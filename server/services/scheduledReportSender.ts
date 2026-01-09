import cron from 'node-cron';
import { generatePlatformReportPDF, generateFinanceReportPDF, sendReportByEmail } from './reportPdfService';
import { db } from '../db';
import { users, demandas, tarefas } from '@shared/schema';
import { eq, or, and, inArray, lt } from 'drizzle-orm';
import nodemailer from 'nodemailer';

interface ReportScheduleConfig {
  relatorio360: {
    enabled: boolean;
    cronExpression: string;
    emails: string[];
    unidades: string[];
  };
  relatorioFinanceiro: {
    enabled: boolean;
    cronExpression: string;
    emails: string[];
    unidades: string[];
  };
}

const defaultConfig: ReportScheduleConfig = {
  relatorio360: {
    enabled: true,
    cronExpression: '0 9 * * 1',
    emails: ['ecobrasil@ecobrasil.bio.br', 'flavia@ecobrasil.bio.br', 'maurivan@ecobrasil.bio.br'],
    unidades: ['goiania', 'salvador', 'luiz_eduardo_magalhaes']
  },
  relatorioFinanceiro: {
    enabled: true,
    cronExpression: '0 9 * * 1',
    emails: ['ecobrasil@ecobrasil.bio.br', 'flavia@ecobrasil.bio.br', 'amanda@ecobrasil.bio.br', 'maurivan@ecobrasil.bio.br'],
    unidades: ['goiania', 'salvador', 'luiz_eduardo_magalhaes']
  }
};

let config = { ...defaultConfig };

async function getDirectorEmails(): Promise<string[]> {
  try {
    const directors = await db
      .select({ email: users.email })
      .from(users)
      .where(or(eq(users.role, 'admin'), eq(users.cargo, 'diretor')));
    
    return directors.map(d => d.email).filter(Boolean) as string[];
  } catch (error) {
    console.error('[Scheduled Reports] Erro ao buscar emails de diretores:', error);
    return [];
  }
}

async function sendRelatorio360() {
  console.log('[Scheduled Reports] Iniciando envio do Relatório 360°...');
  
  try {
    let emails = config.relatorio360.emails;
    if (emails.length === 0) {
      emails = await getDirectorEmails();
    }
    
    if (emails.length === 0) {
      console.log('[Scheduled Reports] Nenhum email configurado para Relatório 360°');
      return;
    }

    for (const unidade of config.relatorio360.unidades) {
      try {
        const pdfBuffer = await generatePlatformReportPDF({ unidade });
        const filename = `Relatorio_360_${unidade}_${new Date().toISOString().split('T')[0]}.pdf`;
        const unidadeFormatada = unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/_/g, ' ');
        
        for (const email of emails) {
          const success = await sendReportByEmail(
            pdfBuffer,
            filename,
            email,
            `Relatório 360° EcoBrasil - ${unidadeFormatada} - Semanal`,
            `Bom dia!\n\nSegue em anexo o Relatório 360° EcoBrasil da unidade ${unidadeFormatada}.\n\nData: ${new Date().toLocaleDateString('pt-BR')}\n\nEste é um email automático do sistema EcoGestor.`
          );
          
          if (success) {
            console.log(`[Scheduled Reports] Relatório 360° (${unidade}) enviado para ${email}`);
          } else {
            console.error(`[Scheduled Reports] Falha ao enviar Relatório 360° (${unidade}) para ${email}`);
          }
        }
      } catch (error) {
        console.error(`[Scheduled Reports] Erro ao gerar Relatório 360° (${unidade}):`, error);
      }
    }
    
    console.log('[Scheduled Reports] Envio do Relatório 360° concluído');
  } catch (error) {
    console.error('[Scheduled Reports] Erro no envio do Relatório 360°:', error);
  }
}

async function sendRelatorioFinanceiro() {
  console.log('[Scheduled Reports] Iniciando envio do Relatório Financeiro...');
  
  try {
    let emails = config.relatorioFinanceiro.emails;
    if (emails.length === 0) {
      emails = await getDirectorEmails();
    }
    
    if (emails.length === 0) {
      console.log('[Scheduled Reports] Nenhum email configurado para Relatório Financeiro');
      return;
    }

    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    for (const unidade of config.relatorioFinanceiro.unidades) {
      try {
        const pdfBuffer = await generateFinanceReportPDF({ unidade, mes, ano });
        const filename = `Relatorio_Financeiro_${unidade}_${ano}_${String(mes).padStart(2, '0')}.pdf`;
        const unidadeFormatada = unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/_/g, ' ');
        
        for (const email of emails) {
          const success = await sendReportByEmail(
            pdfBuffer,
            filename,
            email,
            `Relatório Financeiro - ${unidadeFormatada} - ${monthNames[mes - 1]} ${ano}`,
            `Boa tarde!\n\nSegue em anexo o Relatório Financeiro da unidade ${unidadeFormatada}.\n\nPeríodo: ${monthNames[mes - 1]} de ${ano}\n\nEste é um email automático do sistema EcoGestor.`
          );
          
          if (success) {
            console.log(`[Scheduled Reports] Relatório Financeiro (${unidade}) enviado para ${email}`);
          } else {
            console.error(`[Scheduled Reports] Falha ao enviar Relatório Financeiro (${unidade}) para ${email}`);
          }
        }
      } catch (error) {
        console.error(`[Scheduled Reports] Erro ao gerar Relatório Financeiro (${unidade}):`, error);
      }
    }
    
    console.log('[Scheduled Reports] Envio do Relatório Financeiro concluído');
  } catch (error) {
    console.error('[Scheduled Reports] Erro no envio do Relatório Financeiro:', error);
  }
}

let relatorio360Job: ReturnType<typeof cron.schedule> | null = null;
let relatorioFinanceiroJob: ReturnType<typeof cron.schedule> | null = null;
let resumoDemandasJob: ReturnType<typeof cron.schedule> | null = null;

const resumoDemandasConfig = {
  enabled: true,
  cronExpression: '0 9 * * 1',
  coordenadoras: [
    { email: 'luciana@ecobrasil.bio.br', nome: 'Luciana' },
    { email: 'arsinoe@ecobrasil.bio.br', nome: 'Arsinoé' }
  ]
};

async function getDemandasTarefasStats(responsavelEmail: string) {
  const now = new Date();
  
  const user = await db.select().from(users).where(eq(users.email, responsavelEmail)).limit(1);
  if (!user.length) {
    return { demandasAtivas: 0, demandasAtrasadas: 0, tarefasAtivas: 0, tarefasAtrasadas: 0 };
  }
  const userId = user[0].id;
  
  const demandasAtivas = await db.select().from(demandas).where(
    and(
      eq(demandas.responsavelId, userId),
      or(eq(demandas.status, 'pendente'), eq(demandas.status, 'em_andamento'), eq(demandas.status, 'a_fazer'))
    )
  );

  const demandasAtrasadas = demandasAtivas.filter(d => {
    if (!d.dataEntrega) return false;
    return new Date(d.dataEntrega) < now;
  });

  const tarefasAtivas = await db.select().from(tarefas).where(
    and(
      eq(tarefas.responsavelId, userId),
      or(eq(tarefas.status, 'pendente'), eq(tarefas.status, 'em_andamento'), eq(tarefas.status, 'a_fazer'))
    )
  );

  const tarefasAtrasadas = tarefasAtivas.filter(t => {
    if (!t.dataFim) return false;
    return new Date(t.dataFim) < now;
  });

  return {
    demandasAtivas: demandasAtivas.length,
    demandasAtrasadas: demandasAtrasadas.length,
    tarefasAtivas: tarefasAtivas.length,
    tarefasAtrasadas: tarefasAtrasadas.length
  };
}

async function sendResumoDemandasEmail(to: string, subject: string, htmlBody: string) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'maurivan.bio@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: '"EcoGestor - Lembretes" <maurivan.bio@gmail.com>',
      to,
      subject,
      html: htmlBody,
    });

    console.log(`[Resumo Demandas] Email enviado para ${to}`);
    return true;
  } catch (error) {
    console.error(`[Resumo Demandas] Erro ao enviar email para ${to}:`, error);
    return false;
  }
}

async function sendResumoSemanalDemandas() {
  console.log('[Resumo Demandas] Iniciando envio do resumo semanal...');

  for (const coord of resumoDemandasConfig.coordenadoras) {
    try {
      const stats = await getDemandasTarefasStats(coord.email);
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #228B22 0%, #006400 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Resumo Semanal</h1>
            <p style="color: #90EE90; margin: 5px 0 0 0;">Suas demandas e tarefas no EcoGestor</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
            <p style="margin: 0 0 20px 0;">Olá <strong>${coord.nome}</strong>,</p>
            <p style="margin: 0 0 20px 0;">Este é o resumo semanal contendo <strong>apenas</strong> as demandas e tarefas atribuídas a você no EcoGestor.</p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
              <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #228B22;">
                <div style="font-size: 28px; font-weight: bold; color: #228B22;">${stats.demandasAtivas}</div>
                <div style="color: #666; font-size: 14px;">Demandas ativas</div>
              </div>
              <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
                <div style="font-size: 28px; font-weight: bold; color: #dc3545;">${stats.demandasAtrasadas}</div>
                <div style="color: #666; font-size: 14px;">Demandas atrasadas</div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
              <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
                <div style="font-size: 28px; font-weight: bold; color: #007bff;">${stats.tarefasAtivas}</div>
                <div style="color: #666; font-size: 14px;">Tarefas ativas</div>
              </div>
              <div style="flex: 1; background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
                <div style="font-size: 28px; font-weight: bold; color: #ffc107;">${stats.tarefasAtrasadas}</div>
                <div style="color: #666; font-size: 14px;">Tarefas atrasadas</div>
              </div>
            </div>
            
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>Recomenda-se revisar prazos e prioridades para a semana.</strong>
            </p>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              Este é um email automático do sistema EcoGestor.<br>
              EcoBrasil - Consultoria Ambiental
            </p>
          </div>
        </div>
      `;

      await sendResumoDemandasEmail(
        coord.email,
        `Resumo semanal - Suas demandas e tarefas | EcoGestor`,
        htmlBody
      );
    } catch (error) {
      console.error(`[Resumo Demandas] Erro ao processar ${coord.email}:`, error);
    }
  }

  console.log('[Resumo Demandas] Envio concluído');
}

export async function sendResumoSemanalTest(emails: string[]) {
  console.log('[Resumo Demandas] Enviando teste para:', emails);

  const stats = {
    demandasAtivas: 5,
    demandasAtrasadas: 2,
    tarefasAtivas: 8,
    tarefasAtrasadas: 1
  };

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #228B22 0%, #006400 100%); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Resumo Semanal</h1>
        <p style="color: #90EE90; margin: 5px 0 0 0;">Suas demandas e tarefas no EcoGestor</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
        <p style="margin: 0 0 20px 0; background: #fff3cd; padding: 10px; border-radius: 5px; color: #856404;">
          <strong>TESTE</strong> - Este é um email de teste do sistema de resumo semanal.
        </p>
        <p style="margin: 0 0 20px 0;">Este é o resumo semanal contendo <strong>apenas</strong> as demandas e tarefas atribuídas a você no EcoGestor.</p>
        
        <table style="width: 100%; border-collapse: separate; border-spacing: 10px;">
          <tr>
            <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #228B22; width: 50%;">
              <div style="font-size: 28px; font-weight: bold; color: #228B22;">${stats.demandasAtivas}</div>
              <div style="color: #666; font-size: 14px;">Demandas ativas</div>
            </td>
            <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; width: 50%;">
              <div style="font-size: 28px; font-weight: bold; color: #dc3545;">${stats.demandasAtrasadas}</div>
              <div style="color: #666; font-size: 14px;">Demandas atrasadas</div>
            </td>
          </tr>
          <tr>
            <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
              <div style="font-size: 28px; font-weight: bold; color: #007bff;">${stats.tarefasAtivas}</div>
              <div style="color: #666; font-size: 14px;">Tarefas ativas</div>
            </td>
            <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
              <div style="font-size: 28px; font-weight: bold; color: #ffc107;">${stats.tarefasAtrasadas}</div>
              <div style="color: #666; font-size: 14px;">Tarefas atrasadas</div>
            </td>
          </tr>
        </table>
        
        <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">
          <strong>Recomenda-se revisar prazos e prioridades para a semana.</strong>
        </p>
      </div>
      
      <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 12px;">
          Este é um email automático do sistema EcoGestor.<br>
          EcoBrasil - Consultoria Ambiental | ${new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  `;

  for (const email of emails) {
    await sendResumoDemandasEmail(
      email,
      `[TESTE] Resumo semanal - Suas demandas e tarefas | EcoGestor`,
      htmlBody
    );
  }

  return true;
}

export function initScheduledReportSender() {
  console.log('[Scheduled Reports] Inicializando serviço de envio automático de relatórios...');
  
  if (config.relatorio360.enabled) {
    relatorio360Job = cron.schedule(config.relatorio360.cronExpression, sendRelatorio360, {
      timezone: 'America/Sao_Paulo'
    });
    console.log(`[Scheduled Reports] Relatório 360° agendado: ${config.relatorio360.cronExpression} (toda segunda às 9h)`);
  }
  
  if (config.relatorioFinanceiro.enabled) {
    relatorioFinanceiroJob = cron.schedule(config.relatorioFinanceiro.cronExpression, sendRelatorioFinanceiro, {
      timezone: 'America/Sao_Paulo'
    });
    console.log(`[Scheduled Reports] Relatório Financeiro agendado: ${config.relatorioFinanceiro.cronExpression} (toda segunda às 9h)`);
  }

  if (resumoDemandasConfig.enabled) {
    resumoDemandasJob = cron.schedule(resumoDemandasConfig.cronExpression, sendResumoSemanalDemandas, {
      timezone: 'America/Sao_Paulo'
    });
    console.log(`[Scheduled Reports] Resumo Semanal de Demandas agendado: ${resumoDemandasConfig.cronExpression} (toda segunda às 9h)`);
  }
  
  console.log('[Scheduled Reports] Serviço iniciado com sucesso');
}

export function updateReportConfig(newConfig: Partial<ReportScheduleConfig>) {
  config = { ...config, ...newConfig };
  
  if (relatorio360Job) {
    relatorio360Job.stop();
    relatorio360Job = null;
  }
  if (relatorioFinanceiroJob) {
    relatorioFinanceiroJob.stop();
    relatorioFinanceiroJob = null;
  }
  
  initScheduledReportSender();
}

export function getReportConfig(): ReportScheduleConfig {
  return { ...config };
}

export async function triggerRelatorio360Now() {
  await sendRelatorio360();
}

export async function triggerRelatorioFinanceiroNow() {
  await sendRelatorioFinanceiro();
}

export function addEmailToRelatorio360(email: string) {
  if (!config.relatorio360.emails.includes(email)) {
    config.relatorio360.emails.push(email);
  }
}

export function addEmailToRelatorioFinanceiro(email: string) {
  if (!config.relatorioFinanceiro.emails.includes(email)) {
    config.relatorioFinanceiro.emails.push(email);
  }
}

export function setRelatorio360Emails(emails: string[]) {
  config.relatorio360.emails = emails;
}

export function setRelatorioFinanceiroEmails(emails: string[]) {
  config.relatorioFinanceiro.emails = emails;
}
