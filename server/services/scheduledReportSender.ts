import cron from 'node-cron';
import { generatePlatformReportPDF, generateFinanceReportPDF, sendReportByEmail } from './reportPdfService';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

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
    cronExpression: '0 8 * * 1',
    emails: [],
    unidades: ['goiania', 'salvador', 'luiz_eduardo_magalhaes']
  },
  relatorioFinanceiro: {
    enabled: true,
    cronExpression: '0 17 * * 5',
    emails: [],
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

export function initScheduledReportSender() {
  console.log('[Scheduled Reports] Inicializando serviço de envio automático de relatórios...');
  
  if (config.relatorio360.enabled) {
    relatorio360Job = cron.schedule(config.relatorio360.cronExpression, sendRelatorio360, {
      timezone: 'America/Sao_Paulo'
    });
    console.log(`[Scheduled Reports] Relatório 360° agendado: ${config.relatorio360.cronExpression} (toda segunda às 8h)`);
  }
  
  if (config.relatorioFinanceiro.enabled) {
    relatorioFinanceiroJob = cron.schedule(config.relatorioFinanceiro.cronExpression, sendRelatorioFinanceiro, {
      timezone: 'America/Sao_Paulo'
    });
    console.log(`[Scheduled Reports] Relatório Financeiro agendado: ${config.relatorioFinanceiro.cronExpression} (toda sexta às 17h)`);
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
