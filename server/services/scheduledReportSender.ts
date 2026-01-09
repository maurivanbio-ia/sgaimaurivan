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

function generateRelatorio360EmailHtml(unidadeFormatada: string, dataFormatada: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #228B22 0%, #006400 100%); padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📊 Relatório 360° EcoBrasil</h1>
        <p style="color: #90EE90; margin: 10px 0 0 0; font-size: 16px;">${unidadeFormatada}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 25px; border: 1px solid #e9ecef;">
        <p style="margin: 0 0 20px 0; font-size: 16px;">Bom dia!</p>
        
        <p style="margin: 0 0 20px 0;">Segue em anexo o <strong>Relatório 360° EcoBrasil</strong> da unidade <strong>${unidadeFormatada}</strong>.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #228B22;">
          <h3 style="margin: 0 0 15px 0; color: #228B22;">📋 Conteúdo do Relatório</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li style="margin-bottom: 8px;">Visão geral de licenças e condicionantes</li>
            <li style="margin-bottom: 8px;">Status de demandas e projetos</li>
            <li style="margin-bottom: 8px;">Resumo financeiro por categoria</li>
            <li style="margin-bottom: 8px;">Indicadores de recursos humanos</li>
            <li style="margin-bottom: 8px;">Gestão de frota e equipamentos</li>
            <li style="margin-bottom: 8px;">Contratos e campanhas</li>
          </ul>
        </div>
        
        <div style="background: #e8f5e9; border-radius: 8px; padding: 15px; text-align: center;">
          <p style="margin: 0; color: #2e7d32;">
            <strong>📅 Data do relatório:</strong> ${dataFormatada}
          </p>
        </div>
        
        <div style="margin-top: 25px; text-align: center;">
          <a href="${PLATFORM_URL}/dashboard" style="display: inline-block; background: #228B22; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            🔗 Acessar EcoGestor
          </a>
        </div>
      </div>
      
      <div style="background: #228B22; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
        <p style="margin: 0; color: white; font-size: 12px;">
          Este é um email automático do sistema EcoGestor.<br>
          <strong>EcoBrasil - Consultoria Ambiental</strong>
        </p>
      </div>
    </div>
  `;
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

    const dataFormatada = new Date().toLocaleDateString('pt-BR');

    for (const unidade of config.relatorio360.unidades) {
      try {
        const pdfBuffer = await generatePlatformReportPDF({ unidade });
        const filename = `Relatorio_360_${unidade}_${new Date().toISOString().split('T')[0]}.pdf`;
        const unidadeFormatada = unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/_/g, ' ');
        
        const htmlBody = generateRelatorio360EmailHtml(unidadeFormatada, dataFormatada);
        const textBody = `Bom dia!\n\nSegue em anexo o Relatório 360° EcoBrasil da unidade ${unidadeFormatada}.\n\nData: ${dataFormatada}\n\nEste é um email automático do sistema EcoGestor.`;
        
        for (const email of emails) {
          const success = await sendReportByEmail(
            pdfBuffer,
            filename,
            email,
            `📊 Relatório 360° EcoBrasil - ${unidadeFormatada} - Semanal`,
            textBody,
            htmlBody
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

function generateRelatorioFinanceiroEmailHtml(unidadeFormatada: string, mesNome: string, ano: number): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1976D2 0%, #0D47A1 100%); padding: 25px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">💰 Relatório Financeiro</h1>
        <p style="color: #90CAF9; margin: 10px 0 0 0; font-size: 16px;">${unidadeFormatada} - ${mesNome} ${ano}</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 25px; border: 1px solid #e9ecef;">
        <p style="margin: 0 0 20px 0; font-size: 16px;">Bom dia!</p>
        
        <p style="margin: 0 0 20px 0;">Segue em anexo o <strong>Relatório Financeiro</strong> da unidade <strong>${unidadeFormatada}</strong> referente ao mês de <strong>${mesNome} de ${ano}</strong>.</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #1976D2;">
          <h3 style="margin: 0 0 15px 0; color: #1976D2;">📋 Conteúdo do Relatório</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li style="margin-bottom: 8px;">Resumo de receitas e despesas</li>
            <li style="margin-bottom: 8px;">Distribuição por categoria</li>
            <li style="margin-bottom: 8px;">Resultado financeiro por projeto</li>
            <li style="margin-bottom: 8px;">Gráfico de evolução mensal</li>
            <li style="margin-bottom: 8px;">Análise comparativa</li>
          </ul>
        </div>
        
        <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin: 20px 0;">
          <tr>
            <td style="background: #e8f5e9; padding: 15px; border-radius: 8px; text-align: center; width: 50%;">
              <div style="font-size: 14px; color: #2e7d32; font-weight: bold;">📈 Receitas</div>
              <div style="font-size: 12px; color: #666; margin-top: 5px;">Valores consolidados</div>
            </td>
            <td style="background: #ffebee; padding: 15px; border-radius: 8px; text-align: center; width: 50%;">
              <div style="font-size: 14px; color: #c62828; font-weight: bold;">📉 Despesas</div>
              <div style="font-size: 12px; color: #666; margin-top: 5px;">Custos operacionais</div>
            </td>
          </tr>
        </table>
        
        <div style="margin-top: 25px; text-align: center;">
          <a href="${PLATFORM_URL}/financeiro" style="display: inline-block; background: #1976D2; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            🔗 Ver Financeiro no EcoGestor
          </a>
        </div>
      </div>
      
      <div style="background: #1976D2; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
        <p style="margin: 0; color: white; font-size: 12px;">
          Este é um email automático do sistema EcoGestor.<br>
          <strong>EcoBrasil - Consultoria Ambiental</strong>
        </p>
      </div>
    </div>
  `;
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
        
        const htmlBody = generateRelatorioFinanceiroEmailHtml(unidadeFormatada, monthNames[mes - 1], ano);
        const textBody = `Bom dia!\n\nSegue em anexo o Relatório Financeiro da unidade ${unidadeFormatada}.\n\nPeríodo: ${monthNames[mes - 1]} de ${ano}\n\nEste é um email automático do sistema EcoGestor.`;
        
        for (const email of emails) {
          const success = await sendReportByEmail(
            pdfBuffer,
            filename,
            email,
            `💰 Relatório Financeiro - ${unidadeFormatada} - ${monthNames[mes - 1]} ${ano}`,
            textBody,
            htmlBody
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

const PLATFORM_URL = 'https://ecobrasilgestor.bio';

async function getDemandasTarefasStats(responsavelEmail: string) {
  const now = new Date();
  
  const user = await db.select().from(users).where(eq(users.email, responsavelEmail)).limit(1);
  if (!user.length) {
    return { 
      demandasAtivas: [], 
      demandasAtrasadas: [], 
      tarefasAtivas: [], 
      tarefasAtrasadas: [],
      totalDemandasAtivas: 0,
      totalDemandasAtrasadas: 0,
      totalTarefasAtivas: 0,
      totalTarefasAtrasadas: 0
    };
  }
  const userId = user[0].id;
  
  const demandasAtivasList = await db.select().from(demandas).where(
    and(
      eq(demandas.responsavelId, userId),
      or(eq(demandas.status, 'pendente'), eq(demandas.status, 'em_andamento'), eq(demandas.status, 'a_fazer'))
    )
  );

  const demandasAtrasadasList = demandasAtivasList.filter(d => {
    if (!d.dataEntrega) return false;
    return new Date(d.dataEntrega) < now;
  });

  const tarefasAtivasList = await db.select().from(tarefas).where(
    and(
      eq(tarefas.responsavelId, userId),
      or(eq(tarefas.status, 'pendente'), eq(tarefas.status, 'em_andamento'), eq(tarefas.status, 'a_fazer'))
    )
  );

  const tarefasAtrasadasList = tarefasAtivasList.filter(t => {
    const prazo = t.dataFim || t.prazo;
    if (!prazo) return false;
    return new Date(prazo) < now;
  });

  return {
    demandasAtivas: demandasAtivasList,
    demandasAtrasadas: demandasAtrasadasList,
    tarefasAtivas: tarefasAtivasList,
    tarefasAtrasadas: tarefasAtrasadasList,
    totalDemandasAtivas: demandasAtivasList.length,
    totalDemandasAtrasadas: demandasAtrasadasList.length,
    totalTarefasAtivas: tarefasAtivasList.length,
    totalTarefasAtrasadas: tarefasAtrasadasList.length
  };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Sem prazo';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  } catch {
    return 'Sem prazo';
  }
}

function getPrioridadeColor(prioridade: string): string {
  switch (prioridade?.toLowerCase()) {
    case 'urgente': return '#dc3545';
    case 'alta': return '#fd7e14';
    case 'media': case 'média': return '#ffc107';
    case 'baixa': return '#28a745';
    default: return '#6c757d';
  }
}

function generateDemandasTable(demandasList: any[], titulo: string, color: string): string {
  if (demandasList.length === 0) return '';
  
  const rows = demandasList.slice(0, 10).map(d => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">
        <a href="${PLATFORM_URL}/demandas" style="color: #228B22; text-decoration: none; font-weight: 500;">
          ${d.titulo || 'Sem título'}
        </a>
        ${d.descricao ? `<br><span style="color: #666; font-size: 12px;">${d.descricao.substring(0, 80)}${d.descricao.length > 80 ? '...' : ''}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: center; white-space: nowrap;">
        ${formatDate(d.dataEntrega || d.dataLimite)}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: center;">
        <span style="background: ${getPrioridadeColor(d.prioridade)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
          ${d.prioridade || 'Normal'}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <div style="margin-bottom: 25px;">
      <h3 style="color: ${color}; margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid ${color}; padding-bottom: 5px;">
        ${titulo} (${demandasList.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Demanda</th>
            <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Prazo</th>
            <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Prioridade</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${demandasList.length > 10 ? `<p style="color: #666; font-size: 12px; margin: 5px 0;">... e mais ${demandasList.length - 10} demandas. <a href="${PLATFORM_URL}/demandas" style="color: #228B22;">Ver todas</a></p>` : ''}
    </div>
  `;
}

function generateTarefasTable(tarefasList: any[], titulo: string, color: string): string {
  if (tarefasList.length === 0) return '';
  
  const rows = tarefasList.slice(0, 10).map(t => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e9ecef;">
        <a href="${PLATFORM_URL}/minhas-tarefas" style="color: #228B22; text-decoration: none; font-weight: 500;">
          ${t.titulo || 'Sem título'}
        </a>
        ${t.descricao ? `<br><span style="color: #666; font-size: 12px;">${t.descricao.substring(0, 80)}${t.descricao.length > 80 ? '...' : ''}</span>` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: center; white-space: nowrap;">
        ${formatDate(t.dataFim || t.prazo)}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #e9ecef; text-align: center;">
        <span style="background: ${getPrioridadeColor(t.prioridade)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
          ${t.prioridade || 'Normal'}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <div style="margin-bottom: 25px;">
      <h3 style="color: ${color}; margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid ${color}; padding-bottom: 5px;">
        ${titulo} (${tarefasList.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Tarefa</th>
            <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Prazo</th>
            <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Prioridade</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${tarefasList.length > 10 ? `<p style="color: #666; font-size: 12px; margin: 5px 0;">... e mais ${tarefasList.length - 10} tarefas. <a href="${PLATFORM_URL}/minhas-tarefas" style="color: #228B22;">Ver todas</a></p>` : ''}
    </div>
  `;
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
      
      // Gerar tabelas detalhadas
      const demandasAtrasadasHtml = generateDemandasTable(stats.demandasAtrasadas, '⚠️ Demandas Atrasadas', '#dc3545');
      const demandasAtivasHtml = generateDemandasTable(
        stats.demandasAtivas.filter((d: any) => !stats.demandasAtrasadas.some((a: any) => a.id === d.id)),
        '📋 Demandas em Andamento',
        '#228B22'
      );
      const tarefasAtrasadasHtml = generateTarefasTable(stats.tarefasAtrasadas, '⚠️ Tarefas Atrasadas', '#dc3545');
      const tarefasAtivasHtml = generateTarefasTable(
        stats.tarefasAtivas.filter((t: any) => !stats.tarefasAtrasadas.some((a: any) => a.id === t.id)),
        '✅ Tarefas em Andamento',
        '#007bff'
      );
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #228B22 0%, #006400 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Resumo Semanal</h1>
            <p style="color: #90EE90; margin: 5px 0 0 0;">Suas demandas e tarefas no EcoGestor</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
            <p style="margin: 0 0 20px 0;">Olá <strong>${coord.nome}</strong>,</p>
            <p style="margin: 0 0 20px 0;">Este é o resumo semanal das demandas e tarefas atribuídas a você no EcoGestor.</p>
            
            <!-- Cards resumo -->
            <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 25px;">
              <tr>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #228B22; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #228B22;">${stats.totalDemandasAtivas}</div>
                  <div style="color: #666; font-size: 12px;">Demandas ativas</div>
                </td>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #dc3545;">${stats.totalDemandasAtrasadas}</div>
                  <div style="color: #666; font-size: 12px;">Demandas atrasadas</div>
                </td>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #007bff;">${stats.totalTarefasAtivas}</div>
                  <div style="color: #666; font-size: 12px;">Tarefas ativas</div>
                </td>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #ffc107;">${stats.totalTarefasAtrasadas}</div>
                  <div style="color: #666; font-size: 12px;">Tarefas atrasadas</div>
                </td>
              </tr>
            </table>
            
            <!-- Tabelas detalhadas -->
            ${demandasAtrasadasHtml}
            ${tarefasAtrasadasHtml}
            ${demandasAtivasHtml}
            ${tarefasAtivasHtml}
            
            ${(stats.totalDemandasAtivas === 0 && stats.totalTarefasAtivas === 0) ? 
              '<p style="text-align: center; color: #28a745; font-size: 16px; padding: 20px;">🎉 Parabéns! Você não tem demandas ou tarefas pendentes.</p>' : 
              '<p style="margin: 20px 0 0 0; color: #666; font-size: 14px;"><strong>💡 Dica:</strong> Revise os prazos e prioridades para organizar melhor sua semana.</p>'
            }
            
            <!-- Botões de acesso -->
            <div style="margin-top: 25px; text-align: center;">
              <a href="${PLATFORM_URL}/demandas" style="display: inline-block; background: #228B22; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500;">
                📋 Ver Demandas
              </a>
              <a href="${PLATFORM_URL}/minhas-tarefas" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500;">
                ✅ Ver Tarefas
              </a>
              <a href="${PLATFORM_URL}/calendario" style="display: inline-block; background: #6c757d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500;">
                📅 Calendário
              </a>
            </div>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              Este é um email automático do sistema EcoGestor.<br>
              EcoBrasil - Consultoria Ambiental | ${new Date().toLocaleDateString('pt-BR')}
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

  for (const email of emails) {
    try {
      // Buscar dados reais do usuário
      const stats = await getDemandasTarefasStats(email);
      
      // Gerar tabelas detalhadas
      const demandasAtrasadasHtml = generateDemandasTable(stats.demandasAtrasadas, '⚠️ Demandas Atrasadas', '#dc3545');
      const demandasAtivasHtml = generateDemandasTable(
        stats.demandasAtivas.filter((d: any) => !stats.demandasAtrasadas.some((a: any) => a.id === d.id)),
        '📋 Demandas em Andamento',
        '#228B22'
      );
      const tarefasAtrasadasHtml = generateTarefasTable(stats.tarefasAtrasadas, '⚠️ Tarefas Atrasadas', '#dc3545');
      const tarefasAtivasHtml = generateTarefasTable(
        stats.tarefasAtivas.filter((t: any) => !stats.tarefasAtrasadas.some((a: any) => a.id === t.id)),
        '✅ Tarefas em Andamento',
        '#007bff'
      );

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #228B22 0%, #006400 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Resumo Semanal</h1>
            <p style="color: #90EE90; margin: 5px 0 0 0;">Suas demandas e tarefas no EcoGestor</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef;">
            <p style="margin: 0 0 10px 0; background: #fff3cd; padding: 10px; border-radius: 5px; color: #856404;">
              <strong>TESTE</strong> - Este é um email de teste do sistema de resumo semanal.
            </p>
            <p style="margin: 0 0 20px 0;">Este é o resumo semanal das demandas e tarefas atribuídas a você no EcoGestor.</p>
            
            <!-- Cards resumo -->
            <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 25px;">
              <tr>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #228B22; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #228B22;">${stats.totalDemandasAtivas}</div>
                  <div style="color: #666; font-size: 12px;">Demandas ativas</div>
                </td>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #dc3545;">${stats.totalDemandasAtrasadas}</div>
                  <div style="color: #666; font-size: 12px;">Demandas atrasadas</div>
                </td>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #007bff;">${stats.totalTarefasAtivas}</div>
                  <div style="color: #666; font-size: 12px;">Tarefas ativas</div>
                </td>
                <td style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; width: 25%;">
                  <div style="font-size: 28px; font-weight: bold; color: #ffc107;">${stats.totalTarefasAtrasadas}</div>
                  <div style="color: #666; font-size: 12px;">Tarefas atrasadas</div>
                </td>
              </tr>
            </table>
            
            <!-- Tabelas detalhadas -->
            ${demandasAtrasadasHtml}
            ${tarefasAtrasadasHtml}
            ${demandasAtivasHtml}
            ${tarefasAtivasHtml}
            
            ${(stats.totalDemandasAtivas === 0 && stats.totalTarefasAtivas === 0) ? 
              '<p style="text-align: center; color: #28a745; font-size: 16px; padding: 20px;">🎉 Parabéns! Você não tem demandas ou tarefas pendentes.</p>' : 
              '<p style="margin: 20px 0 0 0; color: #666; font-size: 14px;"><strong>💡 Dica:</strong> Revise os prazos e prioridades para organizar melhor sua semana.</p>'
            }
            
            <!-- Botões de acesso -->
            <div style="margin-top: 25px; text-align: center;">
              <a href="${PLATFORM_URL}/demandas" style="display: inline-block; background: #228B22; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500;">
                📋 Ver Demandas
              </a>
              <a href="${PLATFORM_URL}/minhas-tarefas" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500;">
                ✅ Ver Tarefas
              </a>
              <a href="${PLATFORM_URL}/calendario" style="display: inline-block; background: #6c757d; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 5px; font-weight: 500;">
                📅 Calendário
              </a>
            </div>
          </div>
          
          <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              Este é um email automático do sistema EcoGestor.<br>
              EcoBrasil - Consultoria Ambiental | ${new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      `;

      await sendResumoDemandasEmail(
        email,
        `[TESTE] Resumo semanal - Suas demandas e tarefas | EcoGestor`,
        htmlBody
      );
      console.log(`[Resumo Demandas] Teste enviado para ${email}`);
    } catch (error) {
      console.error(`[Resumo Demandas] Erro ao enviar teste para ${email}:`, error);
    }
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
