import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';

// Dimensions: Gemini = 3072
export const GEMINI_EMBEDDING_DIM = 3072;
export const OPENAI_EMBEDDING_DIM = 1536; // kept for compat reference

// ── Gemini – Document embedding (optimised for indexing) ──────────────────────
export async function generateDocumentEmbedding(text: string, title?: string): Promise<number[]> {
  if (!geminiClient) throw new Error('[Embeddings] GEMINI_API_KEY não configurada');

  const model = geminiClient.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
  const req: any = {
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  };
  if (title) req.title = title;
  const result = await model.embedContent(req);
  console.log(`[Embeddings] Gemini DOCUMENT embedding gerado (dim=${result.embedding.values.length})`);
  return result.embedding.values;
}

// ── Gemini – Query embedding (optimised for search) ───────────────────────────
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  if (!geminiClient) throw new Error('[Embeddings] GEMINI_API_KEY não configurada');

  const model = geminiClient.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_QUERY,
  } as any);
  console.log(`[Embeddings] Gemini QUERY embedding gerado (dim=${result.embedding.values.length})`);
  return result.embedding.values;
}

// ── Backward-compat alias ─────────────────────────────────────────────────────
export async function generateEmbedding(text: string): Promise<number[]> {
  return generateDocumentEmbedding(text);
}

// ── Similarity ────────────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0; // incompatível (OpenAI 1536 vs Gemini 3072)

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
