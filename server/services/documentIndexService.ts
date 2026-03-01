/**
 * Document Auto-Indexing Service for EcoGestor-AI RAG
 * Automatically indexes documents when uploaded to the platform
 */
import { indexDocument } from '../ai/retriever';

export interface DocumentIndexParams {
  unidade: string;
  fileName: string;
  fileBuffer?: Buffer;
  fileUrl?: string;
  fileType: string;
  module: string;
  empreendimentoId?: number;
  empreendimentoNome?: string;
  extraInfo?: Record<string, any>;
}

const MODULE_LABELS: Record<string, string> = {
  licenca: 'Licença Ambiental',
  condicionante: 'Condicionante',
  evidencia: 'Evidência / Documento de Comprovação',
  relatorio: 'Relatório Técnico',
  minuta: 'Minuta de Documento',
  mapa: 'Mapa Geoespacial',
  shapefile: 'Shapefile / Dado Geoespacial',
  camada: 'Camada KMZ/KML',
  contrato: 'Contrato',
  aditivo: 'Aditivo Contratual',
  banco_de_dados: 'Banco de Dados',
  campo: 'Dados de Campo',
  oficio: 'Ofício',
  comunicacao: 'Comunicação',
  protocolo: 'Protocolo',
  entrega: 'Entrega / Protocolo',
  monitoramento: 'Monitoramento Ambiental',
  amostra: 'Amostra de Monitoramento',
  documento: 'Documento',
  base_conhecimento: 'Base de Conhecimento',
  proposta: 'Proposta Comercial',
  rh: 'Recurso Humano',
  financeiro: 'Documento Financeiro',
  ata: 'Ata de Reunião',
  parecer: 'Parecer Técnico',
  autorizacao: 'Autorização Ambiental',
  plano: 'Plano de Trabalho',
  recibo: 'Recibo',
};

const MODULE_DROPBOX_PATH: Record<string, string> = {
  licenca: '7. ENTREGAS_E_PROTOCOLOS/7.2. PROTOCOLOS',
  condicionante: '7. ENTREGAS_E_PROTOCOLOS/7.2. PROTOCOLOS',
  evidencia: '7. ENTREGAS_E_PROTOCOLOS/7.1. ENVIADOS',
  relatorio: '4. RELATORIOS_E_PARECERES/4.2. VERSOES_FINAIS',
  minuta: '4. RELATORIOS_E_PARECERES/4.1. MINUTAS',
  mapa: '5. MAPAS_E_GEOESPACIAL/5.2. MAPAS_FINAIS',
  shapefile: '5. MAPAS_E_GEOESPACIAL/5.1. SHAPEFILES',
  camada: '5. MAPAS_E_GEOESPACIAL/5.3. KMZ_KML',
  contrato: '1. GESTAO_E_CONTRATOS/1.1. CONTRATO_PRINCIPAL',
  aditivo: '1. GESTAO_E_CONTRATOS/1.2. ADITIVOS',
  banco_de_dados: '3. BANCOS_DE_DADOS/3.2. PROCESSADOS',
  campo: '3. BANCOS_DE_DADOS/3.1. CAMPO',
  oficio: '6. COMUNICACOES/6.1. OFICIOS',
  comunicacao: '6. COMUNICACOES/6.2. EMAILS_RELEVANTES',
  protocolo: '7. ENTREGAS_E_PROTOCOLOS/7.2. PROTOCOLOS',
  entrega: '7. ENTREGAS_E_PROTOCOLOS/7.1. ENVIADOS',
  monitoramento: '3. BANCOS_DE_DADOS/3.1. CAMPO',
  amostra: '3. BANCOS_DE_DADOS/3.1. CAMPO',
  documento: '4. RELATORIOS_E_PARECERES/4.2. VERSOES_FINAIS',
  base_conhecimento: '4. BASE_TECNICA_E_REFERENCIAS',
  proposta: '2. COMERCIAL_E_CLIENTES/2.1. PROPOSTAS_ENVIADAS',
  rh: '1. ADMINISTRATIVO_E_JURIDICO/1.3. RECURSOS_HUMANOS',
  financeiro: '1. ADMINISTRATIVO_E_JURIDICO/1.2. FINANCEIRO',
  ata: '2. PLANEJAMENTO_E_CRONOGRAMA/2.3. ATAS_DE_REUNIAO',
  parecer: '4. RELATORIOS_E_PARECERES/4.3. PARECERES_TECNICOS',
  autorizacao: '1. GESTAO_E_CONTRATOS/1.3. AUTORIZACOES',
  plano: '2. PLANEJAMENTO_E_CRONOGRAMA/2.2. PLANOS_DE_TRABALHO',
  recibo: '7. ENTREGAS_E_PROTOCOLOS/7.3. RECIBOS',
};

/**
 * Extract text content from a file buffer for indexing
 */
async function extractTextFromBuffer(buffer: Buffer, fileType: string, fileName: string): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // For PDFs, use pdf-parse if available
  if (ext === 'pdf' || fileType.includes('pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      return data.text?.substring(0, 5000) || '';
    } catch {
      return `[Arquivo PDF: ${fileName}]`;
    }
  }

  // For text-based files
  if (['txt', 'csv', 'json', 'xml', 'html', 'md'].includes(ext)) {
    return buffer.toString('utf-8').substring(0, 5000);
  }

  // For other file types, return metadata only
  return `[Arquivo ${ext.toUpperCase()}: ${fileName}]`;
}

/**
 * Build a rich text description for indexing (used when we have structured data instead of a file)
 */
export function buildDocumentDescription(params: {
  module: string;
  fileName: string;
  empreendimentoNome?: string;
  extraInfo?: Record<string, any>;
}): string {
  const { module, fileName, empreendimentoNome, extraInfo } = params;
  const moduleLabel = MODULE_LABELS[module] || module;
  const dropboxPath = MODULE_DROPBOX_PATH[module] || 'Documentos Gerais';

  const lines: string[] = [
    `Tipo: ${moduleLabel}`,
    `Arquivo: ${fileName}`,
    `Localização na Plataforma: Módulo ${moduleLabel}`,
    `Pasta no Dropbox: ${dropboxPath}`,
  ];

  if (empreendimentoNome) {
    lines.push(`Empreendimento: ${empreendimentoNome}`);
    lines.push(`Pasta Dropbox completa: PROJETOS / [CODIGO]_[CLIENTE]_[UF] / ${dropboxPath}`);
  }

  if (extraInfo) {
    if (extraInfo.titulo) lines.push(`Título: ${extraInfo.titulo}`);
    if (extraInfo.numero) lines.push(`Número: ${extraInfo.numero}`);
    if (extraInfo.orgaoEmissor) lines.push(`Órgão Emissor: ${extraInfo.orgaoEmissor}`);
    if (extraInfo.dataEmissao) lines.push(`Data de Emissão: ${extraInfo.dataEmissao}`);
    if (extraInfo.dataVencimento) lines.push(`Data de Vencimento: ${extraInfo.dataVencimento}`);
    if (extraInfo.status) lines.push(`Status: ${extraInfo.status}`);
    if (extraInfo.responsavel) lines.push(`Responsável: ${extraInfo.responsavel}`);
    if (extraInfo.descricao) lines.push(`Descrição: ${extraInfo.descricao}`);
    if (extraInfo.observacoes) lines.push(`Observações: ${extraInfo.observacoes}`);
  }

  return lines.join('\n');
}

/**
 * Auto-index a document when it is uploaded to the platform.
 * Call this from any file upload endpoint.
 */
export async function autoIndexDocument(params: DocumentIndexParams): Promise<void> {
  const {
    unidade,
    fileName,
    fileBuffer,
    fileUrl,
    fileType,
    module,
    empreendimentoId,
    empreendimentoNome,
    extraInfo,
  } = params;

  try {
    let textContent: string;

    if (fileBuffer && fileBuffer.length > 0) {
      const extracted = await extractTextFromBuffer(fileBuffer, fileType, fileName);
      const description = buildDocumentDescription({ module, fileName, empreendimentoNome, extraInfo });
      textContent = `${description}\n\nConteúdo do arquivo:\n${extracted}`;
    } else {
      textContent = buildDocumentDescription({ module, fileName, empreendimentoNome, extraInfo });
    }

    const moduleLabel = MODULE_LABELS[module] || module;
    const dropboxPath = MODULE_DROPBOX_PATH[module] || 'Documentos';
    const dropboxFullPath = empreendimentoNome
      ? `PROJETOS / [CODIGO_EMPREENDIMENTO] / ${dropboxPath}`
      : dropboxPath;

    const metadata = {
      fileUrl: fileUrl || null,
      module,
      moduleLabel,
      dropboxPath: dropboxFullPath,
      empreendimentoNome: empreendimentoNome || null,
      empreendimentoId: empreendimentoId || null,
      fileType,
      indexedAt: new Date().toISOString(),
      ...extraInfo,
    };

    await indexDocument(
      unidade,
      textContent,
      fileName,
      fileType,
      empreendimentoId,
      metadata
    );

    console.log(`[RAG] Documento indexado automaticamente: ${fileName} (módulo: ${moduleLabel})`);
  } catch (error: any) {
    console.error(`[RAG] Erro ao indexar documento ${fileName}:`, error.message);
  }
}
