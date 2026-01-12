import nodemailer from 'nodemailer';
import { Resend } from 'resend';

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let connectionSettings: any;

async function getResendCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    console.log('[Email] Resend não disponível: token ou hostname ausente');
    return null;
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );
    
    if (!response.ok) {
      console.log('[Email] Resend API resposta não OK:', response.status);
      return null;
    }
    
    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings || !connectionSettings.settings?.api_key) {
      console.log('[Email] Resend não configurado corretamente');
      return null;
    }
    
    return {
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email
    };
  } catch (error) {
    console.error('[Email] Erro ao obter credenciais do Resend:', error);
    return null;
  }
}

async function getResendClient() {
  const credentials = await getResendCredentials();
  if (!credentials) {
    return null;
  }
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

function createGmailTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
  
  if (!user || !pass) {
    console.log('[Email] Gmail não configurado: credenciais ausentes');
    return null;
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

export async function sendEmail(emailData: EmailData): Promise<void> {
  const defaultFromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ecobrasiloficial@gmail.com';
  
  console.log(`[Email] Tentando enviar email para ${emailData.to}...`);
  
  // Tenta Resend primeiro
  const resendClient = await getResendClient();
  if (resendClient) {
    try {
      const fromEmail = resendClient.fromEmail || defaultFromEmail;
      console.log(`[Email] Usando Resend com from: ${fromEmail}`);
      
      await resendClient.client.emails.send({
        to: emailData.to,
        from: fromEmail,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
      });
      console.log(`[Email] Enviado via Resend para ${emailData.to}`);
      return;
    } catch (error: any) {
      console.error('[Email] Erro no Resend:', error.message);
    }
  }
  
  // Fallback para Gmail
  const gmailTransporter = createGmailTransporter();
  if (gmailTransporter) {
    try {
      const mailOptions = {
        from: defaultFromEmail,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
      };

      console.log(`[Email] Usando Gmail com from: ${defaultFromEmail}`);
      const info = await gmailTransporter.sendMail(mailOptions);
      console.log(`[Email] Enviado via Gmail para ${emailData.to}. ID: ${info.messageId}`);
      return;
    } catch (error: any) {
      console.error('[Email] Erro no Gmail:', error.message);
      throw new Error(`Erro ao enviar email: ${error.message}`);
    }
  }
  
  throw new Error('Nenhum serviço de email configurado. Configure Resend ou Gmail.');
}
