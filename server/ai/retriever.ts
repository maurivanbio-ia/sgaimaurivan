import { db } from '../db';
import { aiDocuments } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateEmbedding, cosineSimilarity } from './embeddings';

export interface SearchResult {
  id: number;
  content: string;
  source: string;
  sourceType: string;
  similarity: number;
  metadata: any;
}

/**
 * Busca documentos similares usando embeddings
 * MULTI-TENANCY: Filtra documentos apenas da unidade especificada
 */
export async function searchSimilarDocuments(
  unidade: string,
  query: string,
  limit: number = 5,
  empreendimentoId?: number
): Promise<SearchResult[]> {
  try {
    // Gera embedding da query
    const queryEmbedding = await generateEmbedding(query);
    
    // Busca documentos filtrados por unidade (OBRIGATÓRIO)
    const whereConditions = [eq(aiDocuments.unidade, unidade)];
    
    if (empreendimentoId) {
      whereConditions.push(eq(aiDocuments.empreendimentoId, empreendimentoId));
    }
    
    const documents = await db.select()
      .from(aiDocuments)
      .where(and(...whereConditions))
      .execute();
    
    // Calcula similaridade para cada documento
    const results: SearchResult[] = documents
      .filter(doc => doc.embedding)
      .map(doc => {
        const docEmbedding = JSON.parse(doc.embedding!);
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
        
        return {
          id: doc.id,
          content: doc.content,
          source: doc.source,
          sourceType: doc.sourceType,
          similarity,
          metadata: doc.metadata as any,
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
 * MULTI-TENANCY: Documenta indexado com unidade obrigatória
 */
export async function indexDocument(
  unidade: string,
  content: string,
  source: string,
  sourceType: string,
  empreendimentoId?: number,
  metadata: any = {}
): Promise<void> {
  try {
    // Gera embedding do conteúdo
    const embedding = await generateEmbedding(content);
    
    // Salva no banco com unidade (ISOLAMENTO DE DADOS)
    await db.insert(aiDocuments).values({
      unidade,
      empreendimentoId,
      source,
      sourceType,
      content,
      embedding: JSON.stringify(embedding),
      metadata,
    });
    
    console.log(`Documento indexado (${unidade}): ${source}`);
  } catch (error) {
    console.error('Error indexing document:', error);
    throw new Error('Falha ao indexar documento');
  }
}
