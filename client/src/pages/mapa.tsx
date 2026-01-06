import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { MapPin, Building, Filter, RefreshCw } from "lucide-react";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const createColoredIcon = (color: string) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

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

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useMemo(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapaEmpreendimentos() {
  const [, navigate] = useLocation();
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

  const defaultCenter: [number, number] = [-15.7942, -47.8822];
  
  const mapCenter = useMemo(() => {
    if (empreendimentosFiltrados.length > 0) {
      const lat = empreendimentosFiltrados.reduce((sum, emp) => sum + parseFloat(emp.latitude!), 0) / empreendimentosFiltrados.length;
      const lng = empreendimentosFiltrados.reduce((sum, emp) => sum + parseFloat(emp.longitude!), 0) / empreendimentosFiltrados.length;
      return [lat, lng] as [number, number];
    }
    return defaultCenter;
  }, [empreendimentosFiltrados]);

  const statusCounts = useMemo(() => {
    return empreendimentosComCoordenadas.reduce((acc, emp) => {
      acc[emp.status] = (acc[emp.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [empreendimentosComCoordenadas]);

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
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
          <div className="rounded-lg overflow-hidden border" style={{ height: "500px" }}>
            <MapContainer
              center={mapCenter}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} />
              {empreendimentosFiltrados.map(emp => (
                <Marker
                  key={emp.id}
                  position={[parseFloat(emp.latitude!), parseFloat(emp.longitude!)]}
                  icon={createColoredIcon(statusColors[emp.status] || statusColors.ativo)}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-bold text-lg mb-2">{emp.nome}</h3>
                      <div className="space-y-1 text-sm">
                        <p><strong>Cliente:</strong> {emp.cliente}</p>
                        <p><strong>Local:</strong> {emp.municipio}, {emp.uf}</p>
                        <p><strong>Responsável:</strong> {emp.responsavelInterno}</p>
                        <div className="mt-2">
                          <Badge 
                            style={{ backgroundColor: statusColors[emp.status] }}
                            className="text-white"
                          >
                            {statusLabels[emp.status] || emp.status}
                          </Badge>
                        </div>
                        <Button 
                          size="sm" 
                          className="mt-3 w-full"
                          onClick={() => navigate(`/empreendimentos/${emp.id}`)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
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
