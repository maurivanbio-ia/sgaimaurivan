import { db } from '../db';
import { aiDocuments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { generateDocumentEmbedding, generateQueryEmbedding, cosineSimilarity } from './embeddings';

export interface SearchResult {
  id: number;
  content: string;
  source: string;
  sourceType: string;
  similarity: number;
  metadata: any;
  fileUrl?: string;
  module?: string;
  moduleLabel?: string;
  dropboxPath?: string;
  empreendimentoNome?: string;
}

/**
 * Busca documentos similares usando embeddings
 * Usa RETRIEVAL_QUERY para otimizar a busca semântica.
 * Documentos indexados com dimensão diferente da query são automaticamente ignorados.
 * MULTI-TENANCY: Filtra documentos apenas da unidade especificada
 */
export async function searchSimilarDocuments(
  unidade: string,
  query: string,
  limit: number = 5,
  empreendimentoId?: number
): Promise<SearchResult[]> {
  try {
    // RETRIEVAL_QUERY — embedding optimizado para a pergunta do usuário
    const queryEmbedding = await generateQueryEmbedding(query);

    const whereConditions = [eq(aiDocuments.unidade, unidade)];
    if (empreendimentoId) {
      whereConditions.push(eq(aiDocuments.empreendimentoId, empreendimentoId));
    }

    const documents = await db.select()
      .from(aiDocuments)
      .where(and(...whereConditions))
      .execute();

    const results: SearchResult[] = documents
      .filter(doc => doc.embedding)
      .map(doc => {
        const docEmbedding: number[] = JSON.parse(doc.embedding!);
        // cosineSimilarity retorna 0 quando dimensões divergem (OpenAI vs Gemini)
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
        const meta = (doc.metadata as any) || {};

        return {
          id: doc.id,
          content: doc.content,
          source: doc.source,
          sourceType: doc.sourceType,
          similarity,
          metadata: meta,
          fileUrl: meta.fileUrl || null,
          module: meta.module || null,
          moduleLabel: meta.moduleLabel || null,
          dropboxPath: meta.dropboxPath || null,
          empreendimentoNome: meta.empreendimentoNome || null,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  } catch (error) {
    console.error('Error searching documents:', error);
    throw new Error('Falha ao buscar documentos similares');
  }
}

/**
 * Indexa um documento no banco de dados
 * Usa RETRIEVAL_DOCUMENT para gerar embeddings otimizados para armazenamento.
 * MULTI-TENANCY: Documento indexado com unidade obrigatória
 */
export async function indexDocument(
  unidade: string,
  content: string,
  source: string,
  sourceType: string,
  empreendimentoId?: number,
  metadata: any = {}
): Promise<number> {
  try {
    // RETRIEVAL_DOCUMENT — embedding otimizado para o conteúdo do documento
    const embedding = await generateDocumentEmbedding(content, source);

    const [inserted] = await db.insert(aiDocuments).values({
      unidade,
      empreendimentoId,
      source,
      sourceType,
      content,
      embedding: JSON.stringify(embedding),
      metadata,
    }).returning({ id: aiDocuments.id });

    console.log(`[RAG] Documento indexado com Gemini (${unidade}): "${source}" [id=${inserted.id}, dim=${embedding.length}]`);
    return inserted.id;
  } catch (error) {
    console.error('Error indexing document:', error);
    throw new Error('Falha ao indexar documento');
  }
}

/**
 * Remove um documento indexado pelo ID
 */
export async function removeIndexedDocument(id: number): Promise<void> {
  await db.delete(aiDocuments).where(eq(aiDocuments.id, id));
}

/**
 * Lista todos os documentos indexados de uma unidade
 */
export async function listIndexedDocuments(unidade: string, empreendimentoId?: number) {
  const conditions = [eq(aiDocuments.unidade, unidade)];
  if (empreendimentoId) conditions.push(eq(aiDocuments.empreendimentoId, empreendimentoId));

  return db.select({
    id: aiDocuments.id,
    source: aiDocuments.source,
    sourceType: aiDocuments.sourceType,
    metadata: aiDocuments.metadata,
    criadoEm: aiDocuments.criadoEm,
  })
  .from(aiDocuments)
  .where(and(...conditions))
  .orderBy(aiDocuments.criadoEm);
}
