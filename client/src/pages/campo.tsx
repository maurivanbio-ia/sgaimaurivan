import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Chart, registerables } from "chart.js";
import {
  RefreshCw, Search, Eye, Download, Activity, Bird, MapPin, Clock,
  BarChart3, Database, AlertTriangle, TrendingUp, Wifi, WifiOff,
  Trash2, Building2, ChevronRight, Sigma, FlaskConical, Layers, Leaf,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

Chart.register(...registerables);

// ── Grupo config ─────────────────────────────────────────────────────────────
const GRUPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  fauna_aves:          { label: "Aves",          color: "#0ea5e9", bg: "bg-sky-100 text-sky-800" },
  fauna_mamiferos:     { label: "Mamíferos",      color: "#f59e0b", bg: "bg-amber-100 text-amber-800" },
  fauna_herpetofauna:  { label: "Herpetofauna",   color: "#22c55e", bg: "bg-green-100 text-green-800" },
  fauna_ictiofauna:    { label: "Ictiofauna",     color: "#3b82f6", bg: "bg-blue-100 text-blue-800" },
  fauna_invertebrados: { label: "Invertebrados",  color: "#a855f7", bg: "bg-purple-100 text-purple-800" },
  flora:               { label: "Flora",           color: "#10b981", bg: "bg-emerald-100 text-emerald-800" },
  ruido:               { label: "Ruído",           color: "#f97316", bg: "bg-orange-100 text-orange-800" },
  solo:                { label: "Solo",            color: "#eab308", bg: "bg-yellow-100 text-yellow-800" },
  qualidade_agua:      { label: "Água",            color: "#06b6d4", bg: "bg-cyan-100 text-cyan-800" },
};

const IUCN_COLORS: Record<string, string> = {
  LC: "#22c55e", NT: "#84cc16", VU: "#f59e0b",
  EN: "#f97316", CR: "#ef4444", EW: "#7c3aed", EX: "#000000", DD: "#94a3b8", NE: "#cbd5e1",
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Empreendimento { id: number; nome: string; cliente?: string; municipio?: string; uf?: string; }
interface CampoRegistro {
  id: number; grupoTaxonomico: string; empreendimentoId?: number; campanha?: string;
  data: string; horario?: string; periodo?: string; unidadeAmostral?: string;
  latitude?: string; longitude?: string; nomeCientifico?: string; nomeComum?: string;
  filo?: string; classe?: string; ordem?: string; familia?: string;
  sexo?: string; idade?: string; metodo?: string; statusRegistro?: string;
  iucn?: string; ibamaMma?: string; cites?: string; listaEstadual?: string;
  dieta?: string; endemismo?: string; nomeColetor?: string; observacoes?: string;
  fotos?: { id: number; url: string }[];
}
interface DashboardStats {
  total: number; totalCampanhas: number; totalEspecies: number;
  byGrupo: Record<string, number>; byStatus: Record<string, number>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ESTATÍSTICAS DE BIODIVERSIDADE (port do Python)
// ══════════════════════════════════════════════════════════════════════════════
function shannonH(counts: number[]): number {
  const pos = counts.filter(c => c > 0);
  const N = pos.reduce((a, b) => a + b, 0);
  if (N === 0) return 0;
  return -pos.reduce((h, c) => { const p = c / N; return h + p * Math.log(p); }, 0);
}
function simpsonD(counts: number[]): number {
  const pos = counts.filter(c => c > 0);
  const N = pos.reduce((a, b) => a + b, 0);
  if (N === 0) return 0;
  return 1 - pos.reduce((d, c) => d + (c / N) ** 2, 0);
}
function pielouJ(counts: number[]): number {
  const H = shannonH(counts);
  const S = counts.filter(c => c > 0).length;
  if (S <= 1) return 0;
  return H / Math.log(S);
}
// Jackknife 1 (incidência por UA)
function jackknife1(samplesBySpecies: Record<string, Set<string>>): number {
  const allSamples = new Set<string>();
  Object.values(samplesBySpecies).forEach(s => s.forEach(ua => allSamples.add(ua)));
  const n = allSamples.size;
  if (n === 0) return 0;
  const Sobs = Object.keys(samplesBySpecies).length;
  // Q1 = espécies presentes em exatamente 1 UA
  const Q1 = Object.values(samplesBySpecies).filter(s => s.size === 1).length;
  return Sobs + Q1 * (n - 1) / n;
}
// Bootstrap (incidência)
function bootstrapS(samplesBySpecies: Record<string, Set<string>>): number {
  const allSamples = new Set<string>();
  Object.values(samplesBySpecies).forEach(s => s.forEach(ua => allSamples.add(ua)));
  const n = allSamples.size;
  if (n === 0) return 0;
  const Sobs = Object.keys(samplesBySpecies).length;
  const correction = Object.values(samplesBySpecies).reduce((acc, s) => {
    const p = s.size / n;
    return acc + (1 - p) ** n;
  }, 0);
  return Sobs + correction;
}
// Curva de acumulação — registros ordenados por campanha
function accumulationCurve(registros: CampoRegistro[]): { x: number[]; y: number[] } {
  const campaigns = [...new Set(registros.map(r => r.campanha || r.data))].sort();
  const x: number[] = [], y: number[] = [];
  const seen = new Set<string>();
  campaigns.forEach((camp, i) => {
    registros.filter(r => (r.campanha || r.data) === camp).forEach(r => {
      if (r.nomeCientifico) seen.add(r.nomeCientifico);
    });
    x.push(i + 1);
    y.push(seen.size);
  });
  return { x, y };
}
// Frequência relativa (top N + OUTRAS) — port direto do Python
function relativeFrequency(registros: CampoRegistro[], topN = 20): { especie: string; abs: number; pct: number }[] {
  const counts: Record<string, number> = {};
  registros.forEach(r => {
    const sp = r.nomeCientifico?.trim().toUpperCase();
    if (sp) counts[sp] = (counts[sp] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const result = top.map(([especie, abs]) => ({ especie, abs, pct: (abs / total) * 100 }));
  if (rest.length > 0) {
    const restAbs = rest.reduce((s, [, n]) => s + n, 0);
    result.push({ especie: "OUTRAS", abs: restAbs, pct: (restAbs / total) * 100 });
  }
  return result;
}
// Abundância e riqueza por metodologia
function byMetodo(registros: CampoRegistro[]): { metodo: string; abundancia: number; riqueza: number }[] {
  const grouped: Record<string, Set<string>> = {};
  const counts: Record<string, number> = {};
  registros.forEach(r => {
    const m = r.metodo?.trim() || "Não informado";
    if (!grouped[m]) { grouped[m] = new Set(); counts[m] = 0; }
    if (r.nomeCientifico) grouped[m].add(r.nomeCientifico);
    counts[m]++;
  });
  return Object.entries(grouped)
    .map(([metodo, spp]) => ({ metodo, abundancia: counts[metodo], riqueza: spp.size }))
    .sort((a, b) => b.abundancia - a.abundancia);
}
// Tabela por Unidade Amostral (espécie × UA)
function matrizUa(registros: CampoRegistro[]): { especies: string[]; uas: string[]; matriz: number[][] } {
  const especiesSet = new Set<string>();
  const uasSet = new Set<string>();
  registros.forEach(r => {
    if (r.nomeCientifico) especiesSet.add(r.nomeCientifico);
    if (r.unidadeAmostral) uasSet.add(r.unidadeAmostral);
  });
  const especies = [...especiesSet].sort();
  const uas = [...uasSet].sort();
  const matriz = especies.map(sp =>
    uas.map(ua => registros.filter(r => r.nomeCientifico === sp && r.unidadeAmostral === ua).length)
  );
  return { especies, uas, matriz };
}

// ── Chart components ──────────────────────────────────────────────────────────
function GrupoChart({ byGrupo }: { byGrupo: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !byGrupo || !Object.keys(byGrupo).length) return;
    chartRef.current?.destroy();
    const labels = Object.keys(byGrupo).map(k => GRUPO_CONFIG[k]?.label || k);
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "doughnut",
      data: { labels, datasets: [{ data: Object.values(byGrupo), backgroundColor: Object.keys(byGrupo).map(k => GRUPO_CONFIG[k]?.color || "#94a3b8"), borderWidth: 2, borderColor: "#fff" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right", labels: { font: { size: 11 }, boxWidth: 12 } } } },
    });
    return () => chartRef.current?.destroy();
  }, [byGrupo]);
  return <canvas ref={ref} height={200} />;
}

function FreqRelChart({ data }: { data: { especie: string; abs: number; pct: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    const colors = data.map(d => d.especie === "OUTRAS" ? "#94a3b8" : "#10b981");
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels: data.map(d => d.especie.length > 28 ? d.especie.slice(0, 25) + "…" : d.especie),
        datasets: [{ label: "Freq. relativa (%)", data: data.map(d => +d.pct.toFixed(2)), backgroundColor: colors, borderRadius: 3 }],
      },
      options: {
        indexAxis: "y" as const,
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x.toFixed(2)}%` } } },
        scales: { x: { beginAtZero: true, ticks: { callback: (v) => `${v}%` } }, y: { ticks: { font: { size: 10 } } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <canvas ref={ref} />;
}

function MetodoChart({ data }: { data: { metodo: string; abundancia: number; riqueza: number }[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !data.length) return;
    chartRef.current?.destroy();
    const labels = data.map(d => d.metodo.length > 20 ? d.metodo.slice(0, 18) + "…" : d.metodo);
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { type: "bar" as const, label: "Abundância (n registros)", data: data.map(d => d.abundancia), backgroundColor: "#0ea5e9", borderRadius: 3, yAxisID: "y" },
          { type: "line" as const, label: "Riqueza (n espécies)", data: data.map(d => d.riqueza), borderColor: "#f59e0b", backgroundColor: "#f59e0b33", tension: 0.4, pointRadius: 5, fill: false, yAxisID: "y2" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { font: { size: 11 } } } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Abundância" }, position: "left" },
          y2: { beginAtZero: true, title: { display: true, text: "Riqueza" }, position: "right", grid: { drawOnChartArea: false } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [data]);
  return <canvas ref={ref} height={220} />;
}

function AccumChart({ x, y }: { x: number[]; y: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current || !x.length) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "line",
      data: {
        labels: x.map(v => `Camp. ${v}`),
        datasets: [{
          label: "Sobs acumuladas",
          data: y,
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124,58,237,0.15)",
          fill: true, tension: 0.4, pointRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Campanhas (ordem cronológica)" } },
          y: { beginAtZero: true, title: { display: true, text: "Nº espécies acumuladas" } },
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [x, y]);
  return <canvas ref={ref} height={220} />;
}

function IucnChart({ registros }: { registros: CampoRegistro[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    const counts: Record<string, number> = {};
    registros.forEach(r => { if (r.iucn) counts[r.iucn] = (counts[r.iucn] || 0) + 1; });
    const cats = Object.keys(counts);
    if (!cats.length) return;
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "bar",
      data: { labels: cats, datasets: [{ label: "Registros", data: cats.map(c => counts[c]), backgroundColor: cats.map(c => IUCN_COLORS[c] || "#94a3b8"), borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
    return () => chartRef.current?.destroy();
  }, [registros]);
  return <canvas ref={ref} height={200} />;
}

function TimelineChart({ registros }: { registros: CampoRegistro[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chartRef.current?.destroy();
    const byDay: Record<string, number> = {};
    registros.forEach(r => { if (r.data) byDay[r.data] = (byDay[r.data] || 0) + 1; });
    const days = Object.keys(byDay).sort().slice(-30);
    if (!days.length) return;
    chartRef.current = new Chart(ref.current.getContext("2d")!, {
      type: "line",
      data: { labels: days.map(d => d.slice(5)), datasets: [{ label: "Registros/dia", data: days.map(d => byDay[d]), fill: true, backgroundColor: "rgba(16,185,129,0.15)", borderColor: "#10b981", tension: 0.4, pointRadius: 3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });
    return () => chartRef.current?.destroy();
  }, [registros]);
  return <canvas ref={ref} height={200} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CampoMonitoramento() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEmpId, setSelectedEmpId] = useState<string>("todos");
  const [filterCampanha, setFilterCampanha] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [filterGrupo, setFilterGrupo] = useState("todos");
  const [viewingRecord, setViewingRecord] = useState<CampoRegistro | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(60);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });
  const empParam = selectedEmpId !== "todos" ? `&empreendimentoId=${selectedEmpId}` : "";
  const empParamStats = selectedEmpId !== "todos" ? `?empreendimentoId=${selectedEmpId}` : "";

  const { data: registros = [], isLoading, refetch } = useQuery<CampoRegistro[]>({
    queryKey: ["/api/campo", selectedEmpId],
    queryFn: async () => {
      const res = await fetch(`/api/campo?limit=2000${empParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/campo/stats/dashboard", selectedEmpId],
    queryFn: async () => {
      const res = await fetch(`/api/campo/stats/dashboard${empParamStats}`, { credentials: "include" });
      return res.ok ? res.json() : null;
    },
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/campo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      toast({ title: "Registro excluído" });
    },
  });

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => setCountdown(p => { if (p <= 1) { setLastRefresh(new Date()); return 60; } return p - 1; }), 1000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  function handleRefresh() {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
    setLastRefresh(new Date()); setCountdown(60);
    toast({ title: "Dados atualizados" });
  }

  // ── Filtro de campanha aplicado ────────────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => filterCampanha === "todas" || r.campanha === filterCampanha);
  }, [registros, filterCampanha]);

  // ── Cálculos de biodiversidade ─────────────────────────────────────────────
  const bioStats = useMemo(() => {
    if (!registrosFiltrados.length) return null;

    // Contagem por espécie
    const spCounts: Record<string, number> = {};
    const spByUa: Record<string, Set<string>> = {};
    registrosFiltrados.forEach(r => {
      const sp = r.nomeCientifico?.trim().toUpperCase();
      if (!sp) return;
      spCounts[sp] = (spCounts[sp] || 0) + 1;
      if (!spByUa[sp]) spByUa[sp] = new Set();
      if (r.unidadeAmostral) spByUa[sp].add(r.unidadeAmostral);
    });

    const counts = Object.values(spCounts);
    const Sobs = counts.length;
    const H = shannonH(counts);
    const D = simpsonD(counts);
    const J = pielouJ(counts);
    const jack1 = jackknife1(spByUa);
    const boot = bootstrapS(spByUa);
    const accum = accumulationCurve(registrosFiltrados);
    const freqRel = relativeFrequency(registrosFiltrados, 20);
    const metodoData = byMetodo(registrosFiltrados);
    const ua = matrizUa(registrosFiltrados);
    const threatened = registrosFiltrados.filter(r => r.iucn && ["VU", "EN", "CR", "EW", "EX"].includes(r.iucn));

    // Top espécies
    const topSp = Object.entries(spCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return { Sobs, H, D, J, jack1, boot, accum, freqRel, metodoData, ua, threatened, topSp };
  }, [registrosFiltrados]);

  const campanhas = useMemo(() => [...new Set(registros.filter(r => r.campanha).map(r => r.campanha!))].sort(), [registros]);
  const selectedEmp = empreendimentos.find(e => String(e.id) === selectedEmpId);

  // Tabela final com filtros
  const tableData = useMemo(() => {
    return registrosFiltrados.filter(r => {
      const matchGrupo = filterGrupo === "todos" || r.grupoTaxonomico === filterGrupo;
      const matchSearch = !search ||
        r.nomeCientifico?.toLowerCase().includes(search.toLowerCase()) ||
        r.nomeComum?.toLowerCase().includes(search.toLowerCase()) ||
        r.campanha?.toLowerCase().includes(search.toLowerCase()) ||
        r.unidadeAmostral?.toLowerCase().includes(search.toLowerCase());
      return matchGrupo && matchSearch;
    });
  }, [registrosFiltrados, filterGrupo, search]);

  function getEmpNome(id?: number) {
    if (!id) return null;
    return empreendimentos.find(e => e.id === id)?.nome || `Empreendimento #${id}`;
  }

  function exportCSV() {
    if (!tableData.length) return;
    const headers = ["ID", "Empreendimento", "Grupo", "Nome Científico", "Nome Comum", "Campanha", "Data", "UA", "Latitude", "Longitude", "Método", "IUCN", "IBAMA", "CITES", "Coletor"];
    const rows = tableData.map(r => [r.id, getEmpNome(r.empreendimentoId) || "", GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico, r.nomeCientifico || "", r.nomeComum || "", r.campanha || "", r.data, r.unidadeAmostral || "", r.latitude || "", r.longitude || "", r.metodo || "", r.iucn || "", r.ibamaMma || "", r.cites || "", r.nomeColetor || ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    const empLabel = selectedEmp ? `_${selectedEmp.nome.replace(/\s+/g, "_")}` : "";
    const campLabel = filterCampanha !== "todas" ? `_${filterCampanha}` : "";
    a.download = `campo${empLabel}${campLabel}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const hasDados = registrosFiltrados.length > 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-full">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" /> Monitoramento de Campo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Recepção e análise estatística em tempo real dos dados coletados em campo</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${autoRefresh ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
            {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {autoRefresh ? `Refresh em ${countdown}s` : "Pausado"}
          </div>
          <Button size="sm" variant="outline" onClick={() => setAutoRefresh(p => !p)} className="text-xs">
            {autoRefresh ? "Pausar" : "Retomar"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-1.5 text-xs">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
          <Button size="sm" onClick={exportCSV} disabled={!tableData.length} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <Download className="w-3 h-3" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* ── Empreendimento + Campanha ── */}
      <Card className="border-2 border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold text-sm text-emerald-800">Empreendimento:</span>
            </div>
            <Select value={selectedEmpId} onValueChange={val => { setSelectedEmpId(val); setFilterCampanha("todas"); }}>
              <SelectTrigger className="flex-1 max-w-sm bg-white border-emerald-300">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os empreendimentos</SelectItem>
                {empreendimentos.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    <span className="font-medium">{e.nome}</span>
                    {e.municipio && <span className="text-muted-foreground text-xs ml-2">— {e.municipio}{e.uf ? `/${e.uf}` : ""}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 flex-shrink-0">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm text-blue-800">Campanha:</span>
            </div>
            <Select value={filterCampanha} onValueChange={setFilterCampanha}>
              <SelectTrigger className="flex-1 max-w-xs bg-white border-blue-300">
                <SelectValue placeholder="Todas..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as campanhas</SelectItem>
                {campanhas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground -mt-2">
        <Clock className="inline w-3 h-3 mr-1" />
        Última atualização: {lastRefresh.toLocaleTimeString("pt-BR")} ·{" "}
        {registrosFiltrados.length} registros{selectedEmp ? ` — ${selectedEmp.nome}` : ""}{filterCampanha !== "todas" ? ` · ${filterCampanha}` : ""}
      </p>

      {/* ── KPIs básicos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Registros", value: stats?.total ?? registros.length, icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Campanhas", value: stats?.totalCampanhas ?? campanhas.length, icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Espécies (Sobs)", value: bioStats?.Sobs ?? (stats?.totalEspecies ?? 0), icon: Bird, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Ameaçadas (VU+)", value: bioStats?.threatened.length ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <div className={`rounded-lg p-2 ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          BLOCO DE ESTATÍSTICAS DE BIODIVERSIDADE
      ═══════════════════════════════════════════════════════════════════ */}
      <>
          {/* ── Título da seção ── */}
          <div className="flex items-center gap-2 pt-2">
            <Sigma className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-bold text-foreground">Estatísticas de Biodiversidade</h2>
            {filterCampanha !== "todas" && <Badge variant="outline" className="text-xs">{filterCampanha}</Badge>}
            {!hasDados && <Badge variant="outline" className="text-xs text-muted-foreground">Aguardando dados do campo</Badge>}
          </div>

          {/* ── Índices de Diversidade ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Shannon (H')", value: bioStats ? bioStats.H.toFixed(3) : "—", desc: "Diversidade", color: "text-violet-600", bg: "bg-violet-50", tip: "H' > 3 = alta diversidade" },
              { label: "Simpson (1-D)", value: bioStats ? bioStats.D.toFixed(3) : "—", desc: "Dominância inv.", color: "text-indigo-600", bg: "bg-indigo-50", tip: "0–1; próximo de 1 = diverso" },
              { label: "Pielou (J')", value: bioStats ? bioStats.J.toFixed(3) : "—", desc: "Equitabilidade", color: "text-blue-600", bg: "bg-blue-50", tip: "0–1; próximo de 1 = uniforme" },
              { label: "Sobs", value: bioStats ? bioStats.Sobs : "—", desc: "Riqueza obs.", color: "text-emerald-600", bg: "bg-emerald-50", tip: "Espécies observadas" },
              { label: "Jackknife 1", value: bioStats ? bioStats.jack1.toFixed(1) : "—", desc: "Riqueza est.", color: "text-teal-600", bg: "bg-teal-50", tip: "Estimador Jackknife de 1ª ordem" },
              { label: "Bootstrap", value: bioStats ? bioStats.boot.toFixed(1) : "—", desc: "Riqueza est.", color: "text-cyan-600", bg: "bg-cyan-50", tip: "Estimador Bootstrap" },
            ].map(({ label, value, desc, color, bg, tip }) => (
              <Card key={label} title={tip}>
                <CardContent className="pt-3 pb-3">
                  <div className={`inline-flex items-center justify-center rounded-lg p-1.5 ${bg} mb-2`}>
                    <FlaskConical className={`w-4 h-4 ${color}`} />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {bioStats ? (<>

          {/* ── Frequência Relativa (full width) ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Frequência Relativa das Espécies (Top {Math.min(20, bioStats.freqRel.length - 1)} + OUTRAS)
              </CardTitle>
            </CardHeader>
            <CardContent style={{ height: Math.max(220, bioStats.freqRel.length * 22) }}>
              <FreqRelChart data={bioStats.freqRel} />
            </CardContent>
          </Card>

          {/* ── Abundância × Riqueza por Metodologia + Curva de Acumulação ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Abundância e Riqueza por Metodologia</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {bioStats.metodoData.length > 0
                  ? <MetodoChart data={bioStats.metodoData} />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Sem dados de metodologia</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  Curva de Acumulação de Espécies
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                {bioStats.accum.x.length > 1
                  ? <AccumChart x={bioStats.accum.x} y={bioStats.accum.y} />
                  : <p className="text-center text-muted-foreground text-xs pt-10">Precisa de ≥2 campanhas para gerar a curva</p>}
              </CardContent>
            </Card>
          </div>

          {/* ── Grupo Taxonômico + IUCN + Timeline ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Por Grupo Taxonômico</CardTitle></CardHeader>
              <CardContent className="h-[220px]">
                {stats?.byGrupo && Object.keys(stats.byGrupo).length
                  ? <GrupoChart byGrupo={stats.byGrupo} />
                  : <p className="text-center text-muted-foreground text-sm pt-8">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribuição IUCN</CardTitle></CardHeader>
              <CardContent className="h-[220px]">
                {registrosFiltrados.some(r => r.iucn)
                  ? <IucnChart registros={registrosFiltrados} />
                  : <p className="text-center text-muted-foreground text-sm pt-8">Nenhuma categoria IUCN registrada</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Registros por Data (últimos 30 dias)</CardTitle></CardHeader>
              <CardContent className="h-[220px]"><TimelineChart registros={registrosFiltrados} /></CardContent>
            </Card>
          </div>

          {/* ── Top Espécies + Espécies Ameaçadas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Espécies por Abundância</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs">#</th>
                      <th className="px-4 py-2 text-left text-xs">Espécie</th>
                      <th className="px-4 py-2 text-right text-xs">n</th>
                      <th className="px-4 py-2 text-right text-xs">Freq. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bioStats.topSp.map(([sp, n], i) => {
                      const total = registrosFiltrados.filter(r => r.nomeCientifico).length;
                      return (
                        <tr key={sp} className="border-t">
                          <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2 italic text-xs">{sp}</td>
                          <td className="px-4 py-2 text-right font-semibold">{n}</td>
                          <td className="px-4 py-2 text-right text-xs text-muted-foreground">{total ? ((n / total) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      );
                    })}
                    {!bioStats.topSp.length && <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground text-xs">Nenhuma espécie registrada</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" /> Espécies Ameaçadas (VU, EN, CR, EW, EX)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs">Espécie</th>
                      <th className="px-4 py-2 text-left text-xs">Nome Comum</th>
                      <th className="px-4 py-2 text-left text-xs">IUCN</th>
                      <th className="px-4 py-2 text-left text-xs">Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Map(bioStats.threatened.map(r => [r.nomeCientifico, r])).values()].slice(0, 10).map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2 italic text-xs">{r.nomeCientifico || "—"}</td>
                        <td className="px-4 py-2 text-xs">{r.nomeComum || "—"}</td>
                        <td className="px-4 py-2">
                          <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[r.iucn!] || "#94a3b8" }}>{r.iucn}</span>
                        </td>
                        <td className="px-4 py-2">
                          <Badge className={`text-xs ${GRUPO_CONFIG[r.grupoTaxonomico].bg || "bg-gray-100 text-gray-800"}`}>
                            {GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {!bioStats.threatened.length && <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground text-xs">Nenhuma espécie ameaçada</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── Matriz por Unidade Amostral ── */}
          {bioStats.ua.uas.length > 0 && bioStats.ua.especies.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Tabela de Espécies × Unidade Amostral
                  <Badge variant="outline" className="text-xs">{bioStats.ua.especies.length} spp × {bioStats.ua.uas.length} UAs</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead className="bg-blue-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium sticky left-0 bg-blue-50 min-w-[180px]">Espécie</th>
                      {bioStats.ua.uas.map(ua => (
                        <th key={ua} className="px-2 py-2 text-center font-medium whitespace-nowrap">{ua}</th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold bg-blue-100">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bioStats.ua.especies.slice(0, 30).map((sp, si) => {
                      const total = bioStats.ua.matriz[si].reduce((a, b) => a + b, 0);
                      return (
                        <tr key={sp} className={`border-t ${si % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="px-3 py-1.5 italic sticky left-0 bg-inherit">{sp}</td>
                          {bioStats.ua.matriz[si].map((v, ui) => (
                            <td key={ui} className="px-2 py-1.5 text-center">
                              {v > 0
                                ? <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: `rgba(16,185,129,${Math.min(0.9, v * 0.2 + 0.15)})`, color: v > 3 ? "#fff" : "#065f46" }}>{v}</span>
                                : <span className="text-muted-foreground/40">·</span>}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center font-bold text-blue-700 bg-blue-50">{total}</td>
                        </tr>
                      );
                    })}
                    {bioStats.ua.especies.length > 30 && (
                      <tr className="border-t bg-muted/30">
                        <td colSpan={bioStats.ua.uas.length + 2} className="px-3 py-2 text-xs text-muted-foreground text-center">
                          + {bioStats.ua.especies.length - 30} espécies (exporte CSV para ver completo)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
          </>) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border-2 border-dashed border-muted rounded-xl">
              <Leaf className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum registro de campo recebido ainda</p>
              <p className="text-xs text-muted-foreground/60 max-w-sm">Os gráficos e índices de biodiversidade aparecerão aqui assim que o aplicativo de campo enviar dados via API.</p>
            </div>
          )}
        </>

      {/* ── Filtros da tabela de registros ── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por espécie, campanha, unidade amostral..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterGrupo} onValueChange={setFilterGrupo}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Grupo taxonômico" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            {Object.entries(GRUPO_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Tabela de registros ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Registros Recebidos ({tableData.length}{tableData.length !== registros.length ? ` de ${registros.length}` : ""})
              {selectedEmp && <span className="text-muted-foreground font-normal ml-2">— {selectedEmp.nome}</span>}
            </CardTitle>
            {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
              <p>Carregando dados do servidor...</p>
            </div>
          ) : tableData.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground space-y-2">
              <Database className="w-12 h-12 mx-auto opacity-20" />
              <p className="font-medium">{selectedEmp ? `Nenhum registro para "${selectedEmp.nome}"` : "Aguardando dados do campo"}</p>
              <p className="text-xs">Os registros aparecerão aqui automaticamente conforme o app de campo sincronizar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    {["ID", "Empreendimento", "Grupo", "Nome Científico", "Nome Comum", "Campanha", "Data", "UA", "GPS", "IUCN", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(r => {
                    const cfg = GRUPO_CONFIG[r.grupoTaxonomico];
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">#{r.id}</td>
                        <td className="px-3 py-2.5">
                          {getEmpNome(r.empreendimentoId)
                            ? <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium"><Building2 className="w-3 h-3" /><span className="truncate max-w-[110px]">{getEmpNome(r.empreendimentoId)}</span></span>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5"><Badge className={`text-xs ${cfg?.bg || "bg-gray-100 text-gray-700"}`}>{cfg?.label || r.grupoTaxonomico}</Badge></td>
                        <td className="px-3 py-2.5 italic text-xs">{r.nomeCientifico || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.nomeComum || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.campanha || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.data}</td>
                        <td className="px-3 py-2.5 text-xs">{r.unidadeAmostral || "—"}</td>
                        <td className="px-3 py-2.5">
                          {r.latitude && r.longitude
                            ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><MapPin className="w-3 h-3" />{parseFloat(r.latitude).toFixed(3)}, {parseFloat(r.longitude).toFixed(3)}</span>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.iucn ? <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[r.iucn] || "#94a3b8" }}>{r.iucn}</span> : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setViewingRecord(r)}><Eye className="w-3 h-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => { if (confirm(`Excluir #${r.id}?`)) deleteMutation.mutate(r.id); }}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Record Detail Dialog ── */}
      {viewingRecord && (
        <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <Badge className={GRUPO_CONFIG[viewingRecord.grupoTaxonomico]?.bg || ""}>{GRUPO_CONFIG[viewingRecord.grupoTaxonomico]?.label}</Badge>
                <span className="italic">{viewingRecord.nomeCientifico || `Registro #${viewingRecord.id}`}</span>
                {viewingRecord.iucn && <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[viewingRecord.iucn] || "#94a3b8" }}>IUCN: {viewingRecord.iucn}</span>}
              </DialogTitle>
            </DialogHeader>
            {viewingRecord.empreendimentoId && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Empreendimento</p>
                  <p className="text-sm font-semibold text-emerald-800">{getEmpNome(viewingRecord.empreendimentoId)}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["Nome Comum", viewingRecord.nomeComum], ["Campanha", viewingRecord.campanha],
                ["Data", viewingRecord.data], ["Horário", viewingRecord.horario],
                ["Período", viewingRecord.periodo], ["UA", viewingRecord.unidadeAmostral],
                ["Filo", viewingRecord.filo], ["Classe", viewingRecord.classe],
                ["Ordem", viewingRecord.ordem], ["Família", viewingRecord.familia],
                ["Sexo", viewingRecord.sexo], ["Idade", viewingRecord.idade],
                ["Método", viewingRecord.metodo], ["Status", viewingRecord.statusRegistro],
                ["IBAMA/MMA", viewingRecord.ibamaMma], ["CITES", viewingRecord.cites],
                ["Endemismo", viewingRecord.endemismo], ["Dieta", viewingRecord.dieta],
                ["Coletor", viewingRecord.nomeColetor],
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="bg-muted/40 rounded p-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium mt-0.5 text-sm">{value}</p>
                </div>
              ))}
            </div>
            {viewingRecord.observacoes && (
              <div className="bg-muted/40 rounded p-2">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="mt-0.5 text-sm">{viewingRecord.observacoes}</p>
              </div>
            )}
            {viewingRecord.fotos?.length ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">FOTOS</p>
                <div className="grid grid-cols-3 gap-2">
                  {viewingRecord.fotos.map(f => (
                    <img key={f.id} src={f.url} alt="foto" className="rounded-lg object-cover w-full h-28 cursor-pointer hover:opacity-90" onClick={() => window.open(f.url, "_blank")} />
                  ))}
                </div>
              </div>
            ) : null}
            {viewingRecord.latitude && viewingRecord.longitude && (
              <div className="bg-emerald-50 rounded-lg p-3 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-emerald-700 font-medium">Coordenadas GPS</p>
                  <p className="font-mono text-sm">{viewingRecord.latitude}, {viewingRecord.longitude}</p>
                  <a href={`https://www.google.com/maps?q=${viewingRecord.latitude},${viewingRecord.longitude}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 underline">Abrir no Google Maps</a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
