import OpenAI from "openai";
import fs from "fs";
const pdf = require("pdf-parse");

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const DEFAULT_MODEL_STR = "gpt-5";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedLicenseInfo {
  numero?: string;
  tipo?: string;
  orgaoEmissor?: string;
  dataEmissao?: string;
  validade?: string;
  condicionantes?: Array<{
    descricao: string;
    prazo?: string;
  }>;
  confidence: number;
}

export class PDFAnalysisService {
  
  // Extrai texto do PDF
  async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      console.error("Erro ao extrair texto do PDF:", error);
      throw new Error("Não foi possível extrair texto do PDF");
    }
  }

  // Analisa o texto usando OpenAI para extrair informações estruturadas
  async analyzeLicenseDocument(text: string): Promise<ExtractedLicenseInfo> {
    try {
      const prompt = `
        Analise o seguinte texto de uma licença ambiental brasileira e extraia as informações em formato JSON.
        
        Procure por:
        - Número da licença (pode estar como "Licença nº", "Número:", "LP", "LI", "LO", etc.)
        - Tipo de licença (Licença Prévia, Licença de Instalação, Licença de Operação, etc.)
        - Órgão emissor (IBAMA, INEMA, SEMAM, etc.)
        - Data de emissão
        - Data de validade/vencimento
        - Condicionantes ambientais (obrigações, medidas mitigadoras, monitoramentos)
        
        Retorne apenas um JSON válido neste formato:
        {
          "numero": "string ou null",
          "tipo": "string ou null", 
          "orgaoEmissor": "string ou null",
          "dataEmissao": "YYYY-MM-DD ou null",
          "validade": "YYYY-MM-DD ou null",
          "condicionantes": [
            {
              "descricao": "string",
              "prazo": "YYYY-MM-DD ou null"
            }
          ],
          "confidence": 0.0-1.0
        }
        
        Para as datas, converta para formato YYYY-MM-DD. Se não encontrar uma informação, use null.
        Para confidence, indique sua confiança na extração (0.0 = baixa, 1.0 = alta).
        
        Texto da licença:
        ${text}
      `;

      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL_STR,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em análise de documentos de licenças ambientais brasileiras. Responda apenas com JSON válido, sem texto adicional."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      // Validar e limpar os dados extraídos
      return this.validateAndCleanExtractedData(result);
      
    } catch (error) {
      console.error("Erro ao analisar documento com OpenAI:", error);
      throw new Error("Erro na análise do documento");
    }
  }

  // Valida e limpa os dados extraídos
  private validateAndCleanExtractedData(data: any): ExtractedLicenseInfo {
    const cleaned: ExtractedLicenseInfo = {
      confidence: Math.max(0, Math.min(1, data.confidence || 0))
    };

    // Limpar e validar cada campo
    if (data.numero && typeof data.numero === 'string') {
      cleaned.numero = data.numero.trim();
    }

    if (data.tipo && typeof data.tipo === 'string') {
      cleaned.tipo = data.tipo.trim();
    }

    if (data.orgaoEmissor && typeof data.orgaoEmissor === 'string') {
      cleaned.orgaoEmissor = data.orgaoEmissor.trim();
    }

    // Validar datas
    if (data.dataEmissao && typeof data.dataEmissao === 'string' && this.isValidDate(data.dataEmissao)) {
      cleaned.dataEmissao = data.dataEmissao;
    }

    if (data.validade && typeof data.validade === 'string' && this.isValidDate(data.validade)) {
      cleaned.validade = data.validade;
    }

    // Processar condicionantes
    if (Array.isArray(data.condicionantes)) {
      cleaned.condicionantes = data.condicionantes
        .filter((c: any) => c.descricao && typeof c.descricao === 'string')
        .map((c: any) => ({
          descricao: c.descricao.trim(),
          prazo: c.prazo && this.isValidDate(c.prazo) ? c.prazo : undefined
        }))
        .slice(0, 20); // Limitar a 20 condicionantes
    }

    return cleaned;
  }

  // Valida formato de data YYYY-MM-DD
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // Método principal que combina extração de texto e análise
  async analyzePDFFile(filePath: string): Promise<ExtractedLicenseInfo> {
    try {
      const text = await this.extractTextFromPDF(filePath);
      
      if (!text || text.trim().length < 100) {
        throw new Error("Documento PDF não contém texto suficiente para análise");
      }

      const analysis = await this.analyzeLicenseDocument(text);
      
      console.log("Análise do PDF concluída:", {
        confidence: analysis.confidence,
        hasNumero: !!analysis.numero,
        hasTipo: !!analysis.tipo,
        hasOrgao: !!analysis.orgaoEmissor,
        condicionantesCount: analysis.condicionantes?.length || 0
      });

      return analysis;
      
    } catch (error) {
      console.error("Erro na análise do PDF:", error);
      throw error;
    }
  }
}

export const pdfAnalysisService = new PDFAnalysisService();