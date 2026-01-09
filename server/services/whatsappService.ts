import { db } from "../db";
import { users, empreendimentos, licencasAmbientais, condicionantes } from "@shared/schema";
import { eq, and, lte, gte, lt } from "drizzle-orm";

interface WhatsAppMessage {
  number: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  fileName?: string;
}

interface EvolutionResponse {
  key?: {
    remoteJid: string;
    id: string;
  };
  message?: any;
  status?: string;
  error?: string;
}

class WhatsAppService {
  private instanceUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.instanceUrl = process.env.EVOLUTION_INSTANCE_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
    this.instanceName = this.extractInstanceName();
  }

  private extractInstanceName(): string {
    const match = this.instanceUrl.match(/instances\/([^\/]+)/);
    return match ? match[1] : "ecobrasil-prod";
  }

  private getBaseUrl(): string {
    const urlParts = this.instanceUrl.split("/instances/");
    return urlParts[0] || "https://api.evolution.com";
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("55")) {
      cleaned = "55" + cleaned;
    }
    return cleaned + "@s.whatsapp.net";
  }

  async sendTextMessage(phone: string, message: string): Promise<EvolutionResponse> {
    if (!this.instanceUrl || !this.apiKey) {
      console.error("[WhatsApp] Evolution API não configurada");
      return { error: "Evolution API não configurada" };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phone);
      const baseUrl = this.getBaseUrl();
      
      const response = await fetch(`${baseUrl}/message/sendText/${this.instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey,
        },
        body: JSON.stringify({
          number: formattedNumber,
          text: message,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("[WhatsApp] Erro ao enviar mensagem:", data);
        return { error: data.message || "Erro ao enviar mensagem" };
      }

      console.log("[WhatsApp] Mensagem enviada com sucesso para:", phone);
      return data;
    } catch (error) {
      console.error("[WhatsApp] Erro de conexão:", error);
      return { error: "Erro de conexão com Evolution API" };
    }
  }

  async sendMediaMessage(
    phone: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "document",
    caption?: string,
    fileName?: string
  ): Promise<EvolutionResponse> {
    if (!this.instanceUrl || !this.apiKey) {
      return { error: "Evolution API não configurada" };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phone);
      const baseUrl = this.getBaseUrl();
      
      const endpoint = mediaType === "document" 
        ? `${baseUrl}/message/sendMedia/${this.instanceName}`
        : `${baseUrl}/message/sendMedia/${this.instanceName}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey,
        },
        body: JSON.stringify({
          number: formattedNumber,
          mediatype: mediaType,
          media: mediaUrl,
          caption: caption || "",
          fileName: fileName || "arquivo",
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("[WhatsApp] Erro ao enviar mídia:", data);
        return { error: data.message || "Erro ao enviar mídia" };
      }

      return data;
    } catch (error) {
      console.error("[WhatsApp] Erro de conexão:", error);
      return { error: "Erro de conexão com Evolution API" };
    }
  }

  async sendLicenseExpirationAlert(
    phone: string,
    licenseName: string,
    enterpriseName: string,
    expirationDate: string,
    daysRemaining: number
  ): Promise<EvolutionResponse> {
    const urgency = daysRemaining <= 7 ? "🔴 URGENTE" : daysRemaining <= 30 ? "🟡 ATENÇÃO" : "🟢 AVISO";
    
    const message = `${urgency} - *Alerta de Licença Ambiental*

📋 *Licença:* ${licenseName}
🏢 *Empreendimento:* ${enterpriseName}
📅 *Vencimento:* ${expirationDate}
⏰ *Dias restantes:* ${daysRemaining}

${daysRemaining <= 7 
  ? "⚠️ Esta licença vence em menos de uma semana! Ação imediata necessária."
  : daysRemaining <= 30 
    ? "📌 Inicie o processo de renovação para evitar problemas."
    : "ℹ️ Agende a renovação com antecedência."}

_EcoGestor - Sistema de Gestão Ambiental_`;

    return this.sendTextMessage(phone, message);
  }

  async sendConditionanteAlert(
    phone: string,
    conditionanteName: string,
    licenseName: string,
    dueDate: string,
    daysRemaining: number
  ): Promise<EvolutionResponse> {
    const urgency = daysRemaining <= 7 ? "🔴 URGENTE" : daysRemaining <= 15 ? "🟡 ATENÇÃO" : "🟢 AVISO";
    
    const message = `${urgency} - *Alerta de Condicionante*

📝 *Condicionante:* ${conditionanteName}
📋 *Licença:* ${licenseName}
📅 *Prazo:* ${dueDate}
⏰ *Dias restantes:* ${daysRemaining}

${daysRemaining <= 7 
  ? "⚠️ Prazo crítico! Complete esta condicionante imediatamente."
  : "📌 Verifique o status e providencie o cumprimento."}

_EcoGestor - Sistema de Gestão Ambiental_`;

    return this.sendTextMessage(phone, message);
  }

  async sendTaskAssignmentAlert(
    phone: string,
    taskTitle: string,
    assignerName: string,
    dueDate: string,
    priority: string
  ): Promise<EvolutionResponse> {
    const priorityIcon = priority === "alta" ? "🔴" : priority === "media" ? "🟡" : "🟢";
    
    const message = `📋 *Nova Tarefa Atribuída*

${priorityIcon} *Prioridade:* ${priority.toUpperCase()}
📝 *Tarefa:* ${taskTitle}
👤 *Atribuída por:* ${assignerName}
📅 *Prazo:* ${dueDate}

Acesse o EcoGestor para mais detalhes.

_EcoGestor - Gestão de Equipe_`;

    return this.sendTextMessage(phone, message);
  }

  async sendDemandAlert(
    phone: string,
    demandTitle: string,
    sector: string,
    dueDate: string,
    priority: string
  ): Promise<EvolutionResponse> {
    const priorityIcon = priority === "alta" ? "🔴" : priority === "media" ? "🟡" : "🟢";
    
    const message = `📢 *Nova Demanda*

${priorityIcon} *Prioridade:* ${priority.toUpperCase()}
📝 *Título:* ${demandTitle}
🏷️ *Setor:* ${sector}
📅 *Prazo:* ${dueDate}

Acesse o EcoGestor para mais detalhes.

_EcoGestor - Sistema de Gestão Ambiental_`;

    return this.sendTextMessage(phone, message);
  }

  async sendGenericAlert(
    phone: string,
    title: string,
    message: string
  ): Promise<EvolutionResponse> {
    const fullMessage = `📢 *${title}*

${message}

_EcoGestor - Sistema de Gestão Ambiental_`;

    return this.sendTextMessage(phone, fullMessage);
  }

  async checkInstanceStatus(): Promise<{ connected: boolean; state?: string; error?: string }> {
    if (!this.instanceUrl || !this.apiKey) {
      return { connected: false, error: "Evolution API não configurada" };
    }

    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/instance/connectionState/${this.instanceName}`, {
        method: "GET",
        headers: {
          "apikey": this.apiKey,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        return { connected: false, error: data.message || "Erro ao verificar status" };
      }

      return { 
        connected: data.state === "open" || data.instance?.state === "open",
        state: data.state || data.instance?.state
      };
    } catch (error) {
      console.error("[WhatsApp] Erro ao verificar status:", error);
      return { connected: false, error: "Erro de conexão" };
    }
  }

  async processIncomingMessage(webhookData: any): Promise<{ response?: string; action?: string }> {
    try {
      const messageData = webhookData.data;
      if (!messageData) return {};

      const remoteJid = messageData.key?.remoteJid || "";
      const messageText = messageData.message?.conversation || 
                          messageData.message?.extendedTextMessage?.text || "";
      
      const phone = remoteJid.replace("@s.whatsapp.net", "");
      const lowerMessage = messageText.toLowerCase().trim();

      if (lowerMessage === "status" || lowerMessage === "licencas" || lowerMessage === "licenças") {
        return {
          response: "📊 Para consultar suas licenças, acesse o Portal do Cliente em nosso sistema ou entre em contato com seu coordenador.",
          action: "status_query"
        };
      }

      if (lowerMessage === "ajuda" || lowerMessage === "help" || lowerMessage === "menu") {
        return {
          response: `🌿 *EcoBrasil - Comandos Disponíveis*

📋 *status* - Consultar status geral
📄 *licencas* - Informações sobre licenças
👤 *contato* - Falar com um atendente
❓ *ajuda* - Ver este menu

Para outras solicitações, responda com sua mensagem e nossa equipe entrará em contato.`,
          action: "help_menu"
        };
      }

      if (lowerMessage === "contato" || lowerMessage === "atendente" || lowerMessage === "humano") {
        return {
          response: "👋 Entendido! Um membro da nossa equipe entrará em contato em breve. Horário de atendimento: Seg-Sex, 8h às 18h.",
          action: "human_request"
        };
      }

      return {
        response: "Obrigado pela sua mensagem! Para atendimento, digite *ajuda* para ver os comandos disponíveis ou aguarde o contato de nossa equipe.",
        action: "default_response"
      };
    } catch (error) {
      console.error("[WhatsApp] Erro ao processar mensagem:", error);
      return {};
    }
  }
}

export const whatsappService = new WhatsAppService();
