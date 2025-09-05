// Para WhatsApp, usaremos a API do Twilio
interface WhatsAppCredentials {
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const credentials: WhatsAppCredentials = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886', // Número padrão do Twilio Sandbox
  };

  // Se não tiver credenciais, simula o envio
  if (!credentials.accountSid || !credentials.authToken) {
    console.log('Simulando envio de WhatsApp (credenciais Twilio não configuradas):');
    console.log(`Para: ${to}`);
    console.log(`Mensagem: ${message}`);
    return;
  }

  try {
    // Importa Twilio dinamicamente para evitar erro se não estiver instalado
    const twilio = await import('twilio');
    const client = twilio.default(credentials.accountSid, credentials.authToken);

    await client.messages.create({
      body: message,
      from: credentials.fromNumber,
      to: `whatsapp:${to}`,
    });

    console.log(`WhatsApp enviado com sucesso para ${to}`);
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    
    // Se o Twilio não estiver instalado, simula o envio
    if ((error as Error).message?.includes('Cannot resolve module')) {
      console.log('Twilio não instalado - Simulando envio de WhatsApp:');
      console.log(`Para: ${to}`);
      console.log(`Mensagem: ${message}`);
      return;
    }
    
    throw error;
  }
}