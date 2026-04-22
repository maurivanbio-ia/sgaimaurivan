import OpenAI from "openai";
import { db } from "../db";
import { blogArtigos, blogComentarios, blogReacoes, newsletterDestaques, empreendimentos } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "missing-key" });

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY || "missing-key",
});

// Note: Manus API is task-based (async) and not compatible with OpenAI chat.completions format
// Using DeepSeek as primary and OpenAI as fallback

interface ArtigoInput {
  titulo: string;
  descricao: string;
  tipo: "projeto" | "tecnico" | "comunicado" | "noticia";
  empreendimentoId?: number;
  newsletterDestaqueId?: number;
  imagemCapaUrl?: string;
  autorNome?: string;
  autorId?: number;
}

interface ArtigoGerado {
  titulo: string;
  subtitulo: string;
  resumo: string;
  conteudo: string;
  palavrasChave: string[];
  metaTitulo: string;
  metaDescricao: string;
}

class BlogService {
  private generateSlug(titulo: string): string {
    return titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 80)
      .replace(/^-+|-+$/g, "");
  }

  async generateArticleContent(input: ArtigoInput): Promise<ArtigoGerado> {
    const tipoTexto = {
      projeto: "projeto ambiental",
      tecnico: "artigo técnico sobre meio ambiente",
      comunicado: "comunicado institucional",
      noticia: "notícia ambiental",
    };

    const prompt = `Você é um redator técnico-científico especializado em meio ambiente para a EcoBrasil Consultoria Ambiental. Gere um artigo acadêmico-profissional seguindo o modelo de publicações científicas de alta qualidade.

TIPO DE CONTEÚDO: ${tipoTexto[input.tipo]}

INFORMAÇÕES DO PROJETO/TEMA:
Título: ${input.titulo}
Descrição: ${input.descricao}

ESTRUTURA OBRIGATÓRIA DO ARTIGO:

1. **INTRODUÇÃO**
   - Contextualização do tema
   - Relevância para a gestão ambiental
   - Objetivo do artigo

2. **DESENVOLVIMENTO** (dividido em 3-5 tópicos temáticos com subtítulos <h2>)
   - Cada tópico deve ter:
     - Título descritivo e específico
     - Conteúdo técnico aprofundado (mínimo 2 parágrafos por tópico)
     - Citações de fontes reais (ex: "Segundo a Resolução CONAMA 237/97...", "De acordo com o IBAMA...", "Conforme estabelece a Política Nacional de Meio Ambiente...")
     - Dados estatísticos quando relevantes (ex: dados do IBGE, MMA, INPE)

3. **CONSIDERAÇÕES FINAIS**
   - Síntese dos pontos principais
   - Importância prática para empresas e comunidade
   - Perspectivas futuras

4. **REFERÊNCIAS BIBLIOGRÁFICAS** (mínimo 5 referências reais)
   - Leis e resoluções ambientais brasileiras (CONAMA, IBAMA, etc.)
   - Políticas públicas (PNMA, PNRS, etc.)
   - Órgãos oficiais (MMA, INPE, IBGE, ICMBio)
   - Normas técnicas (ABNT quando aplicável)

CITAÇÕES E FONTES REAIS OBRIGATÓRIAS:
- Use citações de legislação ambiental brasileira real (Lei 6.938/81, Lei 9.605/98, Lei 12.651/12, etc.)
- Cite resoluções CONAMA reais relacionadas ao tema
- Mencione dados de órgãos oficiais como IBAMA, MMA, INPE, IBGE
- Inclua referências a normas ISO (14001, 45001, etc.) quando pertinente

FORMATO DO CONTEÚDO HTML:
- Use <h2> para títulos de seção principais
- Use <h3> para subtítulos dentro das seções
- Use <p> para parágrafos
- Use <ul> e <li> para listas
- Use <blockquote> para citações destacadas
- Para referências, use <div class="referencias"><h3>Referências Bibliográficas</h3><ul><li>...</li></ul></div>

Responda APENAS no formato JSON válido:
{
  "titulo": "título otimizado para SEO (máx 70 caracteres)",
  "subtitulo": "subtítulo complementar técnico (máx 120 caracteres)",
  "resumo": "resumo técnico de 2-3 frases para preview",
  "conteudo": "artigo completo em HTML seguindo a estrutura acima - mínimo 1500 palavras com citações e referências reais",
  "palavrasChave": ["array", "de", "5-8", "palavras-chave", "técnicas"],
  "metaTitulo": "título SEO para meta tag (máx 60 caracteres)",
  "metaDescricao": "descrição SEO técnica para meta tag (máx 155 caracteres)"
}`;

    try {
      let response;
      let providerUsed = "OpenAI";

      // Try DeepSeek first, then OpenAI
      if (process.env.DEEPSEEK_API_KEY) {
        try {
          response = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 3000,
          });
          providerUsed = "DeepSeek";
        } catch (deepseekError: any) {
          console.error("[Blog] DeepSeek error:", deepseekError.message);
          // Fall through to OpenAI
        }
      }

      if (!response) {
        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 3000,
        });
        providerUsed = "OpenAI";
      }

      console.log(`[Blog] Artigo gerado com ${providerUsed}`);

      const content = response.choices[0]?.message?.content || "";
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanContent) as ArtigoGerado;

      return parsed;
    } catch (error: any) {
      console.error("[Blog] Erro ao gerar artigo:", error);
      return {
        titulo: input.titulo,
        subtitulo: `Saiba mais sobre ${input.titulo}`,
        resumo: input.descricao,
        conteudo: `<p>${input.descricao}</p><p>Acompanhe mais informações sobre este projeto em nosso blog.</p>`,
        palavrasChave: ["meio ambiente", "consultoria ambiental", "ecobrasil"],
        metaTitulo: input.titulo.substring(0, 60),
        metaDescricao: input.descricao.substring(0, 155),
      };
    }
  }

  async createArticle(input: ArtigoInput): Promise<{ success: boolean; slug?: string; error?: string }> {
    try {
      const generated = await this.generateArticleContent(input);
      
      let baseSlug = this.generateSlug(generated.titulo);
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const existing = await db.select().from(blogArtigos).where(eq(blogArtigos.slug, slug)).limit(1);
        if (existing.length === 0) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const [artigo] = await db.insert(blogArtigos).values({
        slug,
        titulo: generated.titulo,
        subtitulo: generated.subtitulo,
        resumo: generated.resumo,
        conteudo: generated.conteudo,
        palavrasChave: generated.palavrasChave,
        imagemCapaUrl: input.imagemCapaUrl,
        tipo: input.tipo,
        status: "rascunho",
        autorId: input.autorId,
        autorNome: input.autorNome,
        empreendimentoId: input.empreendimentoId,
        newsletterDestaqueId: input.newsletterDestaqueId,
        metaTitulo: generated.metaTitulo,
        metaDescricao: generated.metaDescricao,
      }).returning();

      console.log(`[Blog] Artigo criado: ${slug}`);
      return { success: true, slug: artigo.slug };
    } catch (error: any) {
      console.error("[Blog] Erro ao criar artigo:", error);
      return { success: false, error: error.message };
    }
  }

  async publishArticle(id: number, createNewsletterDestaque: boolean = true): Promise<{ success: boolean; slug?: string; destaqueId?: number; error?: string }> {
    try {
      const [artigo] = await db.update(blogArtigos)
        .set({
          status: "publicado",
          publicadoEm: new Date(),
          atualizadoEm: new Date(),
        })
        .where(eq(blogArtigos.id, id))
        .returning();

      if (!artigo) {
        return { success: false, error: "Artigo não encontrado" };
      }

      let destaqueId = artigo.newsletterDestaqueId;

      if (artigo.newsletterDestaqueId) {
        await db.update(newsletterDestaques)
          .set({ blogArtigoSlug: artigo.slug })
          .where(eq(newsletterDestaques.id, artigo.newsletterDestaqueId));
        console.log(`[Blog] Link do artigo atualizado no destaque #${artigo.newsletterDestaqueId}`);
      } else if (createNewsletterDestaque) {
        const [novoDestaque] = await db.insert(newsletterDestaques).values({
          titulo: artigo.titulo,
          descricao: artigo.resumo || artigo.subtitulo || "",
          descricaoMelhorada: artigo.resumo || artigo.subtitulo || "",
          imagemUrl: artigo.imagemCapaUrl,
          blogArtigoSlug: artigo.slug,
          empreendimentoId: artigo.empreendimentoId,
          ativo: true,
          ordem: 0,
        }).returning();

        if (novoDestaque) {
          destaqueId = novoDestaque.id;
          await db.update(blogArtigos)
            .set({ newsletterDestaqueId: novoDestaque.id })
            .where(eq(blogArtigos.id, id));
          console.log(`[Blog] Destaque de newsletter criado automaticamente: #${novoDestaque.id}`);
        }
      }

      console.log(`[Blog] Artigo publicado: ${artigo.slug}`);
      return { success: true, slug: artigo.slug, destaqueId: destaqueId ?? undefined };
    } catch (error: any) {
      console.error("[Blog] Erro ao publicar artigo:", error);
      return { success: false, error: error.message };
    }
  }

  async createAndPublish(input: ArtigoInput): Promise<{ success: boolean; slug?: string; url?: string; error?: string }> {
    const createResult = await this.createArticle(input);
    if (!createResult.success || !createResult.slug) {
      return createResult;
    }

    const [artigo] = await db.select().from(blogArtigos).where(eq(blogArtigos.slug, createResult.slug)).limit(1);
    if (!artigo) {
      return { success: false, error: "Artigo não encontrado após criação" };
    }

    const publishResult = await this.publishArticle(artigo.id);
    if (!publishResult.success) {
      return publishResult;
    }

    const url = `/blog/${artigo.slug}`;
    return { success: true, slug: artigo.slug, url };
  }

  async getPublishedArticles(limit = 20, offset = 0) {
    return db.select()
      .from(blogArtigos)
      .where(eq(blogArtigos.status, "publicado"))
      .orderBy(desc(blogArtigos.publicadoEm))
      .limit(limit)
      .offset(offset);
  }

  async getArticleBySlug(slug: string) {
    const [artigo] = await db.select()
      .from(blogArtigos)
      .where(eq(blogArtigos.slug, slug))
      .limit(1);
    
    if (artigo) {
      await db.update(blogArtigos)
        .set({ visualizacoes: (artigo.visualizacoes || 0) + 1 })
        .where(eq(blogArtigos.id, artigo.id));
    }
    
    return artigo;
  }

  async getAllArticles() {
    return db.select()
      .from(blogArtigos)
      .orderBy(desc(blogArtigos.criadoEm));
  }

  async updateArticle(id: number, data: Partial<typeof blogArtigos.$inferInsert>) {
    const [updated] = await db.update(blogArtigos)
      .set({ ...data, atualizadoEm: new Date() })
      .where(eq(blogArtigos.id, id))
      .returning();
    return updated;
  }

  async deleteArticle(id: number) {
    console.log('[Blog] Iniciando exclusão do artigo ID:', id);
    
    // Excluir comentários e reações primeiro (foreign key constraints)
    const deletedComments = await db.delete(blogComentarios).where(eq(blogComentarios.artigoId, id)).returning();
    console.log('[Blog] Comentários excluídos:', deletedComments.length);
    
    const deletedReactions = await db.delete(blogReacoes).where(eq(blogReacoes.artigoId, id)).returning();
    console.log('[Blog] Reações excluídas:', deletedReactions.length);
    
    // Agora excluir o artigo
    const deletedArticle = await db.delete(blogArtigos).where(eq(blogArtigos.id, id)).returning();
    console.log('[Blog] Artigo excluído:', deletedArticle.length > 0 ? 'sim' : 'não encontrado');
    
    if (deletedArticle.length === 0) {
      throw new Error('Artigo não encontrado');
    }
    
    return deletedArticle[0];
  }

  async addComment(artigoId: number, autorNome: string, conteudo: string, autorEmail?: string) {
    const [comment] = await db.insert(blogComentarios).values({
      artigoId,
      autorNome,
      autorEmail,
      conteudo,
      aprovado: false,
    }).returning();
    return comment;
  }

  async getComments(artigoId: number, onlyApproved = true) {
    const condition = onlyApproved 
      ? and(eq(blogComentarios.artigoId, artigoId), eq(blogComentarios.aprovado, true))
      : eq(blogComentarios.artigoId, artigoId);
    
    return db.select()
      .from(blogComentarios)
      .where(condition)
      .orderBy(desc(blogComentarios.criadoEm));
  }

  async getAllPendingComments() {
    return db.select({
      id: blogComentarios.id,
      artigoId: blogComentarios.artigoId,
      autorNome: blogComentarios.autorNome,
      autorEmail: blogComentarios.autorEmail,
      conteudo: blogComentarios.conteudo,
      aprovado: blogComentarios.aprovado,
      criadoEm: blogComentarios.criadoEm,
      artigoTitulo: blogArtigos.titulo,
    })
      .from(blogComentarios)
      .innerJoin(blogArtigos, eq(blogComentarios.artigoId, blogArtigos.id))
      .where(eq(blogComentarios.aprovado, false))
      .orderBy(desc(blogComentarios.criadoEm));
  }

  async approveComment(id: number) {
    const [updated] = await db.update(blogComentarios)
      .set({ aprovado: true })
      .where(eq(blogComentarios.id, id))
      .returning();
    return updated;
  }

  async deleteComment(id: number) {
    await db.delete(blogComentarios).where(eq(blogComentarios.id, id));
  }

  async addReaction(artigoId: number, tipo: string, sessionId?: string) {
    if (sessionId) {
      const existing = await db.select()
        .from(blogReacoes)
        .where(and(
          eq(blogReacoes.artigoId, artigoId),
          eq(blogReacoes.sessionId, sessionId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return { alreadyReacted: true };
      }
    }

    const [reaction] = await db.insert(blogReacoes).values({
      artigoId,
      tipo,
      sessionId,
    }).returning();

    await db.update(blogArtigos)
      .set({ curtidas: sql`${blogArtigos.curtidas} + 1` })
      .where(eq(blogArtigos.id, artigoId));

    return { reaction, alreadyReacted: false };
  }

  async getReactionCount(artigoId: number) {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(blogReacoes)
      .where(eq(blogReacoes.artigoId, artigoId));
    return result?.count || 0;
  }
}

export const blogService = new BlogService();
