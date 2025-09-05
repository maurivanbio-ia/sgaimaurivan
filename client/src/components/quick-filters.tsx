import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface QuickFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  availableClients?: string[];
}

export interface FilterState {
  cliente?: string;
  status?: string;
  vencimento?: string;
}

export function QuickFilters({ onFiltersChange, availableClients = [] }: QuickFiltersProps) {
  const [activeFilters, setActiveFilters] = useState<FilterState>({});

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...activeFilters };
    
    if (newFilters[key] === value) {
      // Remove filter if same value clicked
      delete newFilters[key];
    } else {
      // Set new filter value
      newFilters[key] = value;
    }
    
    setActiveFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(activeFilters).length;

  const statusOptions = [
    { value: "ativo", label: "Ativo", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    { value: "a_vencer", label: "A Vencer", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    { value: "vencido", label: "Vencido", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
    { value: "pendente", label: "Pendente", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  ];

  const vencimentoOptions = [
    { value: "proximos_30", label: "Próximos 30 dias" },
    { value: "proximos_60", label: "Próximos 60 dias" },
    { value: "proximos_90", label: "Próximos 90 dias" },
    { value: "vencidos", label: "Já vencidos" },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="relative" data-testid="quick-filters-trigger">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {/* Status Filter */}
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          {statusOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleFilterChange('status', option.value)}
              className={activeFilters.status === option.value ? "bg-accent" : ""}
              data-testid={`filter-status-${option.value}`}
            >
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${option.color}`}>
                {option.label}
              </span>
              {activeFilters.status === option.value && "✓"}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          {/* Vencimento Filter */}
          <DropdownMenuLabel>Vencimento</DropdownMenuLabel>
          {vencimentoOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleFilterChange('vencimento', option.value)}
              className={activeFilters.vencimento === option.value ? "bg-accent" : ""}
              data-testid={`filter-vencimento-${option.value}`}
            >
              {option.label}
              {activeFilters.vencimento === option.value && " ✓"}
            </DropdownMenuItem>
          ))}
          
          {availableClients.length > 0 && (
            <>
              <DropdownMenuSeparator />
              
              {/* Cliente Filter */}
              <DropdownMenuLabel>Cliente</DropdownMenuLabel>
              {availableClients.slice(0, 10).map((client) => (
                <DropdownMenuItem
                  key={client}
                  onClick={() => handleFilterChange('cliente', client)}
                  className={activeFilters.cliente === client ? "bg-accent" : ""}
                  data-testid={`filter-cliente-${client.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {client}
                  {activeFilters.cliente === client && " ✓"}
                </DropdownMenuItem>
              ))}
            </>
          )}
          
          {activeFilterCount > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={clearAllFilters} className="text-destructive" data-testid="clear-all-filters">
                <X className="h-4 w-4 mr-2" />
                Limpar todos
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex gap-1 flex-wrap">
          {activeFilters.status && (
            <Badge variant="secondary" className="text-xs" data-testid="active-filter-status">
              Status: {statusOptions.find(s => s.value === activeFilters.status)?.label}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleFilterChange('status', activeFilters.status!)}
              />
            </Badge>
          )}
          {activeFilters.vencimento && (
            <Badge variant="secondary" className="text-xs" data-testid="active-filter-vencimento">
              {vencimentoOptions.find(v => v.value === activeFilters.vencimento)?.label}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleFilterChange('vencimento', activeFilters.vencimento!)}
              />
            </Badge>
          )}
          {activeFilters.cliente && (
            <Badge variant="secondary" className="text-xs" data-testid="active-filter-cliente">
              Cliente: {activeFilters.cliente}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => handleFilterChange('cliente', activeFilters.cliente!)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}