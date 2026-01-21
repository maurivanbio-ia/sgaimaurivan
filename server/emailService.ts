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

function createSmtpTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  
  if (!user || !pass) {
    console.log('[Email] SMTP não configurado: credenciais ausentes');
    return null;
  }
  
  // Se tiver host customizado, usa ele
  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }
  
  // Fallback para Gmail se o email for @gmail.com
  if (user.includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }
  
  // Tenta detectar o host baseado no domínio
  const domain = user.split('@')[1];
  return nodemailer.createTransport({
    host: `smtp.${domain}`,
    port: 587,
    secure: false,
    auth: { user, pass }
  });
}

export async function sendEmail(emailData: EmailData): Promise<void> {
  const defaultFromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ecobrasiloficial@gmail.com';
  
  console.log(`[Email] Tentando enviar email para ${emailData.to}...`);
  
  // Tenta SMTP primeiro
  const smtpTransporter = createSmtpTransporter();
  if (smtpTransporter) {
    try {
      const mailOptions = {
        from: `"EcoGestor" <${defaultFromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
      };

      console.log(`[Email] Usando SMTP (${process.env.SMTP_HOST}) com from: ${defaultFromEmail}`);
      const info = await smtpTransporter.sendMail(mailOptions);
      console.log(`[Email] Enviado via SMTP para ${emailData.to}. ID: ${info.messageId}`);
      return;
    } catch (error: any) {
      console.error('[Email] Erro no SMTP:', error.message);
    }
  }
  
  // Fallback para Resend
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
      throw new Error(`Erro ao enviar email: ${error.message}`);
    }
  }
  
  throw new Error('Nenhum serviço de email configurado. Configure Resend ou Gmail.');
}
