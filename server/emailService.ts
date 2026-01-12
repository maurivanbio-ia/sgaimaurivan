import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Configurar SendGrid se disponível
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

// Configurar Gmail SMTP como fallback
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'ecobrasiloficial@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS
  }
});

export async function sendEmail(emailData: EmailData): Promise<void> {
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'ecobrasiloficial@gmail.com';
  
  // Tentar SendGrid primeiro (mais confiável)
  if (sendgridApiKey) {
    try {
      await sgMail.send({
        to: emailData.to,
        from: fromEmail,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
      });
      console.log(`Email enviado via SendGrid para ${emailData.to}`);
      return;
    } catch (error: any) {
      console.error('Erro no SendGrid, tentando Gmail:', error.message);
    }
  }
  
  // Fallback para Gmail SMTP
  try {
    const mailOptions = {
      from: fromEmail,
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