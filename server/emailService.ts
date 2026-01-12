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
    return null;
  }

  try {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings || !connectionSettings.settings.api_key) {
      return null;
    }
    return {
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email
    };
  } catch (error) {
    console.error('Erro ao obter credenciais do Resend:', error);
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

const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'ecobrasiloficial@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS
  }
});

export async function sendEmail(emailData: EmailData): Promise<void> {
  const defaultFromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ecobrasiloficial@gmail.com';
  
  const resendClient = await getResendClient();
  if (resendClient) {
    try {
      const fromEmail = resendClient.fromEmail || defaultFromEmail;
      await resendClient.client.emails.send({
        to: emailData.to,
        from: fromEmail,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
      });
      console.log(`Email enviado via Resend para ${emailData.to}`);
      return;
    } catch (error: any) {
      console.error('Erro no Resend, tentando Gmail:', error.message);
    }
  }
  
  try {
    const mailOptions = {
      from: defaultFromEmail,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
    };

    const info = await gmailTransporter.sendMail(mailOptions);
    console.log(`Email enviado via Gmail para ${emailData.to}. ID: ${info.messageId}`);
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    throw new Error(`Erro ao enviar email: ${error.message}`);
  }
}
