import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DocumentAnalysisResult {
  isArtigoCientifico: boolean;
  titulo?: string;
  autores?: string;
  anoPublicacao?: string;
  periodico?: string;
  doi?: string;
  tema?: string;
  resumoAuto?: string;
  citacaoAbnt?: string;
  referenciaAbnt?: string;
  tags?: string;
  orgaoEmissor?: string;
  numeroDocumento?: string;
  dataEmissao?: string;
  vigencia?: string;
  versao?: string;
  tipoDocumento?: string;
  legislacaoReferenciada?: string;
  condicionantes?: string;
  prazosImportantes?: string;
  areaAtuacao?: string;
  municipioUf?: string;
  empreendimento?: string;
  palavrasChave?: string;
  descricaoGerada?: string;
}

const TEMAS_AMBIENTAIS = [
  "fauna","flora","recursos_hidricos","residuos","qualidade_ar","solo","ruido",
  "mudancas_climaticas","biodiversidade","areas_protegidas","licenciamento",
  "monitoramento","educacao_ambiental","legislacao","gestao_ambiental","outro"
];

export async function analyzeDocument(
  filename: string,
  contentPreview?: string
): Promise<DocumentAnalysisResult> {
  const hasContent = contentPreview && contentPreview.trim().length > 50;

  const prompt = `Você é um especialista em documentação técnica ambiental, normas ABNT e legislação brasileira. Analise o documento abaixo e extraia TODAS as informações importantes que conseguir identificar.

Nome do arquivo: ${filename}
${hasContent ? `\nConteúdo do documento:\n${contentPreview!.substring(0, 8000)}` : "\n(Sem conteúdo textual disponível — analise com base no nome do arquivo)"}

Extraia o máximo de variáveis possível e responda em JSON com a estrutura abaixo. Use null para campos não identificáveis. Nunca invente informações:

{
  "isArtigoCientifico": boolean,
  "titulo": string ou null,
  "tipoDocumento": string ou null (ex: "Licença Ambiental", "Norma Técnica", "Guia Metodológico", "EIA", "RIMA", "PCA", "RAP", "Plano de Monitoramento", "Artigo Científico", "Manual Técnico", "Instrução Normativa", "Resolução", "Guia Técnico"),
  "orgaoEmissor": string ou null (ex: "IBAMA", "INEMA", "SEMA", "CETESB", "CONAMA", "ABNT", nome da universidade, empresa),
  "numeroDocumento": string ou null (número da norma/licença/resolução, ex: "CONAMA 357/2005", "NBR 10004"),
  "dataEmissao": string ou null (data de emissão ou publicação, formato DD/MM/AAAA ou AAAA),
  "vigencia": string ou null (prazo de validade, ex: "31/12/2027", "3 anos"),
  "versao": string ou null (versão do documento),
  "autores": string ou null (para artigos: "SOBRENOME, Nome; SOBRENOME2, Nome2"),
  "anoPublicacao": string ou null,
  "periodico": string ou null,
  "doi": string ou null,
  "tema": string (um de: ${TEMAS_AMBIENTAIS.join(", ")}),
  "areaAtuacao": string ou null (ex: "Licenciamento Ambiental", "SST", "Gestão de Resíduos", "Qualidade da Água", "Monitoramento de Fauna"),
  "municipioUf": string ou null,
  "empreendimento": string ou null,
  "legislacaoReferenciada": string ou null (principais leis e resoluções referenciadas),
  "condicionantes": string ou null (condicionantes ou requisitos principais, máx 300 chars),
  "prazosImportantes": string ou null (prazos e periodicidades, máx 200 chars),
  "palavrasChave": string ou null (5-8 palavras-chave separadas por vírgula),
  "resumoAuto": string (resumo executivo de 3-5 frases — seja específico ao conteúdo real),
  "descricaoGerada": string (descrição curta de 1 frase, máx 150 chars),
  "citacaoAbnt": string ou null (apenas se artigo científico),
  "referenciaAbnt": string ou null (apenas se artigo científico)
}

${hasContent ? "IMPORTANTE: Use o conteúdo fornecido para extrair informações reais. Não invente dados." : "IMPORTANTE: Analise com base apenas no nome do arquivo."}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um especialista em biblioteconomia, documentação técnica ambiental e normas ABNT. Extrai informações de documentos com precisão. Responda sempre em JSON válido." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      isArtigoCientifico: result.isArtigoCientifico || false,
      titulo: result.titulo || undefined,
      autores: result.autores || undefined,
      anoPublicacao: result.anoPublicacao || undefined,
      periodico: result.periodico || undefined,
      doi: result.doi || undefined,
      tema: result.tema || "outro",
      resumoAuto: result.resumoAuto || undefined,
      citacaoAbnt: result.citacaoAbnt || undefined,
      referenciaAbnt: result.referenciaAbnt || undefined,
      tags: result.palavrasChave || result.tags || undefined,
      orgaoEmissor: result.orgaoEmissor || undefined,
      numeroDocumento: result.numeroDocumento || undefined,
      dataEmissao: result.dataEmissao || undefined,
      vigencia: result.vigencia || undefined,
      versao: result.versao || undefined,
      tipoDocumento: result.tipoDocumento || undefined,
      legislacaoReferenciada: result.legislacaoReferenciada || undefined,
      condicionantes: result.condicionantes || undefined,
      prazosImportantes: result.prazosImportantes || undefined,
      areaAtuacao: result.areaAtuacao || undefined,
      municipioUf: result.municipioUf || undefined,
      empreendimento: result.empreendimento || undefined,
      palavrasChave: result.palavrasChave || undefined,
      descricaoGerada: result.descricaoGerada || undefined,
    };
  } catch (error) {
    console.error("[DocumentAnalysis] Error analyzing document:", error);
    return {
      isArtigoCientifico: false,
      tema: "outro",
      resumoAuto: "Não foi possível analisar o documento automaticamente."
    };
  }
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
    if (mimeType === "application/pdf" || mimeType.includes("pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      return data.text || "";
    }
    if (mimeType.startsWith("text/")) {
      return buffer.toString("utf-8");
    }
    return "";
  } catch (error) {
    console.error("[DocumentAnalysis] Error extracting text:", error);
    return "";
  }
}
