import { db } from "../db";
import { newsletterAssinantes, newsletterEdicoes, newsletterConfig, newsletterDestaques, insertNewsletterAssinanteSchema } from "@shared/schema";
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

  generateNewsletterHtml(edicao: { numero: number; titulo: string; introducao: string; resumoGeral: string; noticias: Noticia[] }, destaquesProj: { titulo: string; descricao: string; descricaoMelhorada: string | null; imagemUrl: string | null; link: string | null }[] = []): string {
    const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const mesCapitalizado = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);
    const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    
    // Gerar HTML dos destaques de projetos EcoBrasil
    const destaquesProjetosHtml = destaquesProj.length > 0 ? `
          <!-- DESTAQUES DE PROJETOS ECOBRASIL -->
          <tr>
            <td style="background: #ffffff; padding: 32px 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: linear-gradient(135deg, #f5c842 0%, #d4a82a 100%); color: #1a1a1a; padding: 6px 14px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">
                      Projetos em Destaque
                    </span>
                    <h3 style="margin: 16px 0 8px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
                      O que estamos fazendo
                    </h3>
                    <p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px;">
                      Conheça alguns dos projetos da EcoBrasil em execução
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${destaquesProj.map((projeto, i) => `
          <tr>
            <td style="background: #ffffff; padding: 0 40px ${i === destaquesProj.length - 1 ? '32px' : '16px'} 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; overflow: hidden; border: 1px solid #bbf7d0;">
                <tr>
                  ${projeto.imagemUrl ? `
                  <td width="180" valign="top" style="background: #dcfce7;">
                    <img src="${projeto.imagemUrl}" alt="${projeto.titulo}" style="width: 180px; height: 140px; object-fit: cover; display: block;" />
                  </td>
                  ` : ''}
                  <td valign="top" style="padding: 24px;">
                    <h4 style="margin: 0 0 12px 0; color: #166534; font-size: 17px; font-weight: 700; line-height: 1.3;">
                      ${projeto.titulo}
                    </h4>
                    <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.65;">
                      ${projeto.descricaoMelhorada || projeto.descricao}
                    </p>
                    ${projeto.link ? `
                    <a href="${projeto.link}" target="_blank" style="display: inline-block; background: #166534; color: #ffffff; padding: 10px 20px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
                      Saiba mais
                    </a>
                    ` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `).join('')}
          
          <!-- DIVISOR SUTIL -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, #e2e8f0, transparent);"></div>
            </td>
          </tr>
    ` : '';
    
    // Notícia principal (destaque)
    const noticiaDestaque = edicao.noticias[0];
    const noticiasSecundarias = edicao.noticias.slice(1, 4);
    const noticiasRapidas = edicao.noticias.slice(4);
    
    // Cards de notícias secundárias (3 colunas quando possível)
    const cardsSecundariosHtml = noticiasSecundarias.map((n, i) => `
      <td width="33%" valign="top" style="padding: ${i > 0 ? '0 0 0 16px' : '0'};">
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #1a5d47 0%, #2d8b6e 100%);"></td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <span style="display: inline-block; color: #1a5d47; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
                ${n.fonte}
              </span>
              <h4 style="margin: 0 0 12px 0; color: #0f172a; font-size: 15px; font-weight: 600; line-height: 1.4;">
                ${n.titulo.length > 80 ? n.titulo.substring(0, 80) + '...' : n.titulo}
              </h4>
              <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; line-height: 1.6;">
                ${n.resumo.length > 100 ? n.resumo.substring(0, 100) + '...' : n.resumo}
              </p>
              <a href="${n.link}" target="_blank" style="color: #1a5d47; font-size: 12px; font-weight: 600; text-decoration: none;">
                Ler mais
              </a>
            </td>
          </tr>
        </table>
      </td>
    `).join("");

    // Notas rápidas/insights
    const notasRapidasHtml = noticiasRapidas.map((n, i) => `
      <tr>
        <td style="padding: 16px 0; ${i < noticiasRapidas.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="32" valign="top" style="padding-right: 12px;">
                <div style="width: 28px; height: 28px; background: #f0fdf4; border-radius: 6px; text-align: center; line-height: 28px;">
                  <span style="color: #1a5d47; font-size: 13px; font-weight: 700;">${i + 1}</span>
                </div>
              </td>
              <td valign="top">
                <a href="${n.link}" target="_blank" style="color: #0f172a; font-size: 14px; font-weight: 500; text-decoration: none; line-height: 1.5;">
                  ${n.titulo}
                </a>
                <span style="display: block; color: #94a3b8; font-size: 11px; margin-top: 4px;">${n.fonte}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `).join("");

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${edicao.titulo}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto;">
          
          <!-- CABEÇALHO MODERNO - Estilo Notion/Substack -->
          <tr>
            <td style="background: #ffffff; border-radius: 16px 16px 0 0; overflow: hidden;">
              <!-- Barra de Cor Institucional -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #1a5d47 0%, #2d8b6e 50%, #f5c842 100%);"></td>
                </tr>
              </table>
              
              <!-- Header Principal -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 40px 24px 40px;">
                <tr>
                  <td>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td valign="middle">
                          <img src="${ECOBRASIL_LOGO_BASE64}" alt="EcoBrasil" style="width: 140px; height: auto;" />
                        </td>
                        <td align="right" valign="middle">
                          <span style="display: inline-block; background: linear-gradient(135deg, #1a5d47 0%, #2d8b6e 100%); color: #ffffff; padding: 10px 20px; border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; box-shadow: 0 2px 8px rgba(26,93,71,0.25);">
                            EDIÇÃO ${String(edicao.numero).padStart(3, '0')}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Título e Subtítulo -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 0 40px 32px 40px;">
                <tr>
                  <td>
                    <h1 style="margin: 0 0 8px 0; color: #0f172a; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2;">
                      Newsletter Ambiental
                    </h1>
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 14px; font-weight: 400;">
                      Curadoria semanal de notícias e tendências do setor ambiental brasileiro
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                      ${dataAtual}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- BLOCO EDITORIAL - Estilo Premium -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left: 3px solid #1a5d47; padding-left: 20px;">
                <tr>
                  <td>
                    <span style="display: inline-block; color: #1a5d47; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
                      Editorial da Semana
                    </span>
                    <p style="margin: 0; color: #334155; font-size: 15px; line-height: 1.75; font-weight: 400;">
                      ${edicao.introducao}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- DIVISOR SUTIL -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, #e2e8f0, transparent);"></div>
            </td>
          </tr>
          
          ${destaquesProjetosHtml}
          
          <!-- NOTÍCIA DESTAQUE - Card Principal -->
          ${noticiaDestaque ? `
          <tr>
            <td style="background: #ffffff; padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background: linear-gradient(135deg, #1a5d47 0%, #2d8b6e 100%); color: #ffffff; padding: 6px 14px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 16px;">
                      Destaque
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 28px;">
                          <span style="display: inline-block; color: #0d9488; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                            ${noticiaDestaque.fonte}
                          </span>
                          <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.35;">
                            ${noticiaDestaque.titulo}
                          </h2>
                          <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.7;">
                            ${noticiaDestaque.resumo}
                          </p>
                          <a href="${noticiaDestaque.link}" target="_blank" style="display: inline-block; background: #1a5d47; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
                            Ler matéria completa
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- CARDS SECUNDÁRIOS - Grid Modular -->
          ${noticiasSecundarias.length > 0 ? `
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <span style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
                      Mais Notícias
                    </span>
                  </td>
                </tr>
                <tr>
                  ${cardsSecundariosHtml}
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- RESUMO PANORÂMICO - Box Premium -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="display: inline-block; color: #0d9488; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">
                            Panorama da Semana
                          </span>
                          <p style="margin: 0; color: #134e4a; font-size: 15px; line-height: 1.75; font-weight: 400;">
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
          
          <!-- NOTAS RÁPIDAS - Insights -->
          ${noticiasRapidas.length > 0 ? `
          <tr>
            <td style="background: #ffffff; padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 16px;">
                    <span style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
                      Leitura Rápida
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; border-radius: 12px; padding: 8px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${notasRapidasHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- CTA - ACESSO À PLATAFORMA -->
          <tr>
            <td style="background: #ffffff; padding: 0 40px 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 32px;" align="center">
                    <img src="${BRASILEIRINHO_BASE64}" alt="EcoBrasil" style="width: 56px; height: auto; margin-bottom: 16px;" />
                    <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                      EcoGestor
                    </h3>
                    <p style="margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                      Plataforma completa de gestão ambiental
                    </p>
                    <a href="https://ecobrasilgestor.bio/" target="_blank" style="display: inline-block; background: #f5c842; color: #0f172a; padding: 14px 36px; border-radius: 6px; font-size: 13px; font-weight: 700; text-decoration: none; letter-spacing: 0.5px;">
                      ACESSAR PLATAFORMA
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- RODAPÉ INSTITUCIONAL -->
          <tr>
            <td style="background: #ffffff; border-radius: 0 0 16px 16px; padding: 24px 40px 32px 40px; border-top: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://ecobrasil.bio.br/" target="_blank" style="text-decoration: none;">
                      <img src="${ECOBRASIL_LOGO_BASE64}" alt="EcoBrasil" style="width: 100px; height: auto; margin-bottom: 16px; opacity: 0.8;" />
                    </a>
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; line-height: 1.6;">
                      EcoBrasil Meio Ambiente<br/>
                      Soluções Sustentáveis em Ação
                    </p>
                    <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 11px;">
                      ecobrasil@ecobrasil.bio.br
                    </p>
                    <a href="https://ecobrasil.bio.br/" target="_blank" style="color: #1a5d47; font-size: 11px; font-weight: 600; text-decoration: none;">
                      ecobrasil.bio.br
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- ASSINATURA BRASILEIRINHO -->
          <tr>
            <td style="padding: 28px 40px; background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 50px; height: 2px; background: linear-gradient(90deg, transparent, #2d8b6e);"></td>
                  <td style="padding: 0 20px;">
                    <img src="${BRASILEIRINHO_BASE64}" alt="Brasileirinho" style="width: 40px; height: auto;" />
                  </td>
                  <td style="width: 50px; height: 2px; background: linear-gradient(90deg, #2d8b6e, transparent);"></td>
                </tr>
              </table>
              <p style="margin: 14px 0 0 0; color: #1a5d47; font-size: 11px; font-weight: 600; letter-spacing: 1.5px;">
                Uma publicação EcoBrasil
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
      const aiSummary = await this.generateAISummary(news.slice(0, config.maxNoticias || 12));

      // Buscar destaques de projetos ativos
      const destaquesAtivos = await db.select().from(newsletterDestaques)
        .where(eq(newsletterDestaques.ativo, true))
        .orderBy(newsletterDestaques.ordem);
      console.log(`${destaquesAtivos.length} destaque(s) de projetos ativos`);

      const weekNumber = Math.ceil((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      const titulo = (config.assuntoTemplate || "Newsletter Ambiental EcoBrasil - Semana {{semana}}")
        .replace("{{semana}}", weekNumber.toString());

      const htmlContent = this.generateNewsletterHtml({
        numero: nextNumber,
        titulo,
        introducao: aiSummary.introducao,
        resumoGeral: aiSummary.resumoGeral,
        noticias: aiSummary.noticias,
      }, destaquesAtivos);

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
      
      const aiSummary = await this.generateAISummary(news.slice(0, 12));
      
      // Buscar destaques de projetos ativos
      const destaquesAtivos = await db.select().from(newsletterDestaques)
        .where(eq(newsletterDestaques.ativo, true))
        .orderBy(newsletterDestaques.ordem);
      console.log(`[Newsletter] ${destaquesAtivos.length} destaque(s) de projetos ativos`);
      
      const htmlContent = this.generateNewsletterHtml({
        numero: 0,
        titulo: "Newsletter Ambiental EcoBrasil - TESTE",
        introducao: aiSummary.introducao,
        resumoGeral: aiSummary.resumoGeral,
        noticias: aiSummary.noticias,
      }, destaquesAtivos);

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
