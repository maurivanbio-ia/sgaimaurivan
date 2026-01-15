import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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
import { MapPin, Filter, RefreshCw, Layers, Upload, Eye, EyeOff, Trash2, Info } from "lucide-react";

/* =========================
   Fetch robusto (evita HTML no lugar de JSON)
========================= */
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });

  // Se backend redirecionar p/ login, muitas vezes vira 200 HTML ou 302.
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao buscar ${url}. HTTP ${res.status}. ${text?.slice(0, 120)}`);
  }
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resposta não-JSON em ${url}. content-type=${contentType}. Trecho=${text.slice(0, 80)}`);
  }
  return (await res.json()) as T;
}

/* =========================
   Tipos
========================= */
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

interface CamadaGeoespacial {
  id: number;
  nome: string;
  descricao: string | null;
  categoria: string;
  cor: string | null;
  opacidade: number | null;
  geojsonUrl: string | null;
  geojsonData: any; // ideal: remover e usar URL sob demanda
  fonte: string | null;
  ano: number | null;
  ativo: boolean | null;
  visivel: boolean | null;
  ordem: number | null;
}

/* =========================
   Configs (mantive como você fez)
========================= */
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
  hidreletrica: { color: "#3b82f6", icon: "💧", label: "Hidrelétrica" },
  parque_eolico: { color: "#10b981", icon: "🌪️", label: "Parque Eólico" },
  usina_solar: { color: "#fbbf24", icon: "☀️", label: "Usina Solar" },
  termoeletrica: { color: "#ef4444", icon: "🔥", label: "Termelétrica" },
  linha_transmissao: { color: "#f59e0b", icon: "⚡", label: "Linha de Transmissão" },
  mina: { color: "#8b5cf6", icon: "⛏️", label: "Mineração" },
  pchs: { color: "#06b6d4", icon: "🏭", label: "PCH" },
  outro: { color: "#6b7280", icon: "📍", label: "Outro" },
};

const categoriaConfig: Record<string, { color: string; label: string; icon: string }> = {
  uc: { color: "#22c55e", label: "Unidades de Conservação", icon: "🌲" },
  terras_indigenas: { color: "#f59e0b", label: "Terras Indígenas", icon: "🏠" },
  uso_solo: { color: "#8b5cf6", label: "Uso do Solo", icon: "🗺️" },
  hidrografia: { color: "#3b82f6", label: "Hidrografia", icon: "💧" },
  municipios: { color: "#6b7280", label: "Municípios", icon: "🏙️" },
  vegetacao: { color: "#10b981", label: "Vegetação", icon: "🌿" },
  outro: { color: "#ef4444", label: "Outros", icon: "📍" },
};

/* =========================
   Popup seguro (sem HTML injection)
========================= */
function buildEmpPopup(emp: Empreendimento) {
  const tipoInfo = tipoConfig[emp.tipo] || tipoConfig.outro;

  const root = L.DomUtil.create("div");
  root.style.minWidth = "220px";

  const title = L.DomUtil.create("h3", "", root);
  title.style.fontWeight = "700";
  title.style.fontSize = "16px";
  title.style.marginBottom = "8px";
  title.textContent = `${tipoInfo.icon} ${emp.nome}`;

  const p1 = L.DomUtil.create("p", "", root);
  p1.innerHTML = `<strong>Tipo:</strong> ${tipoInfo.label}`;

  const p2 = L.DomUtil.create("p", "", root);
  // texto seguro
  p2.innerHTML = `<strong>Cliente:</strong> `;
  const spanCliente = L.DomUtil.create("span", "", p2);
  spanCliente.textContent = emp.cliente ?? "";

  const p3 = L.DomUtil.create("p", "", root);
  p3.innerHTML = `<strong>Local:</strong> `;
  const spanLoc = L.DomUtil.create("span", "", p3);
  spanLoc.textContent = emp.municipio && emp.uf ? `${emp.municipio}, ${emp.uf}` : emp.localizacao || "";

  const p4 = L.DomUtil.create("p", "", root);
  p4.innerHTML = `<strong>Responsável:</strong> `;
  const spanResp = L.DomUtil.create("span", "", p4);
  spanResp.textContent = emp.responsavelInterno ?? "";

  const btn = L.DomUtil.create("button", "", root);
  btn.style.marginTop = "12px";
  btn.style.width = "100%";
  btn.style.padding = "8px";
  btn.style.background = "#16a34a";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.borderRadius = "4px";
  btn.style.cursor = "pointer";
  btn.textContent = "Ver Detalhes";
  btn.addEventListener("click", () => {
    window.location.href = `/empreendimentos/${emp.id}`;
  });

  return root;
}

export default function MapaEmpreendimentos() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Melhor que array de marker: use LayerGroup
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const layersRef = useRef<Map<number, L.GeoJSON>>(new Map());

  const didFitOnceRef = useRef(false);

  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [visibleLayers, setVisibleLayers] = useState<Set<number>>(new Set());

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const { data: empreendimentos = [], isLoading, refetch } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: () => fetchJson<Empreendimento[]>("/api/empreendimentos"),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: camadas = [], isLoading: loadingCamadas, refetch: refetchCamadas } = useQuery<CamadaGeoespacial[]>({
    queryKey: ["/api/camadas-geoespaciais"],
    queryFn: () => fetchJson<CamadaGeoespacial[]>("/api/camadas-geoespaciais"),
    staleTime: 60_000,
    retry: 1,
  });

  // Inicializa camadas visíveis por padrão (uma vez por carga)
  useEffect(() => {
    if (!camadas?.length) return;
    setVisibleLayers((prev) => {
      // se já tem algo selecionado, respeita usuário
      if (prev.size > 0) return prev;
      const s = new Set<number>();
      camadas.forEach((c) => {
        if (c.visivel) s.add(c.id);
      });
      return s;
    });
  }, [camadas]);

  const empreendimentosComCoordenadas = useMemo(() => {
    return empreendimentos.filter((emp) => {
      if (!emp.latitude || !emp.longitude) return false;
      const lat = Number(emp.latitude);
      const lng = Number(emp.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
    });
  }, [empreendimentos]);

  const empreendimentosFiltrados = useMemo(() => {
    return empreendimentosComCoordenadas.filter((emp) => {
      if (statusFilter !== "todos" && emp.status !== statusFilter) return false;
      if (tipoFilter !== "todos" && emp.tipo !== tipoFilter) return false;
      return true;
    });
  }, [empreendimentosComCoordenadas, statusFilter, tipoFilter]);

  const tipos = useMemo(() => {
    const uniqueTipos = new Set(empreendimentos.map((emp) => emp.tipo));
    return Array.from(uniqueTipos).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [empreendimentos]);

  const statusCounts = useMemo(() => {
    return empreendimentosComCoordenadas.reduce((acc, emp) => {
      acc[emp.status] = (acc[emp.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [empreendimentosComCoordenadas]);

  const camadasPorCategoria = useMemo(() => {
    const grouped: Record<string, CamadaGeoespacial[]> = {};
    camadas.forEach((camada) => {
      (grouped[camada.categoria] ||= []).push(camada);
    });

    // Ordenação por "ordem" se existir
    Object.values(grouped).forEach((arr) => {
      arr.sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
    });

    return grouped;
  }, [camadas]);

  // Criar mapa uma vez
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [-15.7942, -47.8822];
    const map = L.map(mapRef.current, { preferCanvas: true }).setView(defaultCenter, 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      layersRef.current.clear();
    };
  }, []);

  // Atualizar markers via layerGroup
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    empreendimentosFiltrados.forEach((emp) => {
      const statusColor = statusColors[emp.status] || statusColors.ativo;
      const tipoInfo = tipoConfig[emp.tipo] || tipoConfig.outro;

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          background-color:${tipoInfo.color};
          width:36px;height:36px;border-radius:50%;
          border:3px solid ${statusColor};
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:18px;
        ">${tipoInfo.icon}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const lat = Number(emp.latitude);
      const lng = Number(emp.longitude);

      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(buildEmpPopup(emp));
      marker.addTo(markersLayer);
    });

    // Fit bounds só uma vez (ou quando usuário clicar em “Ajustar”)
    if (!didFitOnceRef.current && empreendimentosFiltrados.length > 0) {
      const bounds = L.latLngBounds(
        empreendimentosFiltrados.map((emp) => [Number(emp.latitude), Number(emp.longitude)] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      didFitOnceRef.current = true;
    }
  }, [empreendimentosFiltrados]);

  // Toggle camada
  const toggleLayer = useCallback((camadaId: number) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(camadaId)) next.delete(camadaId);
      else next.add(camadaId);
      return next;
    });
  }, []);

  const toggleCategoryLayers = useCallback(
    (categoria: string, enabled: boolean) => {
      const categoryLayers = camadasPorCategoria[categoria] || [];
      setVisibleLayers((prev) => {
        const next = new Set(prev);
        categoryLayers.forEach((c) => {
          if (enabled) next.add(c.id);
          else next.delete(c.id);
        });
        return next;
      });
    },
    [camadasPorCategoria]
  );

  // Renderizar camadas visíveis
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    camadas.forEach((camada) => {
      const existingLayer = layersRef.current.get(camada.id);
      const shouldBeVisible = visibleLayers.has(camada.id);

      if (shouldBeVisible && !existingLayer) {
        const data = camada.geojsonData;

        // fase 2 recomendada: se não tem geojsonData, buscar por geojsonUrl sob demanda
        if (!data) return;

        const geojsonLayer = L.geoJSON(data, {
          style: () => ({
            color: camada.cor || "#3b82f6",
            weight: 2,
            opacity: 0.8,
            fillOpacity: camada.opacidade ?? 0.3,
            fillColor: camada.cor || "#3b82f6",
          }),
          onEachFeature: (feature, layer) => {
            const props: any = (feature as any)?.properties || {};
            const cfg = categoriaConfig[camada.categoria] || categoriaConfig.outro;
            const name = props.NOM_UC || props.name || props.Name || props.NOME || camada.nome;

            layer.bindTooltip(String(name), {
              sticky: true,
              direction: "top",
              offset: [0, -10],
            });

            // Popup: manter simples, sem despejar todas propriedades (pode travar)
            const popup = L.DomUtil.create("div");
            const h = L.DomUtil.create("h3", "", popup);
            h.style.fontWeight = "700";
            h.style.marginBottom = "6px";
            h.textContent = `${cfg.icon} ${String(name)}`;

            const p = L.DomUtil.create("p", "", popup);
            p.style.fontSize = "12px";
            p.textContent = `${cfg.label}. Fonte: ${camada.fonte ?? "N.I."}. Ano: ${camada.ano ?? "N.I."}`;

            layer.bindPopup(popup);
          },
        }).addTo(map);

        layersRef.current.set(camada.id, geojsonLayer);
      }

      if (!shouldBeVisible && existingLayer) {
        existingLayer.remove();
        layersRef.current.delete(camada.id);
      }
    });
  }, [camadas, visibleLayers]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    try {
      const formData = new FormData(e.currentTarget);

      const response = await fetch("/api/camadas-geoespaciais/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Upload falhou. HTTP ${response.status}. ${text.slice(0, 200)}`);
      }
      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        throw new Error(`Upload retornou não-JSON. Trecho=${text.slice(0, 120)}`);
      }

      toast({ title: "Sucesso", description: "Camada carregada com sucesso!" });
      setUploadDialogOpen(false);

      await refetchCamadas();
      queryClient.invalidateQueries({ queryKey: ["/api/camadas-geoespaciais"] });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err?.message || "Erro ao fazer upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCamada = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta camada?")) return;

    try {
      await apiRequest("DELETE", `/api/camadas-geoespaciais/${id}`);
      toast({ title: "Sucesso", description: "Camada excluída com sucesso!" });

      setVisibleLayers((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      await refetchCamadas();
      queryClient.invalidateQueries({ queryKey: ["/api/camadas-geoespaciais"] });
    } catch {
      toast({ title: "Erro", description: "Erro ao excluir camada", variant: "destructive" });
    }
  };

  // loading
  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  /* =========
     UI (mantive seu layout, apenas “pluga” na mesma estrutura)
  ========= */
  return (
    <div className="p-8 space-y-6">
      {/* ... pode manter seu JSX original daqui para baixo ... */}
      {/* A parte importante foi robustez e Leaflet/segurança acima */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-8 w-8 text-green-600" />
          Mapa de Empreendimentos
        </h1>

        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Carregar Camada
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Carregar Camada Geoespacial
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <Label htmlFor="file">Arquivo (KMZ, KML ou GeoJSON)</Label>
                  <Input id="file" name="file" type="file" accept=".kmz,.kml,.geojson,.json" required className="mt-1" />
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
                    <SelectContent>
                      {Object.entries(categoriaConfig).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="visivel" name="visivel" defaultChecked />
                  <Label htmlFor="visivel">Visível por padrão</Label>
                </div>

                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? "Carregando..." : "Carregar Camada"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => {
              refetch();
              refetchCamadas();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {tipos.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {tipo.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {visibleLayers.size > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {visibleLayers.size} camada(s) visível(is)
            </Badge>
          )}
        </CardContent>
      </Card>

      <div
        ref={mapRef}
        className="rounded-lg overflow-hidden border"
        style={{ height: 500 }}
      />

      {/* Você pode reaproveitar o restante do seu painel de camadas, usando toggleLayer/toggleCategoryLayers/handleDeleteCamada */}
    </div>
  );
}
