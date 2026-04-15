/**
 * Multi-Model OCR Service — EcoGestor
 *
 * Pipeline de reconhecimento de documentos com cascata:
 *   OCR:     Qwen2.5-VL → GLM-OCR → Gemini File API → Gemini inline
 *   Análise: Qwen2.5-14B → Gemini → DeepSeek → OpenAI
 *
 * Conversão PDF→imagem: pdf2pic + GraphicsMagick (disponível no Replit via Nix)
 *
 * Variáveis de ambiente necessárias:
 *   QWEN_VL_BASE_URL   — ex: http://192.168.1.100:8000/v1
 *   GLM_OCR_BASE_URL   — ex: http://192.168.1.100:8080/v1
 *   TEXT_LLM_BASE_URL  — ex: http://192.168.1.100:8001/v1
 *   QWEN_VL_MODEL      — padrão: Qwen/Qwen2.5-VL-7B-Instruct
 *   GLM_OCR_MODEL      — padrão: zai-org/GLM-OCR
 *   TEXT_LLM_MODEL     — padrão: Qwen/Qwen2.5-14B-Instruct
 */

import OpenAI from 'openai';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

const log  = (msg: string) => console.log(`[MultiModelOCR] ${msg}`);
const warn = (msg: string) => console.warn(`[MultiModelOCR] ${msg}`);

// ── Caminhos do sistema (Replit / Nix) ─────────────────────────────────────

function findBinary(name: string): string | null {
  try {
    return execSync(`which ${name} 2>/dev/null`).toString().trim() || null;
  } catch { return null; }
}

const GM_PATH    = findBinary('gm')        || '/usr/bin/gm';
const PDFTOPPM   = findBinary('pdftoppm')  || '/usr/bin/pdftoppm';
const CONVERT    = findBinary('convert')   || '/usr/bin/convert';

log(`GraphicsMagick: ${GM_PATH}`);
log(`pdftoppm:       ${PDFTOPPM}`);

// ── Helpers de validação de URL ─────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = ['seu-servidor', 'your-server', 'localhost', '127.0.0.1', 'placeholder', 'example'];

function isPlaceholderUrl(url: string | undefined): boolean {
  if (!url) return true;
  return PLACEHOLDER_PATTERNS.some(p => url.toLowerCase().includes(p));
}

function getValidUrl(envKey: string): string | null {
  const url = process.env[envKey];
  if (!url) return null;
  if (isPlaceholderUrl(url)) {
    warn(`${envKey}="${url}" parece ser um URL de exemplo. Configure o IP real do servidor.`);
    return null;
  }
  return url;
}

// ── Clientes OpenAI-compatible ──────────────────────────────────────────────

function getQwenVLClient(): OpenAI | null {
  const baseURL = getValidUrl('QWEN_VL_BASE_URL');
  if (!baseURL) return null;
  return new OpenAI({ baseURL, apiKey: process.env.QWEN_VL_API_KEY || 'vllm', timeout: 180_000 });
}

function getGLMClient(): OpenAI | null {
  const baseURL = getValidUrl('GLM_OCR_BASE_URL');
  if (!baseURL) return null;
  return new OpenAI({ baseURL, apiKey: process.env.GLM_OCR_API_KEY || 'vllm', timeout: 180_000 });
}

function getTextLLMClient(): OpenAI | null {
  const baseURL = getValidUrl('TEXT_LLM_BASE_URL');
  if (!baseURL) return null;
  return new OpenAI({ baseURL, apiKey: process.env.TEXT_LLM_API_KEY || 'vllm', timeout: 300_000 });
}

const QWEN_VL_MODEL  = process.env.QWEN_VL_MODEL  || 'Qwen/Qwen2.5-VL-7B-Instruct';
const GLM_OCR_MODEL  = process.env.GLM_OCR_MODEL  || 'zai-org/GLM-OCR';
const TEXT_LLM_MODEL = process.env.TEXT_LLM_MODEL || 'Qwen/Qwen2.5-14B-Instruct';

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

// ── Conversão PDF → imagens (GraphicsMagick / pdftoppm) ────────────────────

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
    log(`Convertendo PDF → imagens com pdf2pic (GM: ${GM_PATH})...`);

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
        log(`  → Página ${i} convertida (${Math.round(result.base64.length / 1024)}KB)`);
      } catch {
        break;
      }
    }

    if (pages.length === 0) {
      log('pdf2pic GM retornou 0 páginas, tentando pdftoppm direto...');
      for (let i = 0; i < maxPages; i++) {
        const outBase = path.join(tmpDir, `${tmpId}_p${i}`);
        try {
          execSync(`${PDFTOPPM} -r 200 -f ${i + 1} -l ${i + 1} -png "${tmpPdf}" "${outBase}"`, { timeout: 30_000 });
          const outFile = `${outBase}-1.png`;
          if (fs.existsSync(outFile)) {
            const buf = fs.readFileSync(outFile);
            pages.push({ base64: buf.toString('base64'), mimeType: 'image/png', pageNumber: i + 1 });
            fs.unlinkSync(outFile);
            log(`  → Página ${i + 1} via pdftoppm (${Math.round(buf.length / 1024)}KB)`);
          } else {
            break;
          }
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
  const client = getQwenVLClient();
  if (!client) return null;

  log(`OCR com Qwen2.5-VL (${QWEN_VL_MODEL})...`);
  try {
    if (pages.length > 0) {
      const allText: string[] = [];
      for (const page of pages) {
        const resp = await client.chat.completions.create({
          model: QWEN_VL_MODEL,
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

    // Fallback: PDF inline (para servidores que suportam)
    if (pdfBuffer && pdfBuffer.length < 20 * 1024 * 1024) {
      const resp = await client.chat.completions.create({
        model: QWEN_VL_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}` } },
            { type: 'text', text: OCR_PROMPT },
          ] as any,
        }],
        temperature: 0,
        max_tokens: 8192,
      });
      const result = resp.choices[0]?.message?.content?.trim() || '';
      if (result.length > 100) {
        log(`Qwen2.5-VL PDF inline OK — ${result.length} chars`);
        return result;
      }
    }
    return null;
  } catch (err: any) {
    warn(`Qwen2.5-VL falhou: ${err?.message}`);
    return null;
  }
}

// ── OCR com GLM-OCR ──────────────────────────────────────────────────────

async function ocrGLM(pages: PageImage[], pdfBuffer?: Buffer): Promise<string | null> {
  const client = getGLMClient();
  if (!client) return null;

  log(`OCR com GLM-OCR (${GLM_OCR_MODEL})...`);
  try {
    if (pages.length > 0) {
      const allText: string[] = [];
      for (const page of pages) {
        const resp = await client.chat.completions.create({
          model: GLM_OCR_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${page.mimeType};base64,${page.base64}` } },
              { type: 'text', text: 'Transcreva todo o texto visível nesta imagem, exatamente como aparece.' },
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
        log(`GLM-OCR OK — ${result.length} chars (${pages.length} páginas)`);
        return result;
      }
    }

    if (pdfBuffer && pdfBuffer.length < 15 * 1024 * 1024) {
      const resp = await client.chat.completions.create({
        model: GLM_OCR_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}` } },
            { type: 'text', text: OCR_PROMPT },
          ] as any,
        }],
        temperature: 0,
        max_tokens: 8192,
      });
      const result = resp.choices[0]?.message?.content?.trim() || '';
      if (result.length > 100) {
        log(`GLM-OCR PDF inline OK — ${result.length} chars`);
        return result;
      }
    }
    return null;
  } catch (err: any) {
    warn(`GLM-OCR falhou: ${err?.message}`);
    return null;
  }
}

// ── OCR com Gemini ──────────────────────────────────────────────────────────

async function ocrGemini(pdfBuffer: Buffer, filename: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  log('OCR com Gemini File API...');

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
      if (text?.trim().length > 100) {
        log(`Gemini File API OK — ${text.length} chars`);
        return text;
      }
    } catch (e: any) {
      warn(`Gemini File API: ${e?.message}`);
    }

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
          if (text?.trim().length > 100) {
            log(`Gemini inline (${m}) OK — ${text.length} chars`);
            return text;
          }
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
  if (hasVisionModel) {
    pages = await pdfToImages(pdfBuffer, 15);
  }

  // 1) Qwen2.5-VL
  if (getValidUrl('QWEN_VL_BASE_URL')) {
    const text = await ocrQwenVL(pages, pdfBuffer);
    if (text && text.trim().length > 100) {
      return { text, method: 'qwen-vl', pages: pages.length, chars: text.length };
    }
  }

  // 2) GLM-OCR
  if (getValidUrl('GLM_OCR_BASE_URL')) {
    const text = await ocrGLM(pages, pdfBuffer);
    if (text && text.trim().length > 100) {
      return { text, method: 'glm-ocr', pages: pages.length, chars: text.length };
    }
  }

  // 3) Gemini (fallback final)
  const geminiText = await ocrGemini(pdfBuffer, filename);
  if (geminiText && geminiText.trim().length > 100) {
    return { text: geminiText, method: 'gemini-file-api', pages: 0, chars: geminiText.length };
  }

  warn(`Todos os métodos OCR falharam. Usando ${existing.length} chars do pdf-parse.`);
  return { text: existing || '', method: existing.length > 0 ? 'pdf-parse' : 'none', pages: 0, chars: existing.length };
}

// ── Análise estruturada (Text LLM) ──────────────────────────────────────────

export interface TextLLMAnalysisResult {
  raw: string;
  usedModel: string;
}

export async function analyzeWithTextLLM(prompt: string): Promise<TextLLMAnalysisResult | null> {
  const client = getTextLLMClient();
  if (!client) return null;

  log(`Análise com Text LLM (${TEXT_LLM_MODEL})...`);
  try {
    const resp = await client.chat.completions.create({
      model: TEXT_LLM_MODEL,
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
    return { raw, usedModel: TEXT_LLM_MODEL };
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
}

export async function testModelConnectivity(baseUrl: string): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const url = baseUrl.replace(/\/v1\/?$/, '') + '/v1/models';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    if (!resp.ok) return { reachable: false, latencyMs, error: `HTTP ${resp.status}` };
    const data = await resp.json() as any;
    const models = (data?.data || []).map((m: any) => m.id).slice(0, 5);
    return { reachable: true, latencyMs, models };
  } catch (err: any) {
    return { reachable: false, error: err?.message?.slice(0, 100) };
  }
}

// ── Status e diagnóstico ────────────────────────────────────────────────────

export interface ModelStatus {
  model: string;
  configured: boolean;
  isPlaceholder: boolean;
  baseUrl: string | null;
  role: string;
  priority: number;
}

export function getModelStatus(): ModelStatus[] {
  return [
    {
      model: QWEN_VL_MODEL,
      configured: !!getValidUrl('QWEN_VL_BASE_URL'),
      isPlaceholder: isPlaceholderUrl(process.env.QWEN_VL_BASE_URL),
      baseUrl: process.env.QWEN_VL_BASE_URL || null,
      role: 'OCR primário (visão)',
      priority: 1,
    },
    {
      model: GLM_OCR_MODEL,
      configured: !!getValidUrl('GLM_OCR_BASE_URL'),
      isPlaceholder: isPlaceholderUrl(process.env.GLM_OCR_BASE_URL),
      baseUrl: process.env.GLM_OCR_BASE_URL || null,
      role: 'OCR fallback (visão)',
      priority: 2,
    },
    {
      model: TEXT_LLM_MODEL,
      configured: !!getValidUrl('TEXT_LLM_BASE_URL'),
      isPlaceholder: isPlaceholderUrl(process.env.TEXT_LLM_BASE_URL),
      baseUrl: process.env.TEXT_LLM_BASE_URL || null,
      role: 'Análise textual e validação',
      priority: 3,
    },
    {
      model: 'gemini-2.0-flash',
      configured: !!process.env.GEMINI_API_KEY,
      isPlaceholder: false,
      baseUrl: 'https://generativelanguage.googleapis.com',
      role: 'OCR fallback final (Google AI)',
      priority: 4,
    },
  ];
}

export function getSystemInfo() {
  return {
    gmPath: GM_PATH,
    pdftoppmPath: PDFTOPPM,
    convertPath: CONVERT,
    gmAvailable: fs.existsSync(GM_PATH),
    pdftoppmAvailable: fs.existsSync(PDFTOPPM),
  };
}
