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

  const prompt = `Você é um analista documental sênior especializado em licenciamento ambiental brasileiro e documentação técnica. Analise o documento abaixo e extraia com máxima precisão todas as informações identificáveis.

Nome do arquivo: ${filename}
${hasContent ? `\nCONTEÚDO DO DOCUMENTO:\n${contentPreview!.substring(0, 10000)}` : "\n(Sem conteúdo textual — analise com base no nome do arquivo)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÕES PARA CADA CAMPO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÓRGÃO EMISSOR: Procure em cabeçalhos, brasões, assinaturas e carimbos. Órgãos ambientais brasileiros:
- Federais: IBAMA, ICMBio, ANA, ANEEL, ANM, MMA, FUNAI, IPHAN
- BA: INEMA (Instituto do Meio Ambiente e Recursos Hídricos), SEMA, CEPRAM
- SP: CETESB, SMA; MG: FEAM, SUPRAM; RS: FEPAM; PA: SEMAS; GO: SEMAD; PR: IAT
- SE: ADEMA; ES/MA: IEMA; AM: IPAAM; RO: SEDAM; AL/PI/RN/TO: SEMARH
- Conselhos: CONAMA, CONSEMA; ABNT (normas técnicas)
Escreva o nome completo + sigla. Ex: "Instituto do Meio Ambiente e Recursos Hídricos (INEMA)"

DATA DE EMISSÃO: Busque a data de assinatura/publicação (não de recebimento). Locais comuns: bloco de assinatura ("Salvador, 15 de março de 2024"), campo "Data:", "Emitido em:", rodapé. Converta para YYYY-MM-DD:
- "15/03/2024" → "2024-03-15"
- "15 de março de 2024" → "2024-03-15"
- "março/2024" → "2024-03-01"
- Apenas ano "2024" → "2024-01-01"

NÚMERO DO DOCUMENTO: Reconheça padrões como:
- Licenças: "LP nº 001/2024", "LI 0023/2023-INEMA", "LO 2024.001.000345-2"
- Ofícios: "OFÍCIO nº 1234/2024/INEMA", "OF. 045/GAB/2024"
- Notificações: "NOT-001/2024", "NOTIFICAÇÃO nº 2024001004933"
- Processos SEI: "SEI 0648-0001234/2024-21"
- Pareceres: "PARECER TÉCNICO nº 123/2024"
- Normas: "CONAMA 357/2005", "NBR 10004:2004"

TIPO DE DOCUMENTO: Classifique pelo conteúdo real:
- Licença Ambiental (LP, LI, LO, LAC, LAU, LAS) → "licenca"
- Notificação, Intimação, Auto de Notificação → "notificacao"
- Ofício, Memorando, Despacho → "oficio"
- Relatório Técnico, EIA, RIMA, PCA, RAP, PRAD, RCA → "relatorio"
- Parecer Técnico ou Jurídico → "parecer"
- ART/RRT → "art"
- Mapa, Planta, Croqui → "mapa"
- Lei, Decreto, Resolução, Portaria, IN, Norma ABNT → "documento_legal"
- Auto de Infração, Embargo → "auto_infracao"
- Artigo Científico, Dissertação, Tese → "artigo_cientifico"
- Outro → "outro"

Retorne APENAS JSON válido:

{
  "isArtigoCientifico": boolean,
  "titulo": "título oficial ou null",
  "tipoDocumento": "licenca|notificacao|oficio|relatorio|parecer|art|mapa|documento_legal|auto_infracao|artigo_cientifico|outro",
  "orgaoEmissor": "nome completo (SIGLA) do órgão ou null",
  "numeroDocumento": "número/código principal do documento ou null",
  "dataEmissao": "YYYY-MM-DD ou null",
  "vigencia": "data de vencimento YYYY-MM-DD ou descrição textual ou null",
  "versao": "versão do documento ou null",
  "autores": "SOBRENOME, Nome; SOBRENOME2, Nome2 (só para artigos) ou null",
  "anoPublicacao": "AAAA ou null",
  "periodico": "nome do periódico (só artigos) ou null",
  "doi": "DOI (só artigos) ou null",
  "tema": "um de: ${TEMAS_AMBIENTAIS.join(", ")}",
  "areaAtuacao": "área específica (ex: 'Monitoramento de Fauna', 'Qualidade da Água') ou null",
  "municipioUf": "Município - UF (ex: 'Salvador - BA') ou null",
  "empreendimento": "nome do empreendimento, empresa ou projeto ou null",
  "legislacaoReferenciada": "principais normas citadas separadas por vírgula ou null",
  "condicionantes": "principais condicionantes/exigências resumidas (máx 400 chars) ou null",
  "prazosImportantes": "prazos e periodicidades identificados (máx 250 chars) ou null",
  "palavrasChave": "5-8 palavras-chave separadas por vírgula ou null",
  "resumoAuto": "resumo executivo específico e técnico em 3-5 frases sobre este documento",
  "descricaoGerada": "descrição de 1 frase (máx 150 chars) para uso como título alternativo",
  "citacaoAbnt": "citação ABNT completa (só artigos) ou null",
  "referenciaAbnt": "referência ABNT completa (só artigos) ou null"
}

${hasContent ? "CRÍTICO: Use APENAS informações presentes no texto. Não invente dados. Prefira null a dados incertos." : "Analise com base apenas no nome do arquivo. Todos os dados são inferidos — marque confiança baixa."}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Você é um analista documental sênior com 20 anos de experiência em licenciamento ambiental brasileiro, órgãos ambientais federais e estaduais (IBAMA, ICMBio, INEMA, CETESB, FEAM, etc.), normas ABNT e legislação ambiental. Sua especialidade é extrair com máxima precisão os metadados de documentos oficiais: órgão emissor, número, data de emissão, tipo, condicionantes e prazos. Responda SEMPRE em JSON válido e nunca invente dados." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000
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
