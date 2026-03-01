import OpenAI from 'openai';
import { db } from '../db';
import { aiConversations, aiLogs } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { searchSimilarDocuments } from './retriever';
import { storage } from '../storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface QueryOptions {
  unidade: string;
  userId: number;
  message: string;
  empreendimentoId?: number;
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
  const { unidade, userId, message, empreendimentoId, context = {} } = options;

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

    const systemPrompt = `Você é o EcoGestor-AI, assistente inteligente da Ecobrasil Consultoria Ambiental especializado em gestão ambiental e licenciamento.

Você tem acesso **em tempo real** a TODOS os dados cadastrados na plataforma EcoGestor para a unidade "${unidade}". Os dados abaixo foram carregados diretamente do banco de dados agora mesmo — use-os para responder com precisão.

REGRAS:
- Responda sempre em português, de forma objetiva e profissional
- Use os dados abaixo como fonte primária de verdade — não invente dados
- Quando listar empreendimentos, licenças, etc., cite os nomes e IDs reais
- Formate respostas com markdown (tabelas, listas, negrito)
- Se a informação não estiver nos dados abaixo, diga claramente que não encontrou
- Para documentos (arquivos), mencione os cartões de documento abaixo da resposta

═══════════════════════════════════════════════════════
DADOS REAIS DA PLATAFORMA (unidade: ${unidade})
═══════════════════════════════════════════════════════
${dbContext}

${docsText}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.4,
      max_tokens: 1500,
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
