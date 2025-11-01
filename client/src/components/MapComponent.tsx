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
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>

      {/* Legenda de tipos */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded shadow-md border z-[1000] max-w-xs">
        <h4 className="text-xs font-semibold mb-2 text-card-foreground">Mapa de Empreendimentos</h4>
        <p className="text-xs text-muted-foreground">Carregando marcadores...</p>
      </div>
    </div>
  );
}
