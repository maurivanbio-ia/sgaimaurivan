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
  // Documentos de Projeto
  contrato:             'Contrato',
  aditivo:              'Aditivo Contratual',
  autorizacao:          'Autorização Ambiental',
  cronograma:           'Cronograma de Projeto',
  plano_trabalho:       'Plano de Trabalho',
  plano:                'Plano de Trabalho',
  ata:                  'Ata de Reunião',
  licenca:              'Licença Ambiental',
  condicionante:        'Condicionante de Licença',
  evidencia:            'Evidência / Comprovante',
  protocolo:            'Protocolo',
  campo:                'Dados de Campo',
  formulario:           'Formulário de Campo',
  amostra:              'Amostra de Monitoramento',
  monitoramento:        'Monitoramento Ambiental',
  banco_de_dados:       'Banco de Dados Processados',
  laudo_laboratorial:   'Laudo Laboratorial',
  minuta:               'Minuta de Documento',
  relatorio:            'Relatório Técnico',
  parecer:              'Parecer Técnico',
  documento:            'Documento',
  shapefile:            'Shapefile / Dado Geoespacial',
  mapa:                 'Mapa Geoespacial',
  camada:               'Camada KMZ/KML',
  oficio:               'Ofício',
  comunicacao:          'Comunicação',
  notificacao_orgao:    'Notificação de Órgão Ambiental',
  entrega:              'Entrega / Protocolo',
  recibo:               'Recibo',
  nota_fiscal_projeto:  'Nota Fiscal de Projeto',
  // Documentos Institucionais
  rh:                   'Recursos Humanos',
  contrato_funcionario: 'Contrato de Funcionário',
  documento_pessoal:    'Documento Pessoal',
  sst:                  'Segurança do Trabalho (SST)',
  aso:                  'ASO / Exame Médico',
  pcmso:                'PCMSO / LTCAT / PGR',
  epi:                  'EPI / Equipamento de Proteção',
  treinamento:          'Treinamento / Capacitação',
  certificado:          'Certificado de Treinamento',
  material_didatico:    'Material Didático',
  iso:                  'Conformidade ISO',
  iso_14001:            'ISO 14001 — Gestão Ambiental',
  iso_9001:             'ISO 9001 — Gestão da Qualidade',
  iso_45001:            'ISO 45001 — Saúde e Segurança',
  financeiro:           'Documento Financeiro',
  lancamento:           'Lançamento Financeiro',
  nota_fiscal:          'Nota Fiscal',
  proposta:             'Proposta Comercial',
  proposta_aprovada:    'Proposta Comercial Aprovada',
  lead:                 'Lead / CRM',
  fornecedor:           'Fornecedor',
  cotacao:              'Cotação de Fornecedor',
  frota:                'Frota / Veículos',
  veiculo:              'Veículo',
  documento_veiculo:    'Documento de Veículo',
  manutencao:           'Manutenção de Veículo',
  equipamento:          'Equipamento',
  calibracao:           'Certificado de Calibração',
  manual_equipamento:   'Manual de Equipamento',
  base_conhecimento:    'Base de Conhecimento',
  legislacao:           'Legislação',
  norma_tecnica:        'Norma Técnica',
  artigo:               'Artigo Científico',
  manual:               'Manual Metodológico',
  template:             'Modelo / Template',
  modelo_planilha:      'Modelo de Planilha',
};

// Caminhos Dropbox espelhando a estrutura da plataforma
// (relativo = dentro da pasta do projeto; com /ECOBRASIL_CONSULTORIA_AMBIENTAL = institucional)
const MODULE_DROPBOX_PATH: Record<string, string> = {
  // Documentos de Projeto (relativos à pasta /3. PROJETOS/{PROJETO}/)
  contrato:             '1. GESTAO_E_CONTRATOS/1.1. CONTRATO_PRINCIPAL',
  aditivo:              '1. GESTAO_E_CONTRATOS/1.2. ADITIVOS',
  autorizacao:          '1. GESTAO_E_CONTRATOS/1.3. AUTORIZACOES',
  cronograma:           '2. PLANEJAMENTO_E_CRONOGRAMA/2.1. CRONOGRAMA',
  plano_trabalho:       '2. PLANEJAMENTO_E_CRONOGRAMA/2.2. PLANOS_DE_TRABALHO',
  plano:                '2. PLANEJAMENTO_E_CRONOGRAMA/2.2. PLANOS_DE_TRABALHO',
  ata:                  '2. PLANEJAMENTO_E_CRONOGRAMA/2.3. ATAS_DE_REUNIAO',
  licenca:              '3. LICENCAS_E_CONDICIONANTES/3.1. LICENCAS_ATIVAS',
  condicionante:        '3. LICENCAS_E_CONDICIONANTES/3.2. CONDICIONANTES',
  evidencia:            '3. LICENCAS_E_CONDICIONANTES/3.3. EVIDENCIAS_E_COMPROVANTES',
  protocolo:            '3. LICENCAS_E_CONDICIONANTES/3.4. PROTOCOLOS',
  campo:                '4. MONITORAMENTO_E_AMOSTRAS/4.1. CAMPO',
  formulario:           '4. MONITORAMENTO_E_AMOSTRAS/4.1. CAMPO/4.1.1. FORMULARIOS',
  amostra:              '4. MONITORAMENTO_E_AMOSTRAS/4.1. CAMPO/4.1.3. AMOSTRAS',
  monitoramento:        '4. MONITORAMENTO_E_AMOSTRAS/4.1. CAMPO/4.1.3. AMOSTRAS',
  banco_de_dados:       '4. MONITORAMENTO_E_AMOSTRAS/4.2. PROCESSADOS',
  laudo_laboratorial:   '4. MONITORAMENTO_E_AMOSTRAS/4.3. LAUDOS_LABORATORIAIS',
  minuta:               '5. RELATORIOS_E_PARECERES/5.1. MINUTAS',
  relatorio:            '5. RELATORIOS_E_PARECERES/5.2. VERSOES_FINAIS',
  parecer:              '5. RELATORIOS_E_PARECERES/5.3. PARECERES_TECNICOS',
  documento:            '5. RELATORIOS_E_PARECERES/5.2. VERSOES_FINAIS',
  shapefile:            '6. MAPAS_E_GEOESPACIAL/6.1. SHAPEFILES',
  mapa:                 '6. MAPAS_E_GEOESPACIAL/6.2. MAPAS_FINAIS',
  camada:               '6. MAPAS_E_GEOESPACIAL/6.3. KMZ_KML',
  oficio:               '7. COMUNICACOES/7.1. OFICIOS',
  comunicacao:          '7. COMUNICACOES/7.2. EMAILS_RELEVANTES',
  notificacao_orgao:    '7. COMUNICACOES/7.3. NOTIFICACOES_ORGAOS',
  entrega:              '8. ENTREGAS_E_FINANCEIRO/8.1. ENVIADOS',
  recibo:               '8. ENTREGAS_E_FINANCEIRO/8.3. RECIBOS',
  nota_fiscal_projeto:  '8. ENTREGAS_E_FINANCEIRO/8.4. NOTAS_FISCAIS',
  // Documentos Institucionais (absolutos)
  rh:                   '1. ADMINISTRATIVO_E_JURIDICO/1.3. RECURSOS_HUMANOS',
  contrato_funcionario: '1. ADMINISTRATIVO_E_JURIDICO/1.3. RECURSOS_HUMANOS/1.3.1. CONTRATOS_FUNCIONARIOS',
  documento_pessoal:    '1. ADMINISTRATIVO_E_JURIDICO/1.3. RECURSOS_HUMANOS/1.3.2. DOCUMENTOS_PESSOAIS',
  sst:                  '1. ADMINISTRATIVO_E_JURIDICO/1.4. SST',
  aso:                  '1. ADMINISTRATIVO_E_JURIDICO/1.4. SST/1.4.1. ASO_E_EXAMES',
  pcmso:                '1. ADMINISTRATIVO_E_JURIDICO/1.4. SST/1.4.2. PCMSO_LTCAT_PGR',
  epi:                  '1. ADMINISTRATIVO_E_JURIDICO/1.4. SST/1.4.3. EPIS_E_EQUIPAMENTOS',
  treinamento:          '1. ADMINISTRATIVO_E_JURIDICO/1.5. TREINAMENTOS_E_CAPACITACAO',
  certificado:          '1. ADMINISTRATIVO_E_JURIDICO/1.5. TREINAMENTOS_E_CAPACITACAO/1.5.1. CERTIFICADOS',
  material_didatico:    '1. ADMINISTRATIVO_E_JURIDICO/1.5. TREINAMENTOS_E_CAPACITACAO/1.5.2. MATERIAIS_DIDATICOS',
  iso:                  '1. ADMINISTRATIVO_E_JURIDICO/1.6. COMPLIANCE_E_LGPD',
  iso_14001:            '1. ADMINISTRATIVO_E_JURIDICO/1.6. COMPLIANCE_E_LGPD/1.6.1. ISO_14001',
  iso_9001:             '1. ADMINISTRATIVO_E_JURIDICO/1.6. COMPLIANCE_E_LGPD/1.6.2. ISO_9001',
  iso_45001:            '1. ADMINISTRATIVO_E_JURIDICO/1.6. COMPLIANCE_E_LGPD/1.6.3. ISO_45001',
  financeiro:           '1. ADMINISTRATIVO_E_JURIDICO/1.2. FINANCEIRO',
  lancamento:           '1. ADMINISTRATIVO_E_JURIDICO/1.2. FINANCEIRO/1.2.1. LANCAMENTOS',
  nota_fiscal:          '1. ADMINISTRATIVO_E_JURIDICO/1.2. FINANCEIRO/1.2.3. NOTAS_FISCAIS',
  proposta:             '2. COMERCIAL_E_CLIENTES/2.1. PROPOSTAS_ENVIADAS',
  proposta_aprovada:    '2. COMERCIAL_E_CLIENTES/2.2. PROPOSTAS_APROVADAS',
  lead:                 '2. COMERCIAL_E_CLIENTES/2.3. LEADS_E_CRM',
  fornecedor:           '2. COMERCIAL_E_CLIENTES/2.5. FORNECEDORES',
  cotacao:              '2. COMERCIAL_E_CLIENTES/2.5. FORNECEDORES/2.5.2. COTACOES',
  frota:                '4. RECURSOS_E_PATRIMONIO/4.1. FROTA',
  veiculo:              '4. RECURSOS_E_PATRIMONIO/4.1. FROTA',
  documento_veiculo:    '4. RECURSOS_E_PATRIMONIO/4.1. FROTA/4.1.1. DOCUMENTOS_VEICULOS',
  manutencao:           '4. RECURSOS_E_PATRIMONIO/4.1. FROTA/4.1.2. MANUTENCOES',
  equipamento:          '4. RECURSOS_E_PATRIMONIO/4.2. EQUIPAMENTOS',
  calibracao:           '4. RECURSOS_E_PATRIMONIO/4.2. EQUIPAMENTOS/4.2.1. CERTIFICADOS_CALIBRACAO',
  manual_equipamento:   '4. RECURSOS_E_PATRIMONIO/4.2. EQUIPAMENTOS/4.2.2. MANUAIS',
  base_conhecimento:    '5. BASE_TECNICA_E_REFERENCIAS',
  legislacao:           '5. BASE_TECNICA_E_REFERENCIAS/5.1. LEGISLACAO',
  norma_tecnica:        '5. BASE_TECNICA_E_REFERENCIAS/5.2. NORMAS_TECNICAS',
  artigo:               '5. BASE_TECNICA_E_REFERENCIAS/5.3. ARTIGOS_CIENTIFICOS',
  manual:               '5. BASE_TECNICA_E_REFERENCIAS/5.4. MANUAIS_METODOLOGICOS',
  template:             '6. MODELOS_E_PADROES/6.1. TEMPLATES_RELATORIOS',
  modelo_planilha:      '6. MODELOS_E_PADROES/6.2. MODELOS_PLANILHAS',
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
 * Build a concise text description for a structured record (no file involved).
 * Used to index licenses, demands, contracts, empreendimentos, etc.
 */
function buildRecordText(type: string, record: Record<string, any>, empreendimentoNome?: string): string {
  const parts: string[] = [`Tipo de registro: ${MODULE_LABELS[type] || type}`];
  if (empreendimentoNome) parts.push(`Empreendimento: ${empreendimentoNome}`);

  const fieldMap: Record<string, string> = {
    nome: 'Nome', titulo: 'Título', numero: 'Número', tipo: 'Tipo',
    subtipo: 'Subtipo', status: 'Status', descricao: 'Descrição',
    orgaoEmissor: 'Órgão Emissor', orgao_emissor: 'Órgão Emissor',
    dataEmissao: 'Data de Emissão', data_emissao: 'Data de Emissão',
    dataVencimento: 'Data de Vencimento', data_vencimento: 'Data de Vencimento',
    dataExpiracao: 'Data de Expiração', data_expiracao: 'Data de Expiração',
    prazo: 'Prazo', dataPrazo: 'Prazo', data_prazo: 'Prazo',
    responsavel: 'Responsável', responsavelInterno: 'Responsável Interno',
    cliente: 'Cliente', localizacao: 'Localização', municipio: 'Município',
    uf: 'UF', cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Telefone',
    cargo: 'Cargo', setor: 'Setor', funcao: 'Função',
    valor: 'Valor', objeto: 'Objeto', categoria: 'Categoria',
    prioridade: 'Prioridade', observacoes: 'Observações', notas: 'Notas',
    modelo: 'Modelo', marca: 'Marca', placa: 'Placa', cor: 'Cor',
    anoFabricacao: 'Ano de Fabricação', ano: 'Ano', codigoPatrimonio: 'Código de Patrimônio',
    campanha: 'Campanha', pontoColeta: 'Ponto de Coleta', laboratorio: 'Laboratório',
    tipoAmostra: 'Tipo de Amostra', dataColeta: 'Data de Coleta',
    nomeColaborador: 'Colaborador', colaborador: 'Colaborador',
    conteudo: 'Conteúdo', texto: 'Texto', tags: 'Tags',
  };

  for (const [key, label] of Object.entries(fieldMap)) {
    const val = record[key];
    if (val != null && val !== '') {
      const strVal = Array.isArray(val) ? val.join(', ') : String(val);
      if (strVal.length > 0) parts.push(`${label}: ${strVal}`);
    }
  }

  const dropboxPath = MODULE_DROPBOX_PATH[type];
  if (dropboxPath) {
    parts.push(`Localização Dropbox: ${empreendimentoNome ? `PROJETOS / [...] / ${dropboxPath}` : dropboxPath}`);
  }

  return parts.join('\n');
}

/**
 * Index a structured record (non-file entity) into the RAG.
 * Call this whenever a record is created or updated in the platform.
 */
export async function indexStructuredRecord(params: {
  unidade: string;
  type: string;
  recordId: number;
  record: Record<string, any>;
  empreendimentoId?: number;
  empreendimentoNome?: string;
  sourceLabel?: string;
}): Promise<void> {
  const { unidade, type, recordId, record, empreendimentoId, empreendimentoNome, sourceLabel } = params;
  try {
    const text = buildRecordText(type, record, empreendimentoNome);
    const moduleLabel = MODULE_LABELS[type] || type;
    const dropboxPath = MODULE_DROPBOX_PATH[type] || '';
    const source = sourceLabel || `${moduleLabel} #${recordId}`;

    const metadata = {
      module: type,
      moduleLabel,
      dropboxPath: empreendimentoNome && dropboxPath
        ? `PROJETOS / [CODIGO_EMPREENDIMENTO] / ${dropboxPath}`
        : dropboxPath,
      empreendimentoNome: empreendimentoNome || null,
      empreendimentoId: empreendimentoId || null,
      recordId,
      indexedAt: new Date().toISOString(),
      structured: true,
    };

    await indexDocument(unidade, text, source, 'structured', empreendimentoId, metadata);
    console.log(`[RAG] Dado estruturado indexado: ${source} (${unidade})`);
  } catch (err: any) {
    console.error(`[RAG] Erro ao indexar registro ${type} #${recordId}:`, err.message);
  }
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
