// Evolution API WhatsApp Service
interface EvolutionResponse {
  key?: {
    remoteJid: string;
    id: string;
  };
  message?: any;
  status?: string;
  error?: string;
}

const getEvolutionConfig = () => {
  const instanceUrl = process.env.EVOLUTION_INSTANCE_URL || "";
  const apiKey = process.env.EVOLUTION_API_KEY || "";
  
  const match = instanceUrl.match(/instances\/([^\/]+)/);
  const instanceName = match ? match[1] : "ecobrasil-prod";
  
  const urlParts = instanceUrl.split("/instances/");
  const baseUrl = urlParts[0] || "https://api.evolution.com";
  
  return { baseUrl, instanceName, apiKey, isConfigured: !!(instanceUrl && apiKey) };
};

const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("55")) {
    cleaned = "55" + cleaned;
  }
  return cleaned + "@s.whatsapp.net";
};

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const config = getEvolutionConfig();
  
  if (!config.isConfigured) {
    console.log('Simulando envio de WhatsApp (Evolution API não configurada):');
    console.log(`Para: ${to}`);
    console.log(`Mensagem: ${message.substring(0, 100)}...`);
    return;
  }

  try {
    const formattedNumber = formatPhoneNumber(to);
    
    const response = await fetch(`${config.baseUrl}/message/sendText/${config.instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.apiKey,
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: message,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("[WhatsApp] Erro ao enviar mensagem:", data);
      throw new Error(data.message || "Erro ao enviar mensagem WhatsApp");
    }

    console.log(`WhatsApp enviado com sucesso para ${to}`);
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    
    // Log the message but don't throw to prevent alert service from failing
    console.log('Falha no envio - Mensagem que seria enviada:');
    console.log(`Para: ${to}`);
    console.log(`Mensagem: ${message.substring(0, 100)}...`);
  }
}

export async function sendLicenseExpirationAlert(
  phone: string,
  licenseName: string,
  enterpriseName: string,
  expirationDate: string,
  daysRemaining: number
): Promise<void> {
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

  await sendWhatsApp(phone, message);
}

export async function sendCondicionanteAlert(
  phone: string,
  conditionanteName: string,
  licenseName: string,
  dueDate: string,
  daysRemaining: number
): Promise<void> {
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

  await sendWhatsApp(phone, message);
}

export async function sendTaskAssignmentAlert(
  phone: string,
  taskTitle: string,
  assignerName: string,
  dueDate: string,
  priority: string
): Promise<void> {
  const priorityIcon = priority === "alta" ? "🔴" : priority === "media" ? "🟡" : "🟢";
  
  const message = `📋 *Nova Tarefa Atribuída*

${priorityIcon} *Prioridade:* ${priority.toUpperCase()}
📝 *Tarefa:* ${taskTitle}
👤 *Atribuída por:* ${assignerName}
📅 *Prazo:* ${dueDate}

Acesse o EcoGestor para mais detalhes.

_EcoGestor - Gestão de Equipe_`;

  await sendWhatsApp(phone, message);
}

export async function sendDemandAlert(
  phone: string,
  demandTitle: string,
  sector: string,
  dueDate: string,
  priority: string
): Promise<void> {
  const priorityIcon = priority === "alta" ? "🔴" : priority === "media" ? "🟡" : "🟢";
  
  const message = `📢 *Nova Demanda*

${priorityIcon} *Prioridade:* ${priority.toUpperCase()}
📝 *Título:* ${demandTitle}
🏷️ *Setor:* ${sector}
📅 *Prazo:* ${dueDate}

Acesse o EcoGestor para mais detalhes.

_EcoGestor - Sistema de Gestão Ambiental_`;

  await sendWhatsApp(phone, message);
}

export async function checkEvolutionStatus(): Promise<{ connected: boolean; state?: string; error?: string }> {
  const config = getEvolutionConfig();
  
  if (!config.isConfigured) {
    return { connected: false, error: "Evolution API não configurada" };
  }

  try {
    const response = await fetch(`${config.baseUrl}/instance/connectionState/${config.instanceName}`, {
      method: "GET",
      headers: {
        "apikey": config.apiKey,
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
