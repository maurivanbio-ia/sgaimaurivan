import { db } from "../db";
import { newsletterAssinantes, newsletterEdicoes, newsletterConfig, insertNewsletterAssinanteSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendEmail } from "../emailService";
import cron from "node-cron";
import OpenAI from "openai";
import { ECOBRASIL_LOGO_BASE64, BRASILEIRINHO_BASE64, HIDROELETRICA_BG_BASE64 } from "../constants/logo";

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

  private readonly ENVIRONMENTAL_KEYWORDS = [
    'meio ambiente', 'ambiental', 'sustentabilidade', 'sustentável', 'ecologia', 'ecológico',
    'ibama', 'inema', 'icmbio', 'mma', 'ministério do meio ambiente',
    'licenciamento', 'licença ambiental', 'eia', 'rima', 'estudo de impacto',
    'desmatamento', 'floresta', 'amazônia', 'cerrado', 'mata atlântica', 'pantanal', 'caatinga',
    'biodiversidade', 'fauna', 'flora', 'espécie', 'extinção', 'conservação',
    'poluição', 'emissões', 'carbono', 'gases de efeito estufa', 'aquecimento global', 'clima',
    'mudanças climáticas', 'aquecimento', 'efeito estufa', 'cop',
    'recursos hídricos', 'água', 'rios', 'bacia hidrográfica', 'saneamento',
    'resíduos', 'reciclagem', 'lixo', 'aterro', 'coleta seletiva',
    'energia renovável', 'energia solar', 'energia eólica', 'biomassa', 'hidrelétrica',
    'área de preservação', 'reserva legal', 'unidade de conservação', 'parque nacional',
    'código florestal', 'lei ambiental', 'crime ambiental', 'multa ambiental',
    'recuperação', 'reflorestamento', 'restauração ecológica',
    'impacto ambiental', 'degradação', 'contaminação', 'remediação',
  ];

  private isEnvironmentalNews(title: string, description: string): boolean {
    const text = `${title} ${description}`.toLowerCase();
    return this.ENVIRONMENTAL_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
  }

  async searchEnvironmentalNews(terms: string): Promise<NewsSearchResult[]> {
    const searchTerms = [
      'licenciamento ambiental Brasil',
      'IBAMA fiscalização',
      'meio ambiente legislação Brasil',
      'sustentabilidade ambiental Brasil',
      'desmatamento Amazônia',
    ];
    const allNews: NewsSearchResult[] = [];

    for (const term of searchTerms) {
      try {
        const response = await fetchWithTimeout(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(term)}&language=pt&sortBy=publishedAt&pageSize=10&apiKey=${process.env.NEWS_API_KEY || ""}`,
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

    const filteredNews = allNews
      .filter(n => n.title && n.description)
      .filter(n => this.isEnvironmentalNews(n.title, n.description))
      .filter(n => new Date(n.publishedAt) >= oneWeekAgo)
      .filter((n, i, arr) => arr.findIndex(x => x.url === n.url) === i);

    console.log(`[Newsletter] Notícias totais: ${allNews.length}, Após filtro ambiental: ${filteredNews.length}`);
    
    return filteredNews.slice(0, 15);
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
    
    const cores = ['#1a5d47', '#2d8b6e', '#0d9488', '#0891b2', '#1a5d47'];
    const noticiasHtml = edicao.noticias.map((n, i) => {
      const numero = String(i + 1).padStart(2, '0');
      const corDestaque = cores[i % cores.length];
      const isFirst = i === 0;
      return `
      <tr>
        <td style="padding: ${isFirst ? '0' : '24px'} 0 0 0;">
          ${isFirst ? '' : '<div style="height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent); margin-bottom: 24px;"></div>'}
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- Número Grande à Esquerda -->
              <td width="70" valign="top" style="padding-right: 20px;">
                <div style="width: 56px; height: 56px; background: linear-gradient(135deg, ${corDestaque} 0%, ${corDestaque}dd 100%); border-radius: 16px; text-align: center; line-height: 56px; box-shadow: 0 4px 12px ${corDestaque}40;">
                  <span style="color: #fff; font-size: 22px; font-weight: 800; font-family: 'Georgia', serif;">${numero}</span>
                </div>
              </td>
              <!-- Conteúdo da Notícia -->
              <td valign="top">
                <!-- Fonte/Tag -->
                <table cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                  <tr>
                    <td>
                      <span style="display: inline-block; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); color: #0369a1; padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #bae6fd;">
                        ${n.fonte}
                      </span>
                    </td>
                  </tr>
                </table>
                <!-- Título -->
                <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.4; font-family: 'Georgia', serif;">
                  ${n.titulo}
                </h3>
                <!-- Resumo -->
                <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.75; font-weight: 400;">
                  ${n.resumo}
                </p>
                <!-- Botão Leia Mais -->
                <a href="${n.link}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, ${corDestaque} 0%, ${corDestaque}ee 100%); color: #ffffff; padding: 10px 22px; border-radius: 25px; font-size: 12px; font-weight: 700; text-decoration: none; letter-spacing: 0.5px; text-transform: uppercase; box-shadow: 0 3px 10px ${corDestaque}30;">
                  Ler Matéria Completa →
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 0;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="max-width: 680px; margin: 0 auto;">
          
          <!-- Hero Header Profissional -->
          <tr>
            <td style="background-image: url('${HIDROELETRICA_BG_BASE64}'); background-size: cover; background-position: center;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(160deg, rgba(12,40,32,0.97) 0%, rgba(26,93,71,0.94) 40%, rgba(34,120,90,0.9) 100%);">
                <!-- Barra Superior Elegante -->
                <tr>
                  <td style="height: 5px; background: linear-gradient(90deg, #1a5d47 0%, #2d8b6e 30%, #f5c842 50%, #2d8b6e 70%, #1a5d47 100%);"></td>
                </tr>
                <!-- Top Bar -->
                <tr>
                  <td style="padding: 28px 40px 20px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="display: inline-block; background: linear-gradient(135deg, #f5c842 0%, #fbbf24 100%); color: #1a3d32; padding: 12px 28px; border-radius: 6px; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                            EDIÇÃO ${String(edicao.numero).padStart(3, '0')}
                          </span>
                        </td>
                        <td align="right">
                          <span style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 500; letter-spacing: 1px;">
                            ${mesCapitalizado}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Título Principal -->
                <tr>
                  <td align="center" style="padding: 40px 40px 15px 40px;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase;">NEWSLETTER AMBIENTAL</p>
                    <h1 style="margin: 0; font-size: 52px; font-weight: 300; font-style: italic; color: #f5c842; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 3px;">
                      Notícias ECO
                    </h1>
                  </td>
                </tr>
                <!-- Linha Decorativa -->
                <tr>
                  <td align="center" style="padding: 20px 40px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width: 60px; height: 2px; background: rgba(255,255,255,0.3);"></td>
                        <td style="padding: 0 15px;">
                          <img src="${BRASILEIRINHO_BASE64}" alt="ECO" style="width: 60px; height: auto;" />
                        </td>
                        <td style="width: 60px; height: 2px; background: rgba(255,255,255,0.3);"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Slogan -->
                <tr>
                  <td align="center" style="padding: 5px 40px 35px 40px;">
                    <p style="margin: 0; color: rgba(255,255,255,0.75); font-size: 15px; font-weight: 400; font-style: italic; letter-spacing: 2px;">
                      Soluções Sustentáveis em Ação
                    </p>
                  </td>
                </tr>
                <!-- Barra Inferior -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #1a5d47 0%, #2d8b6e 50%, #1a5d47 100%);"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Introdução com Fundo Decorativo -->
          <tr>
            <td style="background: linear-gradient(180deg, #ffffff 0%, #f8fafb 100%); padding: 48px 48px 40px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <!-- Box com Borda Verde -->
                    <table cellpadding="0" cellspacing="0" style="max-width: 580px; border-left: 4px solid #2d8b6e; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border-radius: 0 12px 12px 0;">
                      <tr>
                        <td style="padding: 28px 32px;">
                          <p style="margin: 0 0 16px 0; color: #2d8b6e; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
                            Editorial da Semana
                          </p>
                          <p style="margin: 0; color: #1e293b; font-size: 16px; line-height: 1.85; font-weight: 400;">
                            ${edicao.introducao}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Resumo da Semana - Design Premium -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #d1fae5 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(45,139,110,0.08);">
                <tr>
                  <td style="padding: 28px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right: 12px;">
                                <div style="width: 4px; height: 40px; background: linear-gradient(180deg, #2d8b6e 0%, #0d9488 100%); border-radius: 2px;"></div>
                              </td>
                              <td>
                                <p style="margin: 0 0 4px 0; color: #0d9488; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">
                                  Panorama Semanal
                                </p>
                                <p style="margin: 0; color: #134e4a; font-size: 20px; font-weight: 700; font-family: 'Georgia', serif;">
                                  Resumo da Semana
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 20px;">
                          <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.8; font-weight: 400;">
                            ${edicao.resumoGeral}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Seção Destaques - Título Elegante -->
          <tr>
            <td style="background: #ffffff; padding: 20px 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px 0; color: #2d8b6e; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px;">
                      Curadoria Ambiental
                    </p>
                    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 28px; font-weight: 700; font-family: 'Georgia', serif; letter-spacing: -0.5px;">
                      Destaques da Semana
                    </h2>
                    <div style="display: inline-block;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 40px; height: 3px; background: #2d8b6e; border-radius: 2px;"></td>
                          <td style="width: 10px;"></td>
                          <td style="width: 8px; height: 3px; background: #f5c842; border-radius: 2px;"></td>
                          <td style="width: 10px;"></td>
                          <td style="width: 40px; height: 3px; background: #2d8b6e; border-radius: 2px;"></td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Lista de Notícias -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${noticiasHtml}
              </table>
            </td>
          </tr>
          
          <!-- CTA Elegante -->
          <tr>
            <td style="background: #f8fafb; padding: 32px 40px 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a5d47 0%, #2d8b6e 50%, #1a5d47 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(26,93,71,0.25);">
                <tr>
                  <td style="padding: 44px 48px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <!-- Logo Brasileirinho -->
                          <img src="${BRASILEIRINHO_BASE64}" alt="EcoBrasil" style="width: 70px; height: auto; margin-bottom: 20px;" />
                          <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 26px; font-weight: 700; font-family: 'Georgia', serif;">
                            EcoGestor
                          </h3>
                          <p style="margin: 0 0 28px 0; color: rgba(255,255,255,0.8); font-size: 15px; font-weight: 400; line-height: 1.7;">
                            Plataforma completa de gestão ambiental.<br/>Licenças, demandas e projetos em um só lugar.
                          </p>
                          <a href="https://ecobrasilgestor.bio/" target="_blank" style="display: inline-block; background: #f5c842; color: #1a3d32; padding: 16px 44px; border-radius: 8px; font-size: 13px; font-weight: 800; text-decoration: none; letter-spacing: 1px; text-transform: uppercase;">
                            Acessar Plataforma
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer Premium -->
          <tr>
            <td style="background: linear-gradient(180deg, #0f172a 0%, #020617 100%); padding: 40px 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- Logo e Slogan -->
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <img src="${ECOBRASIL_LOGO_BASE64}" alt="EcoBrasil" style="height: 36px; width: auto; opacity: 0.9;" />
                    <p style="margin: 12px 0 0 0; color: #64748b; font-size: 12px; font-style: italic; letter-spacing: 1px;">
                      Soluções Sustentáveis em Ação
                    </p>
                  </td>
                </tr>
                <!-- Separador -->
                <tr>
                  <td style="padding: 0 60px 20px;">
                    <div style="height: 1px; background: linear-gradient(90deg, transparent, #334155, transparent);"></div>
                  </td>
                </tr>
                <!-- Unidades -->
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 0 16px;">
                          <span style="color: #2d8b6e; font-size: 14px;">&#9679;</span>
                          <span style="color: #94a3b8; font-size: 12px; font-weight: 500; padding-left: 6px;">Salvador</span>
                        </td>
                        <td style="padding: 0 16px;">
                          <span style="color: #f5c842; font-size: 14px;">&#9679;</span>
                          <span style="color: #94a3b8; font-size: 12px; font-weight: 500; padding-left: 6px;">Goiânia</span>
                        </td>
                        <td style="padding: 0 16px;">
                          <span style="color: #0d9488; font-size: 14px;">&#9679;</span>
                          <span style="color: #94a3b8; font-size: 12px; font-weight: 500; padding-left: 6px;">Luís Eduardo Magalhães</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Copyright -->
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #475569; font-size: 11px; letter-spacing: 0.5px;">
                      © ${new Date().getFullYear()} EcoBrasil Consultoria Ambiental Ltda. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Barra Final Colorida -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #2d8b6e 0%, #0d9488 25%, #f5c842 50%, #0d9488 75%, #2d8b6e 100%);"></td>
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

  async deleteEdicao(id: number) {
    await db.delete(newsletterEdicoes).where(eq(newsletterEdicoes.id, id));
    return { success: true };
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
