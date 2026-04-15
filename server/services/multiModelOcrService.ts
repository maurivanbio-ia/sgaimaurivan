/**
 * Multi-Model OCR Service — EcoGestor
 *
 * Pipeline de reconhecimento de documentos com cascata:
 *   OCR:     Qwen2.5-VL → GLM-OCR → Gemini File API → Gemini inline
 *   Análise: Qwen2.5-14B → Gemini → DeepSeek → OpenAI
 *
 * Suporta:
 *   - Servidores locais via vLLM (OpenAI-compatible)
 *   - Hugging Face Inference API (serverless)
 *   - Hugging Face Inference Endpoints (dedicados)
 *
 * Variáveis de ambiente:
 *   HUGGINGFACE_API_KEY — token HF (hf_...)
 *   QWEN_VL_BASE_URL    — URL do servidor Qwen2.5-VL
 *   GLM_OCR_BASE_URL    — URL do servidor GLM-OCR
 *   TEXT_LLM_BASE_URL   — URL do servidor Qwen2.5-14B
 *   QWEN_VL_MODEL       — padrão: Qwen/Qwen2.5-VL-7B-Instruct
 *   GLM_OCR_MODEL       — padrão: zai-org/GLM-OCR
 *   TEXT_LLM_MODEL      — padrão: Qwen/Qwen2.5-14B-Instruct
 */

import OpenAI from 'openai';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

const log  = (msg: string) => console.log(`[MultiModelOCR] ${msg}`);
const warn = (msg: string) => console.warn(`[MultiModelOCR] ${msg}`);

// ── Caminhos do sistema ─────────────────────────────────────────────────────

function findBinary(name: string): string | null {
  try { return execSync(`which ${name} 2>/dev/null`).toString().trim() || null; }
  catch { return null; }
}

const GM_PATH  = findBinary('gm')       || '/usr/bin/gm';
const PDFTOPPM = findBinary('pdftoppm') || '/usr/bin/pdftoppm';
const CONVERT  = findBinary('convert')  || '/usr/bin/convert';

// ── Detecção de provedor ────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = ['seu-servidor', 'your-server', 'placeholder', 'example.com'];

// URL padrão correta do HuggingFace Router (OpenAI-compatible)
export const HF_ROUTER_URL = 'https://router.huggingface.co/v1';

function isPlaceholderUrl(url: string | undefined): boolean {
  if (!url) return true;
  return PLACEHOLDER_PATTERNS.some(p => url.toLowerCase().includes(p));
}

function isHuggingFaceUrl(url: string): boolean {
  return url.includes('huggingface.co') || url.includes('hf.co');
}

type Provider = 'huggingface' | 'vllm_local' | 'gemini' | 'unknown';

function detectProvider(url: string): Provider {
  if (isHuggingFaceUrl(url)) return 'huggingface';
  if (url.includes('localhost') || url.includes('127.0.0.1') || /\d+\.\d+\.\d+\.\d+/.test(url)) return 'vllm_local';
  return 'unknown';
}

/**
 * Retorna a API key correta dependendo do provedor:
 * - HuggingFace: usa HUGGINGFACE_API_KEY (token hf_...)
 * - vLLM local: usa 'vllm' (não requer autenticação real)
 * - Customizado: usa a variável específica do modelo se existir
 */
function getApiKey(baseUrl: string, modelApiKeyVar?: string): string {
  if (modelApiKeyVar && process.env[modelApiKeyVar]) return process.env[modelApiKeyVar]!;
  if (isHuggingFaceUrl(baseUrl)) {
    return process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || 'hf_missing';
  }
  return 'vllm'; // vLLM local não requer chave real
}

/**
 * Normaliza a URL para o formato correto.
 *
 * Para HuggingFace: converte api-inference (legado) → router.huggingface.co/v1
 * Para Inference Endpoints dedicados: mantém como está
 * Para vLLM local: adiciona /v1 se necessário
 */
function buildBaseUrl(rawUrl: string): string {
  const clean = rawUrl.replace(/\/+$/, '');

  // Converte api-inference.huggingface.co/models/<model>/v1 → router.huggingface.co/v1
  if (clean.includes('api-inference.huggingface.co/models/')) {
    warn(`URL api-inference legada detectada — migrando automaticamente para router.huggingface.co/v1`);
    return HF_ROUTER_URL;
  }

  // api-inference.huggingface.co/v1 → router.huggingface.co/v1
  if (clean.includes('api-inference.huggingface.co')) {
    warn(`api-inference.huggingface.co não suporta OpenAI-compatible API — migrando para router.huggingface.co/v1`);
    return HF_ROUTER_URL;
  }

  // HF Inference Endpoints dedicados (*.endpoints.huggingface.cloud)
  if (clean.includes('endpoints.huggingface.cloud')) {
    return clean.endsWith('/v1') ? clean : clean + '/v1';
  }

  // HF Router já configurado corretamente
  if (clean.includes('router.huggingface.co')) {
    return clean.endsWith('/v1') ? clean : clean + '/v1';
  }

  // URL genérica (vLLM, etc) — adiciona /v1 se necessário
  if (!clean.endsWith('/v1')) return clean + '/v1';
  return clean;
}

function getValidUrl(envKey: string): string | null {
  const url = process.env[envKey];
  if (!url) return null;
  if (isPlaceholderUrl(url)) {
    warn(`${envKey} contém URL de exemplo. Configure o endereço real do servidor.`);
    return null;
  }
  return url;
}

// ── Clientes OpenAI-compatible ──────────────────────────────────────────────

function makeClient(envKey: string, apiKeyVar?: string): OpenAI | null {
  const rawUrl = getValidUrl(envKey);
  if (!rawUrl) return null;
  const baseURL = buildBaseUrl(rawUrl);
  const apiKey  = getApiKey(rawUrl, apiKeyVar);
  log(`Cliente ${envKey}: ${baseURL} [${detectProvider(rawUrl)}]`);
  return new OpenAI({ baseURL, apiKey, timeout: 180_000, maxRetries: 1 });
}

function getQwenVLClient(): { client: OpenAI; modelName: string } | null {
  const rawUrl = getValidUrl('QWEN_VL_BASE_URL');
  if (!rawUrl) return null;
  const baseURL = buildBaseUrl(rawUrl);
  const apiKey  = getApiKey(rawUrl, 'QWEN_VL_API_KEY');
  const client  = new OpenAI({ baseURL, apiKey, timeout: 180_000, maxRetries: 1 });
  // Extrai o nome do modelo corretamente (mesmo que QWEN_VL_MODEL contenha uma URL por engano)
  const modelName = extractModelFromValue(process.env.QWEN_VL_MODEL, 'Qwen/Qwen2.5-VL-7B-Instruct');
  return { client, modelName };
}

function getGLMClient(): { client: OpenAI; modelName: string } | null {
  const rawUrl = getValidUrl('GLM_OCR_BASE_URL');
  if (!rawUrl) return null;
  const baseURL = buildBaseUrl(rawUrl);
  const apiKey  = getApiKey(rawUrl, 'GLM_OCR_API_KEY');
  const client  = new OpenAI({ baseURL, apiKey, timeout: 180_000, maxRetries: 1 });
  // Extrai o nome do modelo corretamente (mesmo que GLM_OCR_MODEL contenha uma URL por engano)
  const modelName = extractModelFromValue(process.env.GLM_OCR_MODEL, 'zai-org/GLM-OCR');
  return { client, modelName };
}

// Modelos de texto que NÃO estão disponíveis no HF Router free tier
const HF_ROUTER_UNAVAILABLE_MODELS = new Set([
  'Qwen/Qwen2.5-14B-Instruct',
  'Qwen/Qwen2.5-VL-7B-Instruct',
  'Qwen/Qwen2.5-VL-72B-Instruct',
  'zai-org/GLM-OCR',
]);

// Se o nome do env var parece uma URL (começa com http), extrai o modelo do path
function extractModelFromValue(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  if (val.startsWith('http')) {
    // Extrai o nome do modelo da URL: .../models/Qwen/Qwen2.5-14B-Instruct/v1
    const m = val.match(/\/models\/(.+?)(?:\/v1)?$/);
    return m?.[1] || fallback;
  }
  return val;
}

function getTextLLMClient(): { client: OpenAI; modelName: string } | null {
  const rawUrl = getValidUrl('TEXT_LLM_BASE_URL');
  if (!rawUrl) return null;
  const baseURL = buildBaseUrl(rawUrl);
  const apiKey  = getApiKey(rawUrl, 'TEXT_LLM_API_KEY');
  const client  = new OpenAI({ baseURL, apiKey, timeout: 300_000, maxRetries: 1 });

  const isHFRouter = baseURL.includes('router.huggingface.co');

  // Lê o modelo configurado; extrai nome se for uma URL acidentalmente
  const configuredModel = extractModelFromValue(process.env.TEXT_LLM_MODEL, 'Qwen/Qwen2.5-14B-Instruct');

  // Se o modelo configurado não está disponível no HF Router, usa o 72B (disponível no free tier)
  let modelName = configuredModel;
  if (isHFRouter && HF_ROUTER_UNAVAILABLE_MODELS.has(configuredModel)) {
    modelName = 'Qwen/Qwen2.5-72B-Instruct';
    log(`Modelo '${configuredModel}' não disponível no HF Router free tier → usando ${modelName}`);
  }

  return { client, modelName };
}

// ── URLs padrão HuggingFace por modelo ─────────────────────────────────────

/**
 * URL padrão sugerida para cada modelo no HuggingFace Router (free tier).
 * Nota: modelos de visão (VL) e OCR especializado não estão disponíveis no free tier
 * — requerem Inference Endpoints dedicados (*.endpoints.huggingface.cloud).
 */
export function getDefaultHFUrl(modelEnvKey: string): string {
  // Todos os modelos de texto usam o mesmo router URL
  return HF_ROUTER_URL;
}

export function getDefaultHFModel(modelEnvKey: string): string {
  const defaults: Record<string, string> = {
    QWEN_VL_MODEL:  'Qwen/Qwen2.5-VL-7B-Instruct',   // requer endpoint dedicado
    GLM_OCR_MODEL:  'zai-org/GLM-OCR',                 // não é chat model
    TEXT_LLM_MODEL: 'Qwen/Qwen2.5-72B-Instruct',       // disponível no free tier
  };
  return defaults[modelEnvKey] || 'Qwen/Qwen2.5-72B-Instruct';
}

// ── Prompt OCR ──────────────────────────────────────────────────────────────

const OCR_PROMPT = `Você é um sistema de OCR especializado em documentos oficiais brasileiros de licenciamento ambiental. Transcreva TODO o texto visível neste documento página por página, exatamente como aparece.

Inclua obrigatoriamente:
1. Cabeçalho completo — nome do órgão, brasão/timbre, estado/município
2. Número e tipo do documento (ex: NOTIFICAÇÃO Nº 2023001004933, LP nº 001/2024)
3. Número do processo administrativo (SEI, Processo nº, etc.)
4. Destinatário completo — nome, CNPJ/CPF, endereço
5. Corpo do documento — todos os parágrafos, artigos, condicionantes
6. Prazos e datas mencionados
7. Bloco de assinatura — nome, cargo, CREA/CRBio, data
8. Rodapé — código de autenticação, páginas, URL de verificação

Retorne APENAS o texto transcrito, sem comentários adicionais.`;

// ── Conversão PDF → imagens ─────────────────────────────────────────────────

interface PageImage {
  base64: string;
  mimeType: 'image/png' | 'image/jpeg';
  pageNumber: number;
}

async function pdfToImages(pdfBuffer: Buffer, maxPages = 10): Promise<PageImage[]> {
  const tmpDir = os.tmpdir();
  const tmpId  = `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpPdf = path.join(tmpDir, `${tmpId}.pdf`);
  const pages: PageImage[] = [];

  try {
    fs.writeFileSync(tmpPdf, pdfBuffer);
    log(`Convertendo PDF → imagens...`);

    try {
      const { fromPath } = await import('pdf2pic');
      const convert = fromPath(tmpPdf, {
        density: 200,
        saveFilename: tmpId,
        savePath: tmpDir,
        format: 'png',
        width: 2400,
        height: 3200,
        graphicsMagick: true,
      });
      for (let i = 1; i <= maxPages; i++) {
        try {
          const result = await convert(i, { responseType: 'base64' });
          if (!result?.base64) break;
          pages.push({ base64: result.base64, mimeType: 'image/png', pageNumber: i });
          log(`  → p${i}: ${Math.round(result.base64.length / 1024)}KB`);
        } catch { break; }
      }
    } catch (e: any) {
      warn(`pdf2pic falhou (${e?.message}), usando pdftoppm direto...`);
    }

    // Fallback: pdftoppm direto
    if (pages.length === 0 && fs.existsSync(PDFTOPPM)) {
      for (let i = 0; i < maxPages; i++) {
        const outBase = path.join(tmpDir, `${tmpId}_p${i}`);
        try {
          execSync(`"${PDFTOPPM}" -r 200 -f ${i + 1} -l ${i + 1} -png "${tmpPdf}" "${outBase}"`, { timeout: 30_000 });
          const outFile = `${outBase}-1.png`;
          if (fs.existsSync(outFile)) {
            const buf = fs.readFileSync(outFile);
            pages.push({ base64: buf.toString('base64'), mimeType: 'image/png', pageNumber: i + 1 });
            fs.unlinkSync(outFile);
          } else break;
        } catch { break; }
      }
    }

    log(`Total: ${pages.length} página(s) convertida(s)`);
    return pages;
  } catch (err: any) {
    warn(`pdfToImages falhou: ${err?.message}`);
    return [];
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch (_) {}
    try {
      fs.readdirSync(tmpDir)
        .filter(f => f.startsWith(tmpId))
        .forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch (_) {} });
    } catch (_) {}
  }
}

// ── OCR com Qwen2.5-VL ────────────────────────────────────────────────────

async function ocrQwenVL(pages: PageImage[], pdfBuffer?: Buffer): Promise<string | null> {
  const ctx = getQwenVLClient();
  if (!ctx) return null;
  const { client, modelName } = ctx;
  log(`OCR com Qwen2.5-VL (model="${modelName}")...`);
  try {
    if (pages.length > 0) {
      const allText: string[] = [];
      for (const page of pages) {
        const resp = await client.chat.completions.create({
          model: modelName,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${page.mimeType};base64,${page.base64}` } },
              { type: 'text', text: OCR_PROMPT },
            ] as any,
          }],
          temperature: 0,
          max_tokens: 4096,
        });
        const txt = resp.choices[0]?.message?.content?.trim() || '';
        if (txt) allText.push(`--- Página ${page.pageNumber} ---\n${txt}`);
      }
      if (allText.length > 0) {
        const result = allText.join('\n\n');
        log(`Qwen2.5-VL OK — ${result.length} chars (${pages.length} páginas)`);
        return result;
      }
    }
    // Fallback PDF inline
    if (pdfBuffer && pdfBuffer.length < 20 * 1024 * 1024) {
      const resp = await client.chat.completions.create({
        model: modelName,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}` } },
            { type: 'text', text: OCR_PROMPT },
          ] as any,
        }],
        temperature: 0, max_tokens: 8192,
      });
      const result = resp.choices[0]?.message?.content?.trim() || '';
      if (result.length > 100) { log(`Qwen2.5-VL PDF inline OK — ${result.length} chars`); return result; }
    }
    return null;
  } catch (err: any) { warn(`Qwen2.5-VL: ${err?.message}`); return null; }
}

// ── OCR com GLM-OCR ──────────────────────────────────────────────────────

async function ocrGLM(pages: PageImage[], pdfBuffer?: Buffer): Promise<string | null> {
  const ctx = getGLMClient();
  if (!ctx) return null;
  const { client, modelName } = ctx;
  log(`OCR com GLM-OCR (model="${modelName}")...`);
  try {
    if (pages.length > 0) {
      const allText: string[] = [];
      for (const page of pages) {
        const resp = await client.chat.completions.create({
          model: modelName,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${page.mimeType};base64,${page.base64}` } },
              { type: 'text', text: 'Transcreva todo o texto visível nesta imagem exatamente como aparece.' },
            ] as any,
          }],
          temperature: 0, max_tokens: 4096,
        });
        const txt = resp.choices[0]?.message?.content?.trim() || '';
        if (txt) allText.push(`--- Página ${page.pageNumber} ---\n${txt}`);
      }
      if (allText.length > 0) {
        const result = allText.join('\n\n');
        log(`GLM-OCR OK — ${result.length} chars`); return result;
      }
    }
    if (pdfBuffer && pdfBuffer.length < 15 * 1024 * 1024) {
      const resp = await client.chat.completions.create({
        model: modelName,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}` } },
            { type: 'text', text: OCR_PROMPT },
          ] as any,
        }],
        temperature: 0, max_tokens: 8192,
      });
      const result = resp.choices[0]?.message?.content?.trim() || '';
      if (result.length > 100) { log(`GLM-OCR PDF inline OK — ${result.length} chars`); return result; }
    }
    return null;
  } catch (err: any) { warn(`GLM-OCR: ${err?.message}`); return null; }
}

// ── OCR com Gemini ──────────────────────────────────────────────────────────

async function ocrGemini(pdfBuffer: Buffer, filename: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const tmpPath = path.join(os.tmpdir(), `ocr_gem_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, pdfBuffer);
    try {
      const { GoogleAIFileManager } = await import('@google/generative-ai/server');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
      const upload = await fileManager.uploadFile(tmpPath, { mimeType: 'application/pdf', displayName: filename });
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { temperature: 0 } });
      const result = await model.generateContent([
        { fileData: { mimeType: upload.file.mimeType, fileUri: upload.file.uri } },
        { text: OCR_PROMPT },
      ]);
      const text = result.response.text();
      try { await fileManager.deleteFile(upload.file.name); } catch (_) {}
      if (text?.trim().length > 100) { log(`Gemini File API OK — ${text.length} chars`); return text; }
    } catch (e: any) { warn(`Gemini File API: ${e?.message}`); }

    if (pdfBuffer.length < 15 * 1024 * 1024) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      for (const m of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
        try {
          const model = genAI.getGenerativeModel({ model: m, generationConfig: { temperature: 0 } });
          const result = await model.generateContent([
            { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } },
            { text: OCR_PROMPT },
          ]);
          const text = result.response.text();
          if (text?.trim().length > 100) { log(`Gemini inline (${m}) OK — ${text.length} chars`); return text; }
        } catch (e: any) { warn(`Gemini inline (${m}): ${e?.message}`); }
      }
    }
    return null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

// ── Pipeline principal de OCR ────────────────────────────────────────────────

export interface OcrResult {
  text: string;
  method: 'qwen-vl' | 'glm-ocr' | 'gemini-file-api' | 'gemini-inline' | 'pdf-parse' | 'none';
  pages: number;
  chars: number;
}

export async function runMultiModelOcr(
  pdfBuffer: Buffer,
  filename: string,
  pdfParseText: string,
): Promise<OcrResult> {
  const existing = pdfParseText.trim();
  if (existing.length >= 500) {
    return { text: existing, method: 'pdf-parse', pages: 0, chars: existing.length };
  }

  log(`pdf-parse: ${existing.length} chars para "${filename}". Iniciando cascata OCR...`);

  const hasVisionModel = !!(getValidUrl('QWEN_VL_BASE_URL') || getValidUrl('GLM_OCR_BASE_URL'));
  let pages: PageImage[] = [];
  if (hasVisionModel) pages = await pdfToImages(pdfBuffer, 15);

  if (getValidUrl('QWEN_VL_BASE_URL')) {
    const text = await ocrQwenVL(pages, pdfBuffer);
    if (text && text.trim().length > 100) return { text, method: 'qwen-vl', pages: pages.length, chars: text.length };
  }

  if (getValidUrl('GLM_OCR_BASE_URL')) {
    const text = await ocrGLM(pages, pdfBuffer);
    if (text && text.trim().length > 100) return { text, method: 'glm-ocr', pages: pages.length, chars: text.length };
  }

  const geminiText = await ocrGemini(pdfBuffer, filename);
  if (geminiText && geminiText.trim().length > 100) {
    return { text: geminiText, method: 'gemini-file-api', pages: 0, chars: geminiText.length };
  }

  warn(`Todos os métodos OCR falharam. Usando ${existing.length} chars do pdf-parse.`);
  return { text: existing || '', method: existing.length > 0 ? 'pdf-parse' : 'none', pages: 0, chars: existing.length };
}

// ── Análise estruturada (Text LLM) ──────────────────────────────────────────

export interface TextLLMAnalysisResult { raw: string; usedModel: string; }

export async function analyzeWithTextLLM(prompt: string): Promise<TextLLMAnalysisResult | null> {
  const ctx = getTextLLMClient();
  if (!ctx) return null;
  const { client, modelName } = ctx;
  log(`Análise com Text LLM (model="${modelName}")...`);
  try {
    const resp = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: 'Você é um extrator de dados documentais especializado em licenciamento ambiental brasileiro. Responda APENAS com JSON válido, sem markdown.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    });
    const raw = resp.choices[0]?.message?.content?.trim() || '';
    if (!raw) return null;
    log(`Text LLM OK — ${raw.length} chars`);
    return { raw, usedModel: modelName };
  } catch (err: any) {
    warn(`Text LLM falhou: ${err?.message}`);
    return null;
  }
}

// ── Teste de conectividade ───────────────────────────────────────────────────

export interface ConnectivityResult {
  reachable: boolean;
  latencyMs?: number;
  error?: string;
  models?: string[];
  provider?: string;
}

export async function testModelConnectivity(baseUrl: string, modelName?: string): Promise<ConnectivityResult> {
  const start = Date.now();
  const normalizedUrl = buildBaseUrl(baseUrl);
  const provider = detectProvider(normalizedUrl);
  const apiKey = getApiKey(normalizedUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey && apiKey !== 'vllm' ? { Authorization: `Bearer ${apiKey}` } : {}),
  };

  const isHFRouter = normalizedUrl.includes('router.huggingface.co');

  try {
    if (isHFRouter) {
      // HF Router: testa via chat completions (o /models endpoint não é suportado)
      const testModel = modelName || 'Qwen/Qwen2.5-72B-Instruct';
      const chatUrl = normalizedUrl.replace(/\/v1\/?$/, '') + '/v1/chat/completions';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const resp = await fetch(chatUrl, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Responda apenas: OK' }],
          max_tokens: 5,
        }),
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`;
        try { const j = await resp.json() as any; errMsg += ': ' + (j?.error?.message || ''); } catch {}
        return { reachable: false, latencyMs, error: errMsg, provider };
      }
      await resp.json();
      return { reachable: true, latencyMs, models: [testModel], provider };
    } else {
      // vLLM / endpoints dedicados: testa via /models
      const modelsUrl = normalizedUrl.replace(/\/v1\/?$/, '') + '/v1/models';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const resp = await fetch(modelsUrl, { signal: controller.signal, headers });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (!resp.ok) return { reachable: false, latencyMs, error: `HTTP ${resp.status}`, provider };
      const data = await resp.json() as any;
      const models = (data?.data || []).map((m: any) => m.id).slice(0, 5);
      return { reachable: true, latencyMs, models, provider };
    }
  } catch (err: any) {
    return { reachable: false, error: err?.message?.slice(0, 120), provider };
  }
}

// ── Status e diagnóstico ────────────────────────────────────────────────────

export interface ModelStatus {
  model: string;
  effectiveModel?: string;
  configured: boolean;
  isPlaceholder: boolean;
  baseUrl: string | null;
  effectiveUrl?: string;
  role: string;
  priority: number;
  provider: Provider;
  defaultHFUrl?: string;
  note?: string;
}

export function getModelStatus(): ModelStatus[] {
  const hfToken = !!(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN);

  // Determina o modelo efetivo de texto (HF router usa 72B por padrão)
  const textRawUrl   = process.env.TEXT_LLM_BASE_URL || null;
  const textBaseUrl  = textRawUrl ? buildBaseUrl(textRawUrl) : null;
  const isTextHFRouter = textBaseUrl?.includes('router.huggingface.co') || false;
  const textEffModel = process.env.TEXT_LLM_MODEL || (isTextHFRouter ? 'Qwen/Qwen2.5-72B-Instruct' : 'Qwen/Qwen2.5-14B-Instruct');

  return [
    {
      model:         process.env.QWEN_VL_MODEL  || 'Qwen/Qwen2.5-VL-7B-Instruct',
      configured:    !!getValidUrl('QWEN_VL_BASE_URL') && (isHuggingFaceUrl(process.env.QWEN_VL_BASE_URL || '') ? hfToken : true),
      isPlaceholder: isPlaceholderUrl(process.env.QWEN_VL_BASE_URL),
      baseUrl:       process.env.QWEN_VL_BASE_URL || null,
      role:          'OCR primário (visão)',
      priority:      1,
      provider:      detectProvider(process.env.QWEN_VL_BASE_URL || ''),
      defaultHFUrl:  HF_ROUTER_URL,
      note:          'Requer Inference Endpoint dedicado HF (modelo de visão não disponível no free tier)',
    },
    {
      model:         process.env.GLM_OCR_MODEL  || 'zai-org/GLM-OCR',
      configured:    !!getValidUrl('GLM_OCR_BASE_URL') && (isHuggingFaceUrl(process.env.GLM_OCR_BASE_URL || '') ? hfToken : true),
      isPlaceholder: isPlaceholderUrl(process.env.GLM_OCR_BASE_URL),
      baseUrl:       process.env.GLM_OCR_BASE_URL || null,
      role:          'OCR fallback (visão especializada)',
      priority:      2,
      provider:      detectProvider(process.env.GLM_OCR_BASE_URL || ''),
      defaultHFUrl:  HF_ROUTER_URL,
      note:          'Requer Inference Endpoint dedicado HF (modelo de OCR especializado)',
    },
    {
      model:         process.env.TEXT_LLM_MODEL || 'Qwen/Qwen2.5-14B-Instruct',
      effectiveModel: textEffModel,
      configured:    !!getValidUrl('TEXT_LLM_BASE_URL') && (isHuggingFaceUrl(process.env.TEXT_LLM_BASE_URL || '') ? hfToken : true),
      isPlaceholder: isPlaceholderUrl(process.env.TEXT_LLM_BASE_URL),
      baseUrl:       textRawUrl,
      effectiveUrl:  textBaseUrl || undefined,
      role:          'Análise textual e validação',
      priority:      3,
      provider:      detectProvider(textRawUrl || ''),
      defaultHFUrl:  HF_ROUTER_URL,
      note:          isTextHFRouter
        ? `Usando HF Router — modelo efetivo: ${textEffModel} (free tier ✓)`
        : 'Configure TEXT_LLM_BASE_URL=https://router.huggingface.co/v1 para usar HF free tier',
    },
    {
      model:         'gemini-2.0-flash',
      configured:    !!process.env.GEMINI_API_KEY,
      isPlaceholder: false,
      baseUrl:       'https://generativelanguage.googleapis.com',
      role:          'OCR + análise fallback (Google AI)',
      priority:      4,
      provider:      'gemini',
    },
  ];
}

export function getSystemInfo() {
  const hfToken = !!(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN);
  return {
    gmPath:             GM_PATH,
    pdftoppmPath:       PDFTOPPM,
    convertPath:        CONVERT,
    gmAvailable:        fs.existsSync(GM_PATH),
    pdftoppmAvailable:  fs.existsSync(PDFTOPPM),
    huggingfaceToken:   hfToken,
  };
}
