import OpenAI from 'openai';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const OPENAI_EMBEDDING_MODEL  = 'text-embedding-3-small';

// Dimensions: Gemini = 3072 | OpenAI = 1536
export const GEMINI_EMBEDDING_DIM = 3072;
export const OPENAI_EMBEDDING_DIM = 1536;

// ── Gemini – Document embedding (optimised for indexing) ──────────────────────
export async function generateDocumentEmbedding(text: string, title?: string): Promise<number[]> {
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
      const req: any = {
        content: { parts: [{ text }], role: 'user' },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      };
      if (title) req.title = title;
      const result = await model.embedContent(req);
      console.log(`[Embeddings] Gemini DOCUMENT embedding gerado (dim=${result.embedding.values.length})`);
      return result.embedding.values;
    } catch (err: any) {
      console.warn('[Embeddings] Gemini falhou, usando OpenAI como fallback:', err.message);
    }
  }
  return generateOpenAIEmbedding(text);
}

// ── Gemini – Query embedding (optimised for search) ───────────────────────────
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
      const result = await model.embedContent({
        content: { parts: [{ text }], role: 'user' },
        taskType: TaskType.RETRIEVAL_QUERY,
      } as any);
      console.log(`[Embeddings] Gemini QUERY embedding gerado (dim=${result.embedding.values.length})`);
      return result.embedding.values;
    } catch (err: any) {
      console.warn('[Embeddings] Gemini falhou, usando OpenAI como fallback:', err.message);
    }
  }
  return generateOpenAIEmbedding(text);
}

// ── OpenAI fallback ────────────────────────────────────────────────────────────
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: text,
  });
  console.log(`[Embeddings] OpenAI embedding gerado (dim=${response.data[0].embedding.length})`);
  return response.data[0].embedding;
}

// ── Backward-compat alias (used by existing callers) ─────────────────────────
export async function generateEmbedding(text: string): Promise<number[]> {
  return generateDocumentEmbedding(text);
}

// ── Similarity ────────────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    // Incompatible dimensions (mixed OpenAI/Gemini docs) — return 0 to skip
    return 0;
  }

  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ── Text chunking ──────────────────────────────────────────────────────────────
export function chunkText(text: string, maxChunkSize: number = 1000): string[] {
  const sentences = text.split(/[.!?]\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? '. ' : '') + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}
