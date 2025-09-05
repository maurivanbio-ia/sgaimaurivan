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
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw error;
  }
}