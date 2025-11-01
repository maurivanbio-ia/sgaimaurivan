import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, MapPin, Building2, Calendar, User, Navigation } from "lucide-react";
import type { Empreendimento } from "@shared/schema";

// Mapeamento de cores e ícones por tipo de empreendimento
const tipoConfig: Record<string, { color: string; icon: string; label: string }> = {
  hidreletrica: { 
    color: '#3b82f6', 
    icon: '💧', 
    label: 'Hidrelétrica' 
  },
  parque_eolico: { 
    color: '#10b981', 
    icon: '🌪️', 
    label: 'Parque Eólico' 
  },
  termoeletrica: { 
    color: '#ef4444', 
    icon: '🔥', 
    label: 'Termelétrica' 
  },
  linha_transmissao: { 
    color: '#f59e0b', 
    icon: '⚡', 
    label: 'Linha de Transmissão' 
  },
  mina: { 
    color: '#8b5cf6', 
    icon: '⛏️', 
    label: 'Mineração' 
  },
  pchs: { 
    color: '#06b6d4', 
    icon: '🏭', 
    label: 'PCH' 
  },
  outro: { 
    color: '#6b7280', 
    icon: '📍', 
    label: 'Outro' 
  },
};

// Mapeamento de cores de status
const getStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    ativo: 'bg-green-100 text-green-800 border-green-300',
    em_planejamento: 'bg-blue-100 text-blue-800 border-blue-300',
    em_execucao: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    concluido: 'bg-gray-100 text-gray-800 border-gray-300',
    inativo: 'bg-red-100 text-red-800 border-red-300',
  };
  return statusColors[status] || statusColors.ativo;
};

// Formatar status para exibição
const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    ativo: 'Ativo',
    em_planejamento: 'Em Planejamento',
    em_execucao: 'Em Execução',
    concluido: 'Concluído',
    inativo: 'Inativo',
  };
  return statusMap[status] || status;
};

interface MapComponentProps {
  empreendimentos: Empreendimento[];
  className?: string;
}

export default function MapComponent({ empreendimentos, className }: MapComponentProps) {
  // Filtrar apenas empreendimentos com coordenadas válidas
  const empreendimentosComCoordenadas = empreendimentos.filter(
    emp => emp.latitude && emp.longitude && 
           !isNaN(parseFloat(emp.latitude)) && 
           !isNaN(parseFloat(emp.longitude))
  );

  return (
    <div className={`h-96 w-full rounded-lg overflow-hidden ${className || ''}`} data-testid="map-container">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            <h3 className="font-semibold text-lg">Localizações dos Empreendimentos</h3>
          </div>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            {empreendimentosComCoordenadas.length} localização{empreendimentosComCoordenadas.length !== 1 ? 'ões' : ''}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="h-[calc(100%-4rem)] overflow-y-auto bg-gray-50">
        {empreendimentosComCoordenadas.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">Nenhum empreendimento com coordenadas encontrado</p>
              <p className="text-sm text-gray-500 mt-1">Adicione coordenadas aos empreendimentos para visualizá-los</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4">
            {empreendimentosComCoordenadas.map((empreendimento) => {
              const tipoInfo = tipoConfig[empreendimento.tipo] || tipoConfig.outro;
              
              return (
                <Card 
                  key={empreendimento.id} 
                  className="hover:shadow-md transition-shadow border-l-4"
                  style={{ borderLeftColor: tipoInfo.color }}
                  data-testid={`map-card-empreendimento-${empreendimento.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Icon e tipo */}
                      <div className="flex items-start gap-3 flex-1">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: `${tipoInfo.color}15` }}
                        >
                          {tipoInfo.icon}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {/* Nome e Status */}
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-base truncate">{empreendimento.nome}</h4>
                            <Badge 
                              variant="outline" 
                              className={`text-xs flex-shrink-0 ${getStatusColor(empreendimento.status)}`}
                            >
                              {formatStatus(empreendimento.status)}
                            </Badge>
                          </div>

                          {/* Informações */}
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <User className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{empreendimento.cliente}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="truncate">{empreendimento.localizacao}</span>
                            </div>

                            {empreendimento.municipio && empreendimento.uf && (
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate">{empreendimento.municipio}/{empreendimento.uf}</span>
                              </div>
                            )}

                            {/* Coordenadas */}
                            <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-2 pt-2 border-t">
                              <Navigation className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate font-mono">
                                {parseFloat(empreendimento.latitude!).toFixed(6)}, {parseFloat(empreendimento.longitude!).toFixed(6)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Botão Ver Detalhes */}
                      <Link href={`/empreendimentos/${empreendimento.id}`}>
                        <Button 
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0"
                          data-testid={`button-map-view-details-${empreendimento.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda */}
      {empreendimentosComCoordenadas.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border max-w-xs">
          <h4 className="text-xs font-semibold mb-2">Tipos de Empreendimento</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(tipoConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span style={{ fontSize: '14px' }}>{config.icon}</span>
                <span className="text-gray-600">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
