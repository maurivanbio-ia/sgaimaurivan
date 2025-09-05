import nodemailer from 'nodemailer';

interface EmailData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Configurar Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ecobrasiloficial@gmail.com',
    pass: 'ehlbnyjqzxmzsjbg' // Senha de app do Google (sem espaços)
  }
});

export async function sendEmail(emailData: EmailData): Promise<void> {
  try {
    const mailOptions = {
      from: 'ecobrasiloficial@gmail.com', // Email remetente
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html || emailData.text.replace(/\n/g, '<br>'),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email enviado com sucesso para ${emailData.to}. ID: ${info.messageId}`);
  } catch (error: any) {
    console.error('Erro ao enviar email:', error);
    throw new Error(`Erro ao enviar email: ${error.message}`);
  }
}