import { useState } from "react";
import { FileDown, Loader2, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { UnlockDialog, isModuleUnlocked } from "@/components/UnlockDialog";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoPath from "@assets/image_1767899664691.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User } from "@shared/schema";

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

const MARGINS = { left: 15, right: 15, top: 20, bottom: 25 };

interface PlatformReportPDFProps {
  buttonVariant?: "default" | "outline" | "ghost";
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export function PlatformReportPDF({ buttonVariant = "default", buttonSize = "default" }: PlatformReportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const { toast } = useToast();
  
  // Buscar usuário logado para verificar role
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });
  
  // Verifica se o usuário é diretor ou admin (não precisa de senha)
  const isDirectorOrAdmin = currentUser?.role === 'diretor' || currentUser?.role === 'admin';
  
  // Verifica se o módulo de relatórios está desbloqueado na sessão
  const isReportUnlocked = isModuleUnlocked('relatorios');
  
  // Pode acessar se for diretor/admin OU se tiver desbloqueado com senha
  const canAccessReport = isDirectorOrAdmin || isReportUnlocked;

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
      const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
      let yPos = MARGINS.top;

      // Layout helper functions
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

      // Chart drawing functions
      const drawBarChart = (
        x: number, y: number, width: number, height: number,
        data: { label: string; value1: number; value2?: number }[],
        title: string,
        legend?: { label1: string; label2?: string; color1: number[]; color2?: number[] }
      ): number => {
        if (!data || data.length === 0) return y;

        const hasSecondValue = data.some(d => d.value2 !== undefined);
        const maxValue = Math.max(...data.flatMap(d => [d.value1, d.value2 || 0, 1]));
        const chartAreaHeight = height - 35;
        const chartAreaWidth = width - 30;
        const barWidth = hasSecondValue ? (chartAreaWidth / data.length) * 0.35 : (chartAreaWidth / data.length) * 0.6;
        const startX = x + 25;
        const startY = y + 18;

        // Title
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(title, x + width / 2, y + 8, { align: 'center' });

        // Y-axis and gridlines
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

        // Bars
        const groupWidth = chartAreaWidth / data.length;
        data.forEach((item, index) => {
          const groupX = startX + index * groupWidth + (groupWidth - (hasSecondValue ? barWidth * 2 + 2 : barWidth)) / 2;

          // First bar
          const height1 = maxValue > 0 ? (item.value1 / maxValue) * chartAreaHeight : 0;
          doc.setFillColor(legend?.color1[0] || 34, legend?.color1[1] || 139, legend?.color1[2] || 34);
          doc.rect(groupX, startY + chartAreaHeight - height1, barWidth, height1, 'F');

          // Second bar (if exists)
          if (hasSecondValue && item.value2 !== undefined) {
            const height2 = maxValue > 0 ? (item.value2 / maxValue) * chartAreaHeight : 0;
            doc.setFillColor(legend?.color2?.[0] || 200, legend?.color2?.[1] || 50, legend?.color2?.[2] || 50);
            doc.rect(groupX + barWidth + 1, startY + chartAreaHeight - height2, barWidth, height2, 'F');
          }

          // X-axis label
          doc.setFontSize(5);
          doc.setTextColor(100, 100, 100);
          const labelText = item.label.length > 6 ? item.label.substring(0, 5) + '..' : item.label;
          doc.text(labelText, groupX + (hasSecondValue ? barWidth : barWidth / 2), startY + chartAreaHeight + 5, { align: 'center' });
        });

        // Legend
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
        data: { label: string; value: number }[],
        title: string
      ): number => {
        if (!data || data.length === 0) return y;

        const total = data.reduce((sum, d) => sum + d.value, 0);
        if (total === 0) return y;

        // Title
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(title, x + radius, y + 8, { align: 'center' });

        const centerX = x + radius;
        const centerY = y + 18 + radius;
        let startAngle = -Math.PI / 2;

        // Draw pie slices
        data.slice(0, 8).forEach((item, index) => {
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

        // Legend
        let legendY = centerY + radius + 8;
        const legendItems = data.slice(0, 6);
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

      const drawHorizontalBarChart = (
        x: number, y: number, width: number, height: number,
        data: { label: string; value: number; color?: number[] }[],
        title: string
      ): number => {
        if (!data || data.length === 0) return y;

        const maxValue = Math.max(...data.map(d => d.value), 1);
        const barHeight = Math.min(12, (height - 25) / data.length);
        const chartWidth = width - 50;

        // Title
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(title, x + width / 2, y + 8, { align: 'center' });

        let barY = y + 18;
        data.slice(0, 6).forEach((item, index) => {
          // Label
          doc.setFontSize(7);
          doc.setTextColor(80, 80, 80);
          const labelText = item.label.length > 10 ? item.label.substring(0, 8) + '..' : item.label;
          doc.text(labelText, x + 2, barY + barHeight / 2 + 1);

          // Bar
          const barWidth = maxValue > 0 ? (item.value / maxValue) * chartWidth : 0;
          const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(x + 45, barY, barWidth, barHeight - 2, 1, 1, 'F');

          // Value
          doc.setFontSize(6);
          doc.setTextColor(60, 60, 60);
          doc.text(item.value.toString(), x + 47 + barWidth, barY + barHeight / 2 + 1);

          barY += barHeight;
        });

        return barY + 5;
      };

      // === COVER PAGE ===
      try {
        const logoImg = await loadImage(logoPath);
        const logoWidth = 55;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, 35, logoWidth, logoHeight);
        yPos = 35 + logoHeight + 15;
      } catch {
        doc.setFontSize(26);
        doc.setTextColor(...ECOBRASIL_COLORS.green);
        doc.text('EcoBrasil', pageWidth / 2, 50, { align: 'center' });
        doc.setFontSize(11);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('consultoria ambiental', pageWidth / 2, 58, { align: 'center' });
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
      const unidadeLabel = data.unidade === 'goiania' ? 'Goiânia' : 
                          data.unidade === 'salvador' ? 'Salvador' : 
                          data.unidade === 'luiz-eduardo-magalhaes' ? 'Luiz Eduardo Magalhães' : 
                          data.unidade;
      doc.text(`Unidade: ${unidadeLabel}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      doc.text(`Gerado em: ${format(new Date(data.geradoEm), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPos, { align: 'center' });
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

      // KPI Cards Grid (2 rows x 4 columns)
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

      // Financial Summary Cards
      addSectionTitle('Resumo Financeiro', ECOBRASIL_COLORS.green);

      const finCards = [
        { label: 'Total Receitas', value: formatCurrency(data.financeiro?.totalReceitas || 0), color: ECOBRASIL_COLORS.green },
        { label: 'Total Despesas', value: formatCurrency(data.financeiro?.totalDespesas || 0), color: ECOBRASIL_COLORS.red },
        { label: 'Saldo Atual', value: formatCurrency(data.financeiro?.saldoAtual || 0), color: (data.financeiro?.saldoAtual || 0) >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red },
        { label: 'Pendente', value: formatCurrency(data.financeiro?.totalPendente || 0), color: ECOBRASIL_COLORS.yellow },
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

      // Alerts Summary
      addSectionTitle('Alertas e Pendências', ECOBRASIL_COLORS.red);

      const alertItems = [
        { label: 'Licenças Vencidas', value: data.licencas?.vencidas || 0, color: ECOBRASIL_COLORS.red },
        { label: 'Licenças Próx. Vencer (30d)', value: data.licencas?.proximasVencer || 0, color: ECOBRASIL_COLORS.yellow },
        { label: 'Demandas Atrasadas', value: data.demandas?.atrasadas || 0, color: ECOBRASIL_COLORS.red },
        { label: 'Contratos Vencendo (30d)', value: data.contratos?.vencendo || 0, color: ECOBRASIL_COLORS.yellow },
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Alerta', 'Quantidade', 'Prioridade']],
        body: alertItems.map(a => [
          a.label,
          a.value.toString(),
          a.value > 0 ? 'ATENÇÃO' : 'OK'
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'center' },
        },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'body' && cellData.column.index === 2) {
            const value = alertItems[cellData.row.index]?.value || 0;
            cellData.cell.styles.textColor = value > 0 ? ECOBRASIL_COLORS.red : ECOBRASIL_COLORS.green;
            cellData.cell.styles.fontStyle = 'bold';
          }
        },
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

      // Two-column layout for charts
      const chartWidth = (contentWidth - 10) / 2;

      // Row 1: License and Demand Status Pie Charts
      const licenseStatusData = [
        { label: 'Vigentes', value: data.licencas?.vigentes || 0 },
        { label: 'Próx. Vencer', value: data.licencas?.proximasVencer || 0 },
        { label: 'Vencidas', value: data.licencas?.vencidas || 0 },
      ].filter(d => d.value > 0);

      const demandStatusData = [
        { label: 'Abertas', value: data.demandas?.abertas || 0 },
        { label: 'Concluídas', value: data.demandas?.concluidas || 0 },
        { label: 'Atrasadas', value: data.demandas?.atrasadas || 0 },
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
      checkNewPage(70);

      // Row 2: Fleet and Equipment Status
      const fleetStatusData = [
        { label: 'Disponíveis', value: data.frota?.disponiveis || 0, color: ECOBRASIL_COLORS.green },
        { label: 'Em Uso', value: data.frota?.emUso || 0, color: ECOBRASIL_COLORS.blue },
        { label: 'Manutenção', value: data.frota?.emManutencao || 0, color: ECOBRASIL_COLORS.red },
      ].filter(d => d.value > 0);

      const equipmentStatusData = [
        { label: 'Ativos', value: data.equipamentos?.ativos || 0, color: ECOBRASIL_COLORS.green },
        { label: 'Manutenção', value: data.equipamentos?.emManutencao || 0, color: ECOBRASIL_COLORS.red },
      ].filter(d => d.value > 0);

      leftEndY = yPos;
      rightEndY = yPos;

      if (fleetStatusData.length > 0) {
        leftEndY = drawHorizontalBarChart(MARGINS.left, yPos, chartWidth, 50, fleetStatusData, 'Status da Frota');
      }

      if (equipmentStatusData.length > 0) {
        rightEndY = drawHorizontalBarChart(MARGINS.left + chartWidth + 10, yPos, chartWidth, 50, equipmentStatusData, 'Status Equipamentos');
      }

      yPos = Math.max(leftEndY, rightEndY) + 8;
      checkNewPage(70);

      // Row 3: RH and Projects Status
      const rhStatusData = [
        { label: 'Ativos', value: data.rh?.ativos || 0 },
        { label: 'Férias', value: data.rh?.ferias || 0 },
        { label: 'Afastados', value: data.rh?.afastados || 0 },
      ].filter(d => d.value > 0);

      const projectStatusData = [
        { label: 'Em Andamento', value: data.projetos?.emAndamento || 0 },
        { label: 'Concluídos', value: data.projetos?.concluidos || 0 },
      ].filter(d => d.value > 0);

      leftEndY = yPos;
      rightEndY = yPos;

      if (rhStatusData.length > 0) {
        leftEndY = drawPieChart(MARGINS.left, yPos, 25, rhStatusData, 'Status RH');
      }

      if (projectStatusData.length > 0) {
        rightEndY = drawPieChart(MARGINS.left + chartWidth + 10, yPos, 25, projectStatusData, 'Status Projetos');
      }

      yPos = Math.max(leftEndY, rightEndY) + 8;

      // === PAGE 4: PROJECTS ANALYSIS ===
      doc.addPage();
      yPos = MARGINS.top;

      doc.setFontSize(16);
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text('Análise de Projetos', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Project KPI Cards
      const projectKpis = [
        { label: 'Total', value: data.projetos?.total || 0, color: ECOBRASIL_COLORS.blue },
        { label: 'Em Andamento', value: data.projetos?.emAndamento || 0, color: ECOBRASIL_COLORS.green },
        { label: 'Concluídos', value: data.projetos?.concluidos || 0, color: ECOBRASIL_COLORS.darkGreen },
        { label: 'Planejamento', value: data.projetos?.planejamento || 0, color: ECOBRASIL_COLORS.yellow },
        { label: 'Atrasados', value: data.projetos?.atrasados || 0, color: ECOBRASIL_COLORS.red },
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

      yPos += 32;

      // Row 1: Status Pie Chart (left) + Type Distribution (right)
      leftEndY = yPos;
      rightEndY = yPos;

      // Project Status Pie Chart with all statuses
      const fullProjectStatusData = Object.entries(data.projetos?.porStatus || {}).map(([status, count]) => ({
        label: status === 'em_andamento' ? 'Em Andamento' :
               status === 'concluido' ? 'Concluído' :
               status === 'planejamento' ? 'Planejamento' :
               status === 'cancelado' ? 'Cancelado' :
               status === 'pausado' ? 'Pausado' : status,
        value: count as number,
      })).filter(d => d.value > 0);

      if (fullProjectStatusData.length > 0) {
        leftEndY = drawPieChart(MARGINS.left, yPos, 28, fullProjectStatusData, 'Projetos por Status');
      }

      // Project Type Distribution
      const projectTypeData = Object.entries(data.projetos?.porTipo || {}).map(([tipo, count]) => ({
        label: tipo || 'Outros',
        value: count as number,
        color: CHART_COLORS[Object.keys(data.projetos?.porTipo || {}).indexOf(tipo) % CHART_COLORS.length],
      })).filter(d => d.value > 0).slice(0, 6);

      if (projectTypeData.length > 0) {
        rightEndY = drawHorizontalBarChart(
          MARGINS.left + chartWidth + 10, yPos, chartWidth, 70,
          projectTypeData, 'Projetos por Tipo'
        );
      }

      yPos = Math.max(leftEndY, rightEndY) + 10;
      checkNewPage(60);

      // Project Details Table
      addSectionTitle('Detalhes dos Projetos', ECOBRASIL_COLORS.purple);

      if (data.projetos?.lista && data.projetos.lista.length > 0) {
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
          alternateRowStyles: { fillColor: [250, 245, 255] },
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

      // Monthly Evolution Bar Chart
      if (data.financeiro?.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
        const barChartData = data.financeiro.evolucaoMensal.slice(-8).map((m: any) => ({
          label: m.mes || '',
          value1: m.receitas || 0,
          value2: m.despesas || 0,
        }));

        yPos = drawBarChart(
          MARGINS.left, yPos, contentWidth, 80,
          barChartData,
          'Evolução Mensal: Receitas x Despesas',
          { label1: 'Receitas', label2: 'Despesas', color1: [34, 139, 34], color2: [200, 50, 50] }
        );

        yPos += 10;
      }

      // Two column: Expenses by Category (left) + Revenue by Empreendimento (right)
      const halfWidth = (contentWidth - 10) / 2;

      leftEndY = yPos;
      rightEndY = yPos;

      // Expenses by Category Pie Chart
      if (data.financeiro?.porCategoria && data.financeiro.porCategoria.length > 0) {
        const pieData = data.financeiro.porCategoria.map((c: any) => ({
          label: c.categoria || 'Outros',
          value: c.total || c.valor || 0,
        }));

        leftEndY = drawPieChart(MARGINS.left, yPos, 28, pieData, 'Despesas por Categoria');
      }

      // Revenue by Empreendimento Bar Chart
      if (data.financeiro?.porEmpreendimento && data.financeiro.porEmpreendimento.length > 0) {
        const empData = data.financeiro.porEmpreendimento.slice(0, 5).map((e: any) => ({
          label: (e.nome || e.empreendimento || 'N/A').substring(0, 10),
          value: e.receitas || e.total || 0,
          color: ECOBRASIL_COLORS.green,
        }));

        rightEndY = drawHorizontalBarChart(
          MARGINS.left + halfWidth + 10, yPos, halfWidth, 70,
          empData, 'Top Receitas por Empreendimento'
        );
      }

      yPos = Math.max(leftEndY, rightEndY) + 8;

      // Monthly Financial Table
      if (data.financeiro?.evolucaoMensal && data.financeiro.evolucaoMensal.length > 0) {
        checkNewPage(60);
        addSectionTitle('Tabela Financeira Mensal', ECOBRASIL_COLORS.green);

        autoTable(doc, {
          startY: yPos,
          head: [['Mês', 'Receitas', 'Despesas', 'Resultado']],
          body: data.financeiro.evolucaoMensal.slice(-6).map((m: any) => {
            const resultado = (m.receitas || 0) - (m.despesas || 0);
            return [
              m.mes,
              formatCurrency(m.receitas || 0),
              formatCurrency(m.despesas || 0),
              formatCurrency(resultado),
            ];
          }),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          columnStyles: {
            1: { halign: 'right', textColor: ECOBRASIL_COLORS.green },
            2: { halign: 'right', textColor: ECOBRASIL_COLORS.red },
            3: { halign: 'right' },
          },
          didParseCell: (cellData: any) => {
            if (cellData.section === 'body' && cellData.column.index === 3) {
              const m = data.financeiro.evolucaoMensal.slice(-6)[cellData.row.index];
              const resultado = (m?.receitas || 0) - (m?.despesas || 0);
              cellData.cell.styles.textColor = resultado >= 0 ? ECOBRASIL_COLORS.green : ECOBRASIL_COLORS.red;
            }
          },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Expenses by Category Table
      if (data.financeiro?.porCategoria && data.financeiro.porCategoria.length > 0) {
        checkNewPage(50);
        addSectionTitle('Despesas por Categoria', ECOBRASIL_COLORS.red);

        const totalDespesas = data.financeiro.totalDespesas || 1;
        autoTable(doc, {
          startY: yPos,
          head: [['Categoria', 'Valor', '% do Total']],
          body: data.financeiro.porCategoria.slice(0, 8).map((c: any) => {
            const valor = c.total || c.valor || 0;
            const pct = ((valor / totalDespesas) * 100).toFixed(1);
            return [c.categoria || 'Outros', formatCurrency(valor), `${pct}%`];
          }),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.red, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 248, 248] },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
          },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // === PAGE 5+: DETAILED LISTS ===
      doc.addPage();
      yPos = MARGINS.top;

      doc.setFontSize(16);
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text('Dados Detalhados', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Licenses Table
      addSectionTitle('Licenças Ambientais', ECOBRASIL_COLORS.green);
      addSubtitle(`Total: ${data.licencas?.total || 0} | Vigentes: ${data.licencas?.vigentes || 0} | Próx. Vencer: ${data.licencas?.proximasVencer || 0} | Vencidas: ${data.licencas?.vencidas || 0}`);

      if (data.licencas?.lista && data.licencas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Tipo', 'Órgão Emissor', 'Emissão', 'Vencimento', 'Status']],
          body: data.licencas.lista.slice(0, 12).map((l: any) => [
            l.tipo || '-',
            (l.orgaoEmissor || '-').substring(0, 20),
            formatDate(l.dataEmissao),
            formatDate(l.dataVencimento),
            translateStatus(l.status),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Demands Table
      checkNewPage(50);
      addSectionTitle('Demandas', ECOBRASIL_COLORS.yellow);
      addSubtitle(`Total: ${data.demandas?.total || 0} | Abertas: ${data.demandas?.abertas || 0} | Concluídas: ${data.demandas?.concluidas || 0} | Atrasadas: ${data.demandas?.atrasadas || 0}`);

      if (data.demandas?.lista && data.demandas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Título', 'Status', 'Prioridade', 'Prazo']],
          body: data.demandas.lista.slice(0, 10).map((d: any) => [
            (d.titulo || '-').substring(0, 35),
            translateStatus(d.status),
            d.prioridade ? d.prioridade.charAt(0).toUpperCase() + d.prioridade.slice(1) : '-',
            formatDate(d.prazo),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.yellow, textColor: [50, 50, 50], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 245] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Fleet Table
      checkNewPage(50);
      addSectionTitle('Frota de Veículos', ECOBRASIL_COLORS.blue);
      addSubtitle(`Total: ${data.frota?.total || 0} | Disponíveis: ${data.frota?.disponiveis || 0} | Em Uso: ${data.frota?.emUso || 0} | Manutenção: ${data.frota?.emManutencao || 0}`);

      if (data.frota?.lista && data.frota.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Modelo', 'Placa', 'Status', 'Km']],
          body: data.frota.lista.slice(0, 10).map((v: any) => [
            v.modelo || '-',
            v.placa || '-',
            translateStatus(v.status),
            v.quilometragem ? `${Number(v.quilometragem).toLocaleString('pt-BR')}` : '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Equipment Table
      checkNewPage(50);
      addSectionTitle('Equipamentos', ECOBRASIL_COLORS.green);
      addSubtitle(`Total: ${data.equipamentos?.total || 0} | Ativos: ${data.equipamentos?.ativos || 0} | Manutenção: ${data.equipamentos?.emManutencao || 0}`);

      if (data.equipamentos?.lista && data.equipamentos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status']],
          body: data.equipamentos.lista.slice(0, 10).map((e: any) => [
            (e.nome || '-').substring(0, 30),
            e.tipo || '-',
            translateStatus(e.status),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // RH Table
      checkNewPage(50);
      addSectionTitle('Recursos Humanos', ECOBRASIL_COLORS.blue);
      addSubtitle(`Total: ${data.rh?.total || 0} | Ativos: ${data.rh?.ativos || 0} | Férias: ${data.rh?.ferias || 0} | Afastados: ${data.rh?.afastados || 0}`);

      if (data.rh?.lista && data.rh.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Cargo', 'Status']],
          body: data.rh.lista.slice(0, 10).map((r: any) => [
            (r.nome || '-').substring(0, 25),
            r.cargo || '-',
            translateStatus(r.status),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Contracts Table
      checkNewPage(50);
      addSectionTitle('Contratos', ECOBRASIL_COLORS.yellow);
      addSubtitle(`Total: ${data.contratos?.total || 0} | Ativos: ${data.contratos?.ativos || 0} | Vencendo: ${data.contratos?.vencendo || 0} | Valor Total: ${formatCurrency(data.contratos?.valorTotal || 0)}`);

      if (data.contratos?.lista && data.contratos.lista.length > 0) {
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
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.yellow, textColor: [50, 50, 50], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 252, 245] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Projects Table
      checkNewPage(50);
      addSectionTitle('Projetos', ECOBRASIL_COLORS.green);
      addSubtitle(`Total: ${data.projetos?.total || 0} | Em Andamento: ${data.projetos?.emAndamento || 0} | Concluídos: ${data.projetos?.concluidos || 0}`);

      if (data.projetos?.lista && data.projetos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Status', 'Início', 'Fim']],
          body: data.projetos.lista.slice(0, 10).map((p: any) => [
            (p.nome || '-').substring(0, 35),
            translateStatus(p.status),
            formatDate(p.dataInicio),
            formatDate(p.dataFim),
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.green, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Campaigns Table
      checkNewPage(50);
      addSectionTitle('Campanhas', ECOBRASIL_COLORS.blue);
      addSubtitle(`Total: ${data.campanhas?.total || 0} | Ativas: ${data.campanhas?.ativas || 0} | Concluídas: ${data.campanhas?.concluidas || 0}`);

      if (data.campanhas?.lista && data.campanhas.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Status', 'Período']],
          body: data.campanhas.lista.slice(0, 10).map((c: any) => [
            (c.nome || '-').substring(0, 30),
            c.tipo || '-',
            translateStatus(c.status),
            `${formatDate(c.dataInicio)} - ${formatDate(c.dataFim)}`,
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.blue, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 250, 255] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Empreendimentos Table
      checkNewPage(50);
      addSectionTitle('Empreendimentos', ECOBRASIL_COLORS.darkGreen);
      addSubtitle(`Total: ${data.empreendimentos?.total || 0}`);

      if (data.empreendimentos?.lista && data.empreendimentos.lista.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nome', 'Tipo', 'Município', 'UF']],
          body: data.empreendimentos.lista.slice(0, 12).map((e: any) => [
            (e.nome || '-').substring(0, 30),
            e.tipo || '-',
            e.municipio || '-',
            e.uf || '-',
          ]),
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: ECOBRASIL_COLORS.darkGreen, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 252, 248] },
          margin: { left: MARGINS.left, right: MARGINS.right },
        });
      }

      // === ADD FOOTERS TO ALL PAGES ===
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `EcoGestor - Relatório 360° EcoBrasil | Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(MARGINS.left, pageHeight - 12, pageWidth - MARGINS.right, pageHeight - 12);
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

  // Handler para abrir o diálogo - verifica se precisa de senha primeiro
  const handleOpenDialog = () => {
    if (canAccessReport) {
      setIsDialogOpen(true);
    } else {
      setShowUnlockDialog(true);
    }
  };

  return (
    <>
      <Button 
        variant={buttonVariant} 
        size={buttonSize} 
        disabled={isExporting} 
        onClick={handleOpenDialog}
        data-testid="button-relatorio-plataforma"
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Relatório 360°
            {!isDirectorOrAdmin && !isReportUnlocked && <Lock className="h-3 w-3 ml-1" />}
          </>
        )}
      </Button>

      {/* Diálogo de senha para usuários não-diretores */}
      <UnlockDialog
        open={showUnlockDialog}
        onOpenChange={setShowUnlockDialog}
        moduleName="relatorios"
        onSuccess={() => {
          setShowUnlockDialog(false);
          setIsDialogOpen(true);
        }}
        onCancel={() => setShowUnlockDialog(false)}
      />

      {/* Diálogo principal do relatório */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !isExporting && setIsDialogOpen(open)}>
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
                <li>• Gráficos de status por módulo</li>
                <li>• Análise financeira com gráficos</li>
                <li>• Tabelas de evolução mensal</li>
                <li>• Alertas e pendências</li>
                <li>• Listagens detalhadas de todos os módulos</li>
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
    </>
  );
}
