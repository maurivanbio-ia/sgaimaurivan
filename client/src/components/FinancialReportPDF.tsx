import { useState } from "react";
import { FileDown, Loader2, ChevronDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoPath from "@assets/image_1767899664691.png";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string; unidade?: string }>;
  porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number; unidade?: string }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
  empreendimentoNome?: string;
}

const UNIDADES_CONFIG: { [key: string]: { label: string; sigla: string } } = {
  salvador: { label: "Salvador (BA)", sigla: "BA" },
  goiania: { label: "Goiânia (GO)", sigla: "GO" },
  lem: { label: "Luís Eduardo Magalhães (LEM)", sigla: "LEM" }
};

interface Empreendimento {
  id: number;
  nome: string;
}

interface FinancialReportPDFProps {
  stats: FinancialStats | undefined;
  empreendimentos: Empreendimento[];
  lineChartRef?: React.RefObject<any>;
  pieChartRef?: React.RefObject<unknown>;
  barChartRef?: React.RefObject<any>;
  expenseEvolutionChartRef?: React.RefObject<unknown>;
}

const ECOBRASIL_COLORS = {
  green: [34, 139, 34] as [number, number, number],
  yellow: [218, 165, 32] as [number, number, number],
  blue: [0, 102, 153] as [number, number, number],
  darkGreen: [0, 100, 0] as [number, number, number],
  lightGreen: [144, 238, 144] as [number, number, number],
};

type PeriodType = "all" | "this_week" | "this_month" | "last_month" | "last_3_months" | "last_6_months" | "last_12_months" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "custom", label: "Período personalizado" },
];

export function FinancialReportPDF({ stats, empreendimentos, lineChartRef, pieChartRef, barChartRef, expenseEvolutionChartRef }: FinancialReportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();

  const getDateRange = (): { startDate: Date | null; endDate: Date | null; periodLabel: string } => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case "this_week":
        return { 
          startDate: startOfWeek(now, { locale: ptBR }), 
          endDate: endOfWeek(now, { locale: ptBR }),
          periodLabel: "Esta semana"
        };
      case "this_month":
        return { 
          startDate: startOfMonth(now), 
          endDate: endOfMonth(now),
          periodLabel: format(now, "MMMM 'de' yyyy", { locale: ptBR })
        };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { 
          startDate: startOfMonth(lastMonth), 
          endDate: endOfMonth(lastMonth),
          periodLabel: format(lastMonth, "MMMM 'de' yyyy", { locale: ptBR })
        };
      case "last_3_months":
        return { 
          startDate: subMonths(now, 3), 
          endDate: now,
          periodLabel: "Últimos 3 meses"
        };
      case "last_6_months":
        return { 
          startDate: subMonths(now, 6), 
          endDate: now,
          periodLabel: "Últimos 6 meses"
        };
      case "last_12_months":
        return { 
          startDate: subMonths(now, 12), 
          endDate: now,
          periodLabel: "Últimos 12 meses"
        };
      case "custom":
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          return { 
            startDate: start, 
            endDate: end,
            periodLabel: `${format(start, "dd/MM/yyyy")} a ${format(end, "dd/MM/yyyy")}`
          };
        }
        return { startDate: null, endDate: null, periodLabel: "Período inválido" };
      default:
        return { startDate: null, endDate: null, periodLabel: "Todo o período" };
    }
  };

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

  const generatePDF = async () => {
    setIsExporting(true);
    setIsPopoverOpen(false);
    
    try {
      const { startDate, endDate, periodLabel } = getDateRange();
      
      // Validate custom period
      if (selectedPeriod === "custom" && (!customStartDate || !customEndDate)) {
        toast({
          title: "Período inválido",
          description: "Por favor, informe as datas de início e fim do período.",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      let reportStats: FinancialStats;
      let reportTitle = 'Relatório Financeiro Consolidado';
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId !== "all") {
        params.append("empreendimentoId", selectedEmpreendimentoId);
      }
      if (startDate) {
        params.append("startDate", startDate.toISOString());
      }
      if (endDate) {
        params.append("endDate", endDate.toISOString());
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/financeiro/stats${queryString}`);
      
      if (!response.ok) {
        throw new Error("Falha ao buscar dados financeiros");
      }
      
      reportStats = await response.json();
      
      if (selectedEmpreendimentoId !== "all") {
        const empName = reportStats.empreendimentoNome || empreendimentos.find(e => e.id === parseInt(selectedEmpreendimentoId))?.nome;
        reportTitle = `Relatório Financeiro - ${empName || 'Empreendimento'}`;
      }

      const safeStats = {
        totalReceitas: reportStats.totalReceitas || 0,
        totalDespesas: reportStats.totalDespesas || 0,
        totalPendente: reportStats.totalPendente || 0,
        saldoAtual: reportStats.saldoAtual || 0,
        porCategoria: reportStats.porCategoria || [],
        porEmpreendimento: reportStats.porEmpreendimento || [],
        evolucaoMensal: reportStats.evolucaoMensal || [],
      };

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Add logo
      try {
        const logoImg = await loadImage(logoPath);
        const logoWidth = 50;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
      } catch (e) {
        // Fallback to text if logo fails
        doc.setFontSize(24);
        doc.setTextColor(...ECOBRASIL_COLORS.green);
        doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('consultoria ambiental', pageWidth / 2, 28, { align: 'center' });
      }

      doc.setFontSize(22);
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text(reportTitle, pageWidth / 2, 40, { align: 'center' });
      
      // Add period info
      doc.setFontSize(11);
      doc.setTextColor(...ECOBRASIL_COLORS.blue);
      doc.text(`Período: ${periodLabel}`, pageWidth / 2, 48, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, pageWidth / 2, 55, { align: 'center' });

      doc.setDrawColor(...ECOBRASIL_COLORS.green);
      doc.setLineWidth(1);
      doc.line(20, 60, pageWidth - 20, 60);

      let yPos = 68;

      doc.setFontSize(14);
      doc.setTextColor(...ECOBRASIL_COLORS.blue);
      doc.text('Resumo Financeiro', 20, yPos);
      yPos += 10;

      const cardWidth = (pageWidth - 50) / 2;
      const cardHeight = 25;
      const margin = 10;

      doc.setFillColor(240, 255, 240);
      doc.roundedRect(20, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Total Receitas', 25, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(34, 139, 34);
      doc.text(formatCurrency(safeStats.totalReceitas), 25, yPos + 18);

      doc.setFillColor(255, 240, 240);
      doc.roundedRect(25 + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Total Despesas', 30 + cardWidth + margin, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(200, 50, 50);
      doc.text(formatCurrency(safeStats.totalDespesas), 30 + cardWidth + margin, yPos + 18);

      yPos += cardHeight + margin;

      const balanceColor = safeStats.saldoAtual >= 0 ? [34, 139, 34] : [200, 50, 50];
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(20, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Saldo Atual', 25, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(...balanceColor as [number, number, number]);
      doc.text(formatCurrency(safeStats.saldoAtual), 25, yPos + 18);

      doc.setFillColor(255, 250, 240);
      doc.roundedRect(25 + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Pendente', 30 + cardWidth + margin, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(218, 165, 32);
      doc.text(formatCurrency(safeStats.totalPendente), 30 + cardWidth + margin, yPos + 18);

      yPos += cardHeight + 20;

      if (safeStats.evolucaoMensal.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Evolução Mensal', 20, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Mês', 'Receitas', 'Despesas', 'Lucro/Prejuízo']],
          body: safeStats.evolucaoMensal.map(m => [
            m.mes,
            formatCurrency(m.receitas),
            formatCurrency(m.despesas),
            formatCurrency(m.lucro)
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: ECOBRASIL_COLORS.green,
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [245, 250, 245]
          },
          columnStyles: {
            0: { fontStyle: 'bold' },
            1: { textColor: [34, 139, 34], halign: 'right' },
            2: { textColor: [200, 50, 50], halign: 'right' },
            3: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const value = safeStats.evolucaoMensal[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = value >= 0 ? [34, 139, 34] : [200, 50, 50];
            }
          },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
      }

      if (safeStats.porCategoria.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Distribuição por Categoria', 20, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Categoria', 'Tipo', 'Valor']],
          body: safeStats.porCategoria.map(c => [
            c.categoria,
            c.tipo === 'receita' ? 'Receita' : 'Despesa',
            formatCurrency(c.valor)
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: ECOBRASIL_COLORS.yellow,
            textColor: [50, 50, 50],
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [255, 252, 240]
          },
          columnStyles: {
            2: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 1) {
              const tipo = safeStats.porCategoria[data.row.index]?.tipo;
              data.cell.styles.textColor = tipo === 'receita' ? [34, 139, 34] : [200, 50, 50];
            }
            if (data.section === 'body' && data.column.index === 2) {
              const tipo = safeStats.porCategoria[data.row.index]?.tipo;
              data.cell.styles.textColor = tipo === 'receita' ? [34, 139, 34] : [200, 50, 50];
            }
          },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
      }

      if (safeStats.porEmpreendimento.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Resultado por Projeto', 20, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [['Projeto', 'Unidade', 'Receitas', 'Despesas', 'Resultado']],
          body: safeStats.porEmpreendimento.map(e => [
            e.empreendimento.length > 25 ? e.empreendimento.substring(0, 25) + '...' : e.empreendimento,
            UNIDADES_CONFIG[e.unidade || '']?.sigla || e.unidade || '-',
            formatCurrency(e.receitas),
            formatCurrency(e.despesas),
            formatCurrency(e.lucro)
          ]),
          styles: {
            fontSize: 9,
            cellPadding: 4,
          },
          headStyles: {
            fillColor: ECOBRASIL_COLORS.blue,
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: {
            fillColor: [240, 248, 255]
          },
          columnStyles: {
            1: { halign: 'center' },
            2: { textColor: [34, 139, 34], halign: 'right' },
            3: { textColor: [200, 50, 50], halign: 'right' },
            4: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
              const value = safeStats.porEmpreendimento[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = value >= 0 ? [34, 139, 34] : [200, 50, 50];
            }
          },
          margin: { left: 20, right: 20 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Add charts page
      const lineChart = lineChartRef?.current;
      const pieChart = pieChartRef?.current;
      const barChart = barChartRef?.current;
      const expenseEvolutionChart = expenseEvolutionChartRef?.current;
      const hasCharts = lineChart || pieChart || barChart || expenseEvolutionChart;
      
      if (hasCharts) {
        doc.addPage();
        yPos = 20;
        
        doc.setFontSize(16);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Gráficos Financeiros', pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;

        const chartWidth = 85;
        const chartHeight = 60;

        // Line chart - Evolution (full width)
        if (lineChart) {
          try {
            const lineCanvas = lineChart.canvas || lineChart;
            const lineDataUrl = lineCanvas.toDataURL('image/png', 1.0);
            
            doc.setFontSize(11);
            doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
            doc.text('Evolução Financeira Mensal', 20, yPos);
            yPos += 3;
            
            doc.addImage(lineDataUrl, 'PNG', 20, yPos, pageWidth - 40, 70);
            yPos += 80;
          } catch (e) {
            console.error('Erro ao adicionar gráfico de linha:', e);
          }
        }

        // Expense Evolution by Category chart (full width)
        if (expenseEvolutionChart) {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = 20;
          }
          
          try {
            const expenseCanvas = expenseEvolutionChart.canvas || expenseEvolutionChart;
            const expenseDataUrl = expenseCanvas.toDataURL('image/png', 1.0);
            
            doc.setFontSize(11);
            doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
            doc.text('Evolução de Despesas por Tipo', 20, yPos);
            yPos += 3;
            
            doc.addImage(expenseDataUrl, 'PNG', 20, yPos, pageWidth - 40, 70);
            yPos += 80;
          } catch (e) {
            console.error('Erro ao adicionar gráfico de evolução de despesas:', e);
          }
        }

        // Pie and Bar charts side by side
        if (pieChart || barChart) {
          if (yPos > pageHeight - 100) {
            doc.addPage();
            yPos = 20;
          }

          const leftX = 20;
          const rightX = pageWidth / 2 + 5;

          if (pieChart) {
            try {
              const pieCanvas = pieChart.canvas || pieChart;
              const pieDataUrl = pieCanvas.toDataURL('image/png', 1.0);
              
              doc.setFontSize(11);
              doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
              doc.text('Distribuição por Categoria', leftX, yPos);
              
              doc.addImage(pieDataUrl, 'PNG', leftX, yPos + 3, chartWidth, chartHeight);
            } catch (e) {
              console.error('Erro ao adicionar gráfico de pizza:', e);
            }
          }

          if (barChart) {
            try {
              const barCanvas = barChart.canvas || barChart;
              const barDataUrl = barCanvas.toDataURL('image/png', 1.0);
              
              doc.setFontSize(11);
              doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
              doc.text('Resultado por Projeto', rightX, yPos);
              
              doc.addImage(barDataUrl, 'PNG', rightX, yPos + 3, chartWidth, chartHeight);
            } catch (e) {
              console.error('Erro ao adicionar gráfico de barras:', e);
            }
          }
        }
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        doc.setDrawColor(...ECOBRASIL_COLORS.green);
        doc.setLineWidth(0.5);
        doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('EcoBrasil - Consultoria Ambiental', 20, pageHeight - 8);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 20, pageHeight - 8, { align: 'right' });
      }

      const filename = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast({
        title: "Relatório gerado com sucesso",
        description: "O relatório financeiro foi baixado.",
      });
      
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro na geração",
        description: error?.message || "Ocorreu um erro ao gerar o relatório financeiro.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedLabel = selectedEmpreendimentoId === "all" 
    ? "Todos os Projetos" 
    : empreendimentos.find(e => e.id === parseInt(selectedEmpreendimentoId))?.nome || "Selecione";

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline"
          disabled={isExporting}
          data-testid="button-gerar-relatorio-financeiro"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Gerar Relatório PDF
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Configurar Relatório</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Selecione o projeto e o período do relatório
            </p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Projeto</Label>
            <Select 
              value={selectedEmpreendimentoId} 
              onValueChange={setSelectedEmpreendimentoId}
            >
              <SelectTrigger data-testid="select-empreendimento-pdf">
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Projetos (Consolidado)</SelectItem>
                {empreendimentos.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </Label>
            <Select 
              value={selectedPeriod} 
              onValueChange={(value) => setSelectedPeriod(value as PeriodType)}
            >
              <SelectTrigger data-testid="select-periodo-pdf">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPeriod === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  data-testid="input-data-inicio-pdf"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => { setCustomEndDate(e.target.value); }}
                  data-testid="input-data-fim-pdf"
                />
              </div>
            </div>
          )}

          <Button 
            className="w-full" 
            onClick={generatePDF}
            disabled={isExporting || (selectedPeriod === "custom" && (!customStartDate || !customEndDate))}
            data-testid="button-confirmar-gerar-pdf"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Gerar PDF - {selectedLabel}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
