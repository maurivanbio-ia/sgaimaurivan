import cron from 'node-cron';
import { db } from '../db';
import { scheduledReports } from '@shared/schema';
import { eq, lte, and } from 'drizzle-orm';
import { sendEmail } from '../emailService';
import { storage } from '../storage';

class ScheduledReportsService {
  private jobs: Map<number, cron.ScheduledTask> = new Map();

  async initialize() {
    console.log('Inicializando serviço de relatórios agendados...');
    
    try {
      const activeReports = await db.select()
        .from(scheduledReports)
        .where(eq(scheduledReports.ativo, true));

      for (const report of activeReports) {
        this.scheduleReport(report);
      }

      cron.schedule('0 * * * *', () => {
        this.checkAndSendReports();
      });

      console.log(`${activeReports.length} relatórios agendados carregados`);
    } catch (error) {
      console.error('Erro ao inicializar relatórios agendados:', error);
    }
  }

  scheduleReport(report: typeof scheduledReports.$inferSelect) {
    const existingJob = this.jobs.get(report.id);
    if (existingJob) {
      existingJob.stop();
    }

    const cronExpression = this.buildCronExpression(report);
    if (!cronExpression) return;

    const job = cron.schedule(cronExpression, () => {
      this.executeReport(report.id);
    });

    this.jobs.set(report.id, job);
  }

  buildCronExpression(report: typeof scheduledReports.$inferSelect): string | null {
    const [hour, minute] = (report.horario || '08:00').split(':').map(Number);

    switch (report.frequencia) {
      case 'diario':
        return `${minute} ${hour} * * *`;
      
      case 'semanal':
        const dayOfWeek = report.diaSemana ?? 1;
        return `${minute} ${hour} * * ${dayOfWeek}`;
      
      case 'mensal':
        const dayOfMonth = report.diaMes ?? 1;
        return `${minute} ${hour} ${dayOfMonth} * *`;
      
      default:
        return null;
    }
  }

  async executeReport(reportId: number) {
    try {
      const [report] = await db.select()
        .from(scheduledReports)
        .where(eq(scheduledReports.id, reportId));

      if (!report || !report.ativo) return;

      console.log(`Executando relatório agendado: ${report.nome}`);

      const reportData = await this.generateReportData(report);
      
      await this.sendReportByEmail(report, reportData);

      const nextRun = this.calculateNextRun(report);
      await db.update(scheduledReports)
        .set({ 
          ultimoEnvio: new Date(),
          proximoEnvio: nextRun
        })
        .where(eq(scheduledReports.id, reportId));

      console.log(`Relatório ${report.nome} enviado com sucesso`);
    } catch (error) {
      console.error(`Erro ao executar relatório ${reportId}:`, error);
    }
  }

  async generateReportData(report: typeof scheduledReports.$inferSelect) {
    const filtros = (report.filtros as any) || {};
    
    switch (report.tipo) {
      case 'financeiro':
        return this.generateFinancialReport(filtros);
      
      case 'licencas':
        return this.generateLicensesReport(filtros);
      
      case 'equipamentos':
        return this.generateEquipmentReport(filtros);
      
      case 'frota':
        return this.generateFleetReport(filtros);
      
      case 'geral':
        return this.generateGeneralReport(filtros);
      
      default:
        return { error: 'Tipo de relatório desconhecido' };
    }
  }

  async generateFinancialReport(filtros: any) {
    const stats = await storage.getFinancialStats(filtros.empreendimentoId);
    return {
      tipo: 'Relatório Financeiro',
      data: new Date().toLocaleDateString('pt-BR'),
      resumo: {
        totalReceitas: stats.totalReceitas,
        totalDespesas: stats.totalDespesas,
        saldoAtual: stats.saldoAtual,
        totalPendente: stats.totalPendente
      },
      porCategoria: stats.porCategoria,
      porEmpreendimento: stats.porEmpreendimento
    };
  }

  async generateLicensesReport(filtros: any) {
    const licencas = await storage.getLicencasAmbientais(filtros);
    const vencendo30Dias = licencas.filter(l => {
      const validade = new Date(l.validade);
      const hoje = new Date();
      const diff = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 30 && diff > 0;
    });
    
    return {
      tipo: 'Relatório de Licenças Ambientais',
      data: new Date().toLocaleDateString('pt-BR'),
      totalLicencas: licencas.length,
      vencendo30Dias: vencendo30Dias.length,
      alertas: vencendo30Dias.map(l => ({
        numero: l.numero,
        tipo: l.tipo,
        validade: new Date(l.validade).toLocaleDateString('pt-BR')
      }))
    };
  }

  async generateEquipmentReport(filtros: any) {
    const stats = await storage.getEquipamentosStats(filtros.empreendimentoId);
    return {
      tipo: 'Relatório de Equipamentos',
      data: new Date().toLocaleDateString('pt-BR'),
      estatisticas: stats
    };
  }

  async generateFleetReport(filtros: any) {
    const stats = await storage.getVeiculosStats(filtros.empreendimentoId);
    return {
      tipo: 'Relatório de Frota',
      data: new Date().toLocaleDateString('pt-BR'),
      estatisticas: stats
    };
  }

  async generateGeneralReport(filtros: any) {
    const empreendimentos = await storage.getEmpreendimentos();
    const ativos = empreendimentos.filter(e => e.status === 'ativo');
    
    return {
      tipo: 'Relatório Geral',
      data: new Date().toLocaleDateString('pt-BR'),
      totalEmpreendimentos: empreendimentos.length,
      empreendimentosAtivos: ativos.length
    };
  }

  async sendReportByEmail(report: typeof scheduledReports.$inferSelect, data: any) {
    const destinatarios = report.destinatarios || [];
    
    if (destinatarios.length === 0) {
      console.log('Nenhum destinatário configurado para o relatório');
      return;
    }

    const htmlContent = this.formatReportAsHtml(data);

    for (const email of destinatarios) {
      try {
        await sendEmail({
          to: email,
          subject: `${data.tipo} - EcoBrasil (${data.data})`,
          text: `Relatório: ${data.tipo}`,
          html: htmlContent
        });
      } catch (error) {
        console.error(`Erro ao enviar email para ${email}:`, error);
      }
    }
  }

  formatReportAsHtml(data: any): string {
    const formatCurrency = (value: number) => 
      value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const labelMap: Record<string, string> = {
      totalReceitas: 'Total de Receitas',
      totalDespesas: 'Total de Despesas',
      saldoAtual: 'Saldo Atual',
      totalPendente: 'Total Pendente',
    };

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">${data.tipo}</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Gerado em: ${data.data}</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0;">
    `;

    if (data.resumo) {
      html += `<h2 style="color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">Resumo Financeiro</h2>`;
      html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">`;
      for (const [key, value] of Object.entries(data.resumo)) {
        const label = labelMap[key] || key;
        const color = key === 'totalReceitas' ? '#16a34a' : key === 'totalDespesas' ? '#dc2626' : key === 'saldoAtual' ? '#2563eb' : '#64748b';
        html += `
          <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid ${color};">
            <p style="margin: 0; font-size: 12px; color: #64748b;">${label}</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: ${color};">
              ${typeof value === 'number' ? formatCurrency(value) : value}
            </p>
          </div>
        `;
      }
      html += `</div>`;
    }

    if (data.porCategoria && data.porCategoria.length > 0) {
      html += `<h2 style="color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">Por Categoria</h2>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">`;
      html += `<tr style="background: #2563eb; color: white;"><th style="padding: 12px; text-align: left;">Categoria</th><th style="padding: 12px; text-align: left;">Tipo</th><th style="padding: 12px; text-align: right;">Valor</th></tr>`;
      for (const cat of data.porCategoria) {
        const tipoColor = cat.tipo === 'receita' ? '#16a34a' : '#dc2626';
        html += `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px;">${cat.categoria}</td><td style="padding: 12px; color: ${tipoColor}; text-transform: capitalize;">${cat.tipo}</td><td style="padding: 12px; text-align: right; font-weight: 500;">${formatCurrency(cat.valor)}</td></tr>`;
      }
      html += `</table>`;
    }

    if (data.porEmpreendimento && data.porEmpreendimento.length > 0) {
      html += `<h2 style="color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">Por Empreendimento</h2>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">`;
      html += `<tr style="background: #2563eb; color: white;"><th style="padding: 12px; text-align: left;">Empreendimento</th><th style="padding: 12px; text-align: right;">Receitas</th><th style="padding: 12px; text-align: right;">Despesas</th><th style="padding: 12px; text-align: right;">Lucro</th></tr>`;
      for (const emp of data.porEmpreendimento) {
        const lucroColor = emp.lucro >= 0 ? '#16a34a' : '#dc2626';
        html += `<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 12px;">${emp.empreendimento}</td><td style="padding: 12px; text-align: right; color: #16a34a;">${formatCurrency(emp.receitas)}</td><td style="padding: 12px; text-align: right; color: #dc2626;">${formatCurrency(emp.despesas)}</td><td style="padding: 12px; text-align: right; font-weight: bold; color: ${lucroColor};">${formatCurrency(emp.lucro)}</td></tr>`;
      }
      html += `</table>`;
    }

    if (data.alertas && data.alertas.length > 0) {
      html += `<h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">⚠️ Alertas</h2>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">`;
      html += `<tr style="background: #fef2f2; color: #991b1b;"><th style="padding: 12px; text-align: left;">Número</th><th style="padding: 12px; text-align: left;">Tipo</th><th style="padding: 12px; text-align: left;">Validade</th></tr>`;
      for (const alerta of data.alertas) {
        html += `<tr style="border-bottom: 1px solid #fecaca;"><td style="padding: 12px;">${alerta.numero}</td><td style="padding: 12px;">${alerta.tipo}</td><td style="padding: 12px; color: #dc2626; font-weight: 500;">${alerta.validade}</td></tr>`;
      }
      html += `</table>`;
    }

    if (data.estatisticas) {
      html += `<h2 style="color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">Estatísticas</h2>`;
      html += `<div style="background: white; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; overflow-x: auto;">${JSON.stringify(data.estatisticas, null, 2).replace(/\n/g, '<br/>').replace(/ /g, '&nbsp;')}</div>`;
    }

    html += `
        </div>
        <div style="background: #1e293b; color: #94a3b8; padding: 16px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">Este é um relatório automático gerado pelo sistema EcoBrasil.</p>
          <p style="margin: 8px 0 0 0;">© ${new Date().getFullYear()} EcoBrasil - Gestão Ambiental</p>
        </div>
      </div>
    `;
    
    return html;
  }

  calculateNextRun(report: typeof scheduledReports.$inferSelect): Date {
    const now = new Date();
    const [hour, minute] = (report.horario || '08:00').split(':').map(Number);
    
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    switch (report.frequencia) {
      case 'diario':
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      
      case 'semanal':
        const dayOfWeek = report.diaSemana ?? 1;
        while (next.getDay() !== dayOfWeek || next <= now) {
          next.setDate(next.getDate() + 1);
        }
        break;
      
      case 'mensal':
        const dayOfMonth = report.diaMes ?? 1;
        next.setDate(dayOfMonth);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;
    }

    return next;
  }

  async checkAndSendReports() {
    try {
      const now = new Date();
      const pending = await db.select()
        .from(scheduledReports)
        .where(
          and(
            eq(scheduledReports.ativo, true),
            lte(scheduledReports.proximoEnvio, now)
          )
        );

      for (const report of pending) {
        await this.executeReport(report.id);
      }
    } catch (error) {
      console.error('Erro ao verificar relatórios pendentes:', error);
    }
  }

  async addReport(reportData: any) {
    const [report] = await db.insert(scheduledReports).values({
      ...reportData,
      proximoEnvio: this.calculateNextRun(reportData)
    }).returning();

    if (report.ativo) {
      this.scheduleReport(report);
    }

    return report;
  }

  async updateReport(id: number, reportData: any) {
    const [report] = await db.update(scheduledReports)
      .set({
        ...reportData,
        atualizadoEm: new Date(),
        proximoEnvio: this.calculateNextRun(reportData)
      })
      .where(eq(scheduledReports.id, id))
      .returning();

    const existingJob = this.jobs.get(id);
    if (existingJob) {
      existingJob.stop();
      this.jobs.delete(id);
    }

    if (report.ativo) {
      this.scheduleReport(report);
    }

    return report;
  }

  async deleteReport(id: number) {
    const existingJob = this.jobs.get(id);
    if (existingJob) {
      existingJob.stop();
      this.jobs.delete(id);
    }

    await db.delete(scheduledReports).where(eq(scheduledReports.id, id));
  }

  async getReports() {
    return db.select().from(scheduledReports).orderBy(scheduledReports.nome);
  }
}

export const scheduledReportsService = new ScheduledReportsService();
