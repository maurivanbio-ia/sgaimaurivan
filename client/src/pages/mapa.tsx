import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Building, Filter, RefreshCw, Layers, Upload, Eye, EyeOff, Trash2, Info } from "lucide-react";
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
  hidrelétrica: { color: '#3b82f6', icon: '💧', label: 'Hidrelétrica' },
  parque_eolico: { color: '#10b981', icon: '🌬️', label: 'Parque Eólico' },
  parque_eólico: { color: '#10b981', icon: '🌬️', label: 'Parque Eólico' },
  eolico: { color: '#10b981', icon: '🌬️', label: 'Parque Eólico' },
  eólico: { color: '#10b981', icon: '🌬️', label: 'Parque Eólico' },
  usina_solar: { color: '#fbbf24', icon: '☀️', label: 'Usina Solar' },
  solar: { color: '#fbbf24', icon: '☀️', label: 'Usina Solar' },
  fotovoltaico: { color: '#fbbf24', icon: '☀️', label: 'Fotovoltaico' },
  termoeletrica: { color: '#ef4444', icon: '🔥', label: 'Termelétrica' },
  termoelétrica: { color: '#ef4444', icon: '🔥', label: 'Termelétrica' },
  linha_transmissao: { color: '#f59e0b', icon: '⚡', label: 'Linha de Transmissão' },
  linha_transmissão: { color: '#f59e0b', icon: '⚡', label: 'Linha de Transmissão' },
  transmissao: { color: '#f59e0b', icon: '⚡', label: 'Linha de Transmissão' },
  transmissão: { color: '#f59e0b', icon: '⚡', label: 'Linha de Transmissão' },
  mina: { color: '#8b5cf6', icon: '⛏️', label: 'Mineração' },
  mineracao: { color: '#8b5cf6', icon: '⛏️', label: 'Mineração' },
  mineração: { color: '#8b5cf6', icon: '⛏️', label: 'Mineração' },
  pchs: { color: '#06b6d4', icon: '🏭', label: 'PCH' },
  pch: { color: '#06b6d4', icon: '🏭', label: 'PCH' },
  agropecuario: { color: '#84cc16', icon: '🌾', label: 'Agropecuário' },
  agropecuário: { color: '#84cc16', icon: '🌾', label: 'Agropecuário' },
  industria: { color: '#f97316', icon: '🏭', label: 'Indústria' },
  indústria: { color: '#f97316', icon: '🏭', label: 'Indústria' },
  outro: { color: '#6b7280', icon: '📍', label: 'Outro' },
};

function getTipoInfo(tipo: string) {
  if (!tipo) return tipoConfig.outro;
  const lower = tipo.toLowerCase().trim().replace(/\s+/g, '_');
  return tipoConfig[tipo] || tipoConfig[lower] ||
    Object.entries(tipoConfig).find(([k]) => lower.includes(k) || k.includes(lower))?.[1] ||
    tipoConfig.outro;
}

const categoriaConfig: Record<string, { color: string; label: string; icon: string }> = {
  uc: { color: '#22c55e', label: 'Unidades de Conservação', icon: '🌲' },
  terras_indigenas: { color: '#f59e0b', label: 'Terras Indígenas', icon: '🏠' },
  uso_solo: { color: '#8b5cf6', label: 'Uso do Solo', icon: '🗺️' },
  hidrografia: { color: '#3b82f6', label: 'Hidrografia', icon: '💧' },
  municipios: { color: '#6b7280', label: 'Municípios', icon: '🏙️' },
  vegetacao: { color: '#10b981', label: 'Vegetação', icon: '🌿' },
  outro: { color: '#ef4444', label: 'Outros', icon: '📍' },
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
  logoUrl: string | null;
}

interface CamadaGeoespacial {
  id: number;
  nome: string;
  descricao: string | null;
  categoria: string;
  cor: string | null;
  opacidade: number | null;
  geojsonUrl: string | null;
  geojsonData: any;
  fonte: string | null;
  ano: number | null;
  ativo: boolean | null;
  visivel: boolean | null;
  ordem: number | null;
}

export default function MapaEmpreendimentos() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const layersRef = useRef<Map<number, L.GeoJSON>>(new Map());
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [visibleLayers, setVisibleLayers] = useState<Set<number>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const { data: empreendimentos = [], isLoading, refetch } = useQuery<Empreendimento[]>({
    queryKey: ['/api/empreendimentos'],
  });

  const { data: camadas = [], isLoading: loadingCamadas, refetch: refetchCamadas } = useQuery<CamadaGeoespacial[]>({
    queryKey: ['/api/camadas-geoespaciais'],
  });

  const empreendimentosComCoordenadas = useMemo(() => {
    return empreendimentos.filter(emp => 
      emp.latitude && emp.longitude && 
      parseFloat(emp.latitude) !== 0 && parseFloat(emp.longitude) !== 0
    );
  }, [empreendimentos]);

  const empreendimentosFiltrados = useMemo(() => {
    return empreendimentosComCoordenadas.filter(emp => {
      if (statusFilter !== "todos" && (emp.status?.toLowerCase() || '') !== statusFilter) return false;
      if (tipoFilter !== "todos" && (emp.tipo?.toLowerCase() || '') !== tipoFilter) return false;
      return true;
    });
  }, [empreendimentosComCoordenadas, statusFilter, tipoFilter]);

  const tipos = useMemo(() => {
    const uniqueTipos = new Set(empreendimentos.map(emp => emp.tipo.toLowerCase() || 'outro'));
    return Array.from(uniqueTipos);
  }, [empreendimentos]);

  const statusCounts = useMemo(() => {
    return empreendimentos.reduce((acc, emp) => {
      const s = emp.status?.toLowerCase() || 'ativo';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [empreendimentos]);

  const camadasPorCategoria = useMemo(() => {
    const grouped: Record<string, CamadaGeoespacial[]> = {};
    camadas.forEach(camada => {
      if (!grouped[camada.categoria]) {
        grouped[camada.categoria] = [];
      }
      grouped[camada.categoria].push(camada);
    });
    return grouped;
  }, [camadas]);

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
      const statusColor = statusColors[emp.status?.toLowerCase() || 'ativo'] || statusColors.ativo;
      const tipoInfo = getTipoInfo(emp.tipo);
      
      const markerSize = emp.logoUrl ? 44 : 36;
      const iconInner = emp.logoUrl
        ? `<img src="${emp.logoUrl}" alt="logo" style="
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 50%;
            display: block;
          " />`
        : `<span style="font-size: 18px; line-height: 1;">${tipoInfo.icon}</span>`;

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background-color: ${emp.logoUrl ? '#ffffff' : tipoInfo.color};
          width: ${markerSize}px;
          height: ${markerSize}px;
          border-radius: 50%;
          border: 3px solid ${statusColor};
          box-shadow: 0 2px 10px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">${iconInner}</div>`,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
        popupAnchor: [0, -(markerSize / 2)],
      });

      const marker = L.marker(
        [parseFloat(emp.latitude!), parseFloat(emp.longitude!)],
        { icon }
      ).addTo(mapInstanceRef.current!);

      const logoHeader = emp.logoUrl
        ? `<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
             <img src="${emp.logoUrl}" alt="logo" style="width:40px; height:40px; object-fit:contain; border-radius:50%; border:2px solid #e5e7eb; background:#f9fafb; flex-shrink:0;" />
             <h3 style="font-weight:bold; font-size:15px; margin:0;">${emp.nome}</h3>
           </div>`
        : `<h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${tipoInfo.icon} ${emp.nome}</h3>`;

      const popupContent = `
        <div style="min-width: 210px;">
          ${logoHeader}
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

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    camadas.forEach(camada => {
      const existingLayer = layersRef.current.get(camada.id);
      const shouldBeVisible = visibleLayers.has(camada.id);

      if (shouldBeVisible && !existingLayer && camada.geojsonData) {
        const geojsonLayer = L.geoJSON(camada.geojsonData, {
          style: (feature) => ({
            color: camada.cor || '#3b82f6',
            weight: 2,
            opacity: 0.8,
            fillOpacity: camada.opacidade || 0.3,
            fillColor: camada.cor || '#3b82f6',
          }),
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            // Prefer NOM_UC for conservation units, fallback to others
            const ucName = props.NOM_UC || props.name || props.Name || props.NOME || camada.nome;
            let tooltipContent = `<strong>${ucName}</strong>`;
            
            if (props.MUN || props.municipio) {
              tooltipContent += `<br/>Município: ${props.MUN || props.municipio}`;
            }
            if (props.SIGLA_UF || props.uf) {
              tooltipContent += ` - ${props.SIGLA_UF || props.uf}`;
            }

            layer.bindTooltip(tooltipContent, {
              sticky: true,
              direction: 'top',
              offset: [0, -10],
            });

            layer.on('mouseover', function() {
              if ((layer as any).setStyle) {
                (layer as any).setStyle({
                  weight: 3,
                  fillOpacity: (camada.opacidade || 0.3) + 0.2,
                });
              }
            });

            layer.on('mouseout', function() {
              if ((layer as any).setStyle) {
                (layer as any).setStyle({
                  weight: 2,
                  fillOpacity: camada.opacidade || 0.3,
                });
              }
            });

            // Standardize property names for the popup
            const displayProps: Record<string, string> = {
              'Nome': props.NOM_UC || props.name || props.Name || props.NOME || camada.nome,
              'Categoria': props.CATEG || props.categoria || categoriaConfig[camada.categoria]?.label,
              'Gestão': props.GESTAO || props.gestao,
              'Instância': props.INSTANC || props.instancia,
              'Município': props.MUN || props.municipio,
              'UF': props.SIGLA_UF || props.uf,
              'Bioma': props.BIOMA || props.bioma,
              'Bacia Hidrográfica': props.B_HIDRO || props.bacia_hidro,
              'Área (ha)': props.AREA || props.area,
              'Área (km²)': props.AREA_KM2 || props.area_km2,
              'Ano de Criação': props.ANO || props.ano,
              'Restrição': props.RESTR || props.restricao,
              'Observação': props.OBS || props.observacao,
            };

            const popupContent = `
              <div style="min-width: 280px; max-height: 400px; overflow-y: auto;">
                <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                  ${categoriaConfig[camada.categoria]?.icon || '📍'} ${displayProps['Nome']}
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <tbody>
                    ${Object.entries(displayProps)
                      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
                      .map(([key, value]) => `
                        <tr>
                          <td style="font-weight: bold; padding: 4px 0; width: 120px; vertical-align: top;">${key}:</td>
                          <td style="padding: 4px 0;">${value}</td>
                        </tr>
                      `).join('')}
                  </tbody>
                </table>
              </div>
            `;
            layer.bindPopup(popupContent);
          },
        }).addTo(mapInstanceRef.current!);

        // Fit bounds to the first visible layer to help plot it
        if (visibleLayers.size === 1) {
          try {
            const bounds = geojsonLayer.getBounds();
            if (bounds.isValid()) {
              mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
            }
          } catch (e) {
            console.warn('Could not fit bounds for layer', camada.id, e);
          }
        }

        layersRef.current.set(camada.id, geojsonLayer);
      } else if (!shouldBeVisible && existingLayer) {
        existingLayer.remove();
        layersRef.current.delete(camada.id);
      }
    });
  }, [camadas, visibleLayers]);

  const toggleLayer = (camadaId: number) => {
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(camadaId)) {
        newSet.delete(camadaId);
      } else {
        newSet.add(camadaId);
      }
      return newSet;
    });
  };

  const toggleCategoryLayers = (categoria: string, enabled: boolean) => {
    const categoryLayers = camadasPorCategoria[categoria] || [];
    setVisibleLayers(prev => {
      const newSet = new Set(prev);
      categoryLayers.forEach(camada => {
        if (enabled) {
          newSet.add(camada.id);
        } else {
          newSet.delete(camada.id);
        }
      });
      return newSet;
    });
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const response = await fetch('/api/camadas-geoespaciais/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      toast({
        title: "Sucesso",
        description: "Camada carregada com sucesso!",
      });
      setUploadDialogOpen(false);
      refetchCamadas();
      queryClient.invalidateQueries({ queryKey: ['/api/camadas-geoespaciais'] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao fazer upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCamada = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta camada?')) return;

    try {
      await apiRequest('DELETE', `/api/camadas-geoespaciais/${id}`);
      toast({
        title: "Sucesso",
        description: "Camada excluída com sucesso!",
      });
      setVisibleLayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      refetchCamadas();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao excluir camada",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .toaster { 
        z-index: 99999 !important; 
      }
      [role="status"] {
        z-index: 99999 !important;
      }
      .leaflet-container {
        z-index: 1 !important;
      }
      .leaflet-pane {
        z-index: 400 !important;
      }
      .leaflet-top, .leaflet-bottom {
        z-index: 1000 !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

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
            Visualize a localização de todos os empreendimentos e camadas geoespaciais
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-upload-layer">
                <Upload className="h-4 w-4 mr-2" />
                Carregar Camada
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md !z-[10001] fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Carregar Camada Geoespacial
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <Label htmlFor="file">Arquivo (KMZ, KML ou GeoJSON)</Label>
                  <Input 
                    id="file" 
                    name="file" 
                    type="file" 
                    accept=".kmz,.kml,.geojson,.json"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="nome">Nome da Camada</Label>
                  <Input id="nome" name="nome" placeholder="Ex: Unidades de Conservação BA" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select name="categoria" defaultValue="outro">
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent className="!z-[10002]">
                      {Object.entries(categoriaConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cor">Cor</Label>
                    <Input id="cor" name="cor" type="color" defaultValue="#3b82f6" className="mt-1 h-10" />
                  </div>
                  <div>
                    <Label htmlFor="ano">Ano</Label>
                    <Input id="ano" name="ano" type="number" placeholder="2024" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fonte">Fonte dos Dados</Label>
                  <Input id="fonte" name="fonte" placeholder="Ex: ICMBio, FUNAI, IBGE" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input id="descricao" name="descricao" placeholder="Descrição da camada" className="mt-1" />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="visivel" name="visivel" defaultChecked />
                  <Label htmlFor="visivel">Visível por padrão</Label>
                </div>
                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? 'Carregando...' : 'Carregar Camada'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => { void refetch(); refetchCamadas(); }} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Layers className="h-5 w-5" />
              Camadas Geoespaciais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
            {loadingCamadas ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : camadas.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma camada cadastrada</p>
                <p className="text-xs">Clique em "Carregar Camada" para adicionar</p>
              </div>
            ) : (
              Object.entries(camadasPorCategoria).map(([categoria, camadasCategoria]) => {
                const config = categoriaConfig[categoria] || categoriaConfig.outro;
                const allVisible = camadasCategoria.every(c => visibleLayers.has(c.id));
                const someVisible = camadasCategoria.some(c => visibleLayers.has(c.id));

                return (
                  <div key={categoria} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span className="font-medium text-sm">{config.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {camadasCategoria.length}
                        </Badge>
                      </div>
                      <Switch
                        checked={allVisible}
                        onCheckedChange={(checked) => toggleCategoryLayers(categoria, checked)}
                        className="scale-75"
                      />
                    </div>
                    <div className="pl-6 space-y-1">
                      {camadasCategoria.map(camada => (
                        <div 
                          key={camada.id} 
                          className="flex items-center justify-between group hover:bg-muted/50 rounded px-2 py-1"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: camada.cor || config.color }}
                            />
                            <span className="text-sm truncate" title={camada.nome}>
                              {camada.nome}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => { toggleLayer(camada.id); }}
                            >
                              {visibleLayers.has(camada.id) ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => handleDeleteCamada(camada.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Empreendimentos
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
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-muted-foreground">
                Mostrando {empreendimentosFiltrados.length} de {empreendimentosComCoordenadas.length} empreendimentos com coordenadas
              </p>
              {visibleLayers.size > 0 && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {visibleLayers.size} camada{visibleLayers.size !== 1 ? 's' : ''} visível{visibleLayers.size !== 1 ? 'is' : ''}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {empreendimentos.length > 0 && empreendimentosComCoordenadas.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              Nenhum empreendimento possui coordenadas cadastradas. Edite os empreendimentos para adicionar latitude e longitude.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Dicas de uso das Camadas Geoespaciais:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Carregue arquivos KMZ, KML ou GeoJSON para visualizar áreas no mapa</li>
                <li>Use as categorias para organizar camadas (UCs, Terras Indígenas, Uso do Solo, etc.)</li>
                <li>Passe o mouse sobre as áreas para ver informações detalhadas</li>
                <li>Clique nas áreas para abrir um popup com mais informações</li>
                <li>Use os toggles para ligar/desligar camadas individualmente ou por categoria</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
