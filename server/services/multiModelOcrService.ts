/**
 * Multi-Model OCR Service — EcoGestor
 *
 * Implementa o pipeline de reconhecimento de documentos com cascata de modelos:
 *   1. Qwen2.5-VL  — OCR primário + classificação (via vLLM, OpenAI-compatible)
 *   2. GLM-OCR     — OCR fallback + extração alternativa (via vLLM)
 *   3. Gemini      — OCR fallback final (File API + inline base64)
 *
 * Para análise estruturada (buildPromptCompleto):
 *   1. Qwen2.5-14B  — extração e validação textual (via vLLM)
 *   2. Gemini / DeepSeek / OpenAI — fallback existente
 *
 * Configuração via variáveis de ambiente:
 *   QWEN_VL_BASE_URL   — ex: http://seu-servidor:8000/v1
 *   GLM_OCR_BASE_URL   — ex: http://seu-servidor:8080/v1
 *   TEXT_LLM_BASE_URL  — ex: http://seu-servidor:8001/v1
 *   QWEN_VL_MODEL      — padrão: Qwen/Qwen2.5-VL-7B-Instruct
 *   GLM_OCR_MODEL      — padrão: zai-org/GLM-OCR
 *   TEXT_LLM_MODEL     — padrão: Qwen/Qwen2.5-14B-Instruct
 */

import OpenAI from 'openai';
import path from 'path';
import os from 'os';
import fs from 'fs';

const log = (msg: string) => console.log(`[MultiModelOCR] ${msg}`);
const warn = (msg: string) => console.warn(`[MultiModelOCR] ${msg}`);

// ── Configuração dos modelos ────────────────────────────────────────────────

function getQwenVLClient(): OpenAI | null {
  const baseURL = process.env.QWEN_VL_BASE_URL;
  if (!baseURL) return null;
  return new OpenAI({ baseURL, apiKey: process.env.QWEN_VL_API_KEY || 'vllm' });
}

function getGLMClient(): OpenAI | null {
  const baseURL = process.env.GLM_OCR_BASE_URL;
  if (!baseURL) return null;
  return new OpenAI({ baseURL, apiKey: process.env.GLM_OCR_API_KEY || 'vllm' });
}

function getTextLLMClient(): OpenAI | null {
  const baseURL = process.env.TEXT_LLM_BASE_URL;
  if (!baseURL) return null;
  return new OpenAI({ baseURL, apiKey: process.env.TEXT_LLM_API_KEY || 'vllm' });
}

const QWEN_VL_MODEL = process.env.QWEN_VL_MODEL || 'Qwen/Qwen2.5-VL-7B-Instruct';
const GLM_OCR_MODEL = process.env.GLM_OCR_MODEL || 'zai-org/GLM-OCR';
const TEXT_LLM_MODEL = process.env.TEXT_LLM_MODEL || 'Qwen/Qwen2.5-14B-Instruct';

// ── Prompt OCR padrão ───────────────────────────────────────────────────────

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
  const tmpPdf = path.join(tmpDir, `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);

  try {
    fs.writeFileSync(tmpPdf, pdfBuffer);
    const { fromPath } = await import('pdf2pic');
    const convert = fromPath(tmpPdf, {
      density: 200,
      saveFilename: `page_${Date.now()}`,
      savePath: tmpDir,
      format: 'png',
      width: 2400,
      height: 3200,
    });

    const pages: PageImage[] = [];
    for (let i = 1; i <= maxPages; i++) {
      try {
        const result = await convert(i, { responseType: 'base64' });
        if (!result || !result.base64) break;
        pages.push({ base64: result.base64, mimeType: 'image/png', pageNumber: i });
        log(`Página ${i} convertida (${result.base64.length} chars base64)`);
      } catch {
        break; // sem mais páginas
      }
    }
    return pages;
  } catch (err: any) {
    warn(`pdf2pic falhou: ${err?.message} — usando fallback de PDF direto`);
    return [];
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch (_) {}
  }
}

// ── OCR com Qwen2.5-VL ────────────────────────────────────────────────────

async function ocrQwenVL(
  pages: PageImage[],
  pdfBuffer?: Buffer,
  filename?: string
): Promise<string | null> {
  const client = getQwenVLClient();
  if (!client) return null;

  log(`Tentando OCR com Qwen2.5-VL (${QWEN_VL_MODEL})...`);

  try {
    // Se temos páginas convertidas, processar cada uma
    if (pages.length > 0) {
      const allText: string[] = [];
      for (const page of pages) {
        const response = await client.chat.completions.create({
          model: QWEN_VL_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${page.mimeType};base64,${page.base64}` },
                },
                { type: 'text', text: OCR_PROMPT },
              ] as any,
            },
          ],
          temperature: 0,
          max_tokens: 4096,
        });
        const pageText = response.choices[0]?.message?.content || '';
        if (pageText.trim()) {
          allText.push(`--- Página ${page.pageNumber} ---\n${pageText.trim()}`);
        }
      }
      if (allText.length > 0) {
        const result = allText.join('\n\n');
        log(`Qwen2.5-VL OCR OK: ${result.length} chars (${pages.length} páginas)`);
        return result;
      }
    }

    // Fallback: enviar PDF como base64 direto (se suportado pelo modelo/servidor)
    if (pdfBuffer && pdfBuffer.length < 20 * 1024 * 1024) {
      const pdfBase64 = pdfBuffer.toString('base64');
      const response = await client.chat.completions.create({
        model: QWEN_VL_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
              { type: 'text', text: OCR_PROMPT },
            ] as any,
          },
        ],
        temperature: 0,
        max_tokens: 8192,
      });
      const result = response.choices[0]?.message?.content || '';
      if (result.trim().length > 100) {
        log(`Qwen2.5-VL PDF direto OK: ${result.length} chars`);
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

async function ocrGLM(
  pages: PageImage[],
  pdfBuffer?: Buffer
): Promise<string | null> {
  const client = getGLMClient();
  if (!client) return null;

  log(`Tentando OCR com GLM-OCR (${GLM_OCR_MODEL})...`);

  try {
    if (pages.length > 0) {
      const allText: string[] = [];
      for (const page of pages) {
        const response = await client.chat.completions.create({
          model: GLM_OCR_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${page.mimeType};base64,${page.base64}` },
                },
                { type: 'text', text: 'Transcreva todo o texto visível nesta imagem, exatamente como aparece.' },
              ] as any,
            },
          ],
          temperature: 0,
          max_tokens: 4096,
        });
        const pageText = response.choices[0]?.message?.content || '';
        if (pageText.trim()) {
          allText.push(`--- Página ${page.pageNumber} ---\n${pageText.trim()}`);
        }
      }
      if (allText.length > 0) {
        const result = allText.join('\n\n');
        log(`GLM-OCR OK: ${result.length} chars (${pages.length} páginas)`);
        return result;
      }
    }

    // Fallback sem conversão de páginas
    if (pdfBuffer && pdfBuffer.length < 15 * 1024 * 1024) {
      const pdfBase64 = pdfBuffer.toString('base64');
      const response = await client.chat.completions.create({
        model: GLM_OCR_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
              { type: 'text', text: OCR_PROMPT },
            ] as any,
          },
        ],
        temperature: 0,
        max_tokens: 8192,
      });
      const result = response.choices[0]?.message?.content || '';
      if (result.trim().length > 100) {
        log(`GLM-OCR PDF direto OK: ${result.length} chars`);
        return result;
      }
    }

    return null;
  } catch (err: any) {
    warn(`GLM-OCR falhou: ${err?.message}`);
    return null;
  }
}

// ── OCR com Gemini (File API + inline) ──────────────────────────────────────

async function ocrGemini(pdfBuffer: Buffer, filename: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  log('Tentando OCR com Gemini File API...');

  const tmpPath = path.join(os.tmpdir(), `ocr_gem_${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmpPath, pdfBuffer);

    // Tentativa 1: File API
    try {
      const { GoogleAIFileManager } = await import('@google/generative-ai/server');
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
      const upload = await fileManager.uploadFile(tmpPath, {
        mimeType: 'application/pdf',
        displayName: filename,
      });
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0 },
      });
      const result = await model.generateContent([
        { fileData: { mimeType: upload.file.mimeType, fileUri: upload.file.uri } },
        { text: OCR_PROMPT },
      ]);
      const text = result.response.text();
      try { await fileManager.deleteFile(upload.file.name); } catch (_) {}
      if (text && text.trim().length > 100) {
        log(`Gemini File API OK: ${text.length} chars`);
        return text;
      }
    } catch (fileApiErr: any) {
      warn(`Gemini File API falhou: ${fileApiErr?.message}`);
    }

    // Tentativa 2: inline base64 (< 15 MB)
    if (pdfBuffer.length < 15 * 1024 * 1024) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0 },
          });
          const result = await model.generateContent([
            { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } },
            { text: OCR_PROMPT },
          ]);
          const text = result.response.text();
          if (text && text.trim().length > 100) {
            log(`Gemini inline (${modelName}) OK: ${text.length} chars`);
            return text;
          }
        } catch (inlineErr: any) {
          warn(`Gemini inline (${modelName}) falhou: ${inlineErr?.message}`);
        }
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

/**
 * Executa a cascata completa de OCR para um PDF.
 * Chamado quando pdf-parse retorna < 500 chars.
 */
export async function runMultiModelOcr(
  pdfBuffer: Buffer,
  filename: string,
  pdfParseText: string
): Promise<OcrResult> {
  const existing = pdfParseText.trim();

  // Se pdf-parse já tem conteúdo suficiente, não precisamos de OCR
  if (existing.length >= 500) {
    return { text: existing, method: 'pdf-parse', pages: 0, chars: existing.length };
  }

  log(`pdf-parse retornou ${existing.length} chars para "${filename}". Iniciando cascata OCR...`);

  // ── Etapa 1: Converter PDF em imagens (beneficia Qwen + GLM) ─────────────
  let pages: PageImage[] = [];
  const hasVisionModel = !!(process.env.QWEN_VL_BASE_URL || process.env.GLM_OCR_BASE_URL);
  if (hasVisionModel) {
    log('Convertendo PDF em imagens para modelos de visão...');
    pages = await pdfToImages(pdfBuffer, 15);
    log(`${pages.length} página(s) convertida(s)`);
  }

  // ── Etapa 2: Qwen2.5-VL (OCR primário) ──────────────────────────────────
  if (process.env.QWEN_VL_BASE_URL) {
    const text = await ocrQwenVL(pages, pdfBuffer, filename);
    if (text && text.trim().length > 100) {
      return { text, method: 'qwen-vl', pages: pages.length, chars: text.length };
    }
  }

  // ── Etapa 3: GLM-OCR (fallback) ──────────────────────────────────────────
  if (process.env.GLM_OCR_BASE_URL) {
    const text = await ocrGLM(pages, pdfBuffer);
    if (text && text.trim().length > 100) {
      return { text, method: 'glm-ocr', pages: pages.length, chars: text.length };
    }
  }

  // ── Etapa 4: Gemini File API (fallback final) ─────────────────────────────
  const geminiText = await ocrGemini(pdfBuffer, filename);
  if (geminiText && geminiText.trim().length > 100) {
    const method = geminiText.length > 100 ? 'gemini-file-api' : 'gemini-inline';
    return { text: geminiText, method, pages: 0, chars: geminiText.length };
  }

  // ── Sem resultado: retorna o que pdf-parse extraiu (pode ser vazio) ───────
  warn(`Todos os métodos OCR falharam para "${filename}". Usando ${existing.length} chars do pdf-parse.`);
  return {
    text: existing || '',
    method: existing.length > 0 ? 'pdf-parse' : 'none',
    pages: 0,
    chars: existing.length,
  };
}

// ── Análise estruturada com Text LLM (Qwen2.5-14B) ──────────────────────────

export interface TextLLMAnalysisResult {
  raw: string;
  usedModel: string;
}

/**
 * Envia o prompt de análise estruturada para o Text LLM configurado (Qwen2.5-14B).
 * Retorna null se TEXT_LLM_BASE_URL não estiver configurado.
 */
export async function analyzeWithTextLLM(prompt: string): Promise<TextLLMAnalysisResult | null> {
  const client = getTextLLMClient();
  if (!client) return null;

  log(`Analisando documento com Text LLM (${TEXT_LLM_MODEL})...`);
  try {
    const response = await client.chat.completions.create({
      model: TEXT_LLM_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Você é um extrator de dados documentais especializado em licenciamento ambiental brasileiro. Responda APENAS com JSON válido, sem markdown, sem texto adicional.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '';
    if (!raw.trim()) return null;
    log(`Text LLM OK: ${raw.length} chars`);
    return { raw, usedModel: TEXT_LLM_MODEL };
  } catch (err: any) {
    warn(`Text LLM (${TEXT_LLM_MODEL}) falhou: ${err?.message}`);
    return null;
  }
}

// ── Status / diagnóstico dos modelos ────────────────────────────────────────

export interface ModelStatus {
  model: string;
  configured: boolean;
  baseUrl: string | null;
  role: string;
}

export function getModelStatus(): ModelStatus[] {
  return [
    {
      model: QWEN_VL_MODEL,
      configured: !!process.env.QWEN_VL_BASE_URL,
      baseUrl: process.env.QWEN_VL_BASE_URL || null,
      role: 'OCR primário (visão)',
    },
    {
      model: GLM_OCR_MODEL,
      configured: !!process.env.GLM_OCR_BASE_URL,
      baseUrl: process.env.GLM_OCR_BASE_URL || null,
      role: 'OCR fallback (visão)',
    },
    {
      model: TEXT_LLM_MODEL,
      configured: !!process.env.TEXT_LLM_BASE_URL,
      baseUrl: process.env.TEXT_LLM_BASE_URL || null,
      role: 'Análise textual e validação',
    },
    {
      model: 'gemini-2.0-flash',
      configured: !!process.env.GEMINI_API_KEY,
      baseUrl: 'https://generativelanguage.googleapis.com',
      role: 'OCR fallback final (Google AI)',
    },
  ];
}
