import { useState } from "react";
import { FileDown, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoPath from "@assets/image_1767899664691.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ECOBRASIL_COLORS = {
  green: [34, 139, 34] as [number, number, number],
  yellow: [218, 165, 32] as [number, number, number],
  blue: [0, 102, 153] as [number, number, number],
  darkGreen: [0, 100, 0] as [number, number, number],
  lightGreen: [144, 238, 144] as [number, number, number],
  red: [200, 50, 50] as [number, number, number],
};

interface PlatformReportPDFProps {
  buttonVariant?: "default" | "outline" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export function PlatformReportPDF({ buttonVariant = "default", buttonSize = "default" }: PlatformReportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const translateStatus = (status: string | null | undefined) => {
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
  };

  const CHART_COLORS = [
    [34, 139, 34],   // Green
    [200, 50, 50],   // Red
    [0, 102, 153],   // Blue
    [218, 165, 32],  // Gold
    [148, 103, 189], // Purple
    [255, 127, 14],  // Orange
    [44, 160, 44],   // Bright Green
    [214, 39, 40],   // Bright Red
    [31, 119, 180],  // Bright Blue
    [255, 152, 150], // Light Red
  ];

  const drawBarChart = (
    doc: jsPDF,
    data: { label: string; receitas: number; despesas: number }[],
    x: number,
    y: number,
    width: number,
    height: number,
    title: string
  ) => {
    if (!data || data.length === 0) return y;

    const maxValue = Math.max(...data.flatMap(d => [d.receitas, d.despesas, 1]));
    const barAreaHeight = height - 40;
    const barAreaWidth = width - 40;
    const groupWidth = barAreaWidth / data.length;
    const barWidth = groupWidth * 0.35;
    const startX = x + 35;
    const startY = y + 25;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(title, x + width / 2, y + 10, { align: 'center' });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(startX, startY, startX, startY + barAreaHeight);
    doc.line(startX, startY + barAreaHeight, startX + barAreaWidth, startY + barAreaHeight);

    const gridLines = 5;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    for (let i = 0; i <= gridLines; i++) {
      const yLine = startY + (barAreaHeight * i) / gridLines;
      const value = maxValue * (1 - i / gridLines);
      doc.setDrawColor(230, 230, 230);
      doc.line(startX, yLine, startX + barAreaWidth, yLine);
      doc.text(formatCurrency(value).replace('R$ ', ''), startX - 3, yLine + 2, { align: 'right' });
    }

    data.forEach((item, index) => {
      const groupX = startX + index * groupWidth + groupWidth * 0.1;

      const receitaHeight = (item.receitas / maxValue) * barAreaHeight;
      doc.setFillColor(34, 139, 34);
      doc.rect(groupX, startY + barAreaHeight - receitaHeight, barWidth, receitaHeight, 'F');

      const despesaHeight = (item.despesas / maxValue) * barAreaHeight;
      doc.setFillColor(200, 50, 50);
      doc.rect(groupX + barWidth + 2, startY + barAreaHeight - despesaHeight, barWidth, despesaHeight, 'F');

      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      const labelText = item.label.length > 8 ? item.label.substring(0, 6) + '..' : item.label;
      doc.text(labelText, groupX + barWidth, startY + barAreaHeight + 8, { align: 'center' });
    });

    const legendY = startY + barAreaHeight + 15;
    doc.setFillColor(34, 139, 34);
    doc.rect(x + width / 2 - 40, legendY, 8, 5, 'F');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('Receitas', x + width / 2 - 30, legendY + 4);

    doc.setFillColor(200, 50, 50);
    doc.rect(x + width / 2 + 10, legendY, 8, 5, 'F');
    doc.text('Despesas', x + width / 2 + 20, legendY + 4);

    return y + height + 10;
  };

  const drawPieChart = (
    doc: jsPDF,
    data: { categoria: string; valor: number }[],
    x: number,
    y: number,
    radius: number,
    title: string
  ) => {
    if (!data || data.length === 0) return y;

    const total = data.reduce((sum, d) => sum + d.valor, 0);
    if (total === 0) return y;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(title, x + radius, y + 10, { align: 'center' });

    const centerX = x + radius;
    const centerY = y + 25 + radius;
    let startAngle = -Math.PI / 2;

    data.forEach((item, index) => {
      const sliceAngle = (item.valor / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      const color = CHART_COLORS[index % CHART_COLORS.length];
      doc.setFillColor(color[0], color[1], color[2]);

      const segments = Math.ceil(sliceAngle * 30);
      const points: [number, number][] = [[centerX, centerY]];

      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (sliceAngle * i) / segments;
        points.push([
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
        ]);
      }

      if (points.length > 2) {
        doc.setLineWidth(0);
        for (let i = 1; i < points.length - 1; i++) {
          doc.triangle(
            centerX, centerY,
            points[i][0], points[i][1],
            points[i + 1][0], points[i + 1][1],
            'F'
          );
        }
      }

      startAngle = endAngle;
    });

    let legendY = centerY + radius + 15;
    const legendX = x;
    doc.setFontSize(7);

    const legendData = data.slice(0, 8);
    legendData.forEach((item, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(legendX, legendY, 6, 4, 'F');

      doc.setTextColor(60, 60, 60);
      const percentage = ((item.valor / total) * 100).toFixed(1);
      const labelText = item.categoria.length > 15 ? item.categoria.substring(0, 12) + '...' : item.categoria;
      doc.text(`${labelText}: ${percentage}%`, legendX + 8, legendY + 3);
      legendY += 6;
    });

    return legendY + 5;
  };

  const generatePDF = async () => {
    setIsExporting(true);

    try {
      console.log('Iniciando geração do relatório 360°...');
      
      const response = await fetch('/api/relatorio-plataforma', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta do servidor:', response.status, errorText);
        throw new Error(`Falha ao buscar dados do relatório: ${response.status}`);
      }

      const data = await response.json();
      console.log('Dados do relatório recebidos:', Object.keys(data));

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      let yPos = 10;

      const addNewPageIfNeeded = (requiredSpace: number = 50) => {
        if (yPos > pageHeight - requiredSpace) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      const addSectionTitle = (title: string, color: [number, number, number] = ECOBRASIL_COLORS.blue) => {
        addNewPageIfNeeded(40);
        doc.setFontSize(14);
        doc.setTextColor(...color);
        doc.text(title, 20, yPos);
        yPos += 8;
      };

      const addDivider = () => {
        doc.setDrawColor(...ECOBRASIL_COLORS.green);
        doc.setLineWidth(0.5);
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 5;
      };

      // === COVER PAGE ===
      try {
        const logoImg = await loadImage(logoPath);
        const logoWidth = 60;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, 30, logoWidth, logoHeight);
        yPos = 30 + logoHeight + 15;
      } catch (e) {
        doc.setFontSize(28);
        doc.setTextColor(...ECOBRASIL_COLORS.green);
        doc.text('EcoBrasil', pageWidth / 2, 50, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('consultoria ambiental', pageWidth / 2, 60, { align: 'center' });
        yPos = 80;
      }

      doc.setFontSize(24);
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text('Relatório 360° da Plataforma', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      doc.setFontSize(14);
      doc.setTextColor(...ECOBRASIL_COLORS.blue);
      doc.text('EcoGestor - Sistema de Gestão Ambiental', pageWidth / 2, yPos, { align: 'center' });
      yPos += 20;

      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.text(`Unidade: ${data.unidade === 'goiania' ? 'Goiânia' : data.unidade === 'salvador' ? 'Salvador' : data.unidade === 'luiz-eduardo-magalhaes' ? 'Luiz Eduardo Magalhães' : data.unidade}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      doc.text(`Gerado em: ${format(new Date(data.geradoEm), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 30;

      doc.setDrawColor(...ECOBRASIL_COLORS.green);
      doc.setLineWidth(2);
      doc.line(40, yPos, pageWidth - 40, yPos);
      yPos += 20;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('DOCUMENTO CONFIDENCIAL', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      doc.setFontSize(8);
      doc.text('Este relatório contém informações estratégicas da empresa.', pageWidth / 2, yPos, { align: 'center' });

      // === EXECUTIVE SUMMARY PAGE ===
      doc.addPage();
      yPos = 20;

      doc.setFontSize(18);
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text('Resumo Executivo', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      addDivider();
      yPos += 5;

      // KPI Cards
      const kpiData = [
        { label: 'Empreendimentos', value: data.resumoGeral.totalEmpreendimentos, color: ECOBRASIL_COLORS.green },
        { label: 'Licenças', value: data.resumoGeral.totalLicencas, color: ECOBRASIL_COLORS.blue },
        { label: 'Demandas', value: data.resumoGeral.totalDemandas, color: ECOBRASIL_COLORS.yellow },
        { label: 'Projetos', value: data.resumoGeral.totalProjetos, color: ECOBRASIL_COLORS.green },
        { label: 'Veículos', value: data.resumoGeral.totalVeiculos, color: ECOBRASIL_COLORS.blue },
        { label: 'Equipamentos', value: data.resumoGeral.totalEquipamentos, color: ECOBRASIL_COLORS.yellow },
        { label: 'Funcionários', value: data.resumoGeral.totalFuncionarios, color: ECOBRASIL_COLORS.green },
        { label: 'Contratos', value: data.resumoGeral.totalContratos, color: ECOBRASIL_COLORS.blue },
      ];

      const cardWidth = 40;
      const cardHeight = 25;
      const cardsPerRow = 4;
      const cardMargin = 5;
      const startX = (pageWidth - (cardWidth * cardsPerRow + cardMargin * (cardsPerRow - 1))) / 2;

      kpiData.forEach((kpi, idx) => {
        const row = Math.floor(idx / cardsPerRow);
        const col = idx % cardsPerRow;
        const x = startX + col * (cardWidth + cardMargin);
        const y = yPos + row * (cardHeight + cardMargin);

        doc.setFillColor(245, 250, 245);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(kpi.label, x + cardWidth / 2, y + 8, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value.toString(), x + cardWidth / 2, y + 19, { align: 'center' });
      });

      yPos += Math.ceil(kpiData.length / cardsPerRow) * (cardHeight + cardMargin) + 15;

      // Financial Summary
      addSectionTitle('Resumo Financeiro');
      
      const finCards = [
        { label: 'Total Receitas', value: formatCurrency(data.financeiro.totalReceitas || 0), color: ECOBRASIL_COLORS.green },
        { label: 'Total Despesas', value: formatCurrency(data.financeiro.totalDespesas || 0), color: ECOBRASIL_COLORS.red },
        { label: 'Saldo Atual', value: formatCurrency(data.financeiro.saldoAtual || 0), color: (data.financeiro.saldoAtual || 0) >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red },
        { label: 'Pendente', value: formatCurrency(data.financeiro.totalPendente || 0), color: ECOBRASIL_COLORS.yellow },
      ];

      const finCardWidth = 42;
      const finStartX = (pageWidth - (finCardWidth * 4 + cardMargin * 3)) / 2;

      finCards.forEach((card, idx) => {
        const x = finStartX + idx * (finCardWidth + cardMargin);
        
        doc.setFillColor(248, 248, 248);
        doc.roundedRect(x, yPos, finCardWidth, 22, 2, 2, 'F');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(card.label, x + finCardWidth / 2, yPos + 7, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(...card.color);
        doc.text(card.value, x + finCardWidth / 2, yPos + 16, { align: 'center' });
      });

      yPos += 35;

      // === LICENSES SECTION ===
      addSectionTitle('Licenças Ambientais', ECOBRASIL_COLORS.green);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.licencas.total} | Vigentes: ${data.licencas.vigentes} | Próximas a Vencer: ${data.licencas.proximasVencer} | Vencidas: ${data.licencas.vencidas}`, 20, yPos);
      yPos += 8;

      if (data.licencas.lista && data.licencas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Tipo', 'Órgão Emissor', 'Emissão', 'Vencimento', 'Status']],
          body: data.licencas.lista.slice(0, 10).map((l: any) => [
            l.tipo || '-',
            l.orgaoEmissor || '-',
            formatDate(l.dataEmissao),
            formatDate(l.dataVencimento),
            translateStatus(l.status),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 245] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === DEMANDS SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Demandas', ECOBRASIL_COLORS.yellow);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.demandas.total} | Abertas: ${data.demandas.abertas} | Concluídas: ${data.demandas.concluidas} | Atrasadas: ${data.demandas.atrasadas}`, 20, yPos);
      yPos += 8;

      if (data.demandas.lista && data.demandas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Status', 'Prioridade', 'Prazo']],
          body: data.demandas.lista.slice(0, 10).map((d: any) => [
            (d.titulo || '-').substring(0, 40),
            translateStatus(d.status),
            d.prioridade ? d.prioridade.charAt(0).toUpperCase() + d.prioridade.slice(1) : '-',
            formatDate(d.prazo),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.yellow, textColor: [50, 50, 50], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 240] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === FLEET SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Frota de Veículos', ECOBRASIL_COLORS.blue);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.frota.total} | Disponíveis: ${data.frota.disponiveis} | Em Uso: ${data.frota.emUso} | Manutenção: ${data.frota.emManutencao}`, 20, yPos);
      yPos += 8;

      if (data.frota.lista && data.frota.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Modelo', 'Placa', 'Status', 'Quilometragem']],
          body: data.frota.lista.slice(0, 10).map((v: any) => [
            v.modelo || '-',
            v.placa || '-',
            translateStatus(v.status),
            v.quilometragem ? `${Number(v.quilometragem).toLocaleString('pt-BR')} km` : '-',
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 248, 255] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === EQUIPMENT SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Equipamentos', ECOBRASIL_COLORS.green);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.equipamentos.total} | Ativos: ${data.equipamentos.ativos} | Em Manutenção: ${data.equipamentos.emManutencao}`, 20, yPos);
      yPos += 8;

      if (data.equipamentos.lista && data.equipamentos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status']],
          body: data.equipamentos.lista.slice(0, 10).map((e: any) => [
            e.nome || '-',
            e.tipo || '-',
            translateStatus(e.status),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 245] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === RH SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Recursos Humanos', ECOBRASIL_COLORS.blue);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.rh.total} | Ativos: ${data.rh.ativos} | Férias: ${data.rh.ferias} | Afastados: ${data.rh.afastados}`, 20, yPos);
      yPos += 8;

      if (data.rh.lista && data.rh.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Cargo', 'Status']],
          body: data.rh.lista.slice(0, 10).map((r: any) => [
            r.nome || '-',
            r.cargo || '-',
            translateStatus(r.status),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 248, 255] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === CONTRACTS SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Contratos', ECOBRASIL_COLORS.yellow);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.contratos.total} | Ativos: ${data.contratos.ativos} | Vencendo em 30 dias: ${data.contratos.vencendo} | Valor Total: ${formatCurrency(data.contratos.valorTotal)}`, 20, yPos);
      yPos += 8;

      if (data.contratos.lista && data.contratos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Número', 'Tipo', 'Valor', 'Status', 'Vigência']],
          body: data.contratos.lista.slice(0, 10).map((c: any) => [
            c.numero || '-',
            c.tipo || '-',
            formatCurrency(Number(c.valor) || 0),
            translateStatus(c.status),
            `${formatDate(c.dataInicio)} - ${formatDate(c.dataFim)}`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.yellow, textColor: [50, 50, 50], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 240] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === PROJECTS SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Projetos', ECOBRASIL_COLORS.green);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.projetos.total} | Em Andamento: ${data.projetos.emAndamento} | Concluídos: ${data.projetos.concluidos}`, 20, yPos);
      yPos += 8;

      if (data.projetos.lista && data.projetos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Status', 'Início', 'Fim']],
          body: data.projetos.lista.slice(0, 10).map((p: any) => [
            (p.nome || '-').substring(0, 40),
            translateStatus(p.status),
            formatDate(p.dataInicio),
            formatDate(p.dataFim),
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 245] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === CAMPAIGNS SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Campanhas', ECOBRASIL_COLORS.blue);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.campanhas.total} | Ativas: ${data.campanhas.ativas} | Concluídas: ${data.campanhas.concluidas}`, 20, yPos);
      yPos += 8;

      if (data.campanhas.lista && data.campanhas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status', 'Período']],
          body: data.campanhas.lista.slice(0, 10).map((c: any) => [
            (c.nome || '-').substring(0, 35),
            c.tipo || '-',
            translateStatus(c.status),
            `${formatDate(c.dataInicio)} - ${formatDate(c.dataFim)}`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [240, 248, 255] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === EMPREENDIMENTOS SECTION ===
      addNewPageIfNeeded(60);
      addSectionTitle('Empreendimentos', ECOBRASIL_COLORS.darkGreen);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`Total: ${data.empreendimentos.total}`, 20, yPos);
      yPos += 8;

      if (data.empreendimentos.lista && data.empreendimentos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Município', 'UF']],
          body: data.empreendimentos.lista.slice(0, 10).map((e: any) => [
            (e.nome || '-').substring(0, 35),
            e.tipo || '-',
            e.municipio || '-',
            e.uf || '-',
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.darkGreen, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 245] },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === FINANCIAL CHARTS SECTION ===
      doc.addPage();
      yPos = 20;
      addSectionTitle('Gráficos Financeiros', ECOBRASIL_COLORS.green);
      addDivider();

      // Bar Chart - Monthly Evolution
      if (data.financeiro.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
        const barChartData = data.financeiro.evolucaoMensal.map((m: any) => ({
          label: m.mes || '',
          receitas: m.receitas || 0,
          despesas: m.despesas || 0,
        }));

        yPos = drawBarChart(
          doc,
          barChartData.slice(-12),
          20,
          yPos,
          pageWidth - 40,
          100,
          'Evolução Mensal: Receitas x Despesas'
        );
      }

      // Pie Chart - Expenses by Category
      if (data.financeiro.porCategoria && data.financeiro.porCategoria.length > 0) {
        addNewPageIfNeeded(150);
        
        const pieChartData = data.financeiro.porCategoria.map((c: any) => ({
          categoria: c.categoria || 'Outros',
          valor: c.total || c.valor || 0,
        }));

        yPos = drawPieChart(
          doc,
          pieChartData.slice(0, 10),
          pageWidth / 2 - 40,
          yPos,
          35,
          'Despesas por Categoria'
        );
      }

      // Bar Chart - Revenues by Empreendimento (if available)
      if (data.financeiro.porEmpreendimento && data.financeiro.porEmpreendimento.length > 0) {
        addNewPageIfNeeded(120);
        
        const empBarData = data.financeiro.porEmpreendimento.slice(0, 8).map((e: any) => ({
          label: (e.nome || e.empreendimento || 'N/A').substring(0, 10),
          receitas: e.receitas || e.total || 0,
          despesas: e.despesas || 0,
        }));

        yPos = drawBarChart(
          doc,
          empBarData,
          20,
          yPos,
          pageWidth - 40,
          90,
          'Receitas por Empreendimento'
        );
      }

      // === FINANCIAL DETAILS TABLE ===
      if (data.financeiro.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
        addNewPageIfNeeded(80);
        addSectionTitle('Tabela de Evolução Financeira Mensal', ECOBRASIL_COLORS.green);

        autoTable(doc, {
          startY: yPos,
          head: [['Mês', 'Receitas', 'Despesas', 'Lucro/Prejuízo']],
          body: data.financeiro.evolucaoMensal.map((m: any) => [
            m.mes,
            formatCurrency(m.receitas || 0),
            formatCurrency(m.despesas || 0),
            formatCurrency(m.lucro || 0),
          ]),
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 245] },
          columnStyles: {
            1: { textColor: ECOBRASIL_COLORS.green, halign: 'right' },
            2: { textColor: ECOBRASIL_COLORS.red, halign: 'right' },
            3: { halign: 'right' },
          },
          didParseCell: (cellData: any) => {
            if (cellData.section === 'body' && cellData.column.index === 3) {
              const value = data.financeiro.evolucaoMensal[cellData.row.index]?.lucro || 0;
              cellData.cell.styles.textColor = value >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red;
            }
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === EXPENSES BY CATEGORY TABLE ===
      if (data.financeiro.porCategoria && data.financeiro.porCategoria.length > 0) {
        addNewPageIfNeeded(60);
        addSectionTitle('Despesas por Categoria', ECOBRASIL_COLORS.red);

        autoTable(doc, {
          startY: yPos,
          head: [['Categoria', 'Valor Total', '% do Total']],
          body: data.financeiro.porCategoria.map((c: any) => {
            const total = data.financeiro.totalDespesas || 1;
            const valor = c.total || c.valor || 0;
            const percentage = ((valor / total) * 100).toFixed(1);
            return [
              c.categoria || 'Outros',
              formatCurrency(valor),
              `${percentage}%`,
            ];
          }),
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 245, 245] },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
          },
          margin: { left: 20, right: 20 },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === FOOTER ON ALL PAGES ===
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `EcoGestor - Relatório 360° | Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
        
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
      }

      // Save the PDF
      const fileName = `Relatorio_360_EcoBrasil_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
      doc.save(fileName);

      setIsDialogOpen(false);
      toast({
        title: "Relatório gerado com sucesso!",
        description: `O arquivo ${fileName} foi baixado.`,
      });

    } catch (error: any) {
      console.error('Error generating report:', error);
      const errorMessage = error?.message || "Não foi possível gerar o relatório. Tente novamente.";
      toast({
        title: "Erro ao gerar relatório",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => !isExporting && setIsDialogOpen(open)}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant} size={buttonSize} disabled={isExporting} data-testid="button-relatorio-plataforma">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Relatório 360°
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-green-600" />
            Relatório Completo da Plataforma
          </DialogTitle>
          <DialogDescription>
            Gere um relatório PDF completo com todos os dados da plataforma EcoGestor.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">O relatório incluirá:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Resumo executivo com KPIs gerais</li>
              <li>• Licenças ambientais e seus status</li>
              <li>• Demandas abertas e concluídas</li>
              <li>• Frota de veículos</li>
              <li>• Inventário de equipamentos</li>
              <li>• Recursos humanos</li>
              <li>• Contratos ativos e vencendo</li>
              <li>• Projetos e campanhas</li>
              <li>• Resumo financeiro completo</li>
              <li>• Lista de empreendimentos</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            O relatório será gerado em formato PDF com a identidade visual da EcoBrasil.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button 
            onClick={generatePDF} 
            disabled={isExporting}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-gerar-relatorio"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
