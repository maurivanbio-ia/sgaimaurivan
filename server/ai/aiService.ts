import OpenAI from 'openai';
import { db } from '../db';
import { aiConversations, aiLogs } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { searchSimilarDocuments } from './retriever';
import * as actions from './actions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface QueryOptions {
  unidade: string; // goiania, salvador, luiz-eduardo-magalhaes - OBRIGATÓRIO
  userId: number;
  message: string;
  empreendimentoId?: number;
  context?: any;
}

/**
 * Processa uma query do usuário e retorna resposta do agente
 * MULTI-TENANCY: Todas as operações são isoladas por unidade
 */
export async function processQuery(options: QueryOptions): Promise<string> {
  const { unidade, userId, message, empreendimentoId, context = {} } = options;
  
  try {
    // Log da ação (com unidade)
    await db.insert(aiLogs).values({
      unidade,
      userId,
      action: 'query',
      details: { message, empreendimentoId },
      status: 'success',
    });
    
    // Busca documentos relevantes (APENAS da unidade especificada)
    const relevantDocs = await searchSimilarDocuments(unidade, message, 3, empreendimentoId);
    
    // Monta contexto para o modelo
    const contextText = relevantDocs.length > 0
      ? `Documentos relevantes:\n${relevantDocs.map(doc => 
          `- ${doc.source} (${doc.sourceType}): ${doc.content.substring(0, 200)}...`
        ).join('\n')}`
      : 'Nenhum documento relevante encontrado.';
    
    // Detecta se a query requer ação (ISOLADA por unidade)
    const actionResponse = await detectAndExecuteAction(unidade, message, empreendimentoId);
    
    // Gera resposta usando GPT
    const systemPrompt = `Você é o EcoGestor-AI, um assistente inteligente especializado em gestão ambiental e licenciamento.
    
Sua função é ajudar os usuários a:
- Consultar informações sobre empreendimentos, licenças, contratos, demandas, frota e equipamentos
- Analisar documentos e relatórios
- Fornecer insights sobre prazos e compliance
- Executar ações quando solicitado

INSTRUÇÕES:
- Seja objetivo e profissional
- Use dados reais quando disponíveis
- Sempre que possível, cite as fontes (documentos, licenças, contratos)
- Se não tiver certeza sobre algo, diga claramente
- Formate respostas com markdown quando apropriado

DADOS DISPONÍVEIS:
${contextText}

${actionResponse ? `DADOS DA AÇÃO EXECUTADA:\n${JSON.stringify(actionResponse, null, 2)}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    const response = completion.choices[0].message.content || 'Desculpe, não consegui processar sua pergunta.';
    
    // Salva conversa (com unidade)
    await db.insert(aiConversations).values({
      unidade,
      userId,
      message,
      response,
      context: {
        empreendimentoId,
        relevantDocs: relevantDocs.map(d => ({ id: d.id, source: d.source })),
        actionExecuted: actionResponse ? true : false,
        ...context,
      },
    });
    
    return response;
  } catch (error: any) {
    console.error('Error processing query:', error);
    
    // Log do erro (com unidade)
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

/**
 * Detecta e executa ações baseadas na mensagem do usuário
 * MULTI-TENANCY: Todas as ações são executadas com filtro de unidade
 */
async function detectAndExecuteAction(unidade: string, message: string, empreendimentoId?: number): Promise<any | null> {
  const lowerMessage = message.toLowerCase();
  
  // Licenças vencendo (filtradas por unidade)
  if (lowerMessage.includes('licenças') && (lowerMessage.includes('vencem') || lowerMessage.includes('vencer'))) {
    const diasMatch = message.match(/(\d+)\s*dias?/);
    const dias = diasMatch ? parseInt(diasMatch[1]) : 60;
    return await actions.getLicencasVencendoEm(unidade, dias);
  }
  
  // Veículos em manutenção (filtrados por unidade)
  if (lowerMessage.includes('veículos') && lowerMessage.includes('manutenção')) {
    return await actions.getVeiculosEmManutencao(unidade);
  }
  
  // Equipamentos disponíveis (filtrados por unidade)
  if (lowerMessage.includes('equipamentos') && (lowerMessage.includes('disponíveis') || lowerMessage.includes('disponivel'))) {
    return await actions.getEquipamentosDisponiveis(unidade);
  }
  
  // Demandas pendentes (filtradas por unidade)
  if (lowerMessage.includes('demandas') && (lowerMessage.includes('pendentes') || lowerMessage.includes('pendente'))) {
    return await actions.getDemandasPendentes(unidade, empreendimentoId);
  }
  
  // Informações de empreendimento (já filtrado por unidade no banco)
  if (empreendimentoId && (lowerMessage.includes('info') || lowerMessage.includes('informações') || lowerMessage.includes('dados'))) {
    return await actions.getInfoEmpreendimento(unidade, empreendimentoId);
  }
  
  return null;
}

/**
 * Obtém histórico de conversas do usuário
 * MULTI-TENANCY: Filtra conversas apenas da unidade especificada E do usuário
 */
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
