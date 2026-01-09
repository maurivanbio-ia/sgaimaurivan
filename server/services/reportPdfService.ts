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

const CHART_COLORS = [
  [34, 139, 34],
  [200, 50, 50],
  [0, 102, 153],
  [218, 165, 32],
  [148, 103, 189],
  [255, 127, 14],
  [44, 160, 44],
  [214, 39, 40],
];

const MARGINS = { left: 15, right: 15, top: 20, bottom: 25 };

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | Date | null | undefined): string {
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
    'ativo': 'Ativo', 'inativo': 'Inativo', 'disponivel': 'Disponível',
    'em_uso': 'Em Uso', 'manutencao': 'Manutenção', 'aberta': 'Aberta',
    'em_andamento': 'Em Andamento', 'concluida': 'Concluída', 'concluido': 'Concluído',
    'cancelada': 'Cancelada', 'ferias': 'Férias', 'afastado': 'Afastado',
    'vigente': 'Vigente', 'vencida': 'Vencida', 'suspensa': 'Suspensa',
    'pendente': 'Pendente', 'planejamento': 'Planejamento', 'ativa': 'Ativa',
    'a_fazer': 'A Fazer', 'em_revisao': 'Em Revisão',
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

async function fetchReportData(unidade?: string) {
  const whereUnidade = unidade ? eq : () => sql`1=1`;
  
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
    condicionantesData,
    campanhasData,
    categoriasData
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
    db.select().from(condicionantes),
    db.select().from(campanhas).where(unidade ? eq(campanhas.unidade, unidade) : sql`1=1`),
    db.select().from(categoriasFinanceiras)
  ]);

  const now = new Date();
  const licencasVigentes = licencasData.filter(l => l.status === 'ativa' && l.validade && new Date(l.validade) > now);
  const licencasProximasVencer = licencasData.filter(l => {
    if (!l.validade || l.status !== 'ativa') return false;
    const dias = Math.ceil((new Date(l.validade).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return dias > 0 && dias <= 30;
  });
  const licencasVencidas = licencasData.filter(l => l.validade && new Date(l.validade) < now);

  const demandasAbertas = demandasData.filter(d => d.status === 'a_fazer' || d.status === 'em_andamento');
  const demandasConcluidas = demandasData.filter(d => d.status === 'concluido');
  const demandasAtrasadas = demandasData.filter(d => {
    if (!d.dataEntrega || d.status === 'concluido') return false;
    return new Date(d.dataEntrega) < now;
  });

  const veiculosDisponiveis = veiculosData.filter(v => v.status === 'disponivel');
  const veiculosEmUso = veiculosData.filter(v => v.status === 'em_uso');
  const veiculosManutencao = veiculosData.filter(v => v.status === 'manutencao');

  const equipamentosAtivos = equipamentosData.filter(e => e.status === 'ativo' || e.status === 'disponivel');
  const equipamentosManutencao = equipamentosData.filter(e => e.status === 'manutencao');

  const rhAtivos = rhData.filter(r => r.status === 'ativo');
  const rhFerias = rhData.filter(r => r.status === 'ferias');
  const rhAfastados = rhData.filter(r => r.status === 'afastado');

  const contratosAtivos = contratosData.filter(c => c.situacao === 'vigente');
  const contratosVencendo = contratosData.filter(c => {
    if (!c.vigenciaFim || c.situacao !== 'vigente') return false;
    const dias = Math.ceil((new Date(c.vigenciaFim).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return dias > 0 && dias <= 30;
  });

  const projetosEmAndamento = projetosData.filter(p => p.status === 'em_andamento');
  const projetosConcluidos = projetosData.filter(p => p.status === 'concluido');
  const projetosPlanejamento = projetosData.filter(p => p.status === 'planejamento');
  const projetosAtrasados = projetosData.filter(p => {
    if (!p.dataFim || p.status === 'concluido') return false;
    return new Date(p.dataFim) < now;
  });

  const totalReceitas = financeiroData.filter(f => f.tipo === 'receita').reduce((sum, f) => sum + Number(f.valor || 0), 0);
  const totalDespesas = financeiroData.filter(f => f.tipo === 'despesa').reduce((sum, f) => sum + Number(f.valor || 0), 0);
  const totalPendente = financeiroData.filter(f => f.status === 'pendente' || f.status === 'aguardando').reduce((sum, f) => sum + Number(f.valor || 0), 0);

  const categoriaMap: Record<number, string> = {};
  categoriasData.forEach(cat => { categoriaMap[cat.id] = cat.nome; });

  const porCategoria: Record<string, number> = {};
  financeiroData.filter(f => f.tipo === 'despesa').forEach(f => {
    const cat = categoriaMap[f.categoriaId] || 'Outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(f.valor || 0);
  });

  const evolucaoMensal: { mes: string; receitas: number; despesas: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mesLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    
    const receitasMes = financeiroData.filter(f => {
      if (f.tipo !== 'receita' || !f.data) return false;
      const fDate = new Date(f.data);
      return fDate.getFullYear() === d.getFullYear() && fDate.getMonth() === d.getMonth();
    }).reduce((sum, f) => sum + Number(f.valor || 0), 0);

    const despesasMes = financeiroData.filter(f => {
      if (f.tipo !== 'despesa' || !f.data) return false;
      const fDate = new Date(f.data);
      return fDate.getFullYear() === d.getFullYear() && fDate.getMonth() === d.getMonth();
    }).reduce((sum, f) => sum + Number(f.valor || 0), 0);

    evolucaoMensal.push({ mes: mesLabel, receitas: receitasMes, despesas: despesasMes });
  }

  return {
    unidade: unidade || 'Todas as Unidades',
    geradoEm: new Date().toISOString(),
    resumoGeral: {
      totalEmpreendimentos: empreendimentosData.length,
      totalLicencas: licencasData.length,
      totalDemandas: demandasData.length,
      totalProjetos: projetosData.length,
      totalVeiculos: veiculosData.length,
      totalEquipamentos: equipamentosData.length,
      totalFuncionarios: rhData.length,
      totalContratos: contratosData.length,
    },
    licencas: {
      total: licencasData.length,
      vigentes: licencasVigentes.length,
      proximasVencer: licencasProximasVencer.length,
      vencidas: licencasVencidas.length,
      lista: licencasData.slice(0, 15),
    },
    demandas: {
      total: demandasData.length,
      abertas: demandasAbertas.length,
      concluidas: demandasConcluidas.length,
      atrasadas: demandasAtrasadas.length,
    },
    frota: {
      total: veiculosData.length,
      disponiveis: veiculosDisponiveis.length,
      emUso: veiculosEmUso.length,
      emManutencao: veiculosManutencao.length,
    },
    equipamentos: {
      total: equipamentosData.length,
      ativos: equipamentosAtivos.length,
      emManutencao: equipamentosManutencao.length,
    },
    rh: {
      total: rhData.length,
      ativos: rhAtivos.length,
      ferias: rhFerias.length,
      afastados: rhAfastados.length,
    },
    contratos: {
      total: contratosData.length,
      ativos: contratosAtivos.length,
      vencendo: contratosVencendo.length,
      valorTotal: contratosAtivos.reduce((sum, c) => sum + Number(c.valorTotal || 0), 0),
    },
    projetos: {
      total: projetosData.length,
      emAndamento: projetosEmAndamento.length,
      concluidos: projetosConcluidos.length,
      planejamento: projetosPlanejamento.length,
      atrasados: projetosAtrasados.length,
      lista: projetosData.slice(0, 15),
    },
    campanhas: {
      total: campanhasData.length,
      ativas: campanhasData.filter(c => c.status === 'ativa').length,
      concluidas: campanhasData.filter(c => c.status === 'concluida').length,
    },
    financeiro: {
      totalReceitas,
      totalDespesas,
      saldoAtual: totalReceitas - totalDespesas,
      totalPendente,
      porCategoria: Object.entries(porCategoria).map(([categoria, total]) => ({ categoria, total })),
      evolucaoMensal,
    },
    empreendimentos: empreendimentosData,
  };
}

export async function generatePlatformReportPDF(options: ReportOptions = {}): Promise<Buffer> {
  const { unidade } = options;
  const data = await fetchReportData(unidade);
  
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

  const addSubtitle = (text: string) => {
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(text, MARGINS.left, yPos);
    yPos += 6;
  };

  const drawBarChart = (
    x: number, y: number, width: number, height: number,
    chartData: { label: string; value1: number; value2?: number }[],
    title: string,
    legend?: { label1: string; label2?: string; color1: number[]; color2?: number[] }
  ): number => {
    if (!chartData || chartData.length === 0) return y;

    const hasSecondValue = chartData.some(d => d.value2 !== undefined);
    const maxValue = Math.max(...chartData.flatMap(d => [d.value1, d.value2 || 0, 1]));
    const chartAreaHeight = height - 35;
    const chartAreaWidth = width - 30;
    const barWidth = hasSecondValue ? (chartAreaWidth / chartData.length) * 0.35 : (chartAreaWidth / chartData.length) * 0.6;
    const startX = x + 25;
    const startY = y + 18;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(title, x + width / 2, y + 8, { align: 'center' });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(startX, startY, startX, startY + chartAreaHeight);
    doc.line(startX, startY + chartAreaHeight, startX + chartAreaWidth, startY + chartAreaHeight);

    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    for (let i = 0; i <= 4; i++) {
      const yLine = startY + (chartAreaHeight * i) / 4;
      const value = maxValue * (1 - i / 4);
      doc.setDrawColor(235, 235, 235);
      doc.line(startX, yLine, startX + chartAreaWidth, yLine);
      const formattedValue = value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0);
      doc.text(formattedValue, startX - 2, yLine + 1.5, { align: 'right' });
    }

    const groupWidth = chartAreaWidth / chartData.length;
    chartData.forEach((item, index) => {
      const groupX = startX + index * groupWidth + (groupWidth - (hasSecondValue ? barWidth * 2 + 2 : barWidth)) / 2;

      const height1 = maxValue > 0 ? (item.value1 / maxValue) * chartAreaHeight : 0;
      doc.setFillColor(legend?.color1[0] || 34, legend?.color1[1] || 139, legend?.color1[2] || 34);
      doc.rect(groupX, startY + chartAreaHeight - height1, barWidth, height1, 'F');

      if (hasSecondValue && item.value2 !== undefined) {
        const height2 = maxValue > 0 ? (item.value2 / maxValue) * chartAreaHeight : 0;
        doc.setFillColor(legend?.color2?.[0] || 200, legend?.color2?.[1] || 50, legend?.color2?.[2] || 50);
        doc.rect(groupX + barWidth + 1, startY + chartAreaHeight - height2, barWidth, height2, 'F');
      }

      doc.setFontSize(5);
      doc.setTextColor(100, 100, 100);
      const labelText = item.label.length > 6 ? item.label.substring(0, 5) + '..' : item.label;
      doc.text(labelText, groupX + (hasSecondValue ? barWidth : barWidth / 2), startY + chartAreaHeight + 5, { align: 'center' });
    });

    if (legend) {
      const legendY = startY + chartAreaHeight + 12;
      doc.setFillColor(legend.color1[0], legend.color1[1], legend.color1[2]);
      doc.rect(x + width / 2 - 35, legendY, 6, 4, 'F');
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 60);
      doc.text(legend.label1, x + width / 2 - 27, legendY + 3);

      if (legend.label2 && legend.color2) {
        doc.setFillColor(legend.color2[0], legend.color2[1], legend.color2[2]);
        doc.rect(x + width / 2 + 10, legendY, 6, 4, 'F');
        doc.text(legend.label2, x + width / 2 + 18, legendY + 3);
      }
    }

    return y + height + 5;
  };

  const drawPieChart = (
    x: number, y: number, radius: number,
    chartData: { label: string; value: number }[],
    title: string
  ): number => {
    if (!chartData || chartData.length === 0) return y;

    const total = chartData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return y;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(title, x + radius, y + 8, { align: 'center' });

    const centerX = x + radius;
    const centerY = y + 18 + radius;
    let startAngle = -Math.PI / 2;

    chartData.slice(0, 8).forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      const color = CHART_COLORS[index % CHART_COLORS.length];
      doc.setFillColor(color[0], color[1], color[2]);

      const segments = Math.max(3, Math.ceil(sliceAngle * 20));
      for (let i = 0; i < segments; i++) {
        const angle1 = startAngle + (sliceAngle * i) / segments;
        const angle2 = startAngle + (sliceAngle * (i + 1)) / segments;
        doc.triangle(
          centerX, centerY,
          centerX + Math.cos(angle1) * radius, centerY + Math.sin(angle1) * radius,
          centerX + Math.cos(angle2) * radius, centerY + Math.sin(angle2) * radius,
          'F'
        );
      }

      startAngle = endAngle;
    });

    let legendY = centerY + radius + 8;
    const legendItems = chartData.slice(0, 6);
    doc.setFontSize(6);

    legendItems.forEach((item, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(x, legendY, 5, 3, 'F');

      doc.setTextColor(60, 60, 60);
      const percentage = ((item.value / total) * 100).toFixed(1);
      const labelText = item.label.length > 12 ? item.label.substring(0, 10) + '..' : item.label;
      doc.text(`${labelText}: ${percentage}%`, x + 7, legendY + 2.5);
      legendY += 5;
    });

    return legendY + 3;
  };

  // === COVER PAGE ===
  const logoBase64 = await loadLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 55) / 2, 35, 55, 22);
      yPos = 70;
    } catch {
      doc.setFontSize(26);
      doc.setTextColor(...ECOBRASIL_COLORS.green);
      doc.text('EcoBrasil', pageWidth / 2, 50, { align: 'center' });
      doc.setFontSize(11);
      doc.setTextColor(...ECOBRASIL_COLORS.blue);
      doc.text('consultoria ambiental', pageWidth / 2, 58, { align: 'center' });
      yPos = 75;
    }
  } else {
    doc.setFontSize(26);
    doc.setTextColor(...ECOBRASIL_COLORS.green);
    doc.text('EcoBrasil', pageWidth / 2, 50, { align: 'center' });
    yPos = 75;
  }

  doc.setFontSize(22);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Relatório 360° da Plataforma', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  doc.setFontSize(13);
  doc.setTextColor(...ECOBRASIL_COLORS.blue);
  doc.text('EcoGestor - Sistema de Gestão Ambiental', pageWidth / 2, yPos, { align: 'center' });
  yPos += 18;

  doc.setDrawColor(...ECOBRASIL_COLORS.green);
  doc.setLineWidth(1.5);
  doc.line(50, yPos, pageWidth - 50, yPos);
  yPos += 15;

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const unidadeLabel = unidade === 'goiania' ? 'Goiânia' : 
                       unidade === 'salvador' ? 'Salvador' : 
                       unidade === 'luiz_eduardo_magalhaes' ? 'Luiz Eduardo Magalhães' : 
                       'Todas as Unidades';
  doc.text(`Unidade: ${unidadeLabel}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  
  const now = new Date();
  const dataFormatada = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Gerado em: ${dataFormatada} às ${horaFormatada}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 25;

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('DOCUMENTO CONFIDENCIAL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(8);
  doc.text('Este relatório contém informações estratégicas da empresa.', pageWidth / 2, yPos, { align: 'center' });

  // === PAGE 2: EXECUTIVE SUMMARY ===
  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(16);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Resumo Executivo', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  const kpiData = [
    { label: 'Empreendimentos', value: data.resumoGeral.totalEmpreendimentos, color: ECOBRASIL_COLORS.green },
    { label: 'Licenças', value: data.resumoGeral.totalLicencas, color: ECOBRASIL_COLORS.blue },
    { label: 'Demandas', value: data.resumoGeral.totalDemandas, color: ECOBRASIL_COLORS.yellow },
    { label: 'Projetos', value: data.resumoGeral.totalProjetos, color: ECOBRASIL_COLORS.purple },
    { label: 'Veículos', value: data.resumoGeral.totalVeiculos, color: ECOBRASIL_COLORS.orange },
    { label: 'Equipamentos', value: data.resumoGeral.totalEquipamentos, color: ECOBRASIL_COLORS.blue },
    { label: 'Funcionários', value: data.resumoGeral.totalFuncionarios, color: ECOBRASIL_COLORS.green },
    { label: 'Contratos', value: data.resumoGeral.totalContratos, color: ECOBRASIL_COLORS.red },
  ];

  const cardWidth = 42;
  const cardHeight = 22;
  const cardGap = 5;
  const cardsPerRow = 4;
  const gridStartX = (pageWidth - (cardWidth * cardsPerRow + cardGap * (cardsPerRow - 1))) / 2;

  kpiData.forEach((kpi, idx) => {
    const row = Math.floor(idx / cardsPerRow);
    const col = idx % cardsPerRow;
    const cardX = gridStartX + col * (cardWidth + cardGap);
    const cardY = yPos + row * (cardHeight + cardGap);

    doc.setFillColor(248, 250, 248);
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setDrawColor(...kpi.color);
    doc.setLineWidth(0.5);
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(kpi.label, cardX + cardWidth / 2, cardY + 8, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value.toString(), cardX + cardWidth / 2, cardY + 17, { align: 'center' });
  });

  yPos += Math.ceil(kpiData.length / cardsPerRow) * (cardHeight + cardGap) + 12;

  addSectionTitle('Resumo Financeiro', ECOBRASIL_COLORS.green);

  const finCards = [
    { label: 'Total Receitas', value: formatCurrency(data.financeiro.totalReceitas), color: ECOBRASIL_COLORS.green },
    { label: 'Total Despesas', value: formatCurrency(data.financeiro.totalDespesas), color: ECOBRASIL_COLORS.red },
    { label: 'Saldo Atual', value: formatCurrency(data.financeiro.saldoAtual), color: data.financeiro.saldoAtual >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red },
    { label: 'Pendente', value: formatCurrency(data.financeiro.totalPendente), color: ECOBRASIL_COLORS.yellow },
  ];

  const finCardWidth = 43;
  const finStartX = (pageWidth - (finCardWidth * 4 + cardGap * 3)) / 2;

  finCards.forEach((card, idx) => {
    const cardX = finStartX + idx * (finCardWidth + cardGap);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(cardX, yPos, finCardWidth, 20, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(card.label, cardX + finCardWidth / 2, yPos + 7, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(...card.color);
    doc.text(card.value, cardX + finCardWidth / 2, yPos + 15, { align: 'center' });
  });

  yPos += 30;

  addSectionTitle('Alertas e Pendências', ECOBRASIL_COLORS.red);

  const alertItems = [
    { label: 'Licenças Vencidas', value: data.licencas.vencidas, color: ECOBRASIL_COLORS.red },
    { label: 'Licenças Próx. Vencer (30d)', value: data.licencas.proximasVencer, color: ECOBRASIL_COLORS.yellow },
    { label: 'Demandas Atrasadas', value: data.demandas.atrasadas, color: ECOBRASIL_COLORS.red },
    { label: 'Contratos Vencendo (30d)', value: data.contratos.vencendo, color: ECOBRASIL_COLORS.yellow },
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Alerta', 'Quantidade', 'Prioridade']],
    body: alertItems.map(a => [a.label, a.value.toString(), a.value > 0 ? 'ATENÇÃO' : 'OK']),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    margin: { left: MARGINS.left, right: MARGINS.right },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // === PAGE 3: OPERATIONAL CHARTS ===
  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(16);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Análise Operacional', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  const chartWidth = (contentWidth - 10) / 2;

  const licenseStatusData = [
    { label: 'Vigentes', value: data.licencas.vigentes },
    { label: 'Próx. Vencer', value: data.licencas.proximasVencer },
    { label: 'Vencidas', value: data.licencas.vencidas },
  ].filter(d => d.value > 0);

  const demandStatusData = [
    { label: 'Abertas', value: data.demandas.abertas },
    { label: 'Concluídas', value: data.demandas.concluidas },
    { label: 'Atrasadas', value: data.demandas.atrasadas },
  ].filter(d => d.value > 0);

  let leftEndY = yPos;
  let rightEndY = yPos;

  if (licenseStatusData.length > 0) {
    leftEndY = drawPieChart(MARGINS.left, yPos, 25, licenseStatusData, 'Status das Licenças');
  }

  if (demandStatusData.length > 0) {
    rightEndY = drawPieChart(MARGINS.left + chartWidth + 10, yPos, 25, demandStatusData, 'Status das Demandas');
  }

  yPos = Math.max(leftEndY, rightEndY) + 8;

  // === PAGE 4: PROJECTS ANALYSIS ===
  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(16);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Análise de Projetos', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  const projectKpis = [
    { label: 'Total', value: data.projetos.total, color: ECOBRASIL_COLORS.blue },
    { label: 'Em Andamento', value: data.projetos.emAndamento, color: ECOBRASIL_COLORS.green },
    { label: 'Concluídos', value: data.projetos.concluidos, color: ECOBRASIL_COLORS.darkGreen },
    { label: 'Planejamento', value: data.projetos.planejamento, color: ECOBRASIL_COLORS.yellow },
    { label: 'Atrasados', value: data.projetos.atrasados, color: ECOBRASIL_COLORS.red },
  ];

  const projKpiWidth = 34;
  const projKpiStartX = (pageWidth - (projKpiWidth * 5 + 4 * 4)) / 2;

  projectKpis.forEach((kpi, idx) => {
    const kpiX = projKpiStartX + idx * (projKpiWidth + 4);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(kpiX, yPos, projKpiWidth, 22, 2, 2, 'F');
    doc.setDrawColor(...kpi.color);
    doc.setLineWidth(0.5);
    doc.roundedRect(kpiX, yPos, projKpiWidth, 22, 2, 2, 'S');
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(kpi.label, kpiX + projKpiWidth / 2, yPos + 7, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value.toString(), kpiX + projKpiWidth / 2, yPos + 17, { align: 'center' });
  });

  yPos += 35;

  addSectionTitle('Detalhes dos Projetos', ECOBRASIL_COLORS.purple);

  if (data.projetos.lista && data.projetos.lista.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Nome', 'Tipo', 'Status', 'Início', 'Fim Previsto']],
      body: data.projetos.lista.slice(0, 12).map((p: any) => [
        (p.nome || '-').substring(0, 30),
        p.tipo || '-',
        translateStatus(p.status),
        formatDate(p.dataInicio),
        formatDate(p.dataFim),
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: ECOBRASIL_COLORS.purple, textColor: 255, fontStyle: 'bold' },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // === PAGE 5: FINANCIAL ANALYSIS ===
  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(16);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Análise Financeira', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  if (data.financeiro.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
    const barChartData = data.financeiro.evolucaoMensal.map(m => ({
      label: m.mes,
      value1: m.receitas,
      value2: m.despesas,
    }));

    yPos = drawBarChart(
      MARGINS.left, yPos, contentWidth, 80,
      barChartData,
      'Evolução Mensal: Receitas x Despesas',
      { label1: 'Receitas', label2: 'Despesas', color1: [34, 139, 34], color2: [200, 50, 50] }
    );

    yPos += 10;
  }

  addSectionTitle('Tabela Financeira Mensal', ECOBRASIL_COLORS.green);

  if (data.financeiro.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Mês', 'Receitas', 'Despesas', 'Resultado']],
      body: data.financeiro.evolucaoMensal.slice(-6).map(m => {
        const resultado = m.receitas - m.despesas;
        return [m.mes, formatCurrency(m.receitas), formatCurrency(m.despesas), formatCurrency(resultado)];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // === PAGE 6: DETAILED LISTS ===
  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(16);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Dados Detalhados', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  addSectionTitle('Licenças Ambientais', ECOBRASIL_COLORS.green);
  addSubtitle(`Total: ${data.licencas.total} | Vigentes: ${data.licencas.vigentes} | Próx. Vencer: ${data.licencas.proximasVencer} | Vencidas: ${data.licencas.vencidas}`);

  addSectionTitle('Demandas', ECOBRASIL_COLORS.orange);
  addSubtitle(`Total: ${data.demandas.total} | Abertas: ${data.demandas.abertas} | Concluídas: ${data.demandas.concluidas} | Atrasadas: ${data.demandas.atrasadas}`);

  addSectionTitle('Frota de Veículos', ECOBRASIL_COLORS.blue);
  addSubtitle(`Total: ${data.frota.total} | Disponíveis: ${data.frota.disponiveis} | Em Uso: ${data.frota.emUso} | Manutenção: ${data.frota.emManutencao}`);

  addSectionTitle('Equipamentos', ECOBRASIL_COLORS.purple);
  addSubtitle(`Total: ${data.equipamentos.total} | Ativos: ${data.equipamentos.ativos} | Manutenção: ${data.equipamentos.emManutencao}`);

  addSectionTitle('Recursos Humanos', ECOBRASIL_COLORS.green);
  addSubtitle(`Total: ${data.rh.total} | Ativos: ${data.rh.ativos} | Férias: ${data.rh.ferias} | Afastados: ${data.rh.afastados}`);

  addSectionTitle('Contratos', ECOBRASIL_COLORS.blue);
  addSubtitle(`Total: ${data.contratos.total} | Ativos: ${data.contratos.ativos} | Vencendo: ${data.contratos.vencendo} | Valor Total: ${formatCurrency(data.contratos.valorTotal)}`);

  addSectionTitle('Projetos', ECOBRASIL_COLORS.purple);
  addSubtitle(`Total: ${data.projetos.total} | Em Andamento: ${data.projetos.emAndamento} | Concluídos: ${data.projetos.concluidos}`);

  addSectionTitle('Campanhas', ECOBRASIL_COLORS.orange);
  addSubtitle(`Total: ${data.campanhas.total} | Ativas: ${data.campanhas.ativas} | Concluídas: ${data.campanhas.concluidas}`);

  addSectionTitle('Empreendimentos', ECOBRASIL_COLORS.darkGreen);
  addSubtitle(`Total: ${data.empreendimentos.length}`);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`EcoGestor - Relatório 360° EcoBrasil | Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateFinanceReportPDF(options: ReportOptions = {}): Promise<Buffer> {
  const { unidade, mes, ano } = options;
  const currentMonth = mes || new Date().getMonth() + 1;
  const currentYear = ano || new Date().getFullYear();
  
  const data = await fetchReportData(unidade);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
  let yPos = MARGINS.top;

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const logoBase64 = await loadLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', (pageWidth - 50) / 2, 10, 50, 20);
      yPos = 38;
    } catch {
      doc.setFontSize(24);
      doc.setTextColor(...ECOBRASIL_COLORS.green);
      doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
      yPos = 35;
    }
  } else {
    doc.setFontSize(24);
    doc.setTextColor(...ECOBRASIL_COLORS.green);
    doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
    yPos = 35;
  }

  doc.setFontSize(20);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Relatório Financeiro Consolidado', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(11);
  doc.setTextColor(...ECOBRASIL_COLORS.blue);
  doc.text(`Período: Todo o período`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(14);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Resumo Financeiro', MARGINS.left, yPos);
  yPos += 8;

  const finCards = [
    { label: 'Total Receitas', value: formatCurrency(data.financeiro.totalReceitas), color: ECOBRASIL_COLORS.green },
    { label: 'Total Despesas', value: formatCurrency(data.financeiro.totalDespesas), color: ECOBRASIL_COLORS.red },
    { label: 'Saldo Atual', value: formatCurrency(data.financeiro.saldoAtual), color: data.financeiro.saldoAtual >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red },
    { label: 'Pendente', value: formatCurrency(data.financeiro.totalPendente), color: ECOBRASIL_COLORS.yellow },
  ];

  const cardWidth = 42;
  const cardGap = 6;
  const startX = (pageWidth - (cardWidth * 2 + cardGap)) / 2;

  finCards.forEach((card, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const cardX = startX + col * (cardWidth + cardGap);
    const cardY = yPos + row * 28;

    doc.setFillColor(252, 252, 252);
    doc.roundedRect(cardX, cardY, cardWidth, 24, 2, 2, 'F');
    doc.setDrawColor(...card.color);
    doc.setLineWidth(0.5);
    doc.roundedRect(cardX, cardY, cardWidth, 24, 2, 2, 'S');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(card.label, cardX + cardWidth / 2, cardY + 9, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(...card.color);
    doc.text(card.value, cardX + cardWidth / 2, cardY + 19, { align: 'center' });
  });

  yPos += 65;

  doc.setFontSize(14);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Evolução Mensal', MARGINS.left, yPos);
  yPos += 8;

  if (data.financeiro.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Mês', 'Receitas', 'Despesas', 'Lucro/Prejuízo']],
      body: data.financeiro.evolucaoMensal.map(m => {
        const resultado = m.receitas - m.despesas;
        return [m.mes, formatCurrency(m.receitas), formatCurrency(m.despesas), formatCurrency(resultado)];
      }),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: MARGINS.left, right: MARGINS.right },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Page 2: Chart
  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(16);
  doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
  doc.text('Gráficos Financeiros', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('Evolução Financeira Mensal', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  if (data.financeiro.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
    const barChartData = data.financeiro.evolucaoMensal.map(m => ({
      label: m.mes,
      value1: m.receitas,
      value2: m.despesas,
    }));

    const maxValue = Math.max(...barChartData.flatMap(d => [d.value1, d.value2, 1]));
    const chartHeight = 100;
    const chartWidth = contentWidth - 40;
    const barWidth = (chartWidth / barChartData.length) * 0.35;
    const startX = MARGINS.left + 30;
    const startY = yPos;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(startX, startY, startX, startY + chartHeight);
    doc.line(startX, startY + chartHeight, startX + chartWidth, startY + chartHeight);

    for (let i = 0; i <= 4; i++) {
      const lineY = startY + (chartHeight * i) / 4;
      doc.setDrawColor(235, 235, 235);
      doc.line(startX, lineY, startX + chartWidth, lineY);
    }

    const groupWidth = chartWidth / barChartData.length;
    barChartData.forEach((item, index) => {
      const groupX = startX + index * groupWidth + (groupWidth - barWidth * 2 - 2) / 2;
      
      const height1 = maxValue > 0 ? (item.value1 / maxValue) * chartHeight : 0;
      doc.setFillColor(34, 139, 34);
      doc.rect(groupX, startY + chartHeight - height1, barWidth, height1, 'F');

      const height2 = maxValue > 0 ? (item.value2 / maxValue) * chartHeight : 0;
      doc.setFillColor(200, 50, 50);
      doc.rect(groupX + barWidth + 1, startY + chartHeight - height2, barWidth, height2, 'F');

      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.text(item.label, groupX + barWidth, startY + chartHeight + 8, { align: 'center' });
    });

    const legendY = startY + chartHeight + 18;
    doc.setFillColor(34, 139, 34);
    doc.rect(pageWidth / 2 - 30, legendY, 8, 5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('Receitas', pageWidth / 2 - 20, legendY + 4);
    doc.setFillColor(200, 50, 50);
    doc.rect(pageWidth / 2 + 15, legendY, 8, 5, 'F');
    doc.text('Despesas', pageWidth / 2 + 25, legendY + 4);
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`EcoBrasil - Consultoria Ambiental`, MARGINS.left, pageHeight - 10);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - MARGINS.right, pageHeight - 10, { align: 'right' });
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
