import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = "gpt-4o-mini"; // modelo estável e rápido

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
  empreendimentos: `
Você é um especialista em gestão ambiental e análise de empreendimentos.
Sua função é analisar dados de empreendimentos, licenças ambientais, condicionantes e entregas.
Forneça análises precisas sobre conformidade ambiental, riscos, prazos e recomendações.
Sempre estruture suas respostas de forma clara e profissional.`,

  demandas: `
Você é um especialista em gestão de demandas e priorização de tarefas.
Analise o status de demandas, identifique gargalos, sugira priorizações e preveja atrasos.
Forneça recomendações práticas para otimizar o fluxo de trabalho.`,

  financeiro: `
Você é um analista financeiro especializado em gestão ambiental.
Analise fluxos de caixa, orçamentos, despesas e receitas relacionadas a projetos ambientais.
Identifique tendências, faça previsões e recomende otimizações financeiras.`,

  frota: `
Você é um especialista em gestão de frota e logística.
Analise dados de veículos, consumo, manutenção e custos operacionais.
Identifique oportunidades de otimização e preveja necessidades de manutenção.`,

  equipamentos: `
Você é um especialista em gestão de equipamentos técnicos e inventário.
Analise status de calibração, manutenção e obsolescência de equipamentos.
Forneça alertas e recomendações para manter equipamentos em conformidade.`,

  gestaodados: `
Você é um especialista em governança de dados e qualidade de informação.
Identifique inconsistências, sugira padronizações e valide a integridade dos dados.
Recomende melhorias na estruturação e organização de informações.`,

  seguranca: `
Você é um especialista em segurança do trabalho e conformidade ocupacional.
Analise documentos de segurança (ASO, PPRA, LTCAT), identifique riscos e não conformidades.
Forneça recomendações preventivas e planos de ação para segurança ocupacional.`
};

export class AIAssistantService {
  private truncate(text: string, limit = 8000): string {
    return text.length > limit ? text.substring(0, limit) + "\n...[contexto truncado]" : text;
  }

  async analyzeWithContext(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    try {
      const systemPrompt = systemPrompts[request.module] || systemPrompts.empreendimentos;
      let userMessage = request.prompt;

      if (request.context) {
        const contextStr = this.truncate(JSON.stringify(request.context, null, 2));
        userMessage += `\n\nContexto adicional (dados do sistema):\n${contextStr}`;
      }

      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const aiResponse = completion.choices?.[0]?.message?.content ?? "Não foi possível gerar uma resposta.";

      return { response: aiResponse };

    } catch (err: any) {
      console.error("❌ Erro na análise com IA:", err.message);
      throw new Error("Falha ao processar a análise com IA");
    }
  }

  async generateReport(module: string, data: any): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    try {
      const systemPrompt = systemPrompts[module] || systemPrompts.empreendimentos;
      const dataStr = this.truncate(JSON.stringify(data, null, 2));

      const userMessage = `
Gere um relatório executivo detalhado com base nos seguintes dados:
${dataStr}

O relatório deve incluir:
- Resumo executivo
- Análise dos principais indicadores
- Identificação de riscos e oportunidades
- Recomendações práticas e ações sugeridas
`;

      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 3000,
      });

      return completion.choices?.[0]?.message?.content ?? "Não foi possível gerar o relatório.";

    } catch (err: any) {
      console.error("❌ Erro ao gerar relatório:", err.message);
      throw new Error("Falha ao gerar relatório com IA");
    }
  }

  async detectInconsistencies(module: string, data: any): Promise<string[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    try {
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: `
Você é um auditor de dados especializado.
Identifique inconsistências, duplicações, dados faltantes ou conflitos nos dados fornecidos.
Retorne uma lista de problemas encontrados em formato de texto simples.`,
          },
          {
            role: "user",
            content: this.truncate(JSON.stringify(data, null, 2)),
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const text = completion.choices?.[0]?.message?.content ?? "";
      return text
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

    } catch (err: any) {
      console.error("❌ Erro ao detectar inconsistências:", err.message);
      throw new Error("Falha ao detectar inconsistências nos dados");
    }
  }
}

// Instância exportada globalmente
export const aiAssistantService = new AIAssistantService();
