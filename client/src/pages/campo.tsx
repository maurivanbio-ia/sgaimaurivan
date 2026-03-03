import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin, Camera, CloudUpload, Wifi, WifiOff, Plus, Search, Eye, Trash2,
  Download, BarChart3, Bird, TreePine, Waves, Leaf, Cpu, AlertCircle,
  CheckCircle, Clock, RefreshCw, FileText, ChevronRight, ChevronLeft, X
} from "lucide-react";

const GRUPO_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  fauna_aves: { label: "Fauna – Aves", icon: Bird, color: "bg-sky-100 text-sky-800" },
  fauna_mamiferos: { label: "Fauna – Mamíferos", icon: Bird, color: "bg-amber-100 text-amber-800" },
  fauna_herpetofauna: { label: "Fauna – Herpetofauna", icon: Bird, color: "bg-green-100 text-green-800" },
  fauna_ictiofauna: { label: "Fauna – Ictiofauna", icon: Waves, color: "bg-blue-100 text-blue-800" },
  fauna_invertebrados: { label: "Fauna – Invertebrados", icon: Bird, color: "bg-purple-100 text-purple-800" },
  flora: { label: "Flora", icon: Leaf, color: "bg-emerald-100 text-emerald-800" },
  ruido: { label: "Ruído", icon: Cpu, color: "bg-orange-100 text-orange-800" },
  solo: { label: "Solo", icon: TreePine, color: "bg-yellow-100 text-yellow-800" },
  qualidade_agua: { label: "Qualidade da Água", icon: Waves, color: "bg-cyan-100 text-cyan-800" },
};

const PERIODOS = ["Diurno", "Noturno", "Crepuscular Matutino", "Crepuscular Vespertino"];
const CONDICOES_MET = ["Ensolarado", "Nublado", "Parcialmente Nublado", "Chuvoso", "Garoa", "Ventoso"];
const SEXOS = ["Macho", "Fêmea", "Indeterminado", "Não se aplica"];
const IDADES = ["Filhote", "Jovem", "Subadulto", "Adulto", "Indeterminado"];
const STATUS_REGISTRO = ["Confirmado", "Provável", "Possível", "Acidental"];
const IUCN_CATS = ["LC", "NT", "VU", "EN", "CR", "EW", "EX", "DD", "NE"];
const IBAMA_CATS = ["Não ameaçada", "Vulnerável", "Em Perigo", "Criticamente em Perigo", "Extinta", "Não avaliada"];
const CITES_CATS = ["Não listada", "Apêndice I", "Apêndice II", "Apêndice III"];

const OFFLINE_KEY = "ecogestor-campo-offline";

interface CampoRegistro {
  id: number;
  grupoTaxonomico: string;
  empreendimentoId?: number;
  campanha?: string;
  data: string;
  horario?: string;
  periodo?: string;
  unidadeAmostral?: string;
  zonaUtm?: string;
  latitude?: string;
  longitude?: string;
  filo?: string;
  classe?: string;
  ordem?: string;
  familia?: string;
  nomeCientifico?: string;
  nomeComum?: string;
  sexo?: string;
  idade?: string;
  metodo?: string;
  modoRegistro?: string;
  numeracaoLista?: string;
  pontoEscuta?: string;
  descricaoEsforco?: string;
  duracaoAmostragem?: string;
  distanciaPercorrida?: string;
  statusRegistro?: string;
  condicaoMeteorologica?: string;
  ambientePreferencial?: string;
  estagioReprodutivo?: string;
  distribuicao?: string;
  raridade?: string;
  dieta?: string;
  habitat?: string;
  fitofisionomia?: string;
  iucn?: string;
  ibamaMma?: string;
  cites?: string;
  listaEstadual?: string;
  pan?: string;
  usoHabitat?: string;
  sensibilidade?: string;
  locomocao?: string;
  migracao?: string;
  bioindicador?: string;
  endemismo?: string;
  pesoG?: string;
  tipoMarcacao?: string;
  numeroMarcacao?: string;
  numeroTombamento?: string;
  instituicaoTombamento?: string;
  nomeColetor?: string;
  observacoes?: string;
  asaMm?: string;
  tarsoDireitoMm?: string;
  diametroTarsoMm?: string;
  alturaBicoMm?: string;
  comprimentoBicoMm?: string;
  comprimentoCaudaMm?: string;
  larguraOlhoMm?: string;
  totalMm?: string;
  plumagem?: string;
  unidade?: string;
  sincronizado?: boolean;
  criadoEm?: string;
  fotos?: { id: number; url: string; nomeArquivo?: string }[];
}

function emptyForm(): Partial<CampoRegistro> {
  return {
    grupoTaxonomico: "",
    data: new Date().toISOString().split("T")[0],
    horario: new Date().toTimeString().slice(0, 5),
    statusRegistro: "Confirmado",
  };
}

export default function CampoMonitoramento() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingRecord, setViewingRecord] = useState<CampoRegistro | null>(null);
  const [formTab, setFormTab] = useState("localizacao");
  const [form, setForm] = useState<Partial<CampoRegistro>>(emptyForm());
  const [search, setSearch] = useState("");
  const [filterGrupo, setFilterGrupo] = useState("todos");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pending = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
    setOfflineCount(pending.length);
    const handleOnline = () => { setIsOnline(true); autoSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const { data: empreendimentos = [] } = useQuery<any[]>({ queryKey: ["/api/empreendimentos"] });
  const { data: registros = [], isLoading } = useQuery<CampoRegistro[]>({
    queryKey: ["/api/campo"],
    queryFn: async () => {
      const res = await fetch("/api/campo", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar registros");
      return res.json();
    },
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/campo/stats/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/campo/stats/dashboard", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CampoRegistro>) => apiRequest("POST", "/api/campo", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      setShowForm(false);
      setForm(emptyForm());
      toast({ title: "Registro salvo com sucesso!" });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CampoRegistro> }) =>
      apiRequest("PUT", `/api/campo/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      toast({ title: "Registro atualizado!" });
    },
    onError: (err: any) => toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/campo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campo/stats/dashboard"] });
      toast({ title: "Registro excluído" });
    },
  });

  function setField(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function captureGPS() {
    if (!navigator.geolocation) {
      toast({ title: "GPS não disponível", description: "Este dispositivo não suporta geolocalização", variant: "destructive" });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setForm(prev => ({ ...prev, latitude: lat, longitude: lon }));
        setGpsLoading(false);
        toast({ title: "📍 Coordenadas capturadas!", description: `Lat: ${lat}, Lon: ${lon}` });
      },
      (err) => {
        setGpsLoading(false);
        toast({ title: "Erro no GPS", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function saveOffline(data: Partial<CampoRegistro>) {
    const pending = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
    pending.push({ ...data, _offlineId: Date.now(), sincronizado: false });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(pending));
    setOfflineCount(pending.length);
    setShowForm(false);
    setForm(emptyForm());
    toast({ title: "💾 Salvo localmente", description: "Será sincronizado quando houver internet" });
  }

  async function autoSync() {
    const pending = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
    if (pending.length === 0) return;
    try {
      const response = await fetch("/api/campo/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ registros: pending }),
      });
      if (response.ok) {
        const result = await response.json();
        localStorage.setItem(OFFLINE_KEY, "[]");
        setOfflineCount(0);
        queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
        toast({ title: `✅ ${result.synced} registros sincronizados!` });
      }
    } catch (err) { /* silent fail */ }
  }

  async function manualSync() {
    setIsSyncing(true);
    await autoSync();
    setIsSyncing(false);
  }

  function handleSubmit() {
    if (!form.grupoTaxonomico || !form.data) {
      toast({ title: "Preencha os campos obrigatórios", description: "Grupo Taxonômico e Data são obrigatórios", variant: "destructive" });
      return;
    }
    if (!isOnline) { saveOffline(form); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function openEdit(record: CampoRegistro) {
    setEditingId(record.id);
    setForm(record);
    setFormTab("localizacao");
    setShowForm(true);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setFormTab("localizacao");
    setShowForm(true);
  }

  async function uploadPhoto(registroId: number, file: File) {
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await fetch(`/api/campo/${registroId}/fotos`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("Falha no upload");
      queryClient.invalidateQueries({ queryKey: ["/api/campo"] });
      toast({ title: "Foto enviada com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally { setPhotoUploading(false); }
  }

  const filtered = registros.filter(r => {
    const matchGrupo = filterGrupo === "todos" || r.grupoTaxonomico === filterGrupo;
    const matchSearch = !search ||
      r.nomeCientifico?.toLowerCase().includes(search.toLowerCase()) ||
      r.nomeComum?.toLowerCase().includes(search.toLowerCase()) ||
      r.campanha?.toLowerCase().includes(search.toLowerCase());
    return matchGrupo && matchSearch;
  });

  const formTabs = [
    { key: "localizacao", label: "Localização" },
    { key: "taxonomia", label: "Taxonomia" },
    { key: "biologia", label: "Biologia" },
    { key: "conservacao", label: "Conservação" },
    { key: "biometria", label: "Biometria" },
    { key: "coleta", label: "Coleta" },
  ];
  const currentTabIdx = formTabs.findIndex(t => t.key === formTab);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🌿 Monitoramento de Campo</h1>
          <p className="text-sm text-muted-foreground">Coleta de dados biológicos com GPS e sincronização offline</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {offlineCount > 0 && (
            <Button variant="outline" onClick={manualSync} disabled={!isOnline || isSyncing} className="gap-2">
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              Sincronizar ({offlineCount})
            </Button>
          )}
          <Button onClick={openNew} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4" /> Novo Registro
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isOnline ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        {isOnline ? "Online — dados sincronizados automaticamente" : `Offline — ${offlineCount} registro(s) pendente(s) de sincronização`}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Registros</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Campanhas</p>
              <p className="text-3xl font-bold text-blue-600">{stats.totalCampanhas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Espécies</p>
              <p className="text-3xl font-bold text-purple-600">{stats.totalEspecies}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Grupos</p>
              <p className="text-3xl font-bold text-orange-600">{Object.keys(stats.byGrupo || {}).length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por espécie, nome comum, campanha..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterGrupo} onValueChange={setFilterGrupo}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Grupo taxonômico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            {Object.entries(GRUPO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registros ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando registros...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bird className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum registro encontrado</p>
              <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" /> Primeiro Registro
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ID</th>
                    <th className="px-4 py-3 text-left font-medium">Grupo</th>
                    <th className="px-4 py-3 text-left font-medium">Nome Científico</th>
                    <th className="px-4 py-3 text-left font-medium">Nome Comum</th>
                    <th className="px-4 py-3 text-left font-medium">Campanha</th>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">GPS</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const cfg = GRUPO_LABELS[r.grupoTaxonomico];
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{r.id}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${cfg?.color || "bg-gray-100 text-gray-800"}`}>
                            {cfg?.label || r.grupoTaxonomico}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 italic">{r.nomeCientifico || "—"}</td>
                        <td className="px-4 py-3">{r.nomeComum || "—"}</td>
                        <td className="px-4 py-3">{r.campanha || "—"}</td>
                        <td className="px-4 py-3">{r.data || "—"}</td>
                        <td className="px-4 py-3">
                          {r.latitude && r.longitude ? (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs">
                              <MapPin className="w-3 h-3" /> {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.statusRegistro ? (
                            <Badge variant="outline" className="text-xs">{r.statusRegistro}</Badge>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewingRecord(r)} title="Ver detalhes">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)} title="Editar">
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => {
                              if (confirm(`Excluir registro #${r.id}?`)) deleteMutation.mutate(r.id);
                            }} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg font-bold">
              {editingId ? `Editar Registro #${editingId}` : "Novo Registro de Campo"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Preencha as abas com os dados coletados em campo</p>
          </DialogHeader>

          {/* Tab Navigation */}
          <div className="px-6 pt-4">
            <div className="flex overflow-x-auto gap-1 pb-1">
              {formTabs.map((t, i) => (
                <button
                  key={t.key}
                  onClick={() => setFormTab(t.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${formTab === t.key ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {i + 1}. {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 pb-6 space-y-4">
            {/* === ABA 1: LOCALIZAÇÃO === */}
            {formTab === "localizacao" && (
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">GRUPO TAXONÔMICO *</Label>
                    <Select value={form.grupoTaxonomico || ""} onValueChange={v => setField("grupoTaxonomico", v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(GRUPO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">EMPREENDIMENTO</Label>
                    <Select value={form.empreendimentoId?.toString() || ""} onValueChange={v => setField("empreendimentoId", parseInt(v))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {empreendimentos.map((e: any) => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">CAMPANHA</Label>
                    <Input className="mt-1" value={form.campanha || ""} onChange={e => setField("campanha", e.target.value)} placeholder="Ex: Campanha 1 – Jan/2026" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">DATA *</Label>
                    <Input type="date" className="mt-1" value={form.data || ""} onChange={e => setField("data", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">HORÁRIO</Label>
                    <Input type="time" className="mt-1" value={form.horario || ""} onChange={e => setField("horario", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">PERÍODO</Label>
                    <Select value={form.periodo || ""} onValueChange={v => setField("periodo", v)}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{PERIODOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">UNIDADE AMOSTRAL</Label>
                    <Input className="mt-1" value={form.unidadeAmostral || ""} onChange={e => setField("unidadeAmostral", e.target.value)} placeholder="Ex: UA-01" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">ZONA UTM</Label>
                    <Input className="mt-1" value={form.zonaUtm || ""} onChange={e => setField("zonaUtm", e.target.value)} placeholder="Ex: 23S" />
                  </div>
                </div>
                {/* GPS */}
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-xs font-semibold text-emerald-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> COORDENADAS GPS
                    </Label>
                    <Button size="sm" variant="outline" onClick={captureGPS} disabled={gpsLoading} className="border-emerald-400 text-emerald-700 hover:bg-emerald-100 gap-2">
                      {gpsLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                      {gpsLoading ? "Capturando..." : "Capturar GPS"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">LATITUDE</Label>
                      <Input className="mt-1" value={form.latitude || ""} onChange={e => setField("latitude", e.target.value)} placeholder="-15.123456" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">LONGITUDE</Label>
                      <Input className="mt-1" value={form.longitude || ""} onChange={e => setField("longitude", e.target.value)} placeholder="-47.654321" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">CONDIÇÃO METEOROLÓGICA</Label>
                  <Select value={form.condicaoMeteorologica || ""} onValueChange={v => setField("condicaoMeteorologica", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{CONDICOES_MET.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* === ABA 2: TAXONOMIA === */}
            {formTab === "taxonomia" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {[
                  { field: "filo", label: "FILO" },
                  { field: "classe", label: "CLASSE" },
                  { field: "ordem", label: "ORDEM" },
                  { field: "familia", label: "FAMÍLIA" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                    <Input className="mt-1" value={(form as any)[field] || ""} onChange={e => setField(field, e.target.value)} />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">NOME CIENTÍFICO</Label>
                  <Input className="mt-1 italic" value={form.nomeCientifico || ""} onChange={e => setField("nomeCientifico", e.target.value)} placeholder="Genus species" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">NOME COMUM</Label>
                  <Input className="mt-1" value={form.nomeComum || ""} onChange={e => setField("nomeComum", e.target.value)} />
                </div>
              </div>
            )}

            {/* === ABA 3: BIOLOGIA === */}
            {formTab === "biologia" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">SEXO</Label>
                  <Select value={form.sexo || ""} onValueChange={v => setField("sexo", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SEXOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">IDADE / CLASSE ETÁRIA</Label>
                  <Select value={form.idade || ""} onValueChange={v => setField("idade", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{IDADES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">MÉTODO</Label>
                  <Input className="mt-1" value={form.metodo || ""} onChange={e => setField("metodo", e.target.value)} placeholder="Ex: Armadilha fotográfica, Ponto de escuta" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">MODO DE REGISTRO</Label>
                  <Input className="mt-1" value={form.modoRegistro || ""} onChange={e => setField("modoRegistro", e.target.value)} placeholder="Ex: Visual, Auditivo, Captura" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">NUMERAÇÃO LISTA (MACKINNON)</Label>
                  <Input className="mt-1" value={form.numeracaoLista || ""} onChange={e => setField("numeracaoLista", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">PONTO DE ESCUTA</Label>
                  <Input className="mt-1" value={form.pontoEscuta || ""} onChange={e => setField("pontoEscuta", e.target.value)} placeholder="Ex: PE-01" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">DURAÇÃO DA AMOSTRAGEM</Label>
                  <Input className="mt-1" value={form.duracaoAmostragem || ""} onChange={e => setField("duracaoAmostragem", e.target.value)} placeholder="Ex: 10 min, 2 h" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">DISTÂNCIA PERCORRIDA</Label>
                  <Input className="mt-1" value={form.distanciaPercorrida || ""} onChange={e => setField("distanciaPercorrida", e.target.value)} placeholder="Ex: 500 m" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">STATUS DO REGISTRO</Label>
                  <Select value={form.statusRegistro || ""} onValueChange={v => setField("statusRegistro", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{STATUS_REGISTRO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">ESTÁGIO REPRODUTIVO</Label>
                  <Input className="mt-1" value={form.estagioReprodutivo || ""} onChange={e => setField("estagioReprodutivo", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">AMBIENTE PREFERENCIAL</Label>
                  <Input className="mt-1" value={form.ambientePreferencial || ""} onChange={e => setField("ambientePreferencial", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">FITOFISIONOMIA</Label>
                  <Input className="mt-1" value={form.fitofisionomia || ""} onChange={e => setField("fitofisionomia", e.target.value)} placeholder="Ex: Cerrado sentido restrito, Mata Galeria" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">DESCRIÇÃO DO ESFORÇO</Label>
                  <Textarea className="mt-1" rows={2} value={form.descricaoEsforco || ""} onChange={e => setField("descricaoEsforco", e.target.value)} />
                </div>
              </div>
            )}

            {/* === ABA 4: CONSERVAÇÃO === */}
            {formTab === "conservacao" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">IUCN</Label>
                  <Select value={form.iucn || ""} onValueChange={v => setField("iucn", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>{IUCN_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">IBAMA / MMA</Label>
                  <Select value={form.ibamaMma || ""} onValueChange={v => setField("ibamaMma", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>{IBAMA_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">CITES</Label>
                  <Select value={form.cites || ""} onValueChange={v => setField("cites", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Apêndice" /></SelectTrigger>
                    <SelectContent>{CITES_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">LISTA ESTADUAL</Label>
                  <Input className="mt-1" value={form.listaEstadual || ""} onChange={e => setField("listaEstadual", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">PAN</Label>
                  <Input className="mt-1" value={form.pan || ""} onChange={e => setField("pan", e.target.value)} placeholder="Plano de Ação Nacional" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">RARIDADE</Label>
                  <Input className="mt-1" value={form.raridade || ""} onChange={e => setField("raridade", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">DISTRIBUIÇÃO</Label>
                  <Input className="mt-1" value={form.distribuicao || ""} onChange={e => setField("distribuicao", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">DIETA</Label>
                  <Input className="mt-1" value={form.dieta || ""} onChange={e => setField("dieta", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">HABITAT</Label>
                  <Input className="mt-1" value={form.habitat || ""} onChange={e => setField("habitat", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">USO DO HABITAT</Label>
                  <Input className="mt-1" value={form.usoHabitat || ""} onChange={e => setField("usoHabitat", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">SENSIBILIDADE</Label>
                  <Input className="mt-1" value={form.sensibilidade || ""} onChange={e => setField("sensibilidade", e.target.value)} placeholder="Alta / Média / Baixa" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">ENDEMISMO</Label>
                  <Input className="mt-1" value={form.endemismo || ""} onChange={e => setField("endemismo", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">LOCOMOÇÃO</Label>
                  <Input className="mt-1" value={form.locomocao || ""} onChange={e => setField("locomocao", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">MIGRAÇÃO</Label>
                  <Input className="mt-1" value={form.migracao || ""} onChange={e => setField("migracao", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">BIOINDICADOR</Label>
                  <Input className="mt-1" value={form.bioindicador || ""} onChange={e => setField("bioindicador", e.target.value)} />
                </div>
              </div>
            )}

            {/* === ABA 5: BIOMETRIA === */}
            {formTab === "biometria" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
                {[
                  { field: "pesoG", label: "PESO (g)" },
                  { field: "asaMm", label: "ASA (mm)" },
                  { field: "tarsoDireitoMm", label: "TARSO DIREITO (mm)" },
                  { field: "diametroTarsoMm", label: "DIÂMETRO DO TARSO (mm)" },
                  { field: "alturaBicoMm", label: "ALTURA DO BICO (mm)" },
                  { field: "comprimentoBicoMm", label: "COMPRIMENTO DO BICO (mm)" },
                  { field: "comprimentoCaudaMm", label: "COMPRIMENTO DA CAUDA (mm)" },
                  { field: "larguraOlhoMm", label: "LARGURA DO OLHO (mm)" },
                  { field: "totalMm", label: "TOTAL (mm)" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
                    <Input type="number" step="0.1" className="mt-1" value={(form as any)[field] || ""} onChange={e => setField(field, e.target.value)} />
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-3">
                  <Label className="text-xs font-semibold text-muted-foreground">PLUMAGEM</Label>
                  <Input className="mt-1" value={form.plumagem || ""} onChange={e => setField("plumagem", e.target.value)} />
                </div>
              </div>
            )}

            {/* === ABA 6: COLETA === */}
            {formTab === "coleta" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">NOME DO COLETOR</Label>
                  <Input className="mt-1" value={form.nomeColetor || ""} onChange={e => setField("nomeColetor", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">TIPO DA MARCAÇÃO</Label>
                  <Input className="mt-1" value={form.tipoMarcacao || ""} onChange={e => setField("tipoMarcacao", e.target.value)} placeholder="Ex: Anilha, Transponder" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">NÚMERO DA MARCAÇÃO</Label>
                  <Input className="mt-1" value={form.numeroMarcacao || ""} onChange={e => setField("numeroMarcacao", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">NÚMERO DE TOMBAMENTO</Label>
                  <Input className="mt-1" value={form.numeroTombamento || ""} onChange={e => setField("numeroTombamento", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">INSTITUIÇÃO DE TOMBAMENTO</Label>
                  <Input className="mt-1" value={form.instituicaoTombamento || ""} onChange={e => setField("instituicaoTombamento", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">OBSERVAÇÕES</Label>
                  <Textarea className="mt-1" rows={3} value={form.observacoes || ""} onChange={e => setField("observacoes", e.target.value)} />
                </div>

                {/* Photo capture — only when editing existing record */}
                {editingId && (
                  <div className="sm:col-span-2 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <Label className="text-xs font-semibold text-blue-800 flex items-center gap-2 mb-3">
                      <Camera className="w-4 h-4" /> FOTOS DO REGISTRO
                    </Label>
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const file of files) { await uploadPhoto(editingId, file); }
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-blue-400 text-blue-700 gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photoUploading}
                      >
                        {photoUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        {photoUploading ? "Enviando..." : "Tirar/Anexar Foto"}
                      </Button>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Em dispositivos móveis, abre a câmera automaticamente. No desktop, permite selecionar arquivos.
                    </p>
                  </div>
                )}
                {!editingId && (
                  <div className="sm:col-span-2 bg-muted/50 rounded-lg p-4 border border-dashed text-center text-sm text-muted-foreground">
                    <Camera className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Salve o registro primeiro, depois adicione fotos editando-o.
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => currentTabIdx > 0 && setFormTab(formTabs[currentTabIdx - 1].key)} disabled={currentTabIdx === 0}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <span className="text-xs text-muted-foreground">{currentTabIdx + 1} / {formTabs.length}</span>
              {currentTabIdx < formTabs.length - 1 ? (
                <Button variant="outline" onClick={() => setFormTab(formTabs[currentTabIdx + 1].key)}>
                  Próxima <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {!isOnline ? "Salvar Offline" : editingId ? "Atualizar" : "Salvar Registro"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Record Dialog */}
      {viewingRecord && (
        <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <Badge className={GRUPO_LABELS[viewingRecord.grupoTaxonomico]?.color || ""}>
                  {GRUPO_LABELS[viewingRecord.grupoTaxonomico]?.label || viewingRecord.grupoTaxonomico}
                </Badge>
                {viewingRecord.nomeCientifico ? <span className="italic">{viewingRecord.nomeCientifico}</span> : `Registro #${viewingRecord.id}`}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Nome Comum", viewingRecord.nomeComum],
                ["Campanha", viewingRecord.campanha],
                ["Data", viewingRecord.data],
                ["Horário", viewingRecord.horario],
                ["Período", viewingRecord.periodo],
                ["Unidade Amostral", viewingRecord.unidadeAmostral],
                ["Latitude", viewingRecord.latitude],
                ["Longitude", viewingRecord.longitude],
                ["Filo", viewingRecord.filo],
                ["Classe", viewingRecord.classe],
                ["Ordem", viewingRecord.ordem],
                ["Família", viewingRecord.familia],
                ["Sexo", viewingRecord.sexo],
                ["Idade", viewingRecord.idade],
                ["Método", viewingRecord.metodo],
                ["Modo de Registro", viewingRecord.modoRegistro],
                ["Status do Registro", viewingRecord.statusRegistro],
                ["Condição Meteorológica", viewingRecord.condicaoMeteorologica],
                ["IUCN", viewingRecord.iucn],
                ["IBAMA/MMA", viewingRecord.ibamaMma],
                ["CITES", viewingRecord.cites],
                ["Lista Estadual", viewingRecord.listaEstadual],
                ["PAN", viewingRecord.pan],
                ["Coletor", viewingRecord.nomeColetor],
                ["Peso (g)", viewingRecord.pesoG],
                ["Asa (mm)", viewingRecord.asaMm],
                ["Total (mm)", viewingRecord.totalMm],
                ["Plumagem", viewingRecord.plumagem],
                ["Número de Tombamento", viewingRecord.numeroTombamento],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="bg-muted/40 rounded p-2">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="font-medium mt-0.5">{value}</p>
                </div>
              ))}
              {viewingRecord.observacoes && (
                <div className="col-span-2 bg-muted/40 rounded p-2">
                  <p className="text-xs text-muted-foreground font-medium">Observações</p>
                  <p className="mt-0.5">{viewingRecord.observacoes}</p>
                </div>
              )}
            </div>
            {viewingRecord.fotos && viewingRecord.fotos.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">FOTOS</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {viewingRecord.fotos.map(f => (
                    <img key={f.id} src={f.url} alt={f.nomeArquivo || "foto"} className="rounded-lg object-cover w-full h-32" />
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
