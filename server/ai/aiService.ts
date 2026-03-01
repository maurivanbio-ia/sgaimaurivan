import OpenAI from 'openai';
import { db } from '../db';
import { aiConversations, aiLogs } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { searchSimilarDocuments, SearchResult } from './retriever';
import * as actions from './actions';

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

/**
 * Processa uma query do usuário e retorna resposta + documentos relevantes
 * MULTI-TENANCY: Todas as operações são isoladas por unidade
 */
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

    const relevantDocs = await searchSimilarDocuments(unidade, message, 5, empreendimentoId);

    const SIMILARITY_THRESHOLD = 0.25;
    const goodDocs = relevantDocs.filter(d => d.similarity >= SIMILARITY_THRESHOLD);

    const contextText = goodDocs.length > 0
      ? `Documentos relevantes encontrados na plataforma:\n${goodDocs.map((doc, i) =>
          `[DOC ${i + 1}] ${doc.moduleLabel || doc.sourceType} — "${doc.source}"\n` +
          `Localização: ${doc.dropboxPath || 'Plataforma'}\n` +
          `${doc.empreendimentoNome ? `Empreendimento: ${doc.empreendimentoNome}\n` : ''}` +
          `Trecho: ${doc.content.substring(0, 300)}...`
        ).join('\n\n')}`
      : 'Nenhum documento relevante encontrado para esta consulta.';

    const actionResponse = await detectAndExecuteAction(unidade, message, empreendimentoId);

    const systemPrompt = `Você é o EcoGestor-AI, assistente inteligente especializado em gestão ambiental e licenciamento da Ecobrasil Consultoria Ambiental.

Sua função é ajudar os usuários a:
- Localizar documentos na plataforma e no Dropbox
- Consultar informações sobre empreendimentos, licenças, contratos, demandas, frota e equipamentos
- Analisar documentos e relatórios técnicos
- Fornecer insights sobre prazos e compliance ambiental
- Executar ações quando solicitado

INSTRUÇÕES IMPORTANTES:
- Seja objetivo e profissional
- Quando encontrar documentos relevantes, informe ONDE o documento está na plataforma e no Dropbox
- Cite sempre o nome do módulo e a pasta Dropbox quando localizar documentos
- Use dados reais quando disponíveis
- Formate respostas com markdown quando apropriado
- Se o usuário perguntar "onde está o documento X?", pesquise e informe o módulo e caminho completo
- Quando documentos forem encontrados, mencione que o usuário pode clicar nos cartões de documento abaixo da resposta

DOCUMENTOS DISPONÍVEIS (resultado da busca semântica):
${contextText}

${actionResponse ? `DADOS OPERACIONAIS DO SISTEMA:\n${JSON.stringify(actionResponse, null, 2)}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.6,
      max_tokens: 1200,
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
        actionExecuted: actionResponse ? true : false,
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
    });

    throw new Error('Erro ao processar sua pergunta. Tente novamente.');
  }
}

async function detectAndExecuteAction(unidade: string, message: string, empreendimentoId?: number): Promise<any | null> {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('licenças') && (lowerMessage.includes('vencem') || lowerMessage.includes('vencer'))) {
    const diasMatch = message.match(/(\d+)\s*dias?/);
    const dias = diasMatch ? parseInt(diasMatch[1]) : 60;
    return await actions.getLicencasVencendoEm(unidade, dias);
  }

  if (lowerMessage.includes('veículos') && lowerMessage.includes('manutenção')) {
    return await actions.getVeiculosEmManutencao(unidade);
  }

  if (lowerMessage.includes('equipamentos') && (lowerMessage.includes('disponíveis') || lowerMessage.includes('disponivel'))) {
    return await actions.getEquipamentosDisponiveis(unidade);
  }

  if (lowerMessage.includes('demandas') && (lowerMessage.includes('pendentes') || lowerMessage.includes('pendente'))) {
    return await actions.getDemandasPendentes(unidade, empreendimentoId);
  }

  if (empreendimentoId && (lowerMessage.includes('info') || lowerMessage.includes('informações') || lowerMessage.includes('dados'))) {
    return await actions.getInfoEmpreendimento(unidade, empreendimentoId);
  }

  return null;
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
