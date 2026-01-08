import { useState, useRef } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import logoPath from "@assets/image_1767874122366.png";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
  porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
}

interface FinancialReportPDFProps {
  stats: FinancialStats | undefined;
  lineChartRef?: React.RefObject<HTMLCanvasElement>;
  pieChartRef?: React.RefObject<HTMLCanvasElement>;
  barChartRef?: React.RefObject<HTMLCanvasElement>;
}

const ECOBRASIL_COLORS = {
  green: [34, 139, 34],
  yellow: [218, 165, 32],
  blue: [0, 102, 153],
  darkGreen: [0, 100, 0],
  lightGreen: [144, 238, 144],
};

export function FinancialReportPDF({ stats, lineChartRef, pieChartRef, barChartRef }: FinancialReportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
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

  const generatePDF = async () => {
    if (!stats) {
      toast({
        title: "Dados não disponíveis",
        description: "Aguarde os dados financeiros carregarem.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      try {
        const logoImg = await loadImage(logoPath);
        const logoWidth = 60;
        const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
      } catch (error) {
        console.error('Error loading logo:', error);
        doc.setFontSize(24);
        doc.setTextColor(...ECOBRASIL_COLORS.green);
        doc.text('EcoBrasil', pageWidth / 2, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('consultoria ambiental', pageWidth / 2, 28, { align: 'center' });
      }

      doc.setFontSize(22);
      doc.setTextColor(...ECOBRASIL_COLORS.darkGreen);
      doc.text('Relatório Financeiro', pageWidth / 2, 45, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, pageWidth / 2, 53, { align: 'center' });

      doc.setDrawColor(...ECOBRASIL_COLORS.green);
      doc.setLineWidth(1);
      doc.line(20, 58, pageWidth - 20, 58);

      let yPos = 70;

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
      doc.text(formatCurrency(stats.totalReceitas), 25, yPos + 18);

      doc.setFillColor(255, 240, 240);
      doc.roundedRect(25 + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Total Despesas', 30 + cardWidth + margin, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(200, 50, 50);
      doc.text(formatCurrency(stats.totalDespesas), 30 + cardWidth + margin, yPos + 18);

      yPos += cardHeight + margin;

      const balanceColor = stats.saldoAtual >= 0 ? [34, 139, 34] : [200, 50, 50];
      doc.setFillColor(240, 248, 255);
      doc.roundedRect(20, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Saldo Atual', 25, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(...balanceColor as [number, number, number]);
      doc.text(formatCurrency(stats.saldoAtual), 25, yPos + 18);

      doc.setFillColor(255, 250, 240);
      doc.roundedRect(25 + cardWidth + margin, yPos, cardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Pendente', 30 + cardWidth + margin, yPos + 8);
      doc.setFontSize(14);
      doc.setTextColor(218, 165, 32);
      doc.text(formatCurrency(stats.totalPendente), 30 + cardWidth + margin, yPos + 18);

      yPos += cardHeight + 20;

      if (stats.evolucaoMensal && stats.evolucaoMensal.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Evolução Mensal', 20, yPos);
        yPos += 5;

        doc.autoTable({
          startY: yPos,
          head: [['Mês', 'Receitas', 'Despesas', 'Lucro/Prejuízo']],
          body: stats.evolucaoMensal.map(m => [
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
              const value = stats.evolucaoMensal[data.row.index]?.lucro || 0;
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

      if (stats.porCategoria && stats.porCategoria.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Distribuição por Categoria', 20, yPos);
        yPos += 5;

        doc.autoTable({
          startY: yPos,
          head: [['Categoria', 'Tipo', 'Valor']],
          body: stats.porCategoria.map(c => [
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
              const tipo = stats.porCategoria[data.row.index]?.tipo;
              data.cell.styles.textColor = tipo === 'receita' ? [34, 139, 34] : [200, 50, 50];
            }
            if (data.section === 'body' && data.column.index === 2) {
              const tipo = stats.porCategoria[data.row.index]?.tipo;
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

      if (stats.porEmpreendimento && stats.porEmpreendimento.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...ECOBRASIL_COLORS.blue);
        doc.text('Resultado por Projeto', 20, yPos);
        yPos += 5;

        doc.autoTable({
          startY: yPos,
          head: [['Projeto', 'Receitas', 'Despesas', 'Resultado']],
          body: stats.porEmpreendimento.map(e => [
            e.empreendimento.length > 25 ? e.empreendimento.substring(0, 25) + '...' : e.empreendimento,
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
            1: { textColor: [34, 139, 34], halign: 'right' },
            2: { textColor: [200, 50, 50], halign: 'right' },
            3: { halign: 'right' }
          },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const value = stats.porEmpreendimento[data.row.index]?.lucro || 0;
              data.cell.styles.textColor = value >= 0 ? [34, 139, 34] : [200, 50, 50];
            }
          },
          margin: { left: 20, right: 20 },
        });
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
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro na geração",
        description: "Ocorreu um erro ao gerar o relatório financeiro.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      onClick={generatePDF} 
      disabled={isExporting || !stats}
      variant="outline"
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
        </>
      )}
    </Button>
  );
}
