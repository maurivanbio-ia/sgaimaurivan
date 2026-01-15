import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
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
}

const TEMAS_AMBIENTAIS = [
  "fauna",
  "flora",
  "recursos_hidricos",
  "residuos",
  "qualidade_ar",
  "solo",
  "ruido",
  "mudancas_climaticas",
  "biodiversidade",
  "areas_protegidas",
  "licenciamento",
  "monitoramento",
  "educacao_ambiental",
  "legislacao",
  "gestao_ambiental",
  "outro"
];

export async function analyzeDocument(
  filename: string,
  contentPreview?: string
): Promise<DocumentAnalysisResult> {
  const prompt = `Analise o seguinte documento e determine se é um artigo científico.
Se for um artigo científico, extraia as informações bibliográficas e gere a citação e referência no formato ABNT.

Nome do arquivo: ${filename}
${contentPreview ? `Trecho do conteúdo: ${contentPreview.substring(0, 2000)}` : ""}

Responda em JSON com os seguintes campos:
{
  "isArtigoCientifico": boolean (true se for artigo científico, tese, dissertação ou paper acadêmico),
  "titulo": string ou null (título do documento/artigo),
  "autores": string ou null (autores no formato "SOBRENOME, Nome; SOBRENOME2, Nome2"),
  "anoPublicacao": string ou null (ano de publicação, ex: "2023"),
  "periodico": string ou null (nome da revista/periódico se aplicável),
  "doi": string ou null (DOI se identificável),
  "tema": string (um dos seguintes temas: ${TEMAS_AMBIENTAIS.join(", ")}),
  "resumoAuto": string (um resumo de 2-3 frases sobre o documento),
  "citacaoAbnt": string ou null (citação curta ABNT, ex: "SILVA; SANTOS, 2023" ou "SILVA et al., 2023"),
  "referenciaAbnt": string ou null (referência completa ABNT se for artigo científico),
  "tags": string (palavras-chave separadas por vírgula, máximo 5)
}

Se não conseguir identificar alguma informação, use null para esse campo.
Para o tema, escolha o mais apropriado baseado no conteúdo.
Para a referência ABNT, siga rigorosamente as normas:
- Artigo: SOBRENOME, Nome. Título do artigo. Nome da Revista, v. X, n. Y, p. XX-XX, ano.
- Livro: SOBRENOME, Nome. Título: subtítulo. Edição. Cidade: Editora, ano.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em biblioteconomia e documentação científica, especializado em análise de documentos ambientais e normas ABNT."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048
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
      tags: result.tags || undefined
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

export async function analyzeDocumentFromUrl(
  filename: string,
  fileUrl: string
): Promise<DocumentAnalysisResult> {
  // For now, we'll analyze based on filename and basic metadata
  // In the future, this could be extended to download and parse PDFs
  return analyzeDocument(filename);
}
