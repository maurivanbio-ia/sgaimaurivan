import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  entity: 'empreendimentos' | 'licencas' | 'condicionantes' | 'entregas' | 'relatorio-completo';
  entityId?: number; // Para filtrar por empreendimento ou licença específica
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export function ExportButton({ 
  entity, 
  entityId, 
  className,
  variant = "outline" 
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: 'csv' | 'excel') => {
    setIsExporting(true);
    
    try {
      let url = `/api/export/${entity}?format=${format}`;
      
      // Adiciona ID específico se fornecido
      if (entityId) {
        if (entity === 'licencas') {
          url += `&empreendimentoId=${entityId}`;
        } else if (entity === 'condicionantes' || entity === 'entregas') {
          url += `&licencaId=${entityId}`;
        }
      }

      // Cria um link temporário para download
      const link = document.createElement('a');
      link.href = url;
      link.download = ''; // O nome do arquivo será definido pelo servidor
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Exportação realizada",
        description: `Arquivo ${format.toUpperCase()} baixado com sucesso!`,
      });
    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: "Erro na exportação",
        description: "Erro ao exportar dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getEntityLabel = () => {
    switch (entity) {
      case 'empreendimentos': return 'Empreendimentos';
      case 'licencas': return entityId ? 'Licenças do Empreendimento' : 'Licenças';
      case 'condicionantes': return entityId ? 'Condicionantes da Licença' : 'Condicionantes';
      case 'entregas': return entityId ? 'Entregas da Licença' : 'Entregas';
      case 'relatorio-completo': return 'Relatório Completo';
      default: return 'Dados';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          disabled={isExporting}
          className={className}
          data-testid={`export-button-${entity}${entityId ? `-${entityId}` : ''}`}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? "Exportando..." : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          {getEntityLabel()}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleExport('excel')}
          disabled={isExporting}
          data-testid={`export-excel-${entity}`}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
          Exportar como Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          data-testid={`export-csv-${entity}`}
        >
          <FileText className="mr-2 h-4 w-4 text-blue-600" />
          Exportar como CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}