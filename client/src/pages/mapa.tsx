import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { MapPin, Building, Filter, RefreshCw } from "lucide-react";
import "leaflet/dist/leaflet.css";

const statusColors: Record<string, string> = {
  ativo: "#22c55e",
  em_planejamento: "#f59e0b",
  em_execucao: "#3b82f6",
  concluido: "#6b7280",
  inativo: "#ef4444",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  em_planejamento: "Em Planejamento",
  em_execucao: "Em Execução",
  concluido: "Concluído",
  inativo: "Inativo",
};

const tipoConfig: Record<string, { color: string; icon: string; label: string }> = {
  hidreletrica: { color: '#3b82f6', icon: '💧', label: 'Hidrelétrica' },
  parque_eolico: { color: '#10b981', icon: '🌪️', label: 'Parque Eólico' },
  usina_solar: { color: '#fbbf24', icon: '☀️', label: 'Usina Solar' },
  termoeletrica: { color: '#ef4444', icon: '🔥', label: 'Termelétrica' },
  linha_transmissao: { color: '#f59e0b', icon: '⚡', label: 'Linha de Transmissão' },
  mina: { color: '#8b5cf6', icon: '⛏️', label: 'Mineração' },
  pchs: { color: '#06b6d4', icon: '🏭', label: 'PCH' },
  outro: { color: '#6b7280', icon: '📍', label: 'Outro' },
};

interface Empreendimento {
  id: number;
  nome: string;
  cliente: string;
  localizacao: string;
  latitude: string | null;
  longitude: string | null;
  status: string;
  tipo: string;
  municipio: string | null;
  uf: string | null;
  responsavelInterno: string;
}

export default function MapaEmpreendimentos() {
  const [, navigate] = useLocation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");

  const { data: empreendimentos = [], isLoading, refetch } = useQuery<Empreendimento[]>({
    queryKey: ['/api/empreendimentos'],
  });

  const empreendimentosComCoordenadas = useMemo(() => {
    return empreendimentos.filter(emp => 
      emp.latitude && emp.longitude && 
      parseFloat(emp.latitude) !== 0 && parseFloat(emp.longitude) !== 0
    );
  }, [empreendimentos]);

  const empreendimentosFiltrados = useMemo(() => {
    return empreendimentosComCoordenadas.filter(emp => {
      if (statusFilter !== "todos" && emp.status !== statusFilter) return false;
      if (tipoFilter !== "todos" && emp.tipo !== tipoFilter) return false;
      return true;
    });
  }, [empreendimentosComCoordenadas, statusFilter, tipoFilter]);

  const tipos = useMemo(() => {
    const uniqueTipos = new Set(empreendimentos.map(emp => emp.tipo));
    return Array.from(uniqueTipos);
  }, [empreendimentos]);

  const statusCounts = useMemo(() => {
    return empreendimentosComCoordenadas.reduce((acc, emp) => {
      acc[emp.status] = (acc[emp.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [empreendimentosComCoordenadas]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [-15.7942, -47.8822];
    
    mapInstanceRef.current = L.map(mapRef.current).setView(defaultCenter, 5);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    empreendimentosFiltrados.forEach(emp => {
      const statusColor = statusColors[emp.status] || statusColors.ativo;
      const tipoInfo = tipoConfig[emp.tipo] || tipoConfig.outro;
      
      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background-color: ${tipoInfo.color};
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid ${statusColor};
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        ">${tipoInfo.icon}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const marker = L.marker(
        [parseFloat(emp.latitude!), parseFloat(emp.longitude!)],
        { icon }
      ).addTo(mapInstanceRef.current!);

      const popupContent = `
        <div style="min-width: 200px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${tipoInfo.icon} ${emp.nome}</h3>
          <div style="font-size: 14px;">
            <p><strong>Tipo:</strong> ${tipoInfo.label}</p>
            <p><strong>Cliente:</strong> ${emp.cliente}</p>
            <p><strong>Local:</strong> ${emp.municipio && emp.uf ? `${emp.municipio}, ${emp.uf}` : emp.localizacao || ''}</p>
            <p><strong>Responsável:</strong> ${emp.responsavelInterno}</p>
            <div style="margin-top: 8px;">
              <span style="
                background-color: ${statusColor};
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
              ">${statusLabels[emp.status] || emp.status}</span>
            </div>
            <button 
              onclick="window.location.href='/empreendimentos/${emp.id}'"
              style="
                margin-top: 12px;
                width: 100%;
                padding: 8px;
                background-color: #16a34a;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              "
            >Ver Detalhes</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    if (empreendimentosFiltrados.length > 0) {
      const bounds = L.latLngBounds(
        empreendimentosFiltrados.map(emp => [
          parseFloat(emp.latitude!),
          parseFloat(emp.longitude!)
        ] as [number, number])
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [empreendimentosFiltrados]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2" data-testid="text-page-title">
            <MapPin className="h-8 w-8 text-green-600" />
            Mapa de Empreendimentos
          </h1>
          <p className="text-muted-foreground">
            Visualize a localização de todos os empreendimentos
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(statusLabels).map(([status, label]) => (
          <Card 
            key={status} 
            className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(statusFilter === status ? "todos" : status)}
            data-testid={`filter-${status}`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: statusColors[status] }}
              />
              <div>
                <p className="text-2xl font-bold">{statusCounts[status] || 0}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {tipos.map(tipo => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            ref={mapRef}
            className="rounded-lg overflow-hidden border" 
            style={{ height: "500px" }}
            data-testid="map-container"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Mostrando {empreendimentosFiltrados.length} de {empreendimentosComCoordenadas.length} empreendimentos com coordenadas
          </p>
        </CardContent>
      </Card>

      {empreendimentos.length > 0 && empreendimentosComCoordenadas.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              Nenhum empreendimento possui coordenadas cadastradas. Edite os empreendimentos para adicionar latitude e longitude.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
