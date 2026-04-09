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
  private n8nWebhookUrl: string;
  private zapiInstanceId: string;
  private zapiToken: string;
  private zapiClientToken: string;

  constructor() {
    this.instanceUrl = process.env.EVOLUTION_INSTANCE_URL || "";
    this.apiKey = process.env.EVOLUTION_API_KEY || "";
    this.instanceName = this.extractInstanceName();
    this.n8nWebhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";
    this.zapiInstanceId = process.env.ZAPI_INSTANCE_ID || "";
    this.zapiToken = process.env.ZAPI_TOKEN || "";
    this.zapiClientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  }

  private extractInstanceName(): string {
    const match = this.instanceUrl.match(/instances\/([^\/]+)/);
    return match ? match[1] : "ecobrasil-prod";
  }

  private getBaseUrl(): string {
    const urlParts = this.instanceUrl.split("/instances/");
    return urlParts[0] || "https://api.evolution.com";
  }

  // Normaliza número para Z-API:
  // - Grupos: mantém @g.us (Z-API exige para grupos)
  // - Individuais: remove @s.whatsapp.net (Z-API usa só dígitos)
  private normalizePhoneForZapi(input: string): string {
    return input.replace(/@s\.whatsapp\.net$/, "");
  }

  // Envia mensagem via Z-API (prioridade máxima quando configurado)
  private async sendViaZApi(number: string, message: string): Promise<EvolutionResponse> {
    const phone = this.normalizePhoneForZapi(number);
    const url = `https://api.z-api.io/instances/${this.zapiInstanceId}/token/${this.zapiToken}/send-text`;
    try {
      console.log(`[WhatsApp→Z-API] Enviando para: ${phone}`);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (this.zapiClientToken) headers["Client-Token"] = this.zapiClientToken;
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone, message }),
      });
      const rawText = await response.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch {}
      console.log(`[WhatsApp→Z-API] Resposta HTTP ${response.status}:`, rawText.substring(0, 300));
      if (!response.ok) {
        console.error("[WhatsApp→Z-API] Erro:", JSON.stringify(data));
        return { error: data.message || data.error || `Z-API erro HTTP ${response.status}: ${rawText.substring(0, 200)}` };
      }
      console.log(`[WhatsApp→Z-API] Mensagem enviada com sucesso para ${phone}`);
      return { status: "SENT" };
    } catch (error: any) {
      console.error("[WhatsApp→Z-API] Erro de conexão:", error?.message);
      return { error: `Erro Z-API: ${error?.message || "verifique as credenciais"}` };
    }
  }

  // Envia mensagem via webhook do n8n (que repassa para a Evolution API local)
  private async sendViaN8nWebhook(number: string, message: string): Promise<EvolutionResponse> {
    try {
      console.log(`[WhatsApp→n8n] Enviando via webhook n8n para: ${number}`);
      const response = await fetch(this.n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[WhatsApp→n8n] Webhook retornou erro:", JSON.stringify(data));
        return { error: data.message || data.error || `Webhook n8n erro HTTP ${response.status}` };
      }
      console.log(`[WhatsApp→n8n] Mensagem enviada com sucesso via n8n para ${number}`);
      return { status: "SENT" };
    } catch (error: any) {
      console.error("[WhatsApp→n8n] Erro de conexão com webhook n8n:", error?.message);
      return { error: `Erro n8n: ${error?.message || "verifique a URL do webhook"}` };
    }
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("55")) {
      cleaned = "55" + cleaned;
    }
    return cleaned + "@s.whatsapp.net";
  }

  async sendTextMessage(phone: string, message: string): Promise<EvolutionResponse> {
    const formattedNumber = this.formatPhoneNumber(phone);
    if (this.zapiInstanceId && this.zapiToken) {
      return this.sendViaZApi(formattedNumber, message);
    }
    if (this.n8nWebhookUrl) {
      return this.sendViaN8nWebhook(formattedNumber, message);
    }
    if (!this.instanceUrl || !this.apiKey) {
      console.error("[WhatsApp] Evolution API não configurada");
      return { error: "Evolution API não configurada" };
    }

    try {
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

  // Normaliza o destino: aceita número de telefone brasileiro OU JID completo (@g.us / @s.whatsapp.net)
  normalizeJid(input: string): string {
    const trimmed = input.trim();
    // Já é um JID completo
    if (trimmed.includes("@")) return trimmed;
    // É um número de telefone — formata para JID individual brasileiro
    const digits = trimmed.replace(/\D/g, "");
    // Se não tem código de país, adiciona 55
    const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
    return `${withCountry}@s.whatsapp.net`;
  }

  // Envia mensagem para um grupo ou número WhatsApp
  // Aceita: JID de grupo (XXXXXXXXXXX@g.us), JID individual (@s.whatsapp.net), ou número bruto ex: "62994285690"
  async sendGroupMessage(groupJid: string, message: string): Promise<EvolutionResponse> {
    const resolvedJid = this.normalizeJid(groupJid);
    if (this.zapiInstanceId && this.zapiToken) {
      return this.sendViaZApi(resolvedJid, message);
    }
    if (this.n8nWebhookUrl) {
      return this.sendViaN8nWebhook(resolvedJid, message);
    }
    if (!this.instanceUrl || !this.apiKey) {
      console.error("[WhatsApp] Evolution API não configurada");
      return { error: "Evolution API não configurada" };
    }
    try {
      const baseUrl = this.getBaseUrl();
      const endpoint = `${baseUrl}/message/sendText/${this.instanceName}`;
      console.log(`[WhatsApp] Enviando para: ${endpoint} | JID: ${resolvedJid}`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": this.apiKey },
        body: JSON.stringify({ number: resolvedJid, text: message }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("[WhatsApp] Erro ao enviar mensagem:", JSON.stringify(data));
        return { error: data.message || data.error || "Erro ao enviar mensagem" };
      }
      console.log(`[WhatsApp] Mensagem enviada para ${resolvedJid} (entrada: ${groupJid})`);
      return data;
    } catch (error: any) {
      console.error("[WhatsApp] Erro de conexão com Evolution API:", error?.message || error);
      return { error: `Erro de conexão: ${error?.message || "verifique a URL da Evolution API"}` };
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private calcPrazoInfo(dataEntregaISO: string | null | undefined): { texto: string; linha: string } {
    if (!dataEntregaISO) return { texto: "Sem prazo definido", linha: "📅 *Prazo:* _sem prazo definido_" };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const prazo = new Date(dataEntregaISO);
    prazo.setHours(0, 0, 0, 0);
    const diff = Math.round((prazo.getTime() - hoje.getTime()) / 86_400_000);
    const prazoFmt = prazo.toLocaleDateString("pt-BR");
    let statusPrazo: string;
    if (diff < 0) {
      statusPrazo = `⚠️ *ATRASADO há ${Math.abs(diff)} dia(s)*`;
    } else if (diff === 0) {
      statusPrazo = `🔔 *Vence HOJE!*`;
    } else if (diff <= 3) {
      statusPrazo = `🟠 Faltam *${diff} dia(s)* — urgente`;
    } else if (diff <= 7) {
      statusPrazo = `🟡 Faltam *${diff} dia(s)*`;
    } else {
      statusPrazo = `🟢 Faltam *${diff} dia(s)*`;
    }
    return {
      texto: prazoFmt,
      linha: `📅 *Prazo:* ${prazoFmt}\n   ${statusPrazo}`,
    };
  }

  private ecoBrandHeader(title: string): string[] {
    return [
      `🌿 *ECOBRASIL* | _Consultoria Ambiental_`,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `*${title}*`,
      ``,
    ];
  }

  private ecoBrandFooter(): string[] {
    return [
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━`,
      `🌿 _EcoBrasil · EcoGestor® · Sistema de Gestão Ambiental_`,
    ];
  }

  private setorLabel(setor: string): string {
    const map: Record<string, string> = {
      licenciamento: "Licenciamento", monitoramento: "Monitoramento",
      compensacao: "Compensação Ambiental", juridico: "Jurídico",
      administrativo: "Administrativo", financeiro: "Financeiro", outro: "Outro",
    };
    return map[setor] || setor;
  }

  private prioLabel(prioridade: string): string {
    if (prioridade === "alta") return "🔴 Alta";
    if (prioridade === "media") return "🟡 Média";
    return "🟢 Baixa";
  }

  private statusLabel(status: string): string {
    const map: Record<string, string> = {
      a_fazer: "📌 A Fazer", em_andamento: "🔵 Em Andamento",
      em_revisao: "🟠 Em Revisão", concluido: "✅ Concluído",
      cancelado: "❌ Cancelado", pausado: "⏸️ Pausado",
    };
    return map[status] || status;
  }

  // ─── public message builders ─────────────────────────────────────────────

  buildNovaDemandaMessage(demanda: {
    titulo: string;
    setor: string;
    prioridade: string;
    dataEntrega?: string | null;
    dataEntregaISO?: string | null;
    responsavel?: string;
    empreendimento?: string;
    descricao?: string;
  }): string {
    const prazo = this.calcPrazoInfo(demanda.dataEntregaISO);
    const lines = [
      ...this.ecoBrandHeader("📋 NOVA DEMANDA CADASTRADA"),
      `📝 *Título:* ${demanda.titulo}`,
      `🏷️ *Setor:* ${this.setorLabel(demanda.setor)}`,
      `⚡ *Prioridade:* ${this.prioLabel(demanda.prioridade)}`,
    ];
    if (demanda.responsavel) lines.push(`👤 *Responsável:* ${demanda.responsavel}`);
    if (demanda.empreendimento) lines.push(`🏢 *Empreendimento:* ${demanda.empreendimento}`);
    lines.push(prazo.linha);
    if (demanda.descricao) lines.push(``, `📄 _${demanda.descricao.slice(0, 180)}${demanda.descricao.length > 180 ? '...' : ''}_`);
    lines.push(...this.ecoBrandFooter());
    return lines.join("\n");
  }

  buildMudancaStatusMessage(demanda: {
    titulo: string;
    setor: string;
    prioridade: string;
    statusAnterior: string;
    statusNovo: string;
    dataEntregaISO?: string | null;
    responsavel?: string;
    empreendimento?: string;
  }): string {
    const prazo = this.calcPrazoInfo(demanda.dataEntregaISO);
    const lines = [
      ...this.ecoBrandHeader("🔄 ATUALIZAÇÃO DE STATUS"),
      `📝 *Demanda:* ${demanda.titulo}`,
      `🏷️ *Setor:* ${this.setorLabel(demanda.setor)}`,
      `⚡ *Prioridade:* ${this.prioLabel(demanda.prioridade)}`,
    ];
    if (demanda.responsavel) lines.push(`👤 *Responsável:* ${demanda.responsavel}`);
    if (demanda.empreendimento) lines.push(`🏢 *Empreendimento:* ${demanda.empreendimento}`);
    lines.push(
      ``,
      `📊 *Status atualizado:*`,
      `   ~${this.statusLabel(demanda.statusAnterior)}~  →  *${this.statusLabel(demanda.statusNovo)}*`,
      ``,
      prazo.linha,
    );
    lines.push(...this.ecoBrandFooter());
    return lines.join("\n");
  }

  buildResumoDemandas(demandas: Array<{
    titulo: string;
    setor: string;
    prioridade: string;
    dataEntrega: string;
    dataEntregaISO?: string | null;
    status: string;
  }>, periodo: string): string {
    const atrasadas = demandas.filter(d => {
      if (!d.dataEntregaISO) return false;
      const prazo = new Date(d.dataEntregaISO);
      prazo.setHours(0, 0, 0, 0);
      return prazo < new Date(new Date().setHours(0, 0, 0, 0)) && d.status !== 'concluido' && d.status !== 'cancelado';
    }).length;

    const lines = [
      ...this.ecoBrandHeader("📊 RESUMO SEMANAL DE DEMANDAS"),
      `📅 *Período:* ${periodo}`,
      `📦 *Total:* ${demandas.length} demanda(s)`,
      atrasadas > 0 ? `⚠️ *Atrasadas:* ${atrasadas}` : `✅ Nenhuma demanda atrasada`,
      ``,
    ];

    if (demandas.length === 0) {
      lines.push("_Nenhuma demanda registrada para este período._");
    } else {
      demandas.slice(0, 15).forEach((d, i) => {
        const prazo = this.calcPrazoInfo(d.dataEntregaISO || null);
        lines.push(`*${i + 1}.* ${d.titulo}`);
        lines.push(`   ${this.prioLabel(d.prioridade)} | ${this.statusLabel(d.status)}`);
        lines.push(`   ${prazo.linha.split("\n")[0].replace("📅 *Prazo:* ", "📅 ")}`);
        if (i < demandas.slice(0, 15).length - 1) lines.push(``);
      });
      if (demandas.length > 15) lines.push(``, `_... e mais ${demandas.length - 15} demanda(s)._`);
    }

    lines.push(...this.ecoBrandFooter());
    return lines.join("\n");
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
