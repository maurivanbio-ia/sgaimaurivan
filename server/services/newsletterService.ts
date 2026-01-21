import { db } from "../db";
import { newsletterAssinantes, newsletterEdicoes, newsletterConfig, insertNewsletterAssinanteSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendEmail } from "../emailService";
import cron from "node-cron";
import OpenAI from "openai";
import { ECOBRASIL_LOGO_BASE64, BRASILEIRINHO_BASE64 } from "../constants/logo";

// Usa DeepSeek como provedor principal de IA (compatível com API OpenAI)
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// Fallback para OpenAI/Replit AI se DeepSeek não estiver configurado
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

interface Noticia {
  titulo: string;
  resumo: string;
  link: string;
  fonte: string;
  dataPublicacao: string;
}

interface NewsSearchResult {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
}

class NewsletterService {
  private cronJob: ReturnType<typeof cron.schedule> | null = null;

  async init() {
    await this.ensureDefaultConfig();
    await this.scheduleNewsletter();
    console.log("Newsletter service initialized");
  }

  private async ensureDefaultConfig() {
    const configs = await db.select().from(newsletterConfig).limit(1);
    if (configs.length === 0) {
      await db.insert(newsletterConfig).values({
        ativo: true,
        diaEnvio: 0,
        horarioEnvio: "09:00",
        assuntoTemplate: "Newsletter Ambiental EcoBrasil - Semana {{semana}}",
        termosChave: "meio ambiente, legislação ambiental, licenciamento ambiental, IBAMA, INEMA, sustentabilidade, mudanças climáticas",
        maxNoticias: 10,
        unidade: "salvador",
      });
    }
  }

  async scheduleNewsletter() {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    const [config] = await db.select().from(newsletterConfig).limit(1);
    if (!config?.ativo) {
      console.log("Newsletter desativada");
      return;
    }

    const [hour, minute] = (config.horarioEnvio || "09:00").split(":").map(Number);
    const dayOfWeek = config.diaEnvio ?? 0;

    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`;
    
    this.cronJob = cron.schedule(cronExpression, () => {
      this.generateAndSendNewsletter();
    }, {
      timezone: "America/Sao_Paulo"
    });

    console.log(`Newsletter agendada: ${cronExpression} (Brasília)`);
  }

  async searchEnvironmentalNews(terms: string): Promise<NewsSearchResult[]> {
    const searchTerms = terms.split(",").map(t => t.trim()).slice(0, 3);
    const allNews: NewsSearchResult[] = [];

    for (const term of searchTerms) {
      try {
        const response = await fetchWithTimeout(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(term + " Brasil")}&language=pt&sortBy=publishedAt&pageSize=5&apiKey=${process.env.NEWS_API_KEY || ""}`,
          { headers: { "Accept": "application/json" } },
          15000
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.articles) {
            allNews.push(...data.articles.map((a: any) => ({
              title: a.title,
              description: a.description,
              url: a.url,
              source: a.source?.name || "Fonte desconhecida",
              publishedAt: a.publishedAt,
            })));
          }
        }
      } catch (error) {
        console.error(`Erro ao buscar notícias para "${term}":`, error);
      }
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return allNews
      .filter(n => new Date(n.publishedAt) >= oneWeekAgo)
      .filter((n, i, arr) => arr.findIndex(x => x.url === n.url) === i)
      .slice(0, 15);
  }

  async searchWithGoogleCSE(terms: string): Promise<NewsSearchResult[]> {
    const searchQuery = `${terms} notícias Brasil últimos 7 dias`;
    const results: NewsSearchResult[] = [];
    
    try {
      const cx = process.env.GOOGLE_CSE_ID;
      const apiKey = process.env.GOOGLE_API_KEY;
      
      if (!cx || !apiKey) {
        console.log("Google CSE não configurado, usando busca simulada");
        return this.getSimulatedNews();
      }

      const response = await fetchWithTimeout(
        `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&cx=${cx}&key=${apiKey}&num=10&dateRestrict=w1`,
        {},
        15000
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.items) {
          results.push(...data.items.map((item: any) => ({
            title: item.title,
            description: item.snippet,
            url: item.link,
            source: new URL(item.link).hostname.replace("www.", ""),
            publishedAt: new Date().toISOString(),
          })));
        }
      }
    } catch (error) {
      console.error("Erro na busca Google CSE:", error);
    }
    
    return results;
  }

  private getSimulatedNews(): NewsSearchResult[] {
    const hoje = new Date();
    const fontes = [
      { nome: "Portal G1", url: "https://g1.globo.com/natureza/" },
      { nome: "UOL Sustentabilidade", url: "https://noticias.uol.com.br/meio-ambiente/" },
      { nome: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/geral" },
      { nome: "O Eco", url: "https://oeco.org.br/" },
      { nome: "Instituto Socioambiental", url: "https://www.socioambiental.org/" },
    ];

    const temas = [
      "Legislação ambiental: novas regras para licenciamento",
      "IBAMA intensifica fiscalização em áreas protegidas",
      "Mudanças climáticas: impactos na biodiversidade brasileira",
      "Sustentabilidade corporativa ganha força no mercado",
      "Nova resolução CONAMA sobre gestão de resíduos",
      "Desmatamento na Amazônia: números atualizados",
      "Energia renovável: Brasil bate recorde de investimentos",
      "Recursos hídricos: desafios para gestão sustentável",
    ];

    return temas.slice(0, 6).map((tema, i) => {
      const fonte = fontes[i % fontes.length];
      const data = new Date(hoje);
      data.setDate(data.getDate() - Math.floor(Math.random() * 7));
      
      return {
        title: tema,
        description: `Análise completa sobre ${tema.toLowerCase()}. Especialistas discutem impactos e perspectivas para o setor ambiental brasileiro.`,
        url: fonte.url,
        source: fonte.nome,
        publishedAt: data.toISOString(),
      };
    });
  }

  async generateAISummary(news: NewsSearchResult[]): Promise<{ introducao: string; resumoGeral: string; noticias: Noticia[] }> {
    if (news.length === 0) {
      return {
        introducao: "Esta semana, acompanhamos os principais destaques do cenário ambiental brasileiro.",
        resumoGeral: "Continue acompanhando nossa newsletter para as últimas atualizações sobre meio ambiente e legislação.",
        noticias: [],
      };
    }

    // Gerar resumo simples quando OpenAI não está disponível
    const generateSimpleSummary = () => {
      const temas = news.map(n => n.title.split(':')[0].split('-')[0].trim()).slice(0, 3);
      return {
        introducao: `Esta semana trouxe importantes atualizações no cenário ambiental brasileiro, com destaques para temas como ${temas.join(', ')}.`,
        resumoGeral: `Acompanhe as ${news.length} notícias selecionadas que impactam diretamente o setor de consultoria ambiental, licenciamento e gestão de recursos naturais.`,
        noticias: news.map(n => ({
          titulo: n.title,
          resumo: n.description || `Confira os detalhes desta importante notícia sobre ${n.title.toLowerCase()}.`,
          link: n.url,
          fonte: n.source,
          dataPublicacao: n.publishedAt,
        })),
      };
    };

    const newsContext = news.map((n, i) => 
      `${i + 1}. ${n.title}\nFonte: ${n.source}\nResumo: ${n.description}\nLink: ${n.url}`
    ).join("\n\n");

    try {
      console.log("[Newsletter] Gerando resumo com OpenAI...");
      
      const prompt = `Você é um especialista em meio ambiente e legislação ambiental brasileira, responsável por criar resumos executivos para profissionais do setor ambiental.

Seu tom deve ser:
- Profissional e técnico
- Objetivo e informativo
- Adequado para gestores e técnicos ambientais

Ao resumir notícias:
- Destaque implicações práticas para empresas e consultores ambientais
- Mencione órgãos relevantes (IBAMA, INEMA, ICMBio, CONAMA)
- Aponte impactos em licenciamento e conformidade ambiental

Com base nas seguintes notícias ambientais da última semana, crie:

1. Uma INTRODUÇÃO (2-3 frases) apresentando os destaques da semana de forma envolvente
2. Um RESUMO GERAL (1 parágrafo) com os principais pontos e tendências
3. Para CADA notícia, um resumo de 2-3 frases destacando o que é relevante para profissionais ambientais

Notícias:
${newsContext}

Responda APENAS no formato JSON válido, sem markdown ou texto adicional:
{
  "introducao": "texto da introdução",
  "resumoGeral": "texto do resumo geral",
  "noticias": [
    { "titulo": "título original", "resumo": "seu resumo", "link": "link original", "fonte": "fonte", "dataPublicacao": "data" }
  ]
}`;

      // Tenta DeepSeek primeiro se a chave estiver configurada
      let response;
      let providerUsed = "OpenAI";
      
      if (process.env.DEEPSEEK_API_KEY) {
        console.log("[Newsletter] Tentando gerar resumo com DeepSeek...");
        try {
          response = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 2000,
          });
          providerUsed = "DeepSeek";
        } catch (deepseekError: any) {
          console.error("[Newsletter] Erro com DeepSeek, tentando OpenAI:", deepseekError.message);
          // Fallback para OpenAI
          response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 2000,
          });
        }
      } else {
        console.log("[Newsletter] Gerando resumo com OpenAI...");
        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        });
      }

      const content = response.choices[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log(`[Newsletter] Resumo gerado com sucesso via ${providerUsed}`);
          return {
            introducao: parsed.introducao || "",
            resumoGeral: parsed.resumoGeral || "",
            noticias: parsed.noticias || [],
          };
        }
      }
    } catch (error: any) {
      console.error("[Newsletter] Erro ao gerar resumo com IA, usando fallback:", error.message);
    }

    // Fallback para resumo simples
    return generateSimpleSummary();
  }

  generateNewsletterHtml(edicao: { numero: number; titulo: string; introducao: string; resumoGeral: string; noticias: Noticia[] }): string {
    const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const mesCapitalizado = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);

    const iconesCategorias = ["🌍", "🌱", "🔥", "⚡", "📢", "🏛️", "🌊", "🦜"];
    
    const noticiasHtml = edicao.noticias.map((n, i) => {
      const icone = iconesCategorias[i % iconesCategorias.length];
      return `
      <tr>
        <td style="padding: 0 0 20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%); border-radius: 16px; border: 1px solid #d1fae5; overflow: hidden;">
            <tr>
              <td style="padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50" valign="top">
                      <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; text-align: center; line-height: 44px; font-size: 22px;">
                        ${icone}
                      </div>
                    </td>
                    <td style="padding-left: 12px;">
                      <span style="display: inline-block; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${n.fonte}
                      </span>
                    </td>
                  </tr>
                </table>
                <h3 style="margin: 14px 0 10px 0; color: #065f46; font-size: 17px; font-weight: 700; line-height: 1.4;">
                  ${n.titulo}
                </h3>
                <p style="margin: 0 0 14px 0; color: #374151; font-size: 14px; line-height: 1.65;">
                  ${n.resumo}
                </p>
                <a href="${n.link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 10px 20px; border-radius: 25px; text-decoration: none; font-weight: 600; font-size: 13px; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);">
                  📖 Ler matéria completa
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }).join("");

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${edicao.titulo}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 50%, #ffffff 100%);">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="650" cellpadding="0" cellspacing="0" style="max-width: 650px;">
          
          <!-- Header Principal -->
          <tr>
            <td style="background: linear-gradient(180deg, #3d8b6e 0%, #2d7a5e 30%, #1d6a4e 70%, #0d5a3e 100%); border-radius: 24px 24px 0 0; padding: 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- Top Bar -->
                <tr>
                  <td style="padding: 25px 35px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="display: inline-block; background: #1a1a1a; color: white; padding: 10px 22px; border-radius: 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.5px;">
                            Edição ${String(edicao.numero).padStart(3, '0')}
                          </span>
                        </td>
                        <td align="right">
                          <span style="color: white; font-size: 15px; font-weight: 500;">
                            ${mesCapitalizado}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Logo Central -->
                <tr>
                  <td align="center" style="padding: 40px 30px 25px 30px;">
                    <h1 style="margin: 0; font-size: 56px; font-weight: 800; font-style: italic; color: #f5c842; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 3px;">
                      NOTÍCIAS
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 30px 20px 30px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 52px; font-weight: 800; color: #f5c842; font-family: Arial, sans-serif; letter-spacing: 1px;">EC</span>
                        </td>
                        <td style="vertical-align: middle; padding-left: 3px;">
                          <img src="${BRASILEIRINHO_BASE64}" alt="O" style="width: 65px; height: auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 15px 30px 50px 30px;">
                    <p style="margin: 0; color: #d4e8dc; font-size: 17px; font-weight: 400; font-style: italic; letter-spacing: 1.5px;">
                      Soluções Sustentáveis em Ação
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Brasileirinho Welcome -->
          <tr>
            <td style="background: white; padding: 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="120" valign="top" align="center">
                    <img src="${BRASILEIRINHO_BASE64}" alt="Brasileirinho" style="width: 100px; height: auto;" />
                  </td>
                  <td valign="middle" style="padding-left: 15px;">
                    <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 20px; padding: 18px 22px; position: relative; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
                      <p style="margin: 0; color: #78350f; font-size: 15px; font-weight: 600; line-height: 1.5;">
                        🌟 Olá, sou o <strong>Brasileirinho</strong>!
                      </p>
                      <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        Bem-vindo ao nosso portal de notícias ambientais. Aqui você acompanha as principais novidades do setor ambiental brasileiro!
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Resumo da Semana -->
          <tr>
            <td style="background: white; padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 16px; border: 2px solid #10b981;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="display: inline-block; background: #10b981; color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                            📋 Resumo da Semana
                          </span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 16px 0 0 0; color: #065f46; font-size: 15px; line-height: 1.7; font-weight: 500;">
                      ${edicao.introducao}
                    </p>
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #10b981;">
                      <p style="margin: 0; color: #047857; font-size: 14px; line-height: 1.65;">
                        ${edicao.resumoGeral}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Título Notícias -->
          <tr>
            <td style="background: white; padding: 0 30px 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h2 style="margin: 0; color: #065f46; font-size: 24px; font-weight: 800;">
                      📰 Notícias em Destaque
                    </h2>
                    <div style="margin-top: 8px; height: 4px; width: 60px; background: linear-gradient(90deg, #10b981 0%, #fbbf24 100%); border-radius: 2px;"></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Lista de Notícias -->
          <tr>
            <td style="background: white; padding: 0 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${noticiasHtml}
              </table>
            </td>
          </tr>
          
          <!-- Você Sabia? -->
          <tr>
            <td style="background: white; padding: 20px 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; border: 2px dashed #f59e0b;">
                <tr>
                  <td style="padding: 24px;">
                    <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 18px; font-weight: 700;">
                      💡 Você Sabia?
                    </h3>
                    <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.7;">
                      A EcoBrasil Consultoria Ambiental atua há mais de 15 anos em projetos de licenciamento, monitoramento e conservação da biodiversidade em todo o Brasil. Nosso compromisso é com a sustentabilidade e o desenvolvimento responsável!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA -->
          <tr>
            <td style="background: white; padding: 0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); border-radius: 16px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <p style="margin: 0 0 16px 0; color: white; font-size: 16px; font-weight: 600;">
                      🚀 Acesse o EcoGestor
                    </p>
                    <p style="margin: 0 0 20px 0; color: rgba(255,255,255,0.85); font-size: 14px;">
                      Sistema completo de gestão ambiental
                    </p>
                    <a href="https://ecogestor.ecobrasil.bio.br" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%); color: #78350f; padding: 14px 36px; border-radius: 30px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                      Acessar Plataforma →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #1f2937 0%, #111827 100%); border-radius: 0 0 20px 20px; padding: 30px; text-align: center;">
              <img src="${ECOBRASIL_LOGO_BASE64}" alt="EcoBrasil" style="height: 35px; width: auto; opacity: 0.9; margin-bottom: 16px;" />
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px;">
                © ${new Date().getFullYear()} EcoBrasil Consultoria Ambiental
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 11px; line-height: 1.6;">
                Esta newsletter é enviada semanalmente aos assinantes cadastrados.<br/>
                Salvador • Goiânia • Luís Eduardo Magalhães
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async generateAndSendNewsletter(): Promise<{ success: boolean; message: string }> {
    try {
      console.log("Iniciando geração da newsletter...");

      const [config] = await db.select().from(newsletterConfig).limit(1);
      if (!config?.ativo) {
        return { success: false, message: "Newsletter desativada" };
      }

      const assinantes = await db.select()
        .from(newsletterAssinantes)
        .where(eq(newsletterAssinantes.ativo, true));

      if (assinantes.length === 0) {
        return { success: false, message: "Nenhum assinante ativo" };
      }

      const lastEdition = await db.select()
        .from(newsletterEdicoes)
        .orderBy(desc(newsletterEdicoes.numero))
        .limit(1);
      
      const nextNumber = (lastEdition[0]?.numero || 0) + 1;

      console.log("Buscando notícias ambientais...");
      let news = await this.searchEnvironmentalNews(config.termosChave || "");
      
      if (news.length < 3) {
        console.log("Poucas notícias encontradas via NewsAPI, tentando Google CSE...");
        news = await this.searchWithGoogleCSE(config.termosChave || "meio ambiente legislação Brasil");
      }
      
      if (news.length < 3) {
        console.log("Usando notícias simuladas como fallback");
        news = this.getSimulatedNews();
      }

      console.log(`${news.length} notícias encontradas, gerando resumo com IA...`);
      const aiSummary = await this.generateAISummary(news.slice(0, config.maxNoticias || 10));

      const weekNumber = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const titulo = (config.assuntoTemplate || "Newsletter Ambiental EcoBrasil - Semana {{semana}}")
        .replace("{{semana}}", weekNumber.toString());

      const htmlContent = this.generateNewsletterHtml({
        numero: nextNumber,
        titulo,
        introducao: aiSummary.introducao,
        resumoGeral: aiSummary.resumoGeral,
        noticias: aiSummary.noticias,
      });

      const [edicao] = await db.insert(newsletterEdicoes).values({
        numero: nextNumber,
        titulo,
        introducao: aiSummary.introducao,
        resumoGeral: aiSummary.resumoGeral,
        noticias: aiSummary.noticias,
        htmlContent,
        status: "enviado",
        dataEnvio: new Date(),
        totalDestinatarios: assinantes.length,
      }).returning();

      console.log(`Enviando newsletter para ${assinantes.length} assinantes...`);
      
      let enviados = 0;
      for (const assinante of assinantes) {
        try {
          await sendEmail({
            to: assinante.email,
            subject: titulo,
            text: `${aiSummary.introducao}\n\n${aiSummary.resumoGeral}`,
            html: htmlContent,
          });
          enviados++;
        } catch (error) {
          console.error(`Erro ao enviar para ${assinante.email}:`, error);
        }
      }

      console.log(`Newsletter #${nextNumber} enviada para ${enviados}/${assinantes.length} assinantes`);
      
      return { 
        success: true, 
        message: `Newsletter #${nextNumber} enviada com sucesso para ${enviados} assinantes` 
      };
    } catch (error) {
      console.error("Erro ao gerar/enviar newsletter:", error);
      return { success: false, message: `Erro: ${error}` };
    }
  }

  async getAssinantes() {
    return db.select().from(newsletterAssinantes).orderBy(desc(newsletterAssinantes.criadoEm));
  }

  async addAssinante(email: string, nome?: string, unidade: string = "salvador") {
    const [assinante] = await db.insert(newsletterAssinantes).values({
      email,
      nome,
      unidade,
      ativo: true,
      confirmaAssinatura: true,
    }).returning();
    return assinante;
  }

  async removeAssinante(id: number) {
    await db.delete(newsletterAssinantes).where(eq(newsletterAssinantes.id, id));
  }

  async toggleAssinante(id: number, ativo: boolean) {
    const [updated] = await db.update(newsletterAssinantes)
      .set({ ativo, atualizadoEm: new Date() })
      .where(eq(newsletterAssinantes.id, id))
      .returning();
    return updated;
  }

  async getEdicoes() {
    return db.select().from(newsletterEdicoes).orderBy(desc(newsletterEdicoes.criadoEm));
  }

  async getEdicao(id: number) {
    const [edicao] = await db.select().from(newsletterEdicoes).where(eq(newsletterEdicoes.id, id));
    return edicao;
  }

  async getConfig() {
    const [config] = await db.select().from(newsletterConfig).limit(1);
    return config;
  }

  async updateConfig(data: Partial<typeof newsletterConfig.$inferInsert>) {
    const [config] = await db.select().from(newsletterConfig).limit(1);
    
    if (config) {
      const [updated] = await db.update(newsletterConfig)
        .set({ ...data, atualizadoEm: new Date() })
        .where(eq(newsletterConfig.id, config.id))
        .returning();
      await this.scheduleNewsletter();
      return updated;
    } else {
      const [created] = await db.insert(newsletterConfig).values(data as any).returning();
      await this.scheduleNewsletter();
      return created;
    }
  }

  async sendTestNewsletter(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const [config] = await db.select().from(newsletterConfig).limit(1);
      const termos = config?.termosChave || "meio ambiente, IBAMA, licenciamento ambiental";
      
      console.log(`[Newsletter] Buscando notícias com termos: ${termos}`);
      let news = await this.searchEnvironmentalNews(termos);
      console.log(`[Newsletter] Notícias encontradas via NewsAPI: ${news.length}`);
      
      if (news.length < 3) {
        console.log("[Newsletter] Menos de 3 notícias reais, usando simuladas como complemento");
        news = this.getSimulatedNews();
      } else {
        console.log("[Newsletter] Usando notícias REAIS da NewsAPI");
      }
      
      const aiSummary = await this.generateAISummary(news.slice(0, 5));
      
      const htmlContent = this.generateNewsletterHtml({
        numero: 0,
        titulo: "Newsletter Ambiental EcoBrasil - TESTE",
        introducao: aiSummary.introducao,
        resumoGeral: aiSummary.resumoGeral,
        noticias: aiSummary.noticias,
      });

      await sendEmail({
        to: email,
        subject: "Newsletter Ambiental EcoBrasil - TESTE",
        text: `${aiSummary.introducao}\n\n${aiSummary.resumoGeral}`,
        html: htmlContent,
      });

      return { success: true, message: `Email de teste enviado para ${email}` };
    } catch (error) {
      console.error("Erro ao enviar newsletter de teste:", error);
      return { success: false, message: `Erro: ${error}` };
    }
  }
}

export const newsletterService = new NewsletterService();
