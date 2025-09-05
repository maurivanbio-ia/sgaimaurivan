import { useState, useEffect } from "react";
import { Search, Building2, FileText, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface SearchResult {
  id: number;
  type: 'empreendimento' | 'licenca' | 'condicionante';
  title: string;
  subtitle?: string;
  status?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  // Buscar empreendimentos
  const { data: empreendimentos } = useQuery({
    queryKey: ["/api/empreendimentos"],
    enabled: open,
  });

  // Buscar licenças
  const { data: licencas } = useQuery({
    queryKey: ["/api/licencas"],
    enabled: open,
  });

  // Buscar condicionantes
  const { data: condicionantes } = useQuery({
    queryKey: ["/api/condicionantes"],
    enabled: open,
  });

  const searchResults: SearchResult[] = [];

  // Filtrar resultados baseado na busca
  if (query.length >= 2) {
    // Empreendimentos
    if (empreendimentos && Array.isArray(empreendimentos)) {
      empreendimentos.forEach((emp: any) => {
        if ((emp.nome && emp.nome.toLowerCase().includes(query.toLowerCase())) ||
            (emp.cliente && emp.cliente.toLowerCase().includes(query.toLowerCase()))) {
          searchResults.push({
            id: emp.id,
            type: 'empreendimento',
            title: emp.nome,
            subtitle: `Cliente: ${emp.cliente}`,
          });
        }
      });
    }

    // Licenças
    if (licencas && Array.isArray(licencas)) {
      licencas.forEach((lic: any) => {
        if ((lic.numero && lic.numero.toLowerCase().includes(query.toLowerCase())) ||
            (lic.tipo && lic.tipo.toLowerCase().includes(query.toLowerCase())) ||
            (lic.orgaoEmissor && lic.orgaoEmissor.toLowerCase().includes(query.toLowerCase()))) {
          searchResults.push({
            id: lic.id,
            type: 'licenca',
            title: `${lic.tipo || 'Licença'} - ${lic.numero || 'N/A'}`,
            subtitle: `Órgão: ${lic.orgaoEmissor || 'N/A'}`,
            status: lic.status,
          });
        }
      });
    }

    // Condicionantes
    if (condicionantes && Array.isArray(condicionantes)) {
      condicionantes.forEach((cond: any) => {
        if (cond.descricao && cond.descricao.toLowerCase().includes(query.toLowerCase())) {
          searchResults.push({
            id: cond.id,
            type: 'condicionante',
            title: cond.descricao.substring(0, 60) + (cond.descricao.length > 60 ? '...' : ''),
            subtitle: `Prazo: ${new Date(cond.prazo).toLocaleDateString('pt-BR')}`,
            status: cond.status,
          });
        }
      });
    }
  }

  const handleResultClick = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    
    switch (result.type) {
      case 'empreendimento':
        setLocation(`/empreendimentos/${result.id}`);
        break;
      case 'licenca':
        // Navegar para a licença específica (implementar se houver página dedicada)
        setLocation('/licencas');
        break;
      case 'condicionante':
        // Navegar para condicionantes (implementar se houver página dedicada)
        setLocation('/condicionantes');
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'empreendimento':
        return <Building2 className="h-4 w-4 text-primary" />;
      case 'licenca':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'condicionante':
        return <CheckSquare className="h-4 w-4 text-green-600" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const statusMap: { [key: string]: string } = {
      'ativo': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'a_vencer': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'vencido': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      'pendente': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'vencida': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    const statusLabels: { [key: string]: string } = {
      'ativo': 'Ativo',
      'a_vencer': 'A Vencer',
      'vencido': 'Vencido',
      'pendente': 'Pendente',
      'vencida': 'Vencida',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusMap[status] || ''}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  // Atalho de teclado para abrir busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64" data-testid="global-search-trigger">
          <Search className="mr-2 h-4 w-4" />
          <span className="hidden lg:inline-flex">Buscar...</span>
          <span className="inline-flex lg:hidden">Buscar</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]" data-testid="global-search-dialog">
        <DialogHeader>
          <DialogTitle>Busca Global</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite para buscar empreendimentos, licenças e condicionantes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              data-testid="global-search-input"
              autoFocus
            />
          </div>
          
          {query.length >= 2 && (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Nenhum resultado encontrado para "{query}"
                </div>
              ) : (
                searchResults.map((result, index) => (
                  <div
                    key={`${result.type}-${result.id}-${index}`}
                    className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-accent"
                    onClick={() => handleResultClick(result)}
                    data-testid={`search-result-${result.type}-${result.id}`}
                  >
                    {getIcon(result.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                      )}
                    </div>
                    {result.status && (
                      <div className="flex-shrink-0">
                        {getStatusBadge(result.status)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          
          {query.length < 2 && (
            <div className="text-center py-6 text-muted-foreground">
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}