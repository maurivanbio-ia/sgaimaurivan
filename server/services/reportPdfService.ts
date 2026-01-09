import PDFDocument from 'pdfkit';
import { db } from '../db';
import { 
  licencasAmbientais, 
  empreendimentos, 
  contratos, 
  rhRegistros, 
  veiculos, 
  equipamentos, 
  demandas, 
  projetos, 
  financeiroLancamentos,
  campanhas,
  condicionantes
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';

interface ReportOptions {
  unidade?: string;
  mes?: number;
  ano?: number;
}

export async function generatePlatformReportPDF(options: ReportOptions = {}): Promise<Buffer> {
  const { unidade } = options;
  
  const [
    empreendimentosData,
    licencasData,
    demandasData,
    veiculosData,
    equipamentosData,
    rhData,
    contratosData,
    financeiroData
  ] = await Promise.all([
    db.select().from(empreendimentos).where(unidade ? eq(empreendimentos.unidade, unidade) : sql`1=1`),
    db.select().from(licencasAmbientais),
    db.select().from(demandas).where(unidade ? eq(demandas.unidade, unidade) : sql`1=1`),
    db.select().from(veiculos).where(unidade ? eq(veiculos.unidade, unidade) : sql`1=1`),
    db.select().from(equipamentos).where(unidade ? eq(equipamentos.unidade, unidade) : sql`1=1`),
    db.select().from(rhRegistros).where(unidade ? eq(rhRegistros.unidade, unidade) : sql`1=1`),
    db.select().from(contratos),
    db.select().from(financeiroLancamentos).where(unidade ? eq(financeiroLancamentos.unidade, unidade) : sql`1=1`)
  ]);

  const licencasAtivas = licencasData.filter(l => l.status === 'ativa');
  const licencasVencendo = licencasAtivas.filter(l => {
    if (!l.validade) return false;
    const dias = Math.ceil((new Date(l.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return dias <= 30 && dias >= 0;
  });

  const demandasPendentes = demandasData.filter(d => d.status !== 'concluida' && d.status !== 'cancelada');
  const contratosAtivos = contratosData.filter(c => c.situacao === 'vigente');

  const totalReceitas = financeiroData.filter(f => f.tipo === 'receita').reduce((sum, f) => sum + Number(f.valor || 0), 0);
  const totalDespesas = financeiroData.filter(f => f.tipo === 'despesa').reduce((sum, f) => sum + Number(f.valor || 0), 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).fillColor('#2E7D32').text('Relatório 360° EcoBrasil', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#666').text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
    if (unidade) {
      doc.text(`Unidade: ${unidade.charAt(0).toUpperCase() + unidade.slice(1)}`, { align: 'center' });
    }
    doc.moveDown(2);

    doc.fontSize(16).fillColor('#1B5E20').text('Resumo Geral');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333');

    const kpis = [
      { label: 'Empreendimentos', value: empreendimentosData.length },
      { label: 'Licenças Ativas', value: licencasAtivas.length },
      { label: 'Licenças Vencendo (30 dias)', value: licencasVencendo.length },
      { label: 'Demandas Pendentes', value: demandasPendentes.length },
      { label: 'Contratos Ativos', value: contratosAtivos.length },
      { label: 'Veículos', value: veiculosData.length },
      { label: 'Equipamentos', value: equipamentosData.length },
      { label: 'Colaboradores', value: rhData.length },
    ];

    kpis.forEach(kpi => {
      doc.text(`• ${kpi.label}: ${kpi.value}`);
    });

    doc.moveDown(2);
    doc.fontSize(16).fillColor('#1B5E20').text('Resumo Financeiro');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#333');
    doc.text(`• Total Receitas: R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`• Total Despesas: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`• Saldo: R$ ${(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    if (licencasVencendo.length > 0) {
      doc.moveDown(2);
      doc.fontSize(16).fillColor('#D32F2F').text('Alertas - Licenças Vencendo');
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');

      licencasVencendo.slice(0, 10).forEach(lic => {
        const dias = Math.ceil((new Date(lic.validade!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        doc.text(`• ${lic.numero} - ${lic.tipo} - Vence em ${dias} dias`);
      });
    }

    if (demandasPendentes.length > 0) {
      doc.moveDown(2);
      doc.fontSize(16).fillColor('#F57C00').text('Demandas Pendentes');
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#333');

      demandasPendentes.slice(0, 10).forEach(dem => {
        doc.text(`• ${dem.titulo} - Status: ${dem.status} - Prioridade: ${dem.prioridade || 'Normal'}`);
      });
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999').text('EcoGestor - Sistema de Gestão Ambiental EcoBrasil', { align: 'center' });

    doc.end();
  });
}

export async function generateFinanceReportPDF(options: ReportOptions = {}): Promise<Buffer> {
  const { unidade, mes, ano } = options;
  const currentYear = ano || new Date().getFullYear();
  const currentMonth = mes || new Date().getMonth() + 1;

  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0);

  const financeiroData = await db
    .select()
    .from(financeiroLancamentos)
    .where(
      and(
        unidade ? eq(financeiroLancamentos.unidade, unidade) : sql`1=1`,
        gte(financeiroLancamentos.data, startDate.toISOString().split('T')[0]),
        lte(financeiroLancamentos.data, endDate.toISOString().split('T')[0])
      )
    )
    .orderBy(desc(financeiroLancamentos.data));

  const receitas = financeiroData.filter(f => f.tipo === 'receita');
  const despesas = financeiroData.filter(f => f.tipo === 'despesa');
  const totalReceitas = receitas.reduce((sum, f) => sum + Number(f.valor || 0), 0);
  const totalDespesas = despesas.reduce((sum, f) => sum + Number(f.valor || 0), 0);

  const categoriasDespesas: Record<string, number> = {};
  despesas.forEach(d => {
    const cat = (d as any).categoria || d.descricao?.split(' ')[0] || 'Outros';
    categoriasDespesas[cat] = (categoriasDespesas[cat] || 0) + Number(d.valor || 0);
  });

  const categoriasReceitas: Record<string, number> = {};
  receitas.forEach(r => {
    const cat = (r as any).categoria || r.descricao?.split(' ')[0] || 'Outros';
    categoriasReceitas[cat] = (categoriasReceitas[cat] || 0) + Number(r.valor || 0);
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    doc.fontSize(24).fillColor('#2E7D32').text('Relatório Financeiro', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).fillColor('#666').text(`${monthNames[currentMonth - 1]} de ${currentYear}`, { align: 'center' });
    if (unidade) {
      doc.text(`Unidade: ${unidade.charAt(0).toUpperCase() + unidade.slice(1)}`, { align: 'center' });
    }
    doc.moveDown(2);

    doc.fontSize(18).fillColor('#1B5E20').text('Resumo do Período');
    doc.moveDown();

    doc.fontSize(12).fillColor('#2E7D32').text(`Total Receitas: R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.fillColor('#D32F2F').text(`Total Despesas: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    const saldo = totalReceitas - totalDespesas;
    doc.fillColor(saldo >= 0 ? '#2E7D32' : '#D32F2F').text(`Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    doc.moveDown(2);
    doc.fontSize(14).fillColor('#1B5E20').text('Receitas por Categoria');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    Object.entries(categoriasReceitas).forEach(([cat, valor]) => {
      doc.text(`• ${cat}: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });

    doc.moveDown(1.5);
    doc.fontSize(14).fillColor('#D32F2F').text('Despesas por Categoria');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    Object.entries(categoriasDespesas).forEach(([cat, valor]) => {
      doc.text(`• ${cat}: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });

    if (financeiroData.length > 0) {
      doc.moveDown(2);
      doc.fontSize(14).fillColor('#1B5E20').text('Últimos Lançamentos');
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#333');

      financeiroData.slice(0, 15).forEach(lanc => {
        const tipo = lanc.tipo === 'receita' ? '+' : '-';
        const cor = lanc.tipo === 'receita' ? '#2E7D32' : '#D32F2F';
        doc.fillColor(cor).text(`${tipo} R$ ${Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - ${lanc.descricao} (${new Date(lanc.data!).toLocaleDateString('pt-BR')})`);
      });
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#999').text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, { align: 'center' });
    doc.text('EcoGestor - Sistema de Gestão Ambiental EcoBrasil', { align: 'center' });

    doc.end();
  });
}

export async function sendReportByEmail(
  pdfBuffer: Buffer, 
  filename: string, 
  recipientEmail: string, 
  subject: string,
  body: string
): Promise<boolean> {
  try {
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: 'maurivan.bio@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: '"EcoGestor - Relatórios" <maurivan.bio@gmail.com>',
      to: recipientEmail,
      subject,
      text: body,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log(`[Email] Relatório enviado via Gmail SMTP para ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email com relatório:', error);
    return false;
  }
}
