import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Chart, registerables } from "chart.js";
import {
  RefreshCw, Search, Eye, Download, Activity, Bird, TreePine, Waves, Leaf,
  Cpu, MapPin, Clock, BarChart3, Database, AlertTriangle, CheckCircle,
  TrendingUp, Wifi, WifiOff, Trash2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

Chart.register(...registerables);

const GRUPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  fauna_aves:           { label: "Aves",           color: "#0ea5e9", bg: "bg-sky-100 text-sky-800" },
  fauna_mamiferos:      { label: "Mamíferos",       color: "#f59e0b", bg: "bg-amber-100 text-amber-800" },
  fauna_herpetofauna:   { label: "Herpetofauna",    color: "#22c55e", bg: "bg-green-100 text-green-800" },
  fauna_ictiofauna:     { label: "Ictiofauna",      color: "#3b82f6", bg: "bg-blue-100 text-blue-800" },
  fauna_invertebrados:  { label: "Invertebrados",   color: "#a855f7", bg: "bg-purple-100 text-purple-800" },
  flora:                { label: "Flora",            color: "#10b981", bg: "bg-emerald-100 text-emerald-800" },
  ruido:                { label: "Ruído",            color: "#f97316", bg: "bg-orange-100 text-orange-800" },
  solo:                 { label: "Solo",             color: "#eab308", bg: "bg-yellow-100 text-yellow-800" },
  qualidade_agua:       { label: "Água",             color: "#06b6d4", bg: "bg-cyan-100 text-cyan-800" },
};

const IUCN_COLORS: Record<string, string> = {
  LC: "#22c55e", NT: "#84cc16", VU: "#f59e0b",
  EN: "#f97316", CR: "#ef4444", EW: "#7c3aed", EX: "#000", DD: "#94a3b8", NE: "#cbd5e1",
};

interface CampoRegistro {
  id: number;
  grupoTaxonomico: string;
  empreendimentoId?: number;
  campanha?: string;
  data: string;
  horario?: string;
  periodo?: string;
  unidadeAmostral?: string;
  latitude?: string;
  longitude?: string;
  nomeCientifico?: string;
  nomeComum?: string;
  sexo?: string;
  idade?: string;
  metodo?: string;
  statusRegistro?: string;
  iucn?: string;
  ibamaMma?: string;
  cites?: string;
  nomeColetor?: string;
  observacoes?: string;
  criadoEm?: string;
  sincronizado?: boolean;
  fotos?: { id: number; url: string }[];
}

interface DashboardStats {
  total: number;
  totalCampanhas: number;
  totalEspecies: number;
  byGrupo: Record<string, number>;
  byStatus: Record<string, number>;
}

function GrupoChart({ byGrupo }: { byGrupo: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !byGrupo) return;
    chartRef.current?.destroy();
    const labels = Object.keys(byGrupo).map(k => GRUPO_CONFIG[k]?.label || k);
    const data = Object.values(byGrupo);
    const colors = Object.keys(byGrupo).map(k => GRUPO_CONFIG[k]?.color || "#94a3b8");
    chartRef.current = new Chart(canvasRef.current.getContext("2d")!, {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "right", labels: { font: { size: 11 }, boxWidth: 12 } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [byGrupo]);

  return <canvas ref={canvasRef} height={200} />;
}

function IucnChart({ registros }: { registros: CampoRegistro[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const counts: Record<string, number> = {};
    registros.forEach(r => { if (r.iucn) counts[r.iucn] = (counts[r.iucn] || 0) + 1; });
    const cats = Object.keys(counts);
    if (cats.length === 0) return;
    chartRef.current = new Chart(canvasRef.current.getContext("2d")!, {
      type: "bar",
      data: {
        labels: cats,
        datasets: [{ label: "Registros", data: cats.map(c => counts[c]), backgroundColor: cats.map(c => IUCN_COLORS[c] || "#94a3b8"), borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [registros]);

  return <canvas ref={canvasRef} height={200} />;
}

function TimelineChart({ registros }: { registros: CampoRegistro[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    const byDay: Record<string, number> = {};
    registros.forEach(r => { if (r.data) byDay[r.data] = (byDay[r.data] || 0) + 1; });
    const days = Object.keys(byDay).sort().slice(-30);
    chartRef.current = new Chart(canvasRef.current.getContext("2d")!, {
      type: "line",
      data: {
        labels: days.map(d => d.slice(5)),
        datasets: [{
          label: "Registros/dia",
          data: days.map(d => byDay[d]),
          fill: true,
          backgroundColor: "rgba(16,185,129,0.15)",
          borderColor: "#10b981",
          tension: 0.4,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });
    return () => chartRef.current?.destroy();
  }, [registros]);

  return <canvas ref={canvasRef} height={180} />;
}

export default function CampoMonitoramento() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterGrupo, setFilterGrupo] = useState("todos");
  const [filterCampanha, setFilterCampanha] = useState("todas");
  const [viewingRecord, setViewingRecord] = useState<CampoRegistro | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(60);

  const { data: registros = [], isLoading, refetch } = useQuery<CampoRegistro[]>({
    queryKey: ["/api/campo"],
    queryFn: async () => {
      const res = await fetch("/api/campo", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar");
      return res.json();
    },
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/campo/stats/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/campo/stats/dashboard", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
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

  // Countdown timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { setLastRefresh(new Date()); return 60; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  function handleManualRefresh() {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
    setLastRefresh(new Date());
    setCountdown(60);
    toast({ title: "Dados atualizados" });
  }

  function exportCSV() {
    if (filtered.length === 0) return;
    const headers = ["ID", "Grupo", "Nome Científico", "Nome Comum", "Campanha", "Data", "Horário", "Período", "Latitude", "Longitude", "UA", "Sexo", "Idade", "Método", "Status", "IUCN", "IBAMA", "CITES", "Coletor", "Observações"];
    const rows = filtered.map(r => [
      r.id, GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico,
      r.nomeCientifico || "", r.nomeComum || "", r.campanha || "",
      r.data, r.horario || "", r.periodo || "",
      r.latitude || "", r.longitude || "", r.unidadeAmostral || "",
      r.sexo || "", r.idade || "", r.metodo || "", r.statusRegistro || "",
      r.iucn || "", r.ibamaMma || "", r.cites || "", r.nomeColetor || "", r.observacoes || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `campo_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const campanhas = [...new Set(registros.filter(r => r.campanha).map(r => r.campanha!))].sort();

  const filtered = registros.filter(r => {
    const matchGrupo = filterGrupo === "todos" || r.grupoTaxonomico === filterGrupo;
    const matchCampanha = filterCampanha === "todas" || r.campanha === filterCampanha;
    const matchSearch = !search ||
      r.nomeCientifico?.toLowerCase().includes(search.toLowerCase()) ||
      r.nomeComum?.toLowerCase().includes(search.toLowerCase()) ||
      r.campanha?.toLowerCase().includes(search.toLowerCase()) ||
      r.unidadeAmostral?.toLowerCase().includes(search.toLowerCase());
    return matchGrupo && matchCampanha && matchSearch;
  });

  // Top species
  const speciesCounts: Record<string, number> = {};
  registros.forEach(r => { if (r.nomeCientifico) speciesCounts[r.nomeCientifico] = (speciesCounts[r.nomeCientifico] || 0) + 1; });
  const topSpecies = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Threatened species
  const threatened = registros.filter(r => r.iucn && ["VU", "EN", "CR", "EW", "EX"].includes(r.iucn));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" /> Monitoramento de Campo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Recepção e análise em tempo real dos dados coletados em campo
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${autoRefresh ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
            {autoRefresh ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {autoRefresh ? `Auto-refresh em ${countdown}s` : "Paused"}
          </div>
          <Button size="sm" variant="outline" onClick={() => setAutoRefresh(p => !p)} className="text-xs">
            {autoRefresh ? "Pausar" : "Retomar"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleManualRefresh} className="gap-1.5 text-xs">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
          <Button size="sm" onClick={exportCSV} disabled={filtered.length === 0} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <Download className="w-3 h-3" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Last refresh info */}
      <p className="text-xs text-muted-foreground -mt-3">
        <Clock className="inline w-3 h-3 mr-1" />
        Última atualização: {lastRefresh.toLocaleTimeString("pt-BR")} · {registros.length} registros no servidor
      </p>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Registros", value: stats?.total ?? registros.length, icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Campanhas", value: stats?.totalCampanhas ?? campanhas.length, icon: BarChart3, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Espécies Distintas", value: stats?.totalEspecies ?? 0, icon: Bird, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Ameaçadas (VU+)", value: threatened.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 flex items-start gap-3">
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      {registros.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Por Grupo Taxonômico</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              {stats?.byGrupo && Object.keys(stats.byGrupo).length > 0
                ? <GrupoChart byGrupo={stats.byGrupo} />
                : <p className="text-center text-muted-foreground text-sm pt-8">Sem dados</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição IUCN</CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              {registros.some(r => r.iucn)
                ? <IucnChart registros={registros} />
                : <p className="text-center text-muted-foreground text-sm pt-8">Nenhuma categoria IUCN registrada</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" /> Registros por Data (últimos 30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              <TimelineChart registros={registros} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Species + Threatened */}
      {registros.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Espécies</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-xs">#</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Espécie</th>
                    <th className="px-4 py-2 text-right font-medium text-xs">Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {topSpecies.map(([sp, count], i) => (
                    <tr key={sp} className="border-t">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 italic">{sp}</td>
                      <td className="px-4 py-2 text-right font-semibold">{count}</td>
                    </tr>
                  ))}
                  {topSpecies.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">Nenhuma espécie registrada ainda</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" /> Espécies Ameaçadas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-xs">Espécie</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">IUCN</th>
                    <th className="px-4 py-2 text-left font-medium text-xs">Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...new Map(threatened.map(r => [r.nomeCientifico, r])).values()].slice(0, 8).map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2 italic">{r.nomeCientifico || "—"}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[r.iucn!] || "#94a3b8" }}>
                          {r.iucn}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <Badge className={`text-xs ${GRUPO_CONFIG[r.grupoTaxonomico]?.bg || "bg-gray-100 text-gray-800"}`}>
                          {GRUPO_CONFIG[r.grupoTaxonomico]?.label || r.grupoTaxonomico}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {threatened.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">Nenhuma espécie ameaçada registrada</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por espécie, campanha, unidade amostral..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterGrupo} onValueChange={setFilterGrupo}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Grupo taxonômico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            {Object.entries(GRUPO_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCampanha} onValueChange={setFilterCampanha}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as campanhas</SelectItem>
            {campanhas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Registros Recebidos ({filtered.length}{filtered.length !== registros.length ? ` de ${registros.length}` : ""})
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
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground space-y-2">
              <Database className="w-12 h-12 mx-auto opacity-20" />
              <p className="font-medium">Aguardando dados do campo</p>
              <p className="text-xs">Os registros aparecerão aqui automaticamente conforme o app de campo sincronizar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">ID</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">Grupo</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">Nome Científico</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">Nome Comum</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">Campanha</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">Data</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">UA</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">GPS</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">IUCN</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium text-xs text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const cfg = GRUPO_CONFIG[r.grupoTaxonomico];
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">#{r.id}</td>
                        <td className="px-3 py-2.5">
                          <Badge className={`text-xs ${cfg?.bg || "bg-gray-100 text-gray-700"}`}>{cfg?.label || r.grupoTaxonomico}</Badge>
                        </td>
                        <td className="px-3 py-2.5 italic text-xs">{r.nomeCientifico || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.nomeComum || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.campanha || "—"}</td>
                        <td className="px-3 py-2.5 text-xs">{r.data}</td>
                        <td className="px-3 py-2.5 text-xs">{r.unidadeAmostral || "—"}</td>
                        <td className="px-3 py-2.5">
                          {r.latitude && r.longitude ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs">
                              <MapPin className="w-3 h-3" />
                              {parseFloat(r.latitude).toFixed(3)}, {parseFloat(r.longitude).toFixed(3)}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.iucn ? (
                            <span className="px-1.5 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[r.iucn] || "#94a3b8" }}>
                              {r.iucn}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.statusRegistro ? <Badge variant="outline" className="text-xs">{r.statusRegistro}</Badge> : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setViewingRecord(r)} title="Ver detalhes">
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => {
                              if (confirm(`Excluir registro #${r.id}?`)) deleteMutation.mutate(r.id);
                            }} title="Excluir">
                              <Trash2 className="w-3 h-3" />
                            </Button>
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

      {/* Record Detail Dialog */}
      {viewingRecord && (
        <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 flex-wrap">
                <Badge className={GRUPO_CONFIG[viewingRecord.grupoTaxonomico]?.bg || ""}>
                  {GRUPO_CONFIG[viewingRecord.grupoTaxonomico]?.label}
                </Badge>
                <span className="italic">{viewingRecord.nomeCientifico || `Registro #${viewingRecord.id}`}</span>
                {viewingRecord.iucn && (
                  <span className="px-2 py-0.5 rounded text-white text-xs font-bold" style={{ backgroundColor: IUCN_COLORS[viewingRecord.iucn] || "#94a3b8" }}>
                    IUCN: {viewingRecord.iucn}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["Nome Comum", viewingRecord.nomeComum],
                ["Campanha", viewingRecord.campanha],
                ["Data", viewingRecord.data],
                ["Horário", viewingRecord.horario],
                ["Período", viewingRecord.periodo],
                ["Unidade Amostral", viewingRecord.unidadeAmostral],
                ["Latitude", viewingRecord.latitude],
                ["Longitude", viewingRecord.longitude],
                ["Sexo", viewingRecord.sexo],
                ["Idade", viewingRecord.idade],
                ["Método", viewingRecord.metodo],
                ["Status do Registro", viewingRecord.statusRegistro],
                ["IBAMA/MMA", viewingRecord.ibamaMma],
                ["CITES", viewingRecord.cites],
                ["Coletor", viewingRecord.nomeColetor],
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="bg-muted/40 rounded p-2">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium mt-0.5 text-sm">{value}</p>
                </div>
              ))}
            </div>
            {viewingRecord.observacoes && (
              <div className="bg-muted/40 rounded p-2 mt-2">
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="mt-0.5 text-sm">{viewingRecord.observacoes}</p>
              </div>
            )}
            {viewingRecord.fotos && viewingRecord.fotos.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">FOTOS</p>
                <div className="grid grid-cols-3 gap-2">
                  {viewingRecord.fotos.map(f => (
                    <img key={f.id} src={f.url} alt="foto campo" className="rounded-lg object-cover w-full h-28 cursor-pointer hover:opacity-90" onClick={() => window.open(f.url, "_blank")} />
                  ))}
                </div>
              </div>
            )}
            {viewingRecord.latitude && viewingRecord.longitude && (
              <div className="mt-3 bg-emerald-50 rounded-lg p-3 flex items-center gap-3">
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
