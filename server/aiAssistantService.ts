import OpenAI from "openai";

const DEFAULT_MODEL_STR = "gpt-4-turbo";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIAnalysisRequest {
  module: string;
  prompt: string;
  context?: any;
}

export interface AIAnalysisResponse {
  response: string;
  suggestions?: string[];
}

const systemPrompts: Record<string, string> = {
  empreendimentos: `Você é um especialista em gestão ambiental e análise de empreendimentos.
Sua função é analisar dados de empreendimentos, licenças ambientais, condicionantes e entregas.
Forneça análises precisas sobre conformidade ambiental, riscos, prazos e recomendações.
Sempre estruture suas respostas de forma clara e profissional.`,

  demandas: `Você é um especialista em gestão de demandas e priorização de tarefas.
Analise o status de demandas, identifique gargalos, sugira priorizações e preveja atrasos.
Forneça recomendações práticas para otimizar o fluxo de trabalho.`,

  financeiro: `Você é um analista financeiro especializado em gestão ambiental.
Analise fluxos de caixa, orçamentos, despesas e receitas relacionadas a projetos ambientais.
Identifique tendências, faça previsões e recomende otimizações financeiras.`,

  frota: `Você é um especialista em gestão de frota e logística.
Analise dados de veículos, consumo, manutenção e custos operacionais.
Identifique oportunidades de otimização e preveja necessidades de manutenção.`,

  equipamentos: `Você é um especialista em gestão de equipamentos técnicos e inventário.
Analise status de calibração, manutenção e obsolescência de equipamentos.
Forneça alertas e recomendações para manter equipamentos em conformidade.`,

  gestaodados: `Você é um especialista em governança de dados e qualidade de informação.
Identifique inconsistências, sugira padronizações e valide a integridade dos dados.
Recomende melhorias na estruturação e organização de informações.`,

  seguranca: `Você é um especialista em segurança do trabalho e conformidade ocupacional.
Analise documentos de segurança (ASO, PPRA, LTCAT), identifique riscos e não conformidades.
Forneça recomendações preventivas e planos de ação para segurança ocupacional.`,
};

export class AIAssistantService {
  async analyzeWithContext(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY não configurada");
      }

      const systemPrompt = systemPrompts[request.module] || systemPrompts.empreendimentos;
      
      let userMessage = request.prompt;
      
      if (request.context) {
        const contextStr = JSON.stringify(request.context, null, 2);
        const maxContextLength = 10000;
        const truncatedContext = contextStr.length > maxContextLength 
          ? contextStr.substring(0, maxContextLength) + "\n...[contexto truncado]" 
          : contextStr;
        userMessage += `\n\nContexto adicional (dados do sistema):\n${truncatedContext}`;
      }

      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL_STR,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiResponse = response.choices[0].message.content || "Não foi possível gerar uma resposta.";

      return {
        response: aiResponse,
      };
    } catch (error) {
      console.error("Erro ao analisar com IA:", error);
      throw new Error("Erro na análise com IA");
    }
  }

  async generateReport(module: string, data: any): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY não configurada");
      }

      const systemPrompt = systemPrompts[module] || systemPrompts.empreendimentos;
      
      const userMessage = `Gere um relatório executivo detalhado com base nos seguintes dados:\n\n${JSON.stringify(data, null, 2)}\n\nO relatório deve incluir:\n- Resumo executivo\n- Análise dos principais indicadores\n- Identificação de riscos e oportunidades\n- Recomendações práticas`;

      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL_STR,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.5,
        max_tokens: 3000,
      });

      return response.choices[0].message.content || "Não foi possível gerar o relatório.";
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      throw new Error("Erro ao gerar relatório");
    }
  }

  async detectInconsistencies(module: string, data: any): Promise<string[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    try {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL_STR,
        messages: [
          {
            role: "system",
            content: "Você é um auditor de dados especializado. Identifique inconsistências, duplicações, dados faltantes ou conflitos nos dados fornecidos. Retorne uma lista de problemas encontrados.",
          },
          {
            role: "user",
            content: `Analise os seguintes dados e liste todas as inconsistências encontradas:\n\n${JSON.stringify(data, null, 2)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const result = response.choices[0].message.content || "";
      
      return result.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      console.error("Erro ao detectar inconsistências:", error);
      throw new Error("Erro ao detectar inconsistências");
    }
  }
}

export const aiAssistantService = new AIAssistantService();
