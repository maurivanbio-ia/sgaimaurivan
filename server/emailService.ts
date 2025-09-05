import sgMail from '@sendgrid/mail';

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Configurar SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY não configurada - emails não serão enviados');
}

export async function sendEmail(emailData: EmailData): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('Simulando envio de email (SENDGRID_API_KEY não configurada):');
    console.log(`Para: ${emailData.to}`);
    console.log(`Assunto: ${emailData.subject}`);
    console.log(`Mensagem: ${emailData.text}`);
    return;
  }

  try {
    const msg = {
      to: emailData.to,
      from: 'noreply@ecobrasil.bio.br', // Email verificado no SendGrid
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
    };

    await sgMail.send(msg);
    console.log(`Email enviado com sucesso para ${emailData.to}`);
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    
    // Tratamento específico para erros do SendGrid
    if (error.code === 403) {
      const detailedError = new Error(`SendGrid Forbidden (403): Verifique se:
1. O domínio 'ecobrasil.bio.br' está verificado no SendGrid
2. O email 'noreply@ecobrasil.bio.br' está configurado como remetente verificado
3. A API Key tem permissões de envio
Erro original: ${error.message}`);
      throw detailedError;
    }
    
    throw error;
  }
}