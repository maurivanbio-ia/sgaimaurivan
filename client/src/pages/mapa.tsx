import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * MarkerCluster.
 * Requer dependência instalada:
 *   npm i leaflet.markercluster
 * e CSS:
 *   import "leaflet.markercluster/dist/MarkerCluster.css";
 *   import "leaflet.markercluster/dist/MarkerCluster.Default.css";
 */
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

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
import { MapPin, Filter, RefreshCw, Layers, Upload, Trash2, Info } from "lucide-react";

const CLUSTER_THRESHOLD = 350;

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
  geojsonData: any;
  fonte: string | null;
  ano: number | null;
  ativo: boolean | null;
  visivel: boolean | null;
  ordem: number | null;
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0.3;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function parseLatLng(lat: string | null, lng: string | null): [number, number] | null {
  if (!lat || !lng) return null;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null;
  return [la, lo];
}

export default function MapaEmpreendimentos() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const clusterLayerRef = useRef<any>(null);

  const layersRef = useRef<Map<number, L.GeoJSON>>(new Map());

  const legendControlRef = useRef<L.Control | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const didInitDefaultVisibleLayersRef = useRef(false);

  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [visibleLayers, setVisibleLayers] = useState<Set<number>>(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { toast } = useToast();

  const { data: empreendimentos = [], isLoading, isFetching, refetch } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const {
    data: camadas = [],
    isLoading: loadingCamadas,
    isFetching: fetchingCamadas,
    refetch: refetchCamadas,
  } = useQuery<CamadaGeoespacial[]>({
    queryKey: ["/api/camadas-geoespaciais"],
  });

  const empreendimentosComCoordenadas = useMemo(() => {
    return empreendimentos
      .map((emp) => {
        const ll = parseLatLng(emp.latitude, emp.longitude);
        return ll ? { emp, ll } : null;
      })
      .filter(Boolean)
      .map((x) => (x as any).emp as Empreendimento);
  }, [empreendimentos]);

  const empreendimentosFiltrados = useMemo(() => {
    return empreendimentosComCoordenadas.filter((emp) => {
      if (statusFilter !== "todos" && emp.status !== statusFilter) return false;
      if (tipoFilter !== "todos" && emp.tipo !== tipoFilter) return false;
      return true;
    });
  }, [empreendimentosComCoordenadas, statusFilter, tipoFilter]);

  const tipos = useMemo(() => {
    const uniqueTipos = new Set(empreendimentos.map((emp) => emp.tipo).filter(Boolean));
    return Array.from(uniqueTipos).sort((a, b) => a.localeCompare(b));
  }, [empreendimentos]);

  const statusCounts = useMemo(() => {
    return empreendimentosComCoordenadas.reduce((acc, emp) => {
      acc[emp.status] = (acc[emp.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [empreendimentosComCoordenadas]);

  const camadasOrdenadas = useMemo(() => {
    return [...camadas].sort((a, b) => {
      const ao = a.ordem ?? 999999;
      const bo = b.ordem ?? 999999;
      if (ao !== bo) return ao - bo;
      return (a.nome || "").localeCompare(b.nome || "");
    });
  }, [camadas]);

  const camadasPorCategoria = useMemo(() => {
    const grouped: Record<string, CamadaGeoespacial[]> = {};
    camadasOrdenadas.forEach((camada) => {
      const cat = camada.categoria || "outro";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(camada);
    });
    return grouped;
  }, [camadasOrdenadas]);

  const toggleLayer = useCallback((camadaId: number) => {
    setVisibleLayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(camadaId)) newSet.delete(camadaId);
      else newSet.add(camadaId);
      return newSet;
    });
  }, []);

  const toggleCategoryLayers = useCallback(
    (categoria: string, enabled: boolean) => {
      const categoryLayers = camadasPorCategoria[categoria] || [];
      setVisibleLayers((prev) => {
        const newSet = new Set(prev);
        categoryLayers.forEach((camada) => {
          if (enabled) newSet.add(camada.id);
          else newSet.delete(camada.id);
        });
        return newSet;
      });
    },
    [camadasPorCategoria],
  );

  const handleDeleteCamada = useCallback(
    async (id: number) => {
      if (!confirm("Tem certeza que deseja excluir esta camada?")) return;

      try {
        await apiRequest("DELETE", `/api/camadas-geoespaciais/${id}`);
        toast({ title: "Sucesso", description: "Camada excluída com sucesso!" });

        setVisibleLayers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });

        refetchCamadas();
      } catch {
        toast({ title: "Erro", description: "Erro ao excluir camada", variant: "destructive" });
      }
    },
    [refetchCamadas, toast],
  );

  useEffect(() => {
    if (didInitDefaultVisibleLayersRef.current) return;
    if (!camadas || camadas.length === 0) return;

    didInitDefaultVisibleLayersRef.current = true;

    const defaults = camadas.filter((c) => Boolean(c.visivel)).map((c) => c.id);
    if (defaults.length > 0) {
      setVisibleLayers(new Set(defaults));
    }
  }, [camadas]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [-15.7942, -47.8822];

    const map = L.map(mapRef.current, {
      zoomControl: true,
    }).setView(defaultCenter, 5);

    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    const anyMap = map as any;
    if (anyMap && typeof anyMap.invalidateSize === "function") {
      resizeObserverRef.current = new ResizeObserver(() => {
        try {
          anyMap.invalidateSize({ pan: false });
        } catch {
        }
      });
      resizeObserverRef.current.observe(mapRef.current);
    }

    return () => {
      try {
        if (legendControlRef.current) {
          legendControlRef.current.remove();
          legendControlRef.current = null;
        }

        layersRef.current.forEach((layer) => layer.remove());
        layersRef.current.clear();

        if (clusterLayerRef.current) {
          clusterLayerRef.current.clearLayers?.();
          clusterLayerRef.current.remove?.();
          clusterLayerRef.current = null;
        }

        if (markersLayerRef.current) {
          markersLayerRef.current.clearLayers();
          markersLayerRef.current.remove();
          markersLayerRef.current = null;
        }

        resizeObserverRef.current?.disconnect();
        resizeObserverRef.current = null;

        map.remove();
        mapInstanceRef.current = null;
      } catch {
      }
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .toaster { z-index: 99999 !important; }
      [role="status"] { z-index: 99999 !important; }
      .leaflet-container { z-index: 1 !important; }
      .leaflet-pane { z-index: 400 !important; }
      .leaflet-top, .leaflet-bottom { z-index: 1000 !important; }

      .eco-layer-control {
        background: rgba(255,255,255,0.96);
        border: 1px solid rgba(0,0,0,0.12);
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        padding: 10px;
        width: 320px;
        max-height: 420px;
        overflow: hidden;
      }
      .eco-layer-control.dark {
        background: rgba(17,24,39,0.94);
        color: #fff;
        border-color: rgba(255,255,255,0.12);
      }
      .eco-layer-control__header {
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 8px;
      }
      .eco-layer-control__title {
        font-weight: 700;
        font-size: 13px;
        display:flex;
        align-items:center;
        gap: 8px;
      }
      .eco-layer-control__body {
        max-height: 360px;
        overflow: auto;
        padding-right: 4px;
      }
      .eco-layer-control__cat {
        margin-bottom: 10px;
        padding-bottom: 10px;
        border-bottom: 1px dashed rgba(0,0,0,0.10);
      }
      .eco-layer-control.dark .eco-layer-control__cat {
        border-bottom-color: rgba(255,255,255,0.12);
      }
      .eco-layer-control__catHeader {
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 6px;
      }
      .eco-layer-control__catName {
        font-weight: 600;
        font-size: 12px;
        display:flex;
        align-items:center;
        gap: 8px;
      }
      .eco-layer-control__chip {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(0,0,0,0.06);
      }
      .eco-layer-control.dark .eco-layer-control__chip {
        background: rgba(255,255,255,0.10);
      }
      .eco-layer-control__item {
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        padding: 6px 6px;
        border-radius: 8px;
      }
      .eco-layer-control__item:hover {
        background: rgba(0,0,0,0.04);
      }
      .eco-layer-control.dark .eco-layer-control__item:hover {
        background: rgba(255,255,255,0.08);
      }
      .eco-layer-control__left {
        display:flex;
        align-items:center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .eco-layer-control__dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .eco-layer-control__label {
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .eco-layer-control__actions {
        display:flex;
        align-items:center;
        gap: 6px;
        flex-shrink: 0;
      }
      .eco-layer-control__btn {
        border: 0;
        cursor: pointer;
        padding: 6px;
        border-radius: 8px;
        background: rgba(0,0,0,0.06);
        line-height: 1;
      }
      .eco-layer-control.dark .eco-layer-control__btn {
        background: rgba(255,255,255,0.12);
        color: #fff;
      }
      .eco-layer-control__btn:hover {
        background: rgba(0,0,0,0.10);
      }
      .eco-layer-control.dark .eco-layer-control__btn:hover {
        background: rgba(255,255,255,0.18);
      }
      .eco-layer-control__toggle {
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const buildLegendControl = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (legendControlRef.current) {
      legendControlRef.current.remove();
      legendControlRef.current = null;
    }

    const Control = L.Control.extend({
      onAdd: () => {
        const container = L.DomUtil.create("div", "eco-layer-control") as HTMLDivElement;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const header = document.createElement("div");
        header.className = "eco-layer-control__header";

        const title = document.createElement("div");
        title.className = "eco-layer-control__title";
        title.textContent = "Camadas geoespaciais";

        const counter = document.createElement("div");
        counter.className = "eco-layer-control__chip";
        counter.textContent = `${visibleLayers.size} ativa${visibleLayers.size === 1 ? "" : "s"}`;

        header.appendChild(title);
        header.appendChild(counter);

        const body = document.createElement("div");
        body.className = "eco-layer-control__body";

        const categories = Object.entries(camadasPorCategoria);
        if (categories.length === 0) {
          const empty = document.createElement("div");
          empty.style.fontSize = "12px";
          empty.style.opacity = "0.8";
          empty.textContent = "Nenhuma camada cadastrada.";
          body.appendChild(empty);
        } else {
          categories.forEach(([categoria, layers]) => {
            const cfg = categoriaConfig[categoria] || categoriaConfig.outro;

            const allVisible = layers.length > 0 && layers.every((c) => visibleLayers.has(c.id));
            const someVisible = layers.some((c) => visibleLayers.has(c.id));

            const cat = document.createElement("div");
            cat.className = "eco-layer-control__cat";

            const catHeader = document.createElement("div");
            catHeader.className = "eco-layer-control__catHeader";

            const catName = document.createElement("div");
            catName.className = "eco-layer-control__catName";
            catName.textContent = `${cfg.icon} ${cfg.label}`;

            const catRight = document.createElement("div");
            catRight.style.display = "flex";
            catRight.style.alignItems = "center";
            catRight.style.gap = "8px";

            const chip = document.createElement("div");
            chip.className = "eco-layer-control__chip";
            chip.textContent = String(layers.length);

            const toggle = document.createElement("input");
            toggle.type = "checkbox";
            toggle.className = "eco-layer-control__toggle";
            toggle.checked = allVisible;
            toggle.indeterminate = !allVisible && someVisible;
            toggle.dataset.category = categoria;

            toggle.addEventListener("change", () => {
              toggleCategoryLayers(categoria, toggle.checked);
            });

            catRight.appendChild(chip);
            catRight.appendChild(toggle);

            catHeader.appendChild(catName);
            catHeader.appendChild(catRight);

            cat.appendChild(catHeader);

            layers.forEach((camada) => {
              const row = document.createElement("div");
              row.className = "eco-layer-control__item";

              const left = document.createElement("div");
              left.className = "eco-layer-control__left";

              const dot = document.createElement("div");
              dot.className = "eco-layer-control__dot";
              dot.style.background = camada.cor || cfg.color;

              const label = document.createElement("div");
              label.className = "eco-layer-control__label";
              label.title = camada.nome;
              label.textContent = camada.nome;

              left.appendChild(dot);
              left.appendChild(label);

              const actions = document.createElement("div");
              actions.className = "eco-layer-control__actions";

              const check = document.createElement("input");
              check.type = "checkbox";
              check.className = "eco-layer-control__toggle";
              check.checked = visibleLayers.has(camada.id);

              check.addEventListener("change", () => {
                toggleLayer(camada.id);
              });

              const del = document.createElement("button");
              del.type = "button";
              del.className = "eco-layer-control__btn";
              del.title = "Excluir camada";
              del.textContent = "🗑️";
              del.addEventListener("click", () => {
                handleDeleteCamada(camada.id);
              });

              actions.appendChild(check);
              actions.appendChild(del);

              row.appendChild(left);
              row.appendChild(actions);

              cat.appendChild(row);
            });

            body.appendChild(cat);
          });
        }

        container.appendChild(header);
        container.appendChild(body);

        return container;
      },
    });

    legendControlRef.current = new Control({ position: "topright" });
    legendControlRef.current.addTo(map);
  }, [camadasPorCategoria, handleDeleteCamada, toggleCategoryLayers, toggleLayer, visibleLayers.size, visibleLayers]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    buildLegendControl();
  }, [buildLegendControl]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const shouldCluster = empreendimentosFiltrados.length >= CLUSTER_THRESHOLD;

    if (clusterLayerRef.current) {
      try {
        clusterLayerRef.current.clearLayers?.();
        clusterLayerRef.current.remove?.();
      } catch {
      }
      clusterLayerRef.current = null;
    }

    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }

    const addMarker = (emp: Empreendimento) => {
      const ll = parseLatLng(emp.latitude, emp.longitude);
      if (!ll) return;

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

      const marker = L.marker(ll, { icon });

      const popupRoot = document.createElement("div");
      popupRoot.style.minWidth = "220px";

      const h3 = document.createElement("h3");
      h3.style.fontWeight = "bold";
      h3.style.fontSize = "16px";
      h3.style.marginBottom = "8px";
      h3.textContent = `${tipoInfo.icon} ${emp.nome}`;

      const meta = document.createElement("div");
      meta.style.fontSize = "14px";

      const mkLine = (label: string, value: string) => {
        const p = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(value));
        return p;
      };

      meta.appendChild(mkLine("Tipo", tipoInfo.label));
      meta.appendChild(mkLine("Cliente", emp.cliente || ""));
      meta.appendChild(
        mkLine(
          "Local",
          emp.municipio && emp.uf ? `${emp.municipio}, ${emp.uf}` : emp.localizacao || "",
        ),
      );
      meta.appendChild(mkLine("Responsável", emp.responsavelInterno || ""));

      const statusWrap = document.createElement("div");
      statusWrap.style.marginTop = "8px";

      const badge = document.createElement("span");
      badge.style.backgroundColor = statusColor;
      badge.style.color = "white";
      badge.style.padding = "2px 8px";
      badge.style.borderRadius = "4px";
      badge.style.fontSize = "12px";
      badge.textContent = statusLabels[emp.status] || emp.status;

      statusWrap.appendChild(badge);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Ver Detalhes";
      btn.style.marginTop = "12px";
      btn.style.width = "100%";
      btn.style.padding = "8px";
      btn.style.backgroundColor = "#16a34a";
      btn.style.color = "white";
      btn.style.border = "none";
      btn.style.borderRadius = "6px";
      btn.style.cursor = "pointer";

      btn.addEventListener("click", () => {
        window.location.href = `/empreendimentos/${emp.id}`;
      });

      popupRoot.appendChild(h3);
      popupRoot.appendChild(meta);
      popupRoot.appendChild(statusWrap);
      popupRoot.appendChild(btn);

      marker.bindPopup(popupRoot);

      return marker;
    };

    if (shouldCluster) {
      const clusterGroup = (L as any).markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 16,
        maxClusterRadius: 60,
      });

      empreendimentosFiltrados.forEach((emp) => {
        const m = addMarker(emp);
        if (m) clusterGroup.addLayer(m);
      });

      clusterGroup.addTo(map);
      clusterLayerRef.current = clusterGroup;
    } else {
      const group = markersLayerRef.current || L.layerGroup().addTo(map);
      markersLayerRef.current = group;

      empreendimentosFiltrados.forEach((emp) => {
        const m = addMarker(emp);
        if (m) group.addLayer(m);
      });
    }

    if (empreendimentosFiltrados.length > 0) {
      try {
        const bounds = L.latLngBounds(
          empreendimentosFiltrados
            .map((emp) => parseLatLng(emp.latitude, emp.longitude))
            .filter(Boolean) as [number, number][],
        );
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch {
      }
    }
  }, [empreendimentosFiltrados]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    camadasOrdenadas.forEach((camada) => {
      const existingLayer = layersRef.current.get(camada.id);
      const shouldBeVisible = visibleLayers.has(camada.id);

      if (shouldBeVisible && !existingLayer && camada.geojsonData) {
        const opacity = clamp01(camada.opacidade ?? 0.3);
        const color = camada.cor || "#3b82f6";

        const geojsonLayer = L.geoJSON(camada.geojsonData, {
          style: () => ({
            color,
            weight: 2,
            opacity: 0.85,
            fillOpacity: opacity,
            fillColor: color,
          }),
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const cfg = categoriaConfig[camada.categoria] || categoriaConfig.outro;

            const displayName =
              props.NOM_UC || props.name || props.Name || props.NOME || camada.nome || "Sem nome";

            let tooltipContent = `<strong>${displayName}</strong>`;
            const mun = props.MUN || props.municipio;
            const uf = props.SIGLA_UF || props.uf;

            if (mun) tooltipContent += `<br/>Município: ${mun}`;
            if (uf) tooltipContent += ` . ${uf}`;

            layer.bindTooltip(tooltipContent, { sticky: true, direction: "top", offset: [0, -10] });

            layer.on("mouseover", () => {
              (layer as any).setStyle?.({ weight: 3, fillOpacity: clamp01(opacity + 0.2) });
            });

            layer.on("mouseout", () => {
              (layer as any).setStyle?.({ weight: 2, fillOpacity: opacity });
            });

            const displayProps: Record<string, string> = {
              Nome: displayName,
              Categoria: props.CATEG || props.categoria || cfg.label,
              Gestão: props.GESTAO || props.gestao,
              Instância: props.INSTANC || props.instancia,
              Município: mun,
              UF: uf,
              Bioma: props.BIOMA || props.bioma,
              "Bacia Hidrográfica": props.B_HIDRO || props.bacia_hidro,
              "Área (ha)": props.AREA || props.area,
              "Área (km²)": props.AREA_KM2 || props.area_km2,
              "Ano de Criação": props.ANO || props.ano || (camada.ano ? String(camada.ano) : ""),
              Restrição: props.RESTR || props.restricao,
              Observação: props.OBS || props.observacao || camada.descricao || "",
              Fonte: camada.fonte || "",
            };

            const popupContent = `
              <div style="min-width: 280px; max-height: 400px; overflow-y: auto;">
                <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">
                  ${cfg.icon} ${displayProps["Nome"]}
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <tbody>
                    ${Object.entries(displayProps)
                      .filter(([_, value]) => value !== undefined && value !== null && value !== "")
                      .map(
                        ([key, value]) => `
                        <tr>
                          <td style="font-weight: bold; padding: 4px 0; width: 120px; vertical-align: top;">${key}:</td>
                          <td style="padding: 4px 0;">${value}</td>
                        </tr>
                      `,
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `;

            layer.bindPopup(popupContent);
          },
        }).addTo(map);

        layersRef.current.set(camada.id, geojsonLayer);

        if (visibleLayers.size === 1 && empreendimentosFiltrados.length === 0) {
          try {
            const bounds = geojsonLayer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [50, 50] });
            }
          } catch {
          }
        }
      }

      if (!shouldBeVisible && existingLayer) {
        existingLayer.remove();
        layersRef.current.delete(camada.id);
      }
    });

    const ids = new Set(camadasOrdenadas.map((c) => c.id));
    Array.from(layersRef.current.keys()).forEach((id) => {
      if (!ids.has(id)) {
        layersRef.current.get(id)?.remove();
        layersRef.current.delete(id);
      }
    });
  }, [camadasOrdenadas, visibleLayers, empreendimentosFiltrados.length]);

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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload");
      }

      toast({ title: "Sucesso", description: "Camada carregada com sucesso!" });

      setUploadDialogOpen(false);

      await refetchCamadas();
      queryClient.invalidateQueries({ queryKey: ["/api/camadas-geoespaciais"] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao fazer upload do arquivo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

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
            Visualize a localização de empreendimentos e camadas geoespaciais no mapa
          </p>
        </div>

        <div className="flex gap-2 items-center">
          {(isFetching || fetchingCamadas) && (
            <Badge variant="secondary" className="hidden md:inline-flex">
              Atualizando…
            </Badge>
          )}

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
                  {uploading ? "Carregando..." : "Carregar Camada"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => {
              toast({ title: "Atualizando", description: "Recarregando dados do mapa..." });
              refetch();
              refetchCamadas();
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(statusLabels).map(([status, label]) => (
          <Card
            key={status}
            className={`cursor-pointer transition-all ${statusFilter === status ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter(statusFilter === status ? "todos" : status)}
            data-testid={`filter-${status}`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: statusColors[status] }} />
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
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div ref={mapRef} className="rounded-lg overflow-hidden border" style={{ height: "560px" }} data-testid="map-container" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mt-2">
            <p className="text-sm text-muted-foreground">
              Mostrando {empreendimentosFiltrados.length} de {empreendimentosComCoordenadas.length} empreendimentos com coordenadas
              . {empreendimentosFiltrados.length >= CLUSTER_THRESHOLD ? "Clustering ativo." : "Clustering inativo."}
            </p>

            <Badge variant="outline" className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {visibleLayers.size} camada{visibleLayers.size !== 1 ? "s" : ""} ativa{visibleLayers.size !== 1 ? "s" : ""}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            As camadas são controladas diretamente no mapa. Use o painel “Camadas geoespaciais” no canto superior direito.
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

      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Dicas de uso</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Use o painel de camadas no canto superior direito do mapa para ligar e desligar camadas por categoria.</li>
                <li>Passe o mouse sobre as áreas para ver tooltip e clique para abrir o popup com atributos.</li>
                <li>Clustering é ativado automaticamente quando há muitos empreendimentos no mapa.</li>
                <li>Para excluir uma camada, use o ícone 🗑️ no painel de camadas do mapa.</li>
              </ul>

              {loadingCamadas && (
                <p className="text-xs mt-2 opacity-80">
                  Carregando camadas…
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
