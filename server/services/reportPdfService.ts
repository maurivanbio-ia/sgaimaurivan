import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  condicionantes,
  categoriasFinanceiras
} from '@shared/schema';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface ReportOptions {
  unidade?: string;
  mes?: number;
  ano?: number;
}

const ECOBRASIL_COLORS = {
  green: [34, 139, 34] as [number, number, number],
  yellow: [218, 165, 32] as [number, number, number],
  blue: [0, 102, 153] as [number, number, number],
  darkGreen: [0, 100, 0] as [number, number, number],
  lightGreen: [144, 238, 144] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
  purple: [128, 0, 128] as [number, number, number],
  orange: [255, 140, 0] as [number, number, number],
};

const MARGINS = { left: 15, right: 15, top: 20, bottom: 25 };

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

function translateStatus(status: string | null | undefined): string {
  const statusMap: Record<string, string> = {
    'ativo': 'Ativo',
    'inativo': 'Inativo',
    'disponivel': 'Disponível',
    'em_uso': 'Em Uso',
    'manutencao': 'Manutenção',
    'aberta': 'Aberta',
    'em_andamento': 'Em Andamento',
    'concluida': 'Concluída',
    'concluido': 'Concluído',
    'cancelada': 'Cancelada',
    'ferias': 'Férias',
    'afastado': 'Afastado',
    'vigente': 'Vigente',
    'vencida': 'Vencida',
    'suspensa': 'Suspensa',
    'pendente': 'Pendente',
    'planejamento': 'Planejamento',
    'ativa': 'Ativa',
  };
  return statusMap[status || ''] || status || '-';
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const logoPath = path.join(process.cwd(), 'attached_assets', 'image_1767899664691.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch (e) {
    console.error('Erro ao carregar logo:', e);
  }
  return null;
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
    financeiroData,
    projetosData,
    condicionantesData
  ] = await Promise.all([
    db.select().from(empreendimentos).where(unidade ? eq(empreendimentos.unidade, unidade) : sql`1=1`),
    db.select().from(licencasAmbientais),
    db.select().from(demandas).where(unidade ? eq(demandas.unidade, unidade) : sql`1=1`),
    db.select().from(veiculos).where(unidade ? eq(veiculos.unidade, unidade) : sql`1=1`),
    db.select().from(equipamentos).where(unidade ? eq(equipamentos.unidade, unidade) : sql`1=1`),
    db.select().from(rhRegistros).where(unidade ? eq(rhRegistros.unidade, unidade) : sql`1=1`),
    db.select().from(contratos),
    db.select().from(financeiroLancamentos).where(unidade ? eq(financeiroLancamentos.unidade, unidade) : sql`1=1`),
    db.select().from(projetos),
    db.select().from(condicionantes)
  ]);

  const licencasAtivas = licencasData.filter(l => l.status === 'ativa');
  const licencasVencendo = licencasAtivas.filter(l => {
    if (!l.validade) return false;
    const dias = Math.ceil((new Date(l.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return dias <= 30 && dias >= 0;
  });
  const licencasVencidas = licencasAtivas.filter(l => {
    if (!l.validade) return false;
    return new Date(l.validade).getTime() < Date.now();
  });

  const demandasPendentes = demandasData.filter(d => d.status !== 'concluida' && d.status !== 'cancelada');
  const contratosAtivos = contratosData.filter(c => c.situacao === 'vigente');
  const condicionantesPendentes = condicionantesData.filter(c => c.status === 'pendente');

  const totalReceitas = financeiroData.filter(f => f.tipo === 'receita').reduce((sum, f) => sum + Number(f.valor || 0), 0);
  const totalDespesas = financeiroData.filter(f => f.tipo === 'despesa').reduce((sum, f) => sum + Number(f.valor || 0), 0);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
  let yPos = MARGINS.top;

  const checkNewPage = (requiredSpace: number): boolean => {
    if (yPos + requiredSpace > pageHeight - MARGINS.bottom) {
      doc.addPage();
      yPos = MARGINS.top;
      return true;
    }
    return false;
  };

  const addSectionTitle = (title: string, color: [number, number, number] = ECOBRASIL_COLORS.green) => {
    checkNewPage(25);
    doc.setFontSize(14);
    doc.setTextColor(...color);
    doc.text(title, MARGINS.left, yPos);
    yPos += 3;
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    doc.line(MARGINS.left, yPos, MARGINS.left + 60, yPos);
    yPos += 8;
  };

  // Header com Logo
  const logoBase64 = await loadLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 50) / 2, 10, 50, 20);
      yPos = 35;
    } catch (e) {
      doc.setFontSize(24);
      doc.setTextColor(...ECOBRASIL_COLORS.green);
      doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
      yPos = 30;
    }
  } else {
    doc.setFontSize(24);
    doc.setTextColor(...ECOBRASIL_COLORS.green);
    doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(...ECOBRASIL_COLORS.blue);
    doc.text('consultoria ambiental', pageWidth / 2, 28, { align: 'center' });
    yPos = 35;
  }

  // Título
  doc.setFontSize(22);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Relatório 360° EcoBrasil', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(11);
  doc.setTextColor(...ECOBRASIL_COLORS.blue);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  
  if (unidade) {
    doc.text(`Unidade: ${unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/_/g, ' ')}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  yPos += 10;

  // KPIs Resumo
  addSectionTitle('Resumo Geral', ECOBRASIL_COLORS.darkGreen);

  const kpis = [
    ['Empreendimentos', empreendimentosData.length.toString()],
    ['Licenças Ativas', licencasAtivas.length.toString()],
    ['Licenças Vencendo (30 dias)', licencasVencendo.length.toString()],
    ['Licenças Vencidas', licencasVencidas.length.toString()],
    ['Demandas Pendentes', demandasPendentes.length.toString()],
    ['Condicionantes Pendentes', condicionantesPendentes.length.toString()],
    ['Contratos Ativos', contratosAtivos.length.toString()],
    ['Projetos', projetosData.length.toString()],
    ['Veículos', veiculosData.length.toString()],
    ['Equipamentos', equipamentosData.length.toString()],
    ['Colaboradores', rhData.length.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor']],
    body: kpis,
    theme: 'grid',
    headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'center' } },
    margin: { left: MARGINS.left, right: MARGINS.right },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Resumo Financeiro
  addSectionTitle('Resumo Financeiro', ECOBRASIL_COLORS.blue);

  const financeKpis = [
    ['Total Receitas', formatCurrency(totalReceitas)],
    ['Total Despesas', formatCurrency(totalDespesas)],
    ['Saldo', formatCurrency(totalReceitas - totalDespesas)],
    ['Margem', totalReceitas > 0 ? `${(((totalReceitas - totalDespesas) / totalReceitas) * 100).toFixed(1)}%` : '0%'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor']],
    body: financeKpis,
    theme: 'grid',
    headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    margin: { left: MARGINS.left, right: MARGINS.right },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Licenças Vencendo
  if (licencasVencendo.length > 0) {
    checkNewPage(40);
    addSectionTitle('Alertas - Licenças Vencendo em 30 dias', ECOBRASIL_COLORS.red);

    const licencasRows = licencasVencendo.slice(0, 15).map(lic => {
      const dias = Math.ceil((new Date(lic.validade!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const emp = empreendimentosData.find(e => e.id === lic.empreendimentoId);
      return [lic.numero || '-', lic.tipo || '-', emp?.nome || '-', formatDate(lic.validade), `${dias} dias`];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Número', 'Tipo', 'Empreendimento', 'Validade', 'Dias Restantes']],
      body: licencasRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Demandas Pendentes
  if (demandasPendentes.length > 0) {
    checkNewPage(40);
    addSectionTitle('Demandas Pendentes', ECOBRASIL_COLORS.orange);

    const demandasRows = demandasPendentes.slice(0, 15).map(dem => [
      dem.titulo || '-',
      translateStatus(dem.status),
      dem.prioridade || 'Normal',
      formatDate(dem.dataEntrega)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Título', 'Status', 'Prioridade', 'Prazo']],
      body: demandasRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.orange, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Condicionantes Pendentes
  if (condicionantesPendentes.length > 0) {
    checkNewPage(40);
    addSectionTitle('Condicionantes Pendentes', ECOBRASIL_COLORS.purple);

    const condRows = condicionantesPendentes.slice(0, 10).map(cond => [
      cond.descricao?.substring(0, 50) + (cond.descricao && cond.descricao.length > 50 ? '...' : '') || '-',
      translateStatus(cond.status),
      formatDate(cond.prazo)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Status', 'Prazo']],
      body: condRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.purple, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Contratos Ativos
  if (contratosAtivos.length > 0) {
    checkNewPage(40);
    addSectionTitle('Contratos Ativos', ECOBRASIL_COLORS.green);

    const contratosRows = contratosAtivos.slice(0, 10).map(c => [
      c.numero || '-',
      c.contratanteRazao || '-',
      formatCurrency(Number(c.valorTotal || 0)),
      formatDate(c.vigenciaFim)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Número', 'Cliente', 'Valor', 'Vigência até']],
      body: contratosRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('EcoGestor - Sistema de Gestão Ambiental EcoBrasil', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateFinanceReportPDF(options: ReportOptions = {}): Promise<Buffer> {
  const { unidade, mes, ano } = options;
  const currentMonth = mes || new Date().getMonth() + 1;
  const currentYear = ano || new Date().getFullYear();
  
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0);

  const [financeiroData, categoriasData] = await Promise.all([
    db.select()
      .from(financeiroLancamentos)
      .where(
        and(
          unidade ? eq(financeiroLancamentos.unidade, unidade) : sql`1=1`,
          gte(financeiroLancamentos.data, startDate.toISOString().split('T')[0]),
          lte(financeiroLancamentos.data, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(financeiroLancamentos.data)),
    db.select().from(categoriasFinanceiras)
  ]);

  const categoriaMap: Record<number, string> = {};
  categoriasData.forEach(cat => {
    categoriaMap[cat.id] = cat.nome;
  });

  const receitas = financeiroData.filter(f => f.tipo === 'receita');
  const despesas = financeiroData.filter(f => f.tipo === 'despesa');
  const totalReceitas = receitas.reduce((sum, f) => sum + Number(f.valor || 0), 0);
  const totalDespesas = despesas.reduce((sum, f) => sum + Number(f.valor || 0), 0);

  const categoriasReceitas: Record<string, number> = {};
  const categoriasDespesas: Record<string, number> = {};
  
  receitas.forEach(r => {
    const cat = categoriaMap[r.categoriaId] || 'Outros';
    categoriasReceitas[cat] = (categoriasReceitas[cat] || 0) + Number(r.valor || 0);
  });
  
  despesas.forEach(d => {
    const cat = categoriaMap[d.categoriaId] || 'Outros';
    categoriasDespesas[cat] = (categoriasDespesas[cat] || 0) + Number(d.valor || 0);
  });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let yPos = MARGINS.top;

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Header com Logo
  const logoBase64 = await loadLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 50) / 2, 10, 50, 20);
      yPos = 35;
    } catch (e) {
      doc.setFontSize(24);
      doc.setTextColor(...ECOBRASIL_COLORS.green);
      doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
      yPos = 30;
    }
  } else {
    doc.setFontSize(24);
    doc.setTextColor(...ECOBRASIL_COLORS.green);
    doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(...ECOBRASIL_COLORS.blue);
    doc.text('consultoria ambiental', pageWidth / 2, 28, { align: 'center' });
    yPos = 35;
  }

  // Título
  doc.setFontSize(22);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Relatório Financeiro', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(14);
  doc.setTextColor(...ECOBRASIL_COLORS.blue);
  doc.text(`${monthNames[currentMonth - 1]} de ${currentYear}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  if (unidade) {
    doc.setFontSize(11);
    doc.text(`Unidade: ${unidade.charAt(0).toUpperCase() + unidade.slice(1).replace(/_/g, ' ')}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Resumo
  doc.setFontSize(14);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Resumo do Período', MARGINS.left, yPos);
  yPos += 3;
  doc.setDrawColor(...ECOBRASIL_COLORS.green);
  doc.setLineWidth(0.8);
  doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos);
  yPos += 10;

  const saldo = totalReceitas - totalDespesas;
  const resumo = [
    ['Total Receitas', formatCurrency(totalReceitas)],
    ['Total Despesas', formatCurrency(totalDespesas)],
    ['Saldo do Período', formatCurrency(saldo)],
    ['Margem', totalReceitas > 0 ? `${((saldo / totalReceitas) * 100).toFixed(1)}%` : '0%'],
    ['Qtd. Lançamentos', financeiroData.length.toString()],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Indicador', 'Valor']],
    body: resumo,
    theme: 'grid',
    headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: [255, 255, 255] },
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: { 
      0: { fontStyle: 'bold', cellWidth: 80 }, 
      1: { halign: 'right' } 
    },
    margin: { left: MARGINS.left, right: MARGINS.right },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Receitas por Categoria
  if (Object.keys(categoriasReceitas).length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(...ECOBRASIL_COLORS.green);
    doc.text('Receitas por Categoria', MARGINS.left, yPos);
    yPos += 3;
    doc.setDrawColor(...ECOBRASIL_COLORS.green);
    doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos);
    yPos += 8;

    const receitasRows = Object.entries(categoriasReceitas)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, valor]) => [cat, formatCurrency(valor), `${((valor / totalReceitas) * 100).toFixed(1)}%`]);

    autoTable(doc, {
      startY: yPos,
      head: [['Categoria', 'Valor', '% do Total']],
      body: receitasRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Despesas por Categoria
  if (Object.keys(categoriasDespesas).length > 0) {
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    doc.setFontSize(14);
    doc.setTextColor(...ECOBRASIL_COLORS.red);
    doc.text('Despesas por Categoria', MARGINS.left, yPos);
    yPos += 3;
    doc.setDrawColor(...ECOBRASIL_COLORS.red);
    doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos);
    yPos += 8;

    const despesasRows = Object.entries(categoriasDespesas)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, valor]) => [cat, formatCurrency(valor), `${((valor / totalDespesas) * 100).toFixed(1)}%`]);

    autoTable(doc, {
      startY: yPos,
      head: [['Categoria', 'Valor', '% do Total']],
      body: despesasRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: [255, 255, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' } },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Últimos Lançamentos
  if (financeiroData.length > 0) {
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    doc.setFontSize(14);
    doc.setTextColor(...ECOBRASIL_COLORS.blue);
    doc.text('Últimos Lançamentos', MARGINS.left, yPos);
    yPos += 3;
    doc.setDrawColor(...ECOBRASIL_COLORS.blue);
    doc.line(MARGINS.left, yPos, MARGINS.left + 50, yPos);
    yPos += 8;

    const lancamentosRows = financeiroData.slice(0, 20).map(lanc => [
      formatDate(lanc.data),
      lanc.tipo === 'receita' ? 'Receita' : 'Despesa',
      categoriaMap[lanc.categoriaId] || '-',
      lanc.descricao?.substring(0, 30) + (lanc.descricao && lanc.descricao.length > 30 ? '...' : '') || '-',
      formatCurrency(Number(lanc.valor || 0))
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']],
      body: lancamentosRows,
      theme: 'striped',
      headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text('EcoGestor - Sistema de Gestão Ambiental EcoBrasil', pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
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
