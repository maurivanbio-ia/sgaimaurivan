import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Extend jsPDF to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ExportPDFProps {
  data: any[];
  type: 'empreendimentos' | 'licencas' | 'condicionantes';
  filename?: string;
}

export function ExportPDF({ data, type, filename }: ExportPDFProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const generatePDF = async (includeChart: boolean = false) => {
    setIsExporting(true);
    
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 89, 156); // EcoBrasil blue
      doc.text('LicençaFácil - Relatório', 20, 25);
      
      // Subtitle
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Relatório de ${type.charAt(0).toUpperCase() + type.slice(1)}`, 20, 35);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 42);
      
      // Line separator
      doc.setDrawColor(0, 89, 156);
      doc.line(20, 48, 190, 48);

      let columns: string[] = [];
      let rows: any[][] = [];

      // Configure table based on data type
      switch (type) {
        case 'empreendimentos':
          columns = ['Nome', 'Cliente', 'Localização', 'Criado em'];
          rows = data.map(item => [
            item.nome || '',
            item.cliente || '',
            item.localizacao || '',
            item.criadoEm ? new Date(item.criadoEm).toLocaleDateString('pt-BR') : ''
          ]);
          break;
          
        case 'licencas':
          columns = ['Tipo', 'Número', 'Órgão Emissor', 'Status', 'Validade'];
          rows = data.map(item => [
            item.tipo || '',
            item.numero || '',
            item.orgaoEmissor || '',
            item.status === 'ativo' ? 'Ativo' : 
            item.status === 'a_vencer' ? 'A Vencer' : 'Vencido',
            item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : ''
          ]);
          break;
          
        case 'condicionantes':
          columns = ['Descrição', 'Status', 'Prazo'];
          rows = data.map(item => [
            item.descricao ? (item.descricao.length > 50 ? 
              item.descricao.substring(0, 50) + '...' : item.descricao) : '',
            item.status === 'pendente' ? 'Pendente' : 'Vencida',
            item.prazo ? new Date(item.prazo).toLocaleDateString('pt-BR') : ''
          ]);
          break;
      }

      // Add table
      doc.autoTable({
        head: [columns],
        body: rows,
        startY: 55,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [0, 89, 156],
          textColor: 255,
          fontSize: 10,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: 20, right: 20 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.width - 40,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          'Gerado por LicençaFácil - EcoBrasil',
          20,
          doc.internal.pageSize.height - 10
        );
      }

      // Summary section
      if (data.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(0, 89, 156);
        doc.text('Resumo Estatístico', 20, 25);
        
        let summaryY = 40;
        
        if (type === 'licencas') {
          const stats = {
            total: data.length,
            ativas: data.filter(item => item.status === 'ativo').length,
            aVencer: data.filter(item => item.status === 'a_vencer').length,
            vencidas: data.filter(item => item.status === 'vencido').length,
          };
          
          doc.setFontSize(12);
          doc.setTextColor(60);
          doc.text(`Total de Licenças: ${stats.total}`, 20, summaryY);
          doc.text(`Ativas: ${stats.ativas}`, 20, summaryY + 8);
          doc.text(`A Vencer: ${stats.aVencer}`, 20, summaryY + 16);
          doc.text(`Vencidas: ${stats.vencidas}`, 20, summaryY + 24);
        } else if (type === 'condicionantes') {
          const stats = {
            total: data.length,
            pendentes: data.filter(item => item.status === 'pendente').length,
            vencidas: data.filter(item => item.status === 'vencida').length,
          };
          
          doc.setFontSize(12);
          doc.setTextColor(60);
          doc.text(`Total de Condicionantes: ${stats.total}`, 20, summaryY);
          doc.text(`Pendentes: ${stats.pendentes}`, 20, summaryY + 8);
          doc.text(`Vencidas: ${stats.vencidas}`, 20, summaryY + 16);
        } else {
          doc.setFontSize(12);
          doc.setTextColor(60);
          doc.text(`Total de Empreendimentos: ${data.length}`, 20, summaryY);
        }
      }

      // Save PDF
      const defaultFilename = `${type}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename || defaultFilename);
      
      toast({
        title: "PDF exportado com sucesso",
        description: `Relatório de ${type} foi baixado.`,
      });
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao gerar o relatório PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isExporting) {
    return (
      <Button disabled size="sm" data-testid="export-pdf-loading">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Gerando PDF...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="export-pdf-trigger">
          <FileDown className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => generatePDF(false)} data-testid="export-pdf-simple">
          <FileDown className="h-4 w-4 mr-2" />
          Relatório Simples
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => generatePDF(true)} data-testid="export-pdf-detailed">
          <FileDown className="h-4 w-4 mr-2" />
          Relatório Detalhado
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}