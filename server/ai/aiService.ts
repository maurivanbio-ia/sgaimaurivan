import OpenAI from 'openai';
import { db } from '../db';
import { aiConversations, aiLogs } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { searchSimilarDocuments } from './retriever';
import { storage } from '../storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QueryOptions {
  unidade: string;
  userId: number;
  message: string;
  empreendimentoId?: number;
  history?: ChatMessage[];
  context?: any;
}

export interface QueryResponse {
  response: string;
  documents: Array<{
    id: number;
    source: string;
    sourceType: string;
    module: string | null;
    moduleLabel: string | null;
    fileUrl: string | null;
    dropboxPath: string | null;
    empreendimentoNome: string | null;
    similarity: number;
    snippet: string;
  }>;
}

function fmt(val: any): string {
  if (val == null || val === '') return '-';
  return String(val);
}

function fmtList(items: any[], fields: string[], maxItems = 50): string {
  if (!items || items.length === 0) return '(nenhum registro encontrado)';
  return items.slice(0, maxItems).map((item, i) => {
    const line = fields.map(f => {
      const val = item[f];
      if (val == null || val === '') return null;
      return `${f}: ${val}`;
    }).filter(Boolean).join(' | ');
    return `  ${i + 1}. ${line}`;
  }).join('\n');
}

function detectTopics(msg: string): Set<string> {
  const m = msg.toLowerCase();
  const topics = new Set<string>();

  if (/empreendimento|projeto|fazenda|complexo|sitio|usina|empresa|plant/.test(m)) topics.add('empreendimentos');
  if (/licen[cç]|licença|lp|li\b|lo\b|lao|asa|licenciamento|vali|vence|vencer|expirar/.test(m)) topics.add('licencas');
  if (/condicionante|condi[cç]|exigência|exigencia|obriga/.test(m)) topics.add('condicionantes');
  if (/demanda|tarefa|atividade|pendente|andamento|prazo|entrega/.test(m)) topics.add('demandas');
  if (/contrato|aditivo|objeto|vigência|vigencia|assinatura/.test(m)) topics.add('contratos');
  if (/financ|lançamento|lancamento|receita|despesa|pago|pagar|valor|custo|fatura|nota fiscal|recibo/.test(m)) topics.add('financeiro');
  if (/rh|recurso humano|funcionário|funcionario|colaborador|empregado|cargo|admissão|admissao|demissão|clt|pj|salario|salário/.test(m)) topics.add('rh');
  if (/veículo|veiculo|carro|caminhão|caminhao|moto|frota|placa|km|combustível|manutenção/.test(m)) topics.add('frota');
  if (/equipamento|instrumento|calibr|patrimônio|patrimonio|codigo equip/.test(m)) topics.add('equipamentos');
  if (/amostra|monitoramento|coleta|laboratorio|laboratório|parâmetro|campanha/.test(m)) topics.add('amostras');
  if (/fornecedor|fornecimento|cotação|cotacao|compra|prestador|vendedor/.test(m)) topics.add('fornecedores');
  if (/treinamento|capacitação|capacitacao|curso|certific|qualific/.test(m)) topics.add('treinamentos');
  if (/proposta|comercial|cliente|lead|crm|negoci|orçamento|orcamento/.test(m)) topics.add('propostas');
  if (/colaborador|equipe|time|gestor|coordenador|analista/.test(m)) topics.add('colaboradores');
  if (/iso|conformidade|norma|auditoria|nao conformidade|não conformidade/.test(m)) topics.add('iso');

  // Se nenhum tópico detectado, busca tudo
  if (topics.size === 0) {
    ['empreendimentos', 'licencas', 'demandas', 'contratos'].forEach(t => topics.add(t));
  }

  return topics;
}

async function buildDatabaseContext(unidade: string, message: string, empreendimentoId?: number): Promise<string> {
  const topics = detectTopics(message);
  const sections: string[] = [];

  try {
    // ── EMPREENDIMENTOS (sempre incluído como base) ──────────────────────────
    const empreendimentos = await storage.getEmpreendimentos(unidade);
    const empList = empreendimentos.map((e, i) =>
      `  ${i + 1}. [ID:${e.id}] ${e.nome} | Cliente: ${fmt(e.cliente)} | Local: ${fmt(e.localizacao)} | Status: ${fmt(e.status)} | Responsável: ${fmt(e.responsavelInterno)}`
    ).join('\n');
    sections.push(`## EMPREENDIMENTOS CADASTRADOS (${empreendimentos.length})\n${empList || '(nenhum)'}`);

    // Determina empreendimento de contexto
    const empCtx = empreendimentoId
      ? empreendimentos.find(e => e.id === empreendimentoId)
      : null;

    // ── LICENÇAS ─────────────────────────────────────────────────────────────
    if (topics.has('licencas') || topics.has('condicionantes')) {
      const licStats = await storage.getLicenseStats(unidade, empreendimentoId);
      const licencas = empreendimentoId
        ? await storage.getLicencasByEmpreendimento(empreendimentoId)
        : await storage.getLicencas();
      const filtered = empreendimentoId ? licencas : licencas.filter((l: any) => {
        const emp = empreendimentos.find(e => e.id === l.empreendimentoId);
        return emp !== undefined;
      });
      sections.push(
        `## LICENÇAS AMBIENTAIS (ativas: ${licStats.active} | expirando: ${licStats.expiring} | vencidas: ${licStats.expired})\n` +
        fmtList(filtered, ['numero', 'tipo', 'status', 'orgaoEmissor', 'validade', 'empreendimentoId'])
      );
    }

    // ── DEMANDAS ─────────────────────────────────────────────────────────────
    if (topics.has('demandas')) {
      const demandas = await storage.getDemandas({ unidade, empreendimentoId });
      const dStats = await storage.getDemandasStats(unidade, empreendimentoId);
      sections.push(
        `## DEMANDAS (total: ${dStats.total} | pendentes: ${dStats.pendentes} | em andamento: ${dStats.emAndamento} | concluídas: ${dStats.concluidas})\n` +
        fmtList(demandas, ['titulo', 'status', 'prioridade', 'prazo', 'responsavel', 'empreendimentoId'])
      );
    }

    // ── CONTRATOS ────────────────────────────────────────────────────────────
    if (topics.has('contratos')) {
      const contratos = await storage.getContratos({ unidade, empreendimentoId });
      const cStats = await storage.getContratosStats(unidade, empreendimentoId);
      sections.push(
        `## CONTRATOS (total: ${cStats.total} | ativos: ${cStats.ativos} | valor total: R$ ${Number(cStats.valorTotal || 0).toLocaleString('pt-BR')})\n` +
        fmtList(contratos, ['numero', 'objeto', 'status', 'valor', 'dataInicio', 'dataFim', 'cliente'])
      );
    }

    // ── FINANCEIRO ───────────────────────────────────────────────────────────
    if (topics.has('financeiro')) {
      const lancamentos = await storage.getLancamentos({ unidade, empreendimentoId });
      const receitas = lancamentos.filter((l: any) => l.tipo === 'receita' && l.status === 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0);
      const despesas = lancamentos.filter((l: any) => l.tipo === 'despesa' && l.status === 'pago').reduce((s: number, l: any) => s + Number(l.valor), 0);
      const pendentes = lancamentos.filter((l: any) => l.status !== 'pago' && l.status !== 'cancelado').length;
      sections.push(
        `## FINANCEIRO (receitas pagas: R$ ${receitas.toLocaleString('pt-BR')} | despesas pagas: R$ ${despesas.toLocaleString('pt-BR')} | pendentes: ${pendentes})\n` +
        fmtList(lancamentos.slice(0, 30), ['descricao', 'tipo', 'valor', 'status', 'data', 'dataVencimento'])
      );
    }

    // ── RH ───────────────────────────────────────────────────────────────────
    if (topics.has('rh')) {
      const rh = await storage.getRhRegistros({ unidade });
      const rhStats = await storage.getRhStats(unidade);
      sections.push(
        `## RH / COLABORADORES (total: ${rhStats.total} | ativos: ${rhStats.ativos} | afastados: ${rhStats.afastados})\n` +
        fmtList(rh, ['nome', 'cargo', 'setor', 'status', 'tipoContrato', 'dataAdmissao'])
      );
    }

    // ── FROTA ────────────────────────────────────────────────────────────────
    if (topics.has('frota')) {
      const veiculos = await storage.getVeiculos({ unidade });
      const fStats = await storage.getFrotaStats(unidade);
      sections.push(
        `## FROTA (total: ${fStats.total} | disponíveis: ${fStats.disponiveis} | em uso: ${fStats.emUso} | manutenção: ${fStats.manutencao})\n` +
        fmtList(veiculos, ['placa', 'modelo', 'marca', 'ano', 'status', 'cor', 'responsavel'])
      );
    }

    // ── EQUIPAMENTOS ─────────────────────────────────────────────────────────
    if (topics.has('equipamentos')) {
      const equips = await storage.getEquipamentos({ unidade });
      const eStats = await storage.getEquipamentosStats(unidade);
      sections.push(
        `## EQUIPAMENTOS (total: ${eStats.total} | disponíveis: ${eStats.disponiveis} | em uso: ${eStats.emUso} | manutenção: ${eStats.manutencao})\n` +
        fmtList(equips, ['nome', 'codigo', 'modelo', 'status', 'localizacao', 'responsavel'])
      );
    }

    // ── AMOSTRAS ─────────────────────────────────────────────────────────────
    if (topics.has('amostras')) {
      const amostras = await storage.getAmostras({ unidade });
      sections.push(
        `## AMOSTRAS DE MONITORAMENTO (${amostras.length} registros)\n` +
        fmtList(amostras, ['campanha', 'tipoAmostra', 'pontoColeta', 'status', 'dataColeta', 'laboratorio'])
      );
    }

    // ── FORNECEDORES ─────────────────────────────────────────────────────────
    if (topics.has('fornecedores')) {
      const fornecedores = await storage.getFornecedores({ unidade });
      sections.push(
        `## FORNECEDORES (${fornecedores.length})\n` +
        fmtList(fornecedores, ['nome', 'tipo', 'status', 'rating', 'email', 'telefone'])
      );
    }

    // ── TREINAMENTOS ─────────────────────────────────────────────────────────
    if (topics.has('treinamentos')) {
      const trein = await storage.getTreinamentos({ unidade });
      sections.push(
        `## TREINAMENTOS E CAPACITAÇÕES (${trein.length})\n` +
        fmtList(trein, ['titulo', 'tipo', 'status', 'dataInicio', 'dataFim', 'modalidade'])
      );
    }

    // ── PROPOSTAS COMERCIAIS ─────────────────────────────────────────────────
    if (topics.has('propostas')) {
      const propostas = await storage.getPropostasComerciais({ unidade });
      sections.push(
        `## PROPOSTAS COMERCIAIS (${propostas.length})\n` +
        fmtList(propostas, ['titulo', 'cliente', 'status', 'valorTotal', 'dataEnvio'])
      );
    }

    // ── COLABORADORES (equipe da plataforma) ──────────────────────────────────
    if (topics.has('colaboradores')) {
      const colab = await storage.getColaboradores({ unidade });
      sections.push(
        `## EQUIPE / COLABORADORES INTERNOS (${colab.length})\n` +
        fmtList(colab, ['nome', 'cargo', 'email', 'departamento', 'status'])
      );
    }

    // ── AGENDA DE PRAZOS ─────────────────────────────────────────────────────
    if (topics.has('licencas') || topics.has('demandas') || message.toLowerCase().includes('prazo')) {
      const agenda = await storage.getAgendaPrazos(unidade, empreendimentoId);
      const proximos = agenda.slice(0, 15);
      if (proximos.length > 0) {
        sections.push(
          `## PRÓXIMOS PRAZOS CRÍTICOS\n` +
          proximos.map((p, i) => `  ${i + 1}. [${p.tipo}] ${p.titulo} — Prazo: ${p.prazo} | Status: ${p.status}`).join('\n')
        );
      }
    }

    // Contexto do empreendimento selecionado
    if (empCtx) {
      sections.unshift(
        `## EMPREENDIMENTO SELECIONADO\nID: ${empCtx.id} | Nome: ${empCtx.nome} | Cliente: ${fmt(empCtx.cliente)} | ` +
        `Local: ${fmt(empCtx.localizacao)} | Status: ${fmt(empCtx.status)} | Responsável: ${fmt(empCtx.responsavelInterno)}`
      );
    }

  } catch (err: any) {
    console.error('[AI] Erro ao construir contexto do banco:', err.message);
  }

  return sections.join('\n\n');
}

export async function processQuery(options: QueryOptions): Promise<QueryResponse> {
  const { unidade, userId, message, empreendimentoId, history = [], context = {} } = options;

  try {
    await db.insert(aiLogs).values({
      unidade,
      userId,
      action: 'query',
      details: { message, empreendimentoId },
      status: 'success',
    });

    // Busca paralela: dados do banco + documentos indexados
    const [dbContext, relevantDocs] = await Promise.all([
      buildDatabaseContext(unidade, message, empreendimentoId),
      searchSimilarDocuments(unidade, message, 5, empreendimentoId).catch(() => []),
    ]);

    const SIMILARITY_THRESHOLD = 0.25;
    const goodDocs = relevantDocs.filter(d => d.similarity >= SIMILARITY_THRESHOLD);

    const docsText = goodDocs.length > 0
      ? `## DOCUMENTOS INDEXADOS RELEVANTES (arquivos carregados na plataforma)\n` +
        goodDocs.map((doc, i) =>
          `  [DOC ${i + 1}] ${doc.moduleLabel || doc.sourceType} — "${doc.source}"\n` +
          `  Localização: ${doc.dropboxPath || 'Plataforma'}\n` +
          `  ${doc.empreendimentoNome ? `Empreendimento: ${doc.empreendimentoNome}\n  ` : ''}` +
          `Trecho: ${doc.content.substring(0, 250)}...`
        ).join('\n\n')
      : '';

    const systemPrompt = `Você é o EcoGestor-AI, assistente da Ecobrasil Consultoria Ambiental. Você é um colega experiente em gestão ambiental — inteligente, atento e humano.

## Sua personalidade
- Converse de forma natural e acolhedora, como um colega de trabalho que conhece bem a empresa
- Use português brasileiro informal-profissional: direto, simpático, sem ser robótico
- Quando a pergunta for vaga, faça UMA pergunta de esclarecimento antes de responder
- Mostre que você entendeu o que foi pedido antes de dar a resposta
- Destaque proativamente informações importantes que o usuário pode não ter pedido mas precisa saber (ex: licença vencendo, demanda atrasada)
- Quando tiver muitos dados, resuma primeiro e ofereça detalhar se precisar
- Nunca despeje listas gigantes sem contexto — sempre introduza os dados

## Formatação
- Use **negrito** para nomes, status e valores importantes
- Use tabelas markdown (| col | col |) apenas quando tiver 3+ itens comparáveis
- Use listas com - para enumerações simples
- Separe seções com uma linha em branco
- Respostas concisas — máximo 400 palavras salvo pedido explícito de lista completa

## Dados reais da plataforma (unidade: ${unidade})
Os dados abaixo são reais, buscados agora do banco de dados. Use-os como base, mas interprete-os — não apenas liste-os.

${dbContext}

${docsText}

## Regras absolutas
- Nunca invente dados que não estejam acima
- Se não encontrar a informação, diga claramente e sugira o que o usuário pode fazer
- Mantenha o contexto da conversa — lembre do que foi dito antes neste chat`;

    const historyMessages = (history || []).slice(-8).map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const response = completion.choices[0].message.content || 'Desculpe, não consegui processar sua pergunta.';

    await db.insert(aiConversations).values({
      unidade,
      userId,
      message,
      response,
      context: {
        empreendimentoId,
        relevantDocs: goodDocs.map(d => ({ id: d.id, source: d.source })),
        ...context,
      },
    });

    const documentCards = goodDocs.map(doc => ({
      id: doc.id,
      source: doc.source,
      sourceType: doc.sourceType,
      module: doc.module,
      moduleLabel: doc.moduleLabel,
      fileUrl: doc.fileUrl,
      dropboxPath: doc.dropboxPath,
      empreendimentoNome: doc.empreendimentoNome,
      similarity: Math.round(doc.similarity * 100),
      snippet: doc.content.substring(0, 150) + '...',
    }));

    return { response, documents: documentCards };
  } catch (error: any) {
    console.error('Error processing query:', error);

    await db.insert(aiLogs).values({
      unidade,
      userId,
      action: 'query',
      details: { message, empreendimentoId },
      status: 'error',
      error: error.message,
    }).catch(() => {});

    throw new Error('Erro ao processar sua pergunta. Tente novamente.');
  }
}

// ─── FERRAMENTAS DE AÇÃO (OpenAI Function Calling) ──────────────────────────
const AI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "criar_demanda",
      description: "Cria uma nova demanda/tarefa no sistema. CHAME IMEDIATAMENTE quando tiver titulo+setor+prazo. Campos opcionais têm padrões — não pergunte sobre eles.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "[OBRIGATÓRIO] Título da demanda conforme informado pelo usuário" },
          setor: { type: "string", description: "[OBRIGATÓRIO] Setor: Licenciamento, Fauna, Flora, RH, Engenharia, Meio Físico, Meio Biótico, Financeiro, Administrativo, Geral" },
          prazo: { type: "string", description: "[OBRIGATÓRIO] Data de entrega formato YYYY-MM-DD" },
          descricao: { type: "string", description: "[OPCIONAL] Descrição adicional — deixe em branco se não informado" },
          prioridade: { type: "string", enum: ["alta", "media", "baixa"], description: "[OPCIONAL] Padrão: media — USE o padrão sem perguntar" },
          empreendimentoId: { type: "number", description: "[OPCIONAL] ID do empreendimento — só informe se o usuário mencionou um" },
        },
        required: ["titulo", "setor", "prazo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "criar_empreendimento",
      description: "Cadastra um novo empreendimento/projeto no sistema. IMPORTANTE: confirme todos os campos obrigatórios com o usuário antes de executar.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do empreendimento/projeto. OBRIGATÓRIO." },
          cliente: { type: "string", description: "Nome do cliente/empresa contratante. OBRIGATÓRIO." },
          localizacao: { type: "string", description: "Localização do empreendimento (município, estado). OBRIGATÓRIO." },
          responsavelInterno: { type: "string", description: "Nome do responsável interno pela gestão. OBRIGATÓRIO." },
          tipo: { type: "string", enum: ["hidreletrica", "parque_eolico", "usina_solar", "termoeletrica", "linha_transmissao", "mina", "pchs", "outro"], description: "Tipo do empreendimento. Padrão: outro." },
          status: { type: "string", enum: ["ativo", "em_planejamento", "em_execucao", "concluido", "inativo"], description: "Status atual. Padrão: em_planejamento." },
          descricao: { type: "string", description: "Descrição do empreendimento (opcional)" },
          municipio: { type: "string", description: "Município onde fica o empreendimento (opcional)" },
          uf: { type: "string", description: "UF do estado, ex: BA, SP (opcional)" },
          dataInicio: { type: "string", description: "Data de início YYYY-MM-DD (opcional)" },
          dataFimPrevista: { type: "string", description: "Data prevista de conclusão YYYY-MM-DD (opcional)" },
        },
        required: ["nome", "cliente", "localizacao", "responsavelInterno"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "registrar_equipamento",
      description: "Cadastra um novo equipamento no sistema. IMPORTANTE: confirme nome, tipo e localização com o usuário antes de executar.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome/descrição do equipamento. OBRIGATÓRIO." },
          tipo: { type: "string", description: "Tipo do equipamento. Ex: GPS, Drone, Armadilha Fotográfica, Estação Meteorológica, Amostrador, Medidor, Câmera, etc. OBRIGATÓRIO." },
          localizacaoAtual: { type: "string", description: "Localização atual do equipamento. OBRIGATÓRIO." },
          marca: { type: "string", description: "Marca do equipamento (opcional)" },
          modelo: { type: "string", description: "Modelo do equipamento (opcional)" },
          numeroPatrimonio: { type: "string", description: "Número de patrimônio/série (opcional)" },
          empreendimentoId: { type: "number", description: "ID do empreendimento onde está alocado (opcional)" },
        },
        required: ["nome", "tipo", "localizacaoAtual"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "registrar_veiculo",
      description: "Cadastra um novo veículo na frota. IMPORTANTE: confirme placa, modelo, tipo e combustível com o usuário antes de executar.",
      parameters: {
        type: "object",
        properties: {
          placa: { type: "string", description: "Placa do veículo (formato ABC-1234 ou ABC1D23). OBRIGATÓRIO." },
          marca: { type: "string", description: "Marca do veículo (ex: Toyota, Ford). OBRIGATÓRIO." },
          modelo: { type: "string", description: "Modelo do veículo (ex: Hilux, Ranger). OBRIGATÓRIO." },
          ano: { type: "number", description: "Ano de fabricação (ex: 2022). OBRIGATÓRIO." },
          tipo: { type: "string", enum: ["carro", "caminhonete", "caminhao", "van", "moto"], description: "Tipo do veículo. OBRIGATÓRIO." },
          combustivel: { type: "string", enum: ["gasolina", "etanol", "diesel", "flex"], description: "Tipo de combustível. OBRIGATÓRIO." },
          seguro: { type: "string", description: "Número da apólice de seguro ou 'sem seguro'. OBRIGATÓRIO." },
          proximaRevisao: { type: "string", description: "Data da próxima revisão YYYY-MM-DD. OBRIGATÓRIO." },
          cor: { type: "string", description: "Cor do veículo (opcional)" },
          kmAtual: { type: "number", description: "Quilometragem atual. Padrão: 0." },
          localizacaoAtual: { type: "string", description: "Localização atual do veículo (ex: 'Garagem Salvador'). OBRIGATÓRIO." },
        },
        required: ["placa", "marca", "modelo", "ano", "tipo", "combustivel", "seguro", "proximaRevisao", "localizacaoAtual"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "atualizar_status_licenca",
      description: "Atualiza o status de uma licença ambiental existente. Use o ID real dos dados do banco.",
      parameters: {
        type: "object",
        properties: {
          licencaId: { type: "number", description: "ID numérico da licença a atualizar. Obtenha dos dados do banco." },
          novoStatus: { type: "string", enum: ["ativa", "vencida", "suspensa", "cancelada", "em_renovacao"], description: "Novo status da licença." },
        },
        required: ["licencaId", "novoStatus"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "registrar_lancamento",
      description: "Registra um lançamento financeiro (receita ou despesa). IMPORTANTE: confirme descrição, tipo e valor com o usuário.",
      parameters: {
        type: "object",
        properties: {
          descricao: { type: "string", description: "Descrição do lançamento. OBRIGATÓRIO." },
          tipo: { type: "string", enum: ["receita", "despesa"], description: "Tipo do lançamento. OBRIGATÓRIO." },
          valor: { type: "number", description: "Valor em reais (número positivo). OBRIGATÓRIO." },
          data: { type: "string", description: "Data em formato YYYY-MM-DD. Padrão: hoje." },
          empreendimentoId: { type: "number", description: "ID do empreendimento (opcional)" },
          categoria: { type: "string", description: "Categoria do lançamento (ex: Consultoria, Combustível, Salários). Opcional." },
        },
        required: ["descricao", "tipo", "valor"],
      },
    },
  },
];

async function executeTool(toolName: string, args: any, unidade: string, userId?: number): Promise<{ success: boolean; result: any; message: string }> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const in7days = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  console.log(`[AI Tool] ${toolName} | unidade=${unidade} | userId=${userId} | args=${JSON.stringify(args)}`);

  try {
    // ── CRIAR DEMANDA ───────────────────────────────────────────────────────
    if (toolName === 'criar_demanda') {
      const demanda = await storage.createDemanda({
        titulo: args.titulo,
        descricao: args.descricao || null,
        setor: args.setor || 'Geral',
        prioridade: args.prioridade || 'media',
        complexidade: 'media',
        categoria: 'geral',
        dataEntrega: args.prazo || in7days,
        status: 'a_fazer',
        responsavelId: userId || 1,
        criadoPor: userId || 1,
        unidade,
        empreendimentoId: args.empreendimentoId || null,
        recorrente: false,
      } as any);
      return { success: true, result: { id: demanda.id, titulo: demanda.titulo }, message: `✅ Demanda "${demanda.titulo}" criada com sucesso! ID: #${demanda.id} — Já aparece no quadro de demandas.` };
    }

    // ── CRIAR EMPREENDIMENTO ────────────────────────────────────────────────
    if (toolName === 'criar_empreendimento') {
      const emp = await storage.createEmpreendimento({
        nome: args.nome,
        cliente: args.cliente,
        localizacao: args.localizacao,
        responsavelInterno: args.responsavelInterno,
        tipo: args.tipo || 'outro',
        status: args.status || 'em_planejamento',
        descricao: args.descricao || null,
        municipio: args.municipio || null,
        uf: args.uf || null,
        dataInicio: args.dataInicio || null,
        dataFimPrevista: args.dataFimPrevista || null,
        unidade,
        visivel: true,
        criadoPor: userId || 1,
      } as any);
      return { success: true, result: { id: emp.id, nome: emp.nome }, message: `✅ Empreendimento "${emp.nome}" cadastrado com sucesso! ID: #${emp.id}` };
    }

    // ── REGISTRAR EQUIPAMENTO ───────────────────────────────────────────────
    if (toolName === 'registrar_equipamento') {
      const equip = await storage.createEquipamento({
        nome: args.nome,
        tipo: args.tipo,
        localizacaoAtual: args.localizacaoAtual,
        marca: args.marca || null,
        modelo: args.modelo || null,
        numeroPatrimonio: args.numeroPatrimonio || null,
        status: 'disponivel',
        unidade,
        criadoPor: userId || 1,
        empreendimentoId: args.empreendimentoId || null,
      } as any);
      return { success: true, result: { id: equip.id, nome: equip.nome }, message: `✅ Equipamento "${equip.nome}" registrado com sucesso! ID: #${equip.id}` };
    }

    // ── REGISTRAR VEÍCULO ────────────────────────────────────────────────────
    if (toolName === 'registrar_veiculo') {
      const veiculo = await storage.createVeiculo({
        placa: args.placa,
        marca: args.marca,
        modelo: args.modelo,
        ano: args.ano,
        tipo: args.tipo,
        combustivel: args.combustivel,
        seguro: args.seguro,
        proximaRevisao: args.proximaRevisao,
        cor: args.cor || null,
        kmAtual: args.kmAtual || 0,
        localizacaoAtual: args.localizacaoAtual || 'A definir',
        status: 'disponivel',
        unidade,
        criadoPor: userId || 1,
      } as any);
      return { success: true, result: { id: veiculo.id, placa: veiculo.placa }, message: `✅ Veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.placa}) registrado com sucesso! ID: #${veiculo.id}` };
    }

    // ── ATUALIZAR STATUS LICENÇA ─────────────────────────────────────────────
    if (toolName === 'atualizar_status_licenca') {
      const licenca = await storage.updateLicenca(args.licencaId, { status: args.novoStatus });
      return { success: true, result: { id: licenca.id }, message: `✅ Status da licença #${licenca.id} atualizado para "${args.novoStatus}"` };
    }

    // ── REGISTRAR LANÇAMENTO ─────────────────────────────────────────────────
    if (toolName === 'registrar_lancamento') {
      const lancamento = await storage.createLancamento({
        descricao: args.descricao,
        tipo: args.tipo,
        valor: String(args.valor),
        data: args.data || todayStr,
        status: 'pendente',
        unidade,
        empreendimentoId: args.empreendimentoId || null,
        categoria: args.categoria || null,
      } as any);
      return { success: true, result: { id: lancamento.id }, message: `✅ Lançamento "${args.descricao}" (R$ ${Number(args.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) registrado! ID: #${lancamento.id}` };
    }

    return { success: false, result: null, message: `Ferramenta desconhecida: ${toolName}` };
  } catch (err: any) {
    return { success: false, result: null, message: `Erro ao executar ${toolName}: ${err.message}` };
  }
}

function detectActionIntent(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const actionPatterns = [
    /\bcri(e|a|ar|ou)\s+(uma?\s+)?(demanda|tarefa|empreendimento)/i,
    /\bregistr(e|a|ar|ou)\s+(um(a?)?\s+)?(equipamento|veiculo|vei[ií]culo|lancamento|lan[çc]amento)/i,
    /\badicione?\s+(um(a?)?\s+)?(demanda|tarefa|empreendimento|veiculo|equipamento)/i,
    /\bcadastre?\s+(um(a?)?\s+)?(demanda|tarefa|empreendimento|veiculo|equipamento|empreend)/i,
    /\binsira?\s+(um(a?)?\s+)?(demanda|tarefa)/i,
    /\batualize?\s+(o\s+)?(status)\s+(da\s+)?(licen[çc]a)/i,
  ];
  return actionPatterns.some(p => p.test(lower));
}

function buildSystemPrompt(unidade: string, dbContext: string, docsText: string): string {
  return `Você é o EcoGestor-AI, assistente da Ecobrasil Consultoria Ambiental. Você é um colega experiente em gestão ambiental — inteligente, atento e humano.

## Sua personalidade
- Converse de forma natural e acolhedora, como um colega de trabalho que conhece bem a empresa
- Use português brasileiro informal-profissional: direto, simpático, sem ser robótico
- Quando a pergunta for vaga, faça UMA pergunta de esclarecimento antes de responder
- Mostre que você entendeu o que foi pedido antes de dar a resposta
- Destaque proativamente informações importantes que o usuário pode não ter pedido mas precisa saber (ex: licença vencendo, demanda atrasada)
- Quando tiver muitos dados, resuma primeiro e ofereça detalhar se precisar
- Nunca despeje listas gigantes sem contexto — sempre introduza os dados

## Formatação
- Use **negrito** para nomes, status e valores importantes
- Use tabelas markdown (| col | col |) apenas quando tiver 3+ itens comparáveis
- Use listas com - para enumerações simples
- Separe seções com uma linha em branco
- Respostas concisas — máximo 400 palavras salvo pedido explícito de lista completa

## Marcadores de entidade (IMPORTANTE)
Quando mencionar licenças, demandas ou empreendimentos específicos, use marcadores inline para criar cards clicáveis:
- Licenças: [LICENCA:ID:nome_ou_numero] (ex: [LICENCA:42:LP 001/2024])
- Demandas: [DEMANDA:ID:titulo] (ex: [DEMANDA:17:Relatório Semestral])
- Empreendimentos: [EMP:ID:nome] (ex: [EMP:5:Fazenda Boa Vista])
Use esses marcadores apenas quando souber o ID real do item nos dados abaixo.

## Dados reais da plataforma (unidade: ${unidade})
Os dados abaixo são reais, buscados agora do banco de dados. Use-os como base, mas interprete-os — não apenas liste-os.

${dbContext}

${docsText}

## Ferramentas de ação — PROTOCOLO OBRIGATÓRIO

Você tem acesso a ferramentas reais que executam ações no banco de dados:
- **criar_demanda** — campos obrigatórios: título, setor, prazo (data YYYY-MM-DD)
- **criar_empreendimento** — campos obrigatórios: nome, cliente, localização, responsável interno
- **registrar_equipamento** — campos obrigatórios: nome, tipo, localização atual
- **registrar_veiculo** — campos obrigatórios: placa, marca, modelo, ano, tipo, combustível, seguro, próxima revisão
- **atualizar_status_licenca** — campos obrigatórios: ID da licença, novo status
- **registrar_lancamento** — campos obrigatórios: descrição, tipo (receita/despesa), valor

### REGRA 1 — Coleta (SOMENTE campos OBRIGATÓRIOS que faltam)
Campos obrigatórios que precisam ser coletados antes de executar:
- criar_demanda: **titulo**, **setor**, **prazo** (data)
- criar_empreendimento: **nome**, **cliente**, **localizacao**, **responsavelInterno**
- registrar_equipamento: **nome**, **tipo**, **localizacaoAtual**
- registrar_veiculo: **placa**, **marca**, **modelo**, **ano**, **tipo**, **combustivel**, **seguro**, **proximaRevisao**
- atualizar_status_licenca: **licencaId**, **novoStatus**
- registrar_lancamento: **descricao**, **tipo**, **valor**

Se faltar algum campo OBRIGATÓRIO: escreva UMA pergunta listando o que falta. Campos opcionais (prioridade, descrição, etc.) → use o valor padrão SEM perguntar.

### REGRA 2 — Execução IMEDIATA (quando todos os obrigatórios estão presentes)
Quando o usuário forneceu todos os campos obrigatórios (mesmo que em mensagens anteriores):
1. **CHAME A FUNÇÃO IMEDIATAMENTE** — sem pedir confirmação, sem perguntar opcionais
2. Campos opcionais ausentes: use os padrões (prioridade=media, status=a_fazer, etc.)
3. Após a ferramenta retornar, confirme o resultado brevemente

### REGRA 3 — ABSOLUTAMENTE PROIBIDO
❌ NÃO peça campos opcionais (prioridade, descrição, tags, etc.) antes de executar
❌ NÃO simule criação em texto ("Criei a demanda ID #53") sem ter chamado a função real
❌ NÃO peça confirmação se já tiver todos os obrigatórios
❌ NÃO invente IDs — eles vêm do retorno da ferramenta

Após a ferramenta executar com sucesso, confirme brevemente o que foi criado.

## Regras absolutas
- Nunca invente dados que não estejam acima
- Se não encontrar a informação, diga claramente e sugira o que o usuário pode fazer
- Mantenha o contexto da conversa — lembre do que foi dito antes neste chat`;
}

export async function streamQuery(options: QueryOptions, res: any): Promise<void> {
  const { unidade, userId, message, empreendimentoId, history = [] } = options;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {}
  };

  try {
    const [dbContext, relevantDocs] = await Promise.all([
      buildDatabaseContext(unidade, message, empreendimentoId),
      searchSimilarDocuments(unidade, message, 5, empreendimentoId).catch(() => []),
    ]);

    const SIMILARITY_THRESHOLD = 0.25;
    const goodDocs = relevantDocs.filter((d: any) => d.similarity >= SIMILARITY_THRESHOLD);

    const docsText = goodDocs.length > 0
      ? `## DOCUMENTOS INDEXADOS RELEVANTES\n` +
        goodDocs.map((doc: any, i: number) =>
          `  [DOC ${i + 1}] ${doc.moduleLabel || doc.sourceType} — "${doc.source}"\n` +
          `  ${doc.empreendimentoNome ? `Empreendimento: ${doc.empreendimentoNome}\n  ` : ''}` +
          `Trecho: ${doc.content.substring(0, 250)}...`
        ).join('\n\n')
      : '';

    const systemPrompt = buildSystemPrompt(unidade, dbContext, docsText);
    const historyMessages = (history || []).slice(-8).map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    }));

    const isAction = detectActionIntent(message);
    if (isAction) {
      console.log('[AI Stream] Action intent detected — using tool_choice: required');
    }

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      tools: AI_TOOLS,
      tool_choice: isAction ? 'required' : 'auto',
      temperature: isAction ? 0.2 : 0.7,
      max_tokens: 900,
      stream: true,
    });

    let fullContent = '';
    const toolCallAccum: { [index: number]: { id: string; name: string; arguments: string } } = {};

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullContent += delta.content;
        sendEvent('token', { content: delta.content });
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAccum[tc.index]) {
            toolCallAccum[tc.index] = { id: '', name: '', arguments: '' };
          }
          if (tc.id) toolCallAccum[tc.index].id += tc.id;
          if (tc.function?.name) toolCallAccum[tc.index].name += tc.function.name;
          if (tc.function?.arguments) toolCallAccum[tc.index].arguments += tc.function.arguments;
        }
      }
    }

    // Hallucination detection: AI wrote action text but called no tools
    const toolCallsList = Object.values(toolCallAccum);
    if (toolCallsList.length === 0 && fullContent) {
      const actionKeywords = /criei|criei a demanda|cadastrei|registrei|criado com sucesso|id:\s*#\d+|foi criado|foi cadastrado|já aparece|salvo no sistema/i;
      if (actionKeywords.test(fullContent)) {
        console.warn('[AI Stream] ⚠️ HALLUCINATION DETECTED: AI described an action in text but called no tools. Message:', message.substring(0, 100));
        console.warn('[AI Stream] AI response snippet:', fullContent.substring(0, 200));
      }
    }

    const toolMessages: any[] = [];

    for (const tc of toolCallsList) {
      let args: any = {};
      try { args = JSON.parse(tc.arguments || '{}'); } catch {}
      const result = await executeTool(tc.name, args, unidade, userId);
      sendEvent('action', { tool: tc.name, success: result.success, result: result.result, message: result.message });
      toolMessages.push({
        role: 'tool' as const,
        tool_call_id: tc.id || 'tool_0',
        content: JSON.stringify(result),
      });
    }

    // Follow-up response after tool execution
    if (toolMessages.length > 0) {
      const followupMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
        {
          role: 'assistant',
          content: null,
          tool_calls: toolCallsList.map((tc, i) => ({
            id: tc.id || `tool_${i}`,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        },
        ...toolMessages,
      ];

      const followup = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: followupMessages,
        temperature: 0.7,
        max_tokens: 400,
        stream: true,
      });

      for await (const chunk of followup) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          sendEvent('token', { content });
        }
      }
    }

    // Generate 3 follow-up suggestions
    let suggestions: string[] = ['Há vencimentos esta semana?', 'Quais demandas estão atrasadas?', 'Mostrar resumo geral'];
    try {
      const sugComp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Gere exatamente 3 perguntas curtas de acompanhamento em português brasileiro baseadas na conversa abaixo. Cada pergunta deve ter no máximo 8 palavras. Responda APENAS com um array JSON: ["pergunta1", "pergunta2", "pergunta3"]' },
          { role: 'user', content: `Pergunta: "${message.substring(0, 150)}" | Resposta: "${fullContent.substring(0, 200)}"` },
        ],
        temperature: 0.9,
        max_tokens: 120,
      });
      const raw = sugComp.choices[0].message.content || '[]';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length > 0) suggestions = parsed.slice(0, 3);
    } catch {}

    const documentCards = goodDocs.map((doc: any) => ({
      id: doc.id,
      source: doc.source,
      sourceType: doc.sourceType,
      module: doc.module,
      moduleLabel: doc.moduleLabel,
      fileUrl: doc.fileUrl,
      dropboxPath: doc.dropboxPath,
      empreendimentoNome: doc.empreendimentoNome,
      similarity: Math.round(doc.similarity * 100),
      snippet: doc.content.substring(0, 150) + '...',
    }));

    sendEvent('documents', documentCards);
    sendEvent('suggestions', suggestions);
    sendEvent('done', { success: true });

    await db.insert(aiConversations).values({
      unidade, userId, message, response: fullContent,
      context: { empreendimentoId, relevantDocs: goodDocs.map((d: any) => ({ id: d.id, source: d.source })) },
    }).catch(() => {});

    res.end();
  } catch (err: any) {
    console.error('[AI Stream] Error:', err);
    sendEvent('error', { message: err.message || 'Erro ao processar' });
    res.end();
  }
}

export async function getProactiveAlerts(unidade: string): Promise<any[]> {
  const alerts: any[] = [];
  try {
    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 86400000);
    const licencas = await storage.getLicencas();
    const empList = await storage.getEmpreendimentos(unidade);
    const empIds = new Set(empList.map((e: any) => e.id));

    for (const lic of licencas) {
      if (!empIds.has(lic.empreendimentoId)) continue;
      if (!lic.validade) continue;
      const val = new Date(lic.validade);
      if (val <= in7 && val >= today) {
        const emp = empList.find((e: any) => e.id === lic.empreendimentoId);
        alerts.push({ type: 'licenca_vencendo', severity: val <= new Date(today.getTime() + 2 * 86400000) ? 'critical' : 'warning', title: `Licença vence em breve`, message: `${lic.tipo || 'Licença'} #${lic.numero || lic.id} — ${emp?.nome || 'Empreendimento'}`, daysLeft: Math.ceil((val.getTime() - today.getTime()) / 86400000), link: `/licencas/vencer` });
      } else if (val < today && lic.status === 'ativa') {
        alerts.push({ type: 'licenca_vencida', severity: 'critical', title: 'Licença vencida!', message: `${lic.tipo || 'Licença'} #${lic.numero || lic.id} — venceu em ${lic.validade}`, link: `/licencas/vencidas` });
      }
    }

    const demandas = await storage.getDemandas({ unidade });
    for (const d of demandas as any[]) {
      if (!d.prazo || d.status === 'concluida' || d.status === 'cancelada') continue;
      const prazo = new Date(d.prazo);
      if (prazo < today) {
        alerts.push({ type: 'demanda_atrasada', severity: 'warning', title: 'Demanda atrasada', message: d.titulo, link: `/demandas` });
      } else if (prazo <= in7) {
        alerts.push({ type: 'demanda_vencendo', severity: 'info', title: 'Demanda vence esta semana', message: d.titulo, daysLeft: Math.ceil((prazo.getTime() - today.getTime()) / 86400000), link: `/demandas` });
      }
    }
  } catch (err: any) {
    console.error('[AI Alerts] Error:', err.message);
  }
  return alerts.slice(0, 8);
}

export async function getConversationHistory(unidade: string, userId: number, limit: number = 10) {
  return await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.userId, userId),
      eq(aiConversations.unidade, unidade)
    ))
    .orderBy(desc(aiConversations.criadoEm))
    .limit(limit);
}
