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
  userId: number;
  message: string;
  empreendimentoId?: number;
  context?: any;
}

/**
 * Processa uma query do usuário e retorna resposta do agente
 */
export async function processQuery(options: QueryOptions): Promise<string> {
  const { userId, message, empreendimentoId, context = {} } = options;
  
  try {
    // Log da ação
    await db.insert(aiLogs).values({
      userId,
      action: 'query',
      details: { message, empreendimentoId },
      status: 'success',
    });
    
    // Busca documentos relevantes
    const relevantDocs = await searchSimilarDocuments(message, 3, empreendimentoId);
    
    // Monta contexto para o modelo
    const contextText = relevantDocs.length > 0
      ? `Documentos relevantes:\n${relevantDocs.map(doc => 
          `- ${doc.source} (${doc.sourceType}): ${doc.content.substring(0, 200)}...`
        ).join('\n')}`
      : 'Nenhum documento relevante encontrado.';
    
    // Detecta se a query requer ação
    const actionResponse = await detectAndExecuteAction(message, empreendimentoId);
    
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
    
    // Salva conversa
    await db.insert(aiConversations).values({
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
    
    // Log do erro
    await db.insert(aiLogs).values({
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
 */
async function detectAndExecuteAction(message: string, empreendimentoId?: number): Promise<any | null> {
  const lowerMessage = message.toLowerCase();
  
  // Licenças vencendo
  if (lowerMessage.includes('licenças') && (lowerMessage.includes('vencem') || lowerMessage.includes('vencer'))) {
    const diasMatch = message.match(/(\d+)\s*dias?/);
    const dias = diasMatch ? parseInt(diasMatch[1]) : 60;
    return await actions.getLicencasVencendoEm(dias);
  }
  
  // Veículos em manutenção
  if (lowerMessage.includes('veículos') && lowerMessage.includes('manutenção')) {
    return await actions.getVeiculosEmManutencao();
  }
  
  // Equipamentos disponíveis
  if (lowerMessage.includes('equipamentos') && (lowerMessage.includes('disponíveis') || lowerMessage.includes('disponivel'))) {
    return await actions.getEquipamentosDisponiveis();
  }
  
  // Demandas pendentes
  if (lowerMessage.includes('demandas') && (lowerMessage.includes('pendentes') || lowerMessage.includes('pendente'))) {
    return await actions.getDemandasPendentes(empreendimentoId);
  }
  
  // Informações de empreendimento
  if (empreendimentoId && (lowerMessage.includes('info') || lowerMessage.includes('informações') || lowerMessage.includes('dados'))) {
    return await actions.getInfoEmpreendimento(empreendimentoId);
  }
  
  return null;
}

/**
 * Obtém histórico de conversas do usuário
 */
export async function getConversationHistory(userId: number, limit: number = 10) {
  return await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.criadoEm))
    .limit(limit);
}
