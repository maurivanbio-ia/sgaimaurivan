import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Link } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, MapPin, Building2, Calendar, User } from "lucide-react";
import type { Empreendimento } from "@shared/schema";

// Configurar ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

// Função para criar ícone personalizado baseado no tipo
const createIconByType = (tipo: string) => {
  const config = tipoConfig[tipo] || tipoConfig.outro;
  
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${config.color};
        border: 3px solid white;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        font-size: 18px;
        cursor: pointer;
        transition: transform 0.2s;
      " onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
        ${config.icon}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Função para obter cor do status
const getStatusColor = (status: string) => {
  switch (status) {
    case 'ativo':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'em_planejamento':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'em_execucao':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'concluido':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'inativo':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Função para formatar o status
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

// Componente para ajustar o centro do mapa automaticamente
function MapController({ empreendimentos }: { empreendimentos: Empreendimento[] }) {
  const map = useMap();

  useEffect(() => {
    if (empreendimentos.length > 0) {
      const validCoordinates = empreendimentos.filter(
        emp => emp.latitude && emp.longitude
      );

      if (validCoordinates.length === 1) {
        // Se só tem um empreendimento, centraliza nele
        const emp = validCoordinates[0];
        map.setView([parseFloat(emp.latitude!), parseFloat(emp.longitude!)], 13);
      } else if (validCoordinates.length > 1) {
        // Se tem múltiplos, ajusta para mostrar todos
        const bounds = L.latLngBounds(
          validCoordinates.map(emp => [parseFloat(emp.latitude!), parseFloat(emp.longitude!)])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [empreendimentos, map]);

  return null;
}

export default function MapComponent({ empreendimentos, className }: MapComponentProps) {
  // Filtrar apenas empreendimentos com coordenadas válidas
  const empreendimentosComCoordenadas = empreendimentos.filter(
    emp => emp.latitude && emp.longitude && 
           !isNaN(parseFloat(emp.latitude)) && 
           !isNaN(parseFloat(emp.longitude))
  );

  // Centro padrão do Brasil (Brasília)
  const defaultCenter: [number, number] = [-15.7942, -47.8822];
  const defaultZoom = 4;

  return (
    <div className={`relative h-96 w-full rounded-lg overflow-hidden shadow-sm ${className || ''}`}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
        data-testid="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController empreendimentos={empreendimentosComCoordenadas} />

        {empreendimentosComCoordenadas.map((empreendimento) => {
          const tipoInfo = tipoConfig[empreendimento.tipo] || tipoConfig.outro;
          
          return (
            <Marker
              key={empreendimento.id}
              position={[parseFloat(empreendimento.latitude!), parseFloat(empreendimento.longitude!)]}
              icon={createIconByType(empreendimento.tipo)}
            >
              <Popup minWidth={300} maxWidth={400}>
                <div className="p-3" data-testid={`popup-empreendimento-${empreendimento.id}`}>
                  {/* Header com tipo e status */}
                  <div className="flex items-center justify-between mb-3">
                    <Badge 
                      variant="outline" 
                      className="text-xs font-medium"
                      style={{ 
                        backgroundColor: `${tipoInfo.color}15`, 
                        color: tipoInfo.color,
                        borderColor: tipoInfo.color
                      }}
                    >
                      {tipoInfo.icon} {tipoInfo.label}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-medium border ${getStatusColor(empreendimento.status)}`}
                    >
                      {formatStatus(empreendimento.status)}
                    </Badge>
                  </div>

                  {/* Título */}
                  <h3 className="font-bold text-lg text-card-foreground mb-3 leading-tight">
                    {empreendimento.nome}
                  </h3>

                  {/* Informações principais */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-muted-foreground">Cliente:</span>
                        <p className="text-card-foreground">{empreendimento.cliente}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-muted-foreground">Localização:</span>
                        <p className="text-card-foreground">{empreendimento.localizacao}</p>
                      </div>
                    </div>

                    {empreendimento.municipio && empreendimento.uf && (
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-muted-foreground">Município/UF:</span>
                          <p className="text-card-foreground">{empreendimento.municipio}/{empreendimento.uf}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <span className="font-medium text-muted-foreground">Gestor:</span>
                        <p className="text-card-foreground">{empreendimento.responsavelInterno}</p>
                      </div>
                    </div>

                    {empreendimento.dataInicio && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium text-muted-foreground">Início:</span>
                          <p className="text-card-foreground">
                            {new Date(empreendimento.dataInicio).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coordenadas */}
                  <div className="text-xs text-muted-foreground mb-3 pt-2 border-t">
                    <span className="font-medium">Coordenadas:</span> 
                    {' '}{parseFloat(empreendimento.latitude!).toFixed(6)}, {parseFloat(empreendimento.longitude!).toFixed(6)}
                  </div>

                  {/* Botão de ação */}
                  <Link href={`/empreendimentos/${empreendimento.id}`}>
                    <Button 
                      className="w-full" 
                      size="sm"
                      data-testid={`button-popup-view-details-${empreendimento.id}`}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalhes Completos
                    </Button>
                  </Link>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Mensagem quando não há empreendimentos */}
      {empreendimentosComCoordenadas.length === 0 && (
        <div className="absolute top-4 left-4 bg-white p-3 rounded shadow-md border z-[1000]">
          <p className="text-sm text-gray-600">
            Nenhum empreendimento com coordenadas encontrado.
          </p>
        </div>
      )}

      {/* Legenda de tipos */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded shadow-md border z-[1000] max-w-xs">
        <h4 className="text-xs font-semibold mb-2 text-card-foreground">Legenda</h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(tipoConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <span style={{ fontSize: '14px' }}>{config.icon}</span>
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
