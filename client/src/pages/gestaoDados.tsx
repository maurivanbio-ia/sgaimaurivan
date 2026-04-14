
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Download, Trash2, FileText, Database, XCircle, Eye, Edit, X, Loader2,
  ChevronDown, ChevronRight, BookOpen, Search, Shield, History, FolderOpen,
  FolderPlus, Plus, File, Building2, AlertTriangle, Clock, CheckCircle2,
  Sparkles, Link2, ListChecks, BarChart3, CalendarDays, Zap, FileSearch,
  AlertCircle, Info, BrainCircuit, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { Dataset, Empreendimento, User, DatasetPasta } from "@shared/schema";

// ─── Tipos e Constantes ────────────────────────────────────────────────────────

const TIPOS_DOCUMENTAIS = [
  { value: "licenca", label: "Licença Ambiental", icon: "📋" },
  { value: "notificacao", label: "Notificação", icon: "📢" },
  { value: "oficio", label: "Ofício", icon: "📨" },
  { value: "relatorio", label: "Relatório", icon: "📊" },
  { value: "parecer", label: "Parecer Técnico", icon: "🔍" },
  { value: "art", label: "ART", icon: "🔧" },
  { value: "mapa", label: "Mapa / Cartografia", icon: "🗺️" },
  { value: "documento_legal", label: "Documento Legal", icon: "⚖️" },
  { value: "condicionante", label: "Condicionante", icon: "📌" },
  { value: "outro", label: "Outro", icon: "📄" },
];

const STATUS_DOCUMENTAIS = [
  { value: "recebido", label: "Recebido", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "em_analise", label: "Em Análise", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "em_atendimento", label: "Em Atendimento", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "respondido", label: "Respondido", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "vencido", label: "Vencido", color: "bg-red-100 text-red-800 border-red-200" },
];

const VINCULOS_TIPOS = [
  { value: "resposta", label: "Resposta a documento" },
  { value: "complemento", label: "Complementação" },
  { value: "exigencia", label: "Exigência recebida" },
  { value: "gerando_obrigacao", label: "Gera obrigação" },
];

const DICIONARIO_SIGLAS = {
  DISC: [
    { sigla: "FAU", descricao: "Fauna" },
    { sigla: "FLO", descricao: "Flora" },
    { sigla: "HID", descricao: "Hidrologia" },
    { sigla: "QUI", descricao: "Química" },
    { sigla: "GEO", descricao: "Geologia/Geomorfologia" },
    { sigla: "SOC", descricao: "Socioeconomia" },
    { sigla: "SIG", descricao: "Geoprocessamento" },
    { sigla: "ENG", descricao: "Engenharia" },
    { sigla: "JUR", descricao: "Jurídico" },
    { sigla: "ESG", descricao: "ESG/Sustentabilidade" },
    { sigla: "GPR", descricao: "Gestão de Projetos" },
  ],
  DOC: [
    { sigla: "REL", descricao: "Relatório" },
    { sigla: "NT", descricao: "Nota Técnica" },
    { sigla: "OF", descricao: "Ofício" },
    { sigla: "MEM", descricao: "Memorial" },
    { sigla: "ATA", descricao: "Ata de Reunião" },
    { sigla: "APR", descricao: "Apresentação" },
    { sigla: "MAP", descricao: "Mapa" },
    { sigla: "DAT", descricao: "Banco de Dados" },
    { sigla: "MET", descricao: "Metodologia" },
    { sigla: "LAU", descricao: "Laudo" },
  ],
  ENTREGA: [
    { sigla: "D0", descricao: "Diagnóstico Inicial" },
    { sigla: "D1", descricao: "Primeira Entrega" },
    { sigla: "D2", descricao: "Segunda Entrega (Final)" },
    { sigla: "REV", descricao: "Revisão" },
    { sigla: "RES", descricao: "Resposta a Parecer" },
    { sigla: "PROT", descricao: "Protocolado" },
  ],
  STATUS: [
    { sigla: "RASC", descricao: "Rascunho" },
    { sigla: "PRELIM", descricao: "Preliminar" },
    { sigla: "FINAL", descricao: "Final" },
    { sigla: "ASSIN", descricao: "Assinado" },
    { sigla: "PROTOC", descricao: "Protocolado" },
    { sigla: "ENVIADO", descricao: "Enviado" },
    { sigla: "ARQ", descricao: "Arquivado" },
  ],
  CLASS: [
    { sigla: "PUB", descricao: "Público" },
    { sigla: "INT", descricao: "Interno" },
    { sigla: "CONF", descricao: "Confidencial" },
    { sigla: "LGPD", descricao: "Proteção de Dados" },
  ],
  UF: [
    { sigla: "AC", descricao: "Acre" }, { sigla: "AL", descricao: "Alagoas" },
    { sigla: "AP", descricao: "Amapá" }, { sigla: "AM", descricao: "Amazonas" },
    { sigla: "BA", descricao: "Bahia" }, { sigla: "CE", descricao: "Ceará" },
    { sigla: "DF", descricao: "Distrito Federal" }, { sigla: "ES", descricao: "Espírito Santo" },
    { sigla: "GO", descricao: "Goiás" }, { sigla: "MA", descricao: "Maranhão" },
    { sigla: "MT", descricao: "Mato Grosso" }, { sigla: "MS", descricao: "Mato Grosso do Sul" },
    { sigla: "MG", descricao: "Minas Gerais" }, { sigla: "PA", descricao: "Pará" },
    { sigla: "PB", descricao: "Paraíba" }, { sigla: "PR", descricao: "Paraná" },
    { sigla: "PE", descricao: "Pernambuco" }, { sigla: "PI", descricao: "Piauí" },
    { sigla: "RJ", descricao: "Rio de Janeiro" }, { sigla: "RN", descricao: "Rio Grande do Norte" },
    { sigla: "RS", descricao: "Rio Grande do Sul" }, { sigla: "RO", descricao: "Rondônia" },
    { sigla: "RR", descricao: "Roraima" }, { sigla: "SC", descricao: "Santa Catarina" },
    { sigla: "SP", descricao: "São Paulo" }, { sigla: "SE", descricao: "Sergipe" },
    { sigla: "TO", descricao: "Tocantins" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusDocumentalInfo(status: string | null) {
  return STATUS_DOCUMENTAIS.find(s => s.value === status) || STATUS_DOCUMENTAIS[0];
}

function getTipoDocumentalInfo(tipo: string | null) {
  return TIPOS_DOCUMENTAIS.find(t => t.value === tipo);
}

function getStatusBadge(status: string | null) {
  const colors: Record<string, string> = {
    RASC: "bg-gray-200 text-gray-800", PRELIM: "bg-yellow-200 text-yellow-800",
    FINAL: "bg-green-200 text-green-800", ASSIN: "bg-blue-200 text-blue-800",
    PROTOC: "bg-purple-200 text-purple-800", ENVIADO: "bg-teal-200 text-teal-800",
    ARQ: "bg-slate-200 text-slate-800",
  };
  return colors[status || ""] || "bg-gray-100 text-gray-600";
}

function getClassBadge(cls: string | null) {
  const colors: Record<string, string> = {
    PUB: "bg-green-100 text-green-700", INT: "bg-blue-100 text-blue-700",
    CONF: "bg-orange-100 text-orange-700", LGPD: "bg-red-100 text-red-700",
  };
  return colors[cls || ""] || "bg-gray-100 text-gray-600";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(d: any) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(d));
}

function diasParaVencer(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  const p = new Date(prazo);
  return Math.ceil((p.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function getRiscoColor(diffDays: number | null): string {
  if (diffDays === null) return "";
  if (diffDays < 0) return "text-red-700 bg-red-50 border-red-200";
  if (diffDays <= 7) return "text-red-600 bg-red-50 border-red-200";
  if (diffDays <= 15) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-yellow-600 bg-yellow-50 border-yellow-200";
}

// ─── Componente Principal ──────────────────────────────────────────────────────

type DatasetExt = Dataset & { empreendimentoNome?: string };

export default function GestaoDados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [demandaPendente, setDemandaPendente] = useState<{ id: number; titulo: string } | null>(null);
  const [activeTab, setActiveTab] = useState("documentos");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [filterTipoDocumental, setFilterTipoDocumental] = useState("all");
  const [filterStatusDocumental, setFilterStatusDocumental] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [groupByEmp, setGroupByEmp] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionarySearch, setDictionarySearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [timelineEmpFilter, setTimelineEmpFilter] = useState("all");

  // Upload dialog
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState("");
  const [useAdvancedForm, setUseAdvancedForm] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Upload form fields
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [cliente, setCliente] = useState("");
  const [uf, setUf] = useState("");
  const [projeto, setProjeto] = useState("");
  const [subprojeto, setSubprojeto] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [entrega, setEntrega] = useState("");
  const [area, setArea] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [status, setStatus] = useState("RASC");
  const [classificacao, setClassificacao] = useState("INT");
  const [titulo, setTitulo] = useState("");
  const [codigoPreview, setCodigoPreview] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");
  // Novos campos
  const [tipoDocumental, setTipoDocumental] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [orgaoEmissor, setOrgaoEmissor] = useState("");
  const [prazoAtendimento, setPrazoAtendimento] = useState("");
  const [statusDocumental, setStatusDocumental] = useState("recebido");
  const [documentoRelacionadoId, setDocumentoRelacionadoId] = useState("");
  const [vinculoTipo, setVinculoTipo] = useState("");
  const [exigencias, setExigencias] = useState("");
  const [resumoIA, setResumoIA] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [isExtractingIA, setIsExtractingIA] = useState(false);

  // Edit dialog
  const [editingDataset, setEditingDataset] = useState<DatasetExt | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFields, setEditFields] = useState<Partial<DatasetExt>>({});

  // Análise completa IA
  const [isAnalisandoIA, setIsAnalisandoIA] = useState(false);
  const [analiseCompletaResult, setAnaliseCompletaResult] = useState<any | null>(null);
  const [isAnaliseModalOpen, setIsAnaliseModalOpen] = useState(false);

  // Preview & History
  const [previewDataset, setPreviewDataset] = useState<DatasetExt | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDataset, setHistoryDataset] = useState<DatasetExt | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailDataset, setDetailDataset] = useState<DatasetExt | null>(null);

  // Folder management
  const [selectedPasta, setSelectedPasta] = useState<DatasetPasta | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentFolderId, setParentFolderId] = useState<number | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [folderPassword, setFolderPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "delete" | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Gerar demanda from exigência
  const [isGerarDemandaOpen, setIsGerarDemandaOpen] = useState(false);
  const [demandaDoc, setDemandaDoc] = useState<DatasetExt | null>(null);
  const [novaDemandaTitulo, setNovaDemandaTitulo] = useState("");
  const [novaDemandaPrazo, setNovaDemandaPrazo] = useState("");
  const [novaDemandaResponsavel, setNovaDemandaResponsavel] = useState("");

  // Demanda pendente
  useEffect(() => {
    const stored = localStorage.getItem("demandaPendenteConclusao");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.titulo) setDemandaPendente(parsed);
      } catch { localStorage.removeItem("demandaPendenteConclusao"); }
    }
  }, []);

  const concluirDemandaPendente = async () => {
    if (!demandaPendente) return;
    try {
      const res = await fetch(`/api/demandas/${demandaPendente.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) {
        toast({ title: "Demanda Concluída!", description: `"${demandaPendente.titulo}" concluída com sucesso.` });
        queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
        localStorage.removeItem("demandaPendenteConclusao");
        setDemandaPendente(null);
      }
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
  };

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: currentUser } = useQuery<User>({ queryKey: ["/api/auth/user"] });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar empreendimentos");
      return res.json();
    },
  });

  const { data: datasets = [], isLoading, refetch } = useQuery<DatasetExt[]>({
    queryKey: ["/api/datasets", { empreendimentoId: filterEmpreendimento }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      const res = await fetch(`/api/datasets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar arquivos");
      return res.json();
    },
  });

  const { data: alertas = [], isLoading: alertasLoading } = useQuery<any[]>({
    queryKey: ["/api/datasets/alertas"],
    queryFn: async () => {
      const res = await fetch("/api/datasets/alertas", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pastas = [], isLoading: pastasLoading, refetch: refetchPastas } = useQuery<DatasetPasta[]>({
    queryKey: ["/api/pastas"],
    queryFn: async () => {
      const res = await fetch("/api/pastas", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: selectedFolderFiles = [], refetch: refetchFolderFiles } = useQuery<Dataset[]>({
    queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"],
    queryFn: async () => {
      if (!selectedPasta?.id) return [];
      const res = await fetch(`/api/pastas/${selectedPasta.id}/arquivos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPasta?.id,
  });

  const { data: versoes = [] } = useQuery<any[]>({
    queryKey: ["/api/datasets", historyDataset?.id, "versoes"],
    queryFn: async () => {
      if (!historyDataset?.id) return [];
      const res = await fetch(`/api/datasets/${historyDataset.id}/versoes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!historyDataset?.id,
  });

  // ── Auto-inicializar pastas ───────────────────────────────────────────────────
  const [autoInitialized, setAutoInitialized] = useState(false);
  useEffect(() => {
    if (!pastasLoading && pastas.length === 0 && !autoInitialized) {
      setAutoInitialized(true);
      fetch("/api/datasets/estrutura/macro", { method: "POST", credentials: "include" })
        .then(res => { if (res.ok) queryClient.invalidateQueries({ queryKey: ["/api/pastas"] }); })
        .catch(console.error);
    }
  }, [pastasLoading, pastas.length, autoInitialized]);

  // ── Preview código ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (useAdvancedForm && (cliente || projeto || disciplina || tipoDocumento)) generateCodePreview();
  }, [cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, entrega, area, periodo, status, file]);

  const generateCodePreview = async () => {
    try {
      const extensao = file?.name?.split('.').pop() || '';
      const res = await fetch("/api/datasets/gerar-codigo", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, entrega, area, periodo, status, extensao, responsavel: currentUser?.email }),
      });
      if (res.ok) { const d = await res.json(); setCodigoPreview(d.codigo); setPastaDestino(d.pastaDestino); }
    } catch {}
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createFolderMutation = useMutation({
    mutationFn: async (data: { nome: string; paiId?: number | null; empreendimentoId?: number }) => {
      const res = await fetch("/api/pastas", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao criar pasta"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pastas"] }); refetchPastas(); toast({ title: "Pasta criada com sucesso!" }); setIsCreateFolderOpen(false); setNewFolderName(""); setParentFolderId(null); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (data: { id: number; senha: string }) => {
      const res = await fetch(`/api/pastas/${data.id}`, { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: data.senha }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao excluir pasta"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pastas"] }); refetchPastas(); if (selectedPasta) setSelectedPasta(null); toast({ title: "Pasta excluída com sucesso!" }); setIsPasswordDialogOpen(false); setFolderPassword(""); setPendingAction(null); setPendingDeleteId(null); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const createFileInFolderMutation = useMutation({
    mutationFn: async (data: { pastaId: number; nome: string; objectPath: string; tipo?: string; tamanho?: number; empreendimentoId: number }) => {
      const res = await fetch(`/api/pastas/${data.pastaId}/arquivos`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao registrar arquivo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"] }); queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetchFolderFiles(); refetch(); toast({ title: "Arquivo enviado e registrado!" }); if (demandaPendente) concluirDemandaPendente(); },
    onError: () => toast({ title: "Erro", description: "Falha ao registrar arquivo.", variant: "destructive" }),
  });

  const uploadAdvancedMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets/upload-avancado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetch(); toast({ title: "Documento enviado com código padronizado!" }); resetForm(); setIsUploadDialogOpen(false); setIsUploading(false); if (demandaPendente) concluirDemandaPendente(); },
    onError: () => { toast({ title: "Erro ao enviar documento", variant: "destructive" }); setIsUploading(false); },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetch(); toast({ title: "Arquivo enviado!" }); resetForm(); setIsUploadDialogOpen(false); setIsUploading(false); if (demandaPendente) concluirDemandaPendente(); },
    onError: () => { toast({ title: "Erro ao enviar", variant: "destructive" }); setIsUploading(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetch(); toast({ title: "Arquivo excluído!" }); },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao atualizar");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/datasets"] }); refetch(); toast({ title: "Documento atualizado!" }); setIsEditDialogOpen(false); setEditingDataset(null); },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const gerarDemandaMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/demandas", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Erro ao gerar demanda");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/demandas"] }); toast({ title: "Demanda criada com sucesso!", description: "A exigência foi convertida em tarefa no módulo de Demandas." }); setIsGerarDemandaOpen(false); setDemandaDoc(null); setNovaDemandaTitulo(""); setNovaDemandaPrazo(""); setNovaDemandaResponsavel(""); },
    onError: () => toast({ title: "Erro ao criar demanda", variant: "destructive" }),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setNome(""); setDescricao(""); setTipo(""); setFile(null);
    setSelectedEmpreendimento(""); setCliente(""); setUf(""); setProjeto("");
    setSubprojeto(""); setDisciplina(""); setTipoDocumento(""); setEntrega("");
    setArea(""); setPeriodo(""); setStatus("RASC"); setClassificacao("INT");
    setTitulo(""); setCodigoPreview(""); setPastaDestino("");
    setTipoDocumental(""); setNumeroDocumento(""); setOrgaoEmissor("");
    setPrazoAtendimento(""); setStatusDocumental("recebido"); setDataEmissao("");
    setDocumentoRelacionadoId(""); setVinculoTipo(""); setExigencias(""); setResumoIA("");
  };

  const handleUpload = () => {
    if (!selectedEmpreendimento || !file) {
      toast({ title: "Selecione o empreendimento e o arquivo.", variant: "destructive" }); return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base = {
        empreendimentoId: parseInt(selectedEmpreendimento),
        descricao, tipoDocumental, numeroDocumento, orgaoEmissor, prazoAtendimento,
        statusDocumental, documentoRelacionadoId: documentoRelacionadoId || null,
        vinculoTipo, exigencias, resumoIA, dataEmissao: dataEmissao || null,
      };
      if (useAdvancedForm) {
        uploadAdvancedMutation.mutate({
          ...base, nome: file.name, tipo: file.type || "outro", tamanho: file.size,
          url: reader.result as string, cliente, uf, projeto, subprojeto, disciplina,
          tipoDocumento, entrega, area, periodo, status, classificacao, titulo, pastaDestino,
        });
      } else {
        uploadMutation.mutate({
          ...base, empreendimentoId: parseInt(selectedEmpreendimento),
          nome: nome || file.name, tipo: tipo || "outro", tamanho: file.size,
          usuario: currentUser?.email || "Usuário", url: reader.result as string,
          dataUpload: new Date().toISOString(), pastaDestino,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtractIA = async () => {
    if (!file) { toast({ title: "Selecione um arquivo primeiro.", variant: "destructive" }); return; }
    setIsExtractingIA(true);
    try {
      let texto = "";
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/ai/upload-doc", { method: "POST", credentials: "include", body: formData });
        if (uploadRes.ok) { const d = await uploadRes.json(); texto = d.text || ""; }
      } else if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        texto = await file.text();
      }
      if (!texto) { toast({ title: "Não foi possível extrair texto do arquivo.", variant: "destructive" }); return; }
      const res = await fetch("/api/datasets/ai-extrair", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ texto, nomeArquivo: file.name }),
      });
      if (!res.ok) throw new Error("Erro na extração");
      const extracted = await res.json();
      if (extracted.tipoDocumental && extracted.tipoDocumental !== "null") setTipoDocumental(extracted.tipoDocumental);
      if (extracted.numeroDocumento && extracted.numeroDocumento !== "null") setNumeroDocumento(extracted.numeroDocumento);
      if (extracted.orgaoEmissor && extracted.orgaoEmissor !== "null") setOrgaoEmissor(extracted.orgaoEmissor);
      if (extracted.dataEmissao && extracted.dataEmissao !== "null") setDataEmissao(extracted.dataEmissao);
      if (extracted.prazoAtendimento && extracted.prazoAtendimento !== "null") setPrazoAtendimento(extracted.prazoAtendimento);
      if (extracted.exigencias && extracted.exigencias !== "null") setExigencias(extracted.exigencias);
      if (extracted.resumoIA) setResumoIA(extracted.resumoIA);
      toast({ title: "IA extraiu os metadados!", description: `Confiança: ${extracted.confianca || "—"}. Revise os campos preenchidos automaticamente.` });
    } catch (e: any) {
      toast({ title: "Erro na extração IA", description: e.message, variant: "destructive" });
    } finally { setIsExtractingIA(false); }
  };

  const handleEdit = (d: DatasetExt) => {
    setEditingDataset(d);
    setEditFields({
      nome: d.nome, descricao: d.descricao || "", titulo: d.titulo || "",
      status: d.status || "RASC", classificacao: d.classificacao || "INT",
      responsavel: d.responsavel || "",
      tipoDocumental: d.tipoDocumental || "", numeroDocumento: d.numeroDocumento || "",
      orgaoEmissor: d.orgaoEmissor || "", prazoAtendimento: d.prazoAtendimento || "",
      dataEmissao: (d as any).dataEmissao || "",
      statusDocumental: d.statusDocumental || "recebido", vinculoTipo: d.vinculoTipo || "",
      exigencias: d.exigencias || "", resumoIA: d.resumoIA || "",
      documentoRelacionadoId: d.documentoRelacionadoId || undefined,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingDataset) return;
    editMutation.mutate({ id: editingDataset.id, data: editFields });
  };

  const handleAnalisarIACompleta = async () => {
    if (!editingDataset) return;
    setIsAnalisandoIA(true);
    try {
      const res = await fetch(`/api/datasets/${editingDataset.id}/ai-analise`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      });
      if (!res.ok) {
        let errMsg = "Falha na análise por IA.";
        try {
          const body = await res.json();
          errMsg = body.error || errMsg;
        } catch {
          try { errMsg = (await res.text()).slice(0, 200) || errMsg; } catch { /* noop */ }
        }
        toast({ title: "Erro na análise IA", description: errMsg, variant: "destructive" });
        return;
      }
      const result = await res.json();
      // Preencher automaticamente os campos do formulário de edição
      setEditFields(prev => ({
        ...prev,
        tipoDocumental: result.tipoDocumental || prev.tipoDocumental,
        titulo: result.titulo || prev.titulo,
        numeroDocumento: result.numeroDocumento || prev.numeroDocumento,
        orgaoEmissor: result.orgaoEmissor || prev.orgaoEmissor,
        dataEmissao: result.dataEmissao || (prev as any).dataEmissao,
        prazoAtendimento: result.prazoAtendimento || prev.prazoAtendimento,
        exigencias: result.exigencias || prev.exigencias,
        resumoIA: result.resumoIA || prev.resumoIA,
      }));
      setAnaliseCompletaResult(result.analiseCompleta || result);
      setIsAnaliseModalOpen(true);
      toast({
        title: "Análise completa concluída!",
        description: `Campos preenchidos automaticamente. Confiança: ${result.confianca || "—"}. Confira o relatório completo.`,
      });
    } catch (e: any) {
      toast({ title: "Erro de conexão", description: e.message, variant: "destructive" });
    } finally {
      setIsAnalisandoIA(false);
    }
  };

  const handleGerarDemanda = (d: DatasetExt) => {
    setDemandaDoc(d);
    setNovaDemandaTitulo(d.exigencias ? `Atender exigência: ${d.codigoArquivo || d.nome}` : `Atender documento: ${d.codigoArquivo || d.nome}`);
    setNovaDemandaPrazo(d.prazoAtendimento || "");
    setNovaDemandaResponsavel(d.responsavel || "");
    setIsGerarDemandaOpen(true);
  };

  const handleSubmitGerarDemanda = () => {
    if (!demandaDoc || !novaDemandaTitulo) return;
    gerarDemandaMutation.mutate({
      titulo: novaDemandaTitulo,
      descricao: `Gerado automaticamente a partir do documento ${demandaDoc.codigoArquivo || demandaDoc.nome}.\n\nExigências:\n${demandaDoc.exigencias || "Ver documento original."}`,
      prazo: novaDemandaPrazo || null,
      responsavel: novaDemandaResponsavel || null,
      status: "pendente", prioridade: "alta",
      empreendimentoId: demandaDoc.empreendimentoId,
    });
  };

  const handleDownload = (d: DatasetExt) => {
    const link = document.createElement("a");
    link.href = d.url; link.download = d.nome;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const getUploadParameters = async () => {
    const res = await fetch("/api/object-storage/upload-url", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ fileName: `folder_${selectedPasta?.id}_${Date.now()}`, directory: ".private" }),
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    const data = await res.json();
    return { method: "PUT" as const, url: data.uploadUrl, filePath: data.filePath };
  };

  const handleFileUploadComplete = (result: { uploadURL: string; filePath?: string }, fileName: string, fileSize: number) => {
    if (!selectedPasta || !selectedEmpreendimento) { toast({ title: "Selecione pasta e empreendimento primeiro.", variant: "destructive" }); return; }
    createFileInFolderMutation.mutate({ pastaId: selectedPasta.id, nome: fileName, objectPath: result.filePath || "", tamanho: fileSize, empreendimentoId: parseInt(selectedEmpreendimento) });
  };

  // ── Filtros ───────────────────────────────────────────────────────────────────

  const filteredDatasets = datasets.filter(d => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || (d.nome?.toLowerCase().includes(q)) || (d.codigoArquivo?.toLowerCase().includes(q)) || (d.titulo?.toLowerCase().includes(q)) || (d.numeroDocumento?.toLowerCase().includes(q)) || (d.orgaoEmissor?.toLowerCase().includes(q)) || (d.responsavel?.toLowerCase().includes(q));
    const matchEmp = filterEmpreendimento === "all" || String(d.empreendimentoId) === filterEmpreendimento;
    const matchTipoDoc = filterTipoDocumental === "all" || d.tipoDocumental === filterTipoDocumental;
    const matchStatusDoc = filterStatusDocumental === "all" || d.statusDocumental === filterStatusDocumental;
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchEmp && matchTipoDoc && matchStatusDoc && matchStatus;
  });

  const buildFolderSelectOptions = () => {
    const options: { value: string; label: string; depth: number }[] = [];
    const addFolderWithChildren = (folder: DatasetPasta, depth: number) => {
      const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(depth);
      options.push({ value: folder.caminho, label: `${indent}${depth > 0 ? "└─ " : ""}${folder.nome}`, depth });
      pastas.filter(p => p.paiId === folder.id).sort((a, b) => a.nome.localeCompare(b.nome)).forEach(c => addFolderWithChildren(c, depth + 1));
    };
    pastas.filter(p => !p.paiId).sort((a, b) => a.nome.localeCompare(b.nome)).forEach(f => addFolderWithChildren(f, 0));
    return options;
  };
  const folderSelectOptions = buildFolderSelectOptions();

  // ── KPIs ──────────────────────────────────────────────────────────────────────

  const kpis = {
    total: datasets.length,
    vencidos: datasets.filter(d => { const dias = diasParaVencer(d.prazoAtendimento); return dias !== null && dias < 0; }).length,
    proximos: datasets.filter(d => { const dias = diasParaVencer(d.prazoAtendimento); return dias !== null && dias >= 0 && dias <= 30; }).length,
    sem_responsavel: datasets.filter(d => !d.responsavel).length,
    concluidos: datasets.filter(d => d.statusDocumental === "concluido").length,
  };

  // ── Filtro de dicionário ──────────────────────────────────────────────────────

  const filteredDictionary = Object.entries(DICIONARIO_SIGLAS).map(([category, items]) => ({
    category,
    items: items.filter(item => dictionarySearch === "" || item.sigla.toLowerCase().includes(dictionarySearch.toLowerCase()) || item.descricao.toLowerCase().includes(dictionarySearch.toLowerCase())),
  })).filter(cat => cat.items.length > 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SensitivePageWrapper moduleName="Gestão de Dados" bypassRoles={["admin", "diretor", "coordenador", "rh"]}>
      <div className="container mx-auto p-6 space-y-6">

        {/* Banner de Demanda Pendente */}
        {demandaPendente && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 rounded-full p-2"><FileText className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="font-medium text-amber-800">Demanda aguardando conclusão</p>
                <p className="text-sm text-amber-700">"{demandaPendente.titulo}" será concluída automaticamente após salvar o documento.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={concluirDemandaPendente} className="text-green-600 border-green-200">Concluir agora</Button>
              <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("demandaPendenteConclusao"); setDemandaPendente(null); }} className="text-amber-600">
                <X className="h-4 w-4 mr-1" />Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Database className="h-8 w-8 text-primary" />
              Gestão de Dados
            </h1>
            <p className="text-muted-foreground mt-1">Núcleo inteligente de gestão documental ambiental ECOBRASIL</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Enviar Documento
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-primary">{kpis.total}</div>
              <div className="text-xs text-muted-foreground">Total de Documentos</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-red-600">{kpis.vencidos}</div>
              <div className="text-xs text-muted-foreground">Prazo Vencido</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-400">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-orange-600">{kpis.proximos}</div>
              <div className="text-xs text-muted-foreground">Próximos 30 dias</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-400">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-yellow-700">{kpis.sem_responsavel}</div>
              <div className="text-xs text-muted-foreground">Sem Responsável</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="py-3 px-4">
              <div className="text-2xl font-bold text-green-600">{kpis.concluidos}</div>
              <div className="text-xs text-muted-foreground">Concluídos</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="documentos" className="gap-2"><FileText className="h-4 w-4" />Documentos</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2"><CalendarDays className="h-4 w-4" />Cronologia do Documento</TabsTrigger>
            <TabsTrigger value="insercao" className="gap-2"><Upload className="h-4 w-4" />Cronologia de Inserção</TabsTrigger>
            <TabsTrigger value="alertas" className="gap-2">
              <AlertCircle className="h-4 w-4" />Alertas & Risco
              {alertas.length > 0 && <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5">{alertas.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Documentos ─────────────────────────────────────────────── */}
          <TabsContent value="documentos" className="space-y-4">
            {/* Dicionário */}
            <Collapsible open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Dicionário de Siglas
                      {isDictionaryOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="mb-4"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar sigla..." value={dictionarySearch} onChange={e => setDictionarySearch(e.target.value)} className="pl-10" /></div></div>
                    <ScrollArea className="h-[250px]"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredDictionary.map(({ category, items }) => (<div key={category} className="space-y-1"><h4 className="font-semibold text-sm text-primary">{category}</h4>{items.map(item => (<div key={item.sigla} className="text-sm flex gap-2"><Badge variant="outline" className="font-mono">{item.sigla}</Badge><span className="text-muted-foreground">{item.descricao}</span></div>))}</div>))}</div></ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Busca e Filtros */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome, código, número, órgão, responsável..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsFiltersOpen(!isFiltersOpen)}>
                      <ListChecks className="h-4 w-4 mr-1" />Filtros {isFiltersOpen ? <ChevronDown className="h-3 w-3 ml-1" /> : <ChevronRight className="h-3 w-3 ml-1" />}
                    </Button>
                    {(filterEmpreendimento !== "all" || filterTipoDocumental !== "all" || filterStatusDocumental !== "all" || filterStatus !== "all" || searchQuery) && (
                      <Button variant="ghost" size="sm" onClick={() => { setFilterEmpreendimento("all"); setFilterTipoDocumental("all"); setFilterStatusDocumental("all"); setFilterStatus("all"); setSearchQuery(""); }}>
                        <XCircle className="h-4 w-4 mr-1" />Limpar
                      </Button>
                    )}
                  </div>
                </div>
                {isFiltersOpen && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
                    <div>
                      <Label className="text-xs">Empreendimento</Label>
                      <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo Documental</Label>
                      <Select value={filterTipoDocumental} onValueChange={setFilterTipoDocumental}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{TIPOS_DOCUMENTAIS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status Documental</Label>
                      <Select value={filterStatusDocumental} onValueChange={setFilterStatusDocumental}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{STATUS_DOCUMENTAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status do Arquivo</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Todos</SelectItem>{DICIONARIO_SIGLAS.STATUS.map(s => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardHeader>
            </Card>

            {/* Tabela de Documentos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle>Documentos Cadastrados</CardTitle>
                  <CardDescription>{filteredDatasets.length} documento(s) encontrado(s)</CardDescription>
                </div>
                <Button variant={groupByEmp ? "default" : "outline"} size="sm" onClick={() => setGroupByEmp(p => !p)} className="gap-2">
                  <Building2 className="h-4 w-4" />{groupByEmp ? "Agrupado" : "Por Empreendimento"}
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />Carregando...</div>
                ) : filteredDatasets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />Nenhum documento encontrado.</div>
                ) : groupByEmp ? (
                  <DocumentosGrouped datasets={filteredDatasets} onPreview={d => { setPreviewDataset(d); setIsPreviewOpen(true); }} onHistory={d => { setHistoryDataset(d); setIsHistoryOpen(true); }} onEdit={handleEdit} onDownload={handleDownload} onDelete={id => deleteMutation.mutate(id)} onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }} onGerarDemanda={handleGerarDemanda} />
                ) : (
                  <DocumentosTable datasets={filteredDatasets} onPreview={d => { setPreviewDataset(d); setIsPreviewOpen(true); }} onHistory={d => { setHistoryDataset(d); setIsHistoryOpen(true); }} onEdit={handleEdit} onDownload={handleDownload} onDelete={id => deleteMutation.mutate(id)} onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }} onGerarDemanda={handleGerarDemanda} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Timeline (Data do Documento) ───────────────────────────── */}
          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Cronologia de Datas dos Documentos</CardTitle>
                  <CardDescription className="mt-1">Escala temporal pela data exata de emissão/assinatura de cada documento</CardDescription>
                </div>
                <Select value={timelineEmpFilter} onValueChange={setTimelineEmpFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os empreendimentos" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <TimelineView
                  modo="documento"
                  datasets={datasets.filter(d => timelineEmpFilter === "all" || String(d.empreendimentoId) === timelineEmpFilter)}
                  empreendimentos={empreendimentos}
                  onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Cronologia de Inserção ──────────────────────────────────── */}
          <TabsContent value="insercao" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600" />Cronologia de Inserção na Plataforma</CardTitle>
                  <CardDescription className="mt-1">Escala temporal pela data em que cada arquivo foi cadastrado no sistema</CardDescription>
                </div>
                <Select value={timelineEmpFilter} onValueChange={setTimelineEmpFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os empreendimentos" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <TimelineView
                  modo="upload"
                  datasets={datasets.filter(d => timelineEmpFilter === "all" || String(d.empreendimentoId) === timelineEmpFilter)}
                  empreendimentos={empreendimentos}
                  onDetail={d => { setDetailDataset(d); setIsDetailOpen(true); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Alertas ─────────────────────────────────────────────────── */}
          <TabsContent value="alertas" className="space-y-4">
            <AlertasPanel alertas={alertas} isLoading={alertasLoading} onDetail={(id) => {
              const doc = datasets.find(d => d.id === id);
              if (doc) { setDetailDataset(doc); setIsDetailOpen(true); }
            }} onGerarDemanda={(id) => {
              const doc = datasets.find(d => d.id === id);
              if (doc) handleGerarDemanda(doc);
            }} />
          </TabsContent>
        </Tabs>

        {/* Rodapé normativo */}
        <Card className="bg-muted/30 border-t-4 border-t-primary">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sistema de gestão de dados e documentos da EcoBrasil Consultoria Ambiental, estruturado com base nas normas:
                <strong> ISO 15489</strong>, <strong>ABNT NBR ISO 30301</strong>, <strong>ISO 9001</strong>, <strong>ISO 14001</strong>,
                <strong> ISO/IEC 27001</strong>, <strong>ISO 21502</strong>, <strong>ISO 31000</strong>, <strong>Princípios FAIR</strong>, <strong>LGPD (Lei nº 13.709/2018)</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Dialog Upload ──────────────────────────────────────────────────── */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Upload de Documento</DialogTitle>
              <DialogDescription>Preencha os metadados ou use a IA para extração automática.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Modo avançado toggle */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="useAdvanced" checked={useAdvancedForm} onChange={e => setUseAdvancedForm(e.target.checked)} className="rounded" />
                <Label htmlFor="useAdvanced" className="cursor-pointer">Usar formulário avançado com código padronizado</Label>
              </div>

              {/* Empreendimento */}
              <div>
                <Label>Empreendimento *</Label>
                <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
                  <SelectTrigger><SelectValue placeholder="Selecione o empreendimento" /></SelectTrigger>
                  <SelectContent>{empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Arquivo + botão IA */}
              <div>
                <Label>Arquivo *</Label>
                <div className="flex gap-2">
                  <Input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar,.gpkg,.shp,.geojson,.qgz,.py,.r,.R,.sql,.ipynb" onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1" />
                  <Button type="button" variant="outline" size="sm" disabled={!file || isExtractingIA} onClick={handleExtractIA} title="Extrair metadados com IA">
                    {isExtractingIA ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                    <span className="ml-1 hidden sm:inline">IA</span>
                  </Button>
                </div>
                {file && <p className="text-xs text-muted-foreground mt-1">Arquivo: {file.name} • Clique em "IA" para extração automática de metadados (PDF/TXT)</p>}
              </div>

              {/* Seção de campos estruturados */}
              <div className="border rounded-lg p-4 space-y-3 bg-blue-50/30">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-800"><ListChecks className="h-4 w-4" />Campos Estruturados de Gestão Documental</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo Documental</Label>
                    <Select value={tipoDocumental} onValueChange={setTipoDocumental}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{TIPOS_DOCUMENTAIS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Número do Documento</Label>
                    <Input className="h-8" value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} placeholder="Ex: NOT-001/2025" />
                  </div>
                  <div>
                    <Label className="text-xs">Órgão Emissor</Label>
                    <Input className="h-8" value={orgaoEmissor} onChange={e => setOrgaoEmissor(e.target.value)} placeholder="Ex: INEMA, IBAMA, SEMA" />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      Data do Documento
                      <span className="text-muted-foreground font-normal">(emissão/assinatura)</span>
                    </Label>
                    <Input type="date" className="h-8" value={dataEmissao} onChange={e => setDataEmissao(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Prazo de Atendimento</Label>
                    <Input type="date" className="h-8" value={prazoAtendimento} onChange={e => setPrazoAtendimento(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Status Documental</Label>
                    <Select value={statusDocumental} onValueChange={setStatusDocumental}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_DOCUMENTAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Documento Relacionado</Label>
                    <Select value={documentoRelacionadoId} onValueChange={setDocumentoRelacionadoId}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                      <SelectContent><SelectItem value="">Nenhum</SelectItem>{datasets.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.codigoArquivo || d.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {documentoRelacionadoId && (
                    <div className="col-span-2">
                      <Label className="text-xs">Tipo de Vínculo</Label>
                      <Select value={vinculoTipo} onValueChange={setVinculoTipo}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Como este documento se relaciona?" /></SelectTrigger>
                        <SelectContent>{VINCULOS_TIPOS.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Exigências Identificadas</Label>
                  <Textarea value={exigencias} onChange={e => setExigencias(e.target.value)} placeholder="Descreva as exigências ou obrigações do documento..." rows={2} className="text-sm" />
                </div>
                {resumoIA && (
                  <div className="bg-purple-50 border border-purple-200 rounded p-2">
                    <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />Resumo gerado pela IA:</p>
                    <p className="text-xs text-purple-800">{resumoIA}</p>
                  </div>
                )}
              </div>

              {/* Campos avançados de codificação */}
              {useAdvancedForm ? (
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><Database className="h-4 w-4" />Código Padronizado ECOBRASIL</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Cliente *</Label><Input className="h-8" value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" /></div>
                    <div>
                      <Label className="text-xs">UF *</Label>
                      <Select value={uf} onValueChange={setUf}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Estado" /></SelectTrigger>
                        <SelectContent>{DICIONARIO_SIGLAS.UF.map(u => <SelectItem key={u.sigla} value={u.sigla}>{u.sigla} - {u.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Projeto *</Label><Input className="h-8" value={projeto} onChange={e => setProjeto(e.target.value)} placeholder="Nome do projeto" /></div>
                    <div><Label className="text-xs">Subprojeto</Label><Input className="h-8" value={subprojeto} onChange={e => setSubprojeto(e.target.value)} placeholder="Opcional" /></div>
                    <div>
                      <Label className="text-xs">Disciplina *</Label>
                      <Select value={disciplina} onValueChange={setDisciplina}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{DICIONARIO_SIGLAS.DISC.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} - {d.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo de Documento *</Label>
                      <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{DICIONARIO_SIGLAS.DOC.map(d => <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} - {d.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Entrega *</Label>
                      <Select value={entrega} onValueChange={setEntrega}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{DICIONARIO_SIGLAS.ENTREGA.map(e => <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} - {e.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status *</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{DICIONARIO_SIGLAS.STATUS.map(s => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Área</Label><Input className="h-8" value={area} onChange={e => setArea(e.target.value)} placeholder="Opcional" /></div>
                    <div><Label className="text-xs">Período</Label><Input className="h-8" value={periodo} onChange={e => setPeriodo(e.target.value)} placeholder="Ex: CHEIA2025" /></div>
                    <div>
                      <Label className="text-xs">Classificação</Label>
                      <Select value={classificacao} onValueChange={setClassificacao}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{DICIONARIO_SIGLAS.CLASS.map(c => <SelectItem key={c.sigla} value={c.sigla}>{c.sigla} - {c.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Título Curto</Label><Input className="h-8" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Opcional" /></div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do arquivo" /></div>
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent><SelectItem value="planilha">Planilha</SelectItem><SelectItem value="relatorio">Relatório</SelectItem><SelectItem value="documento">Documento</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional" /></div>

              {/* Pasta destino */}
              <div>
                <Label>Pasta Destino *</Label>
                <Select value={pastaDestino} onValueChange={setPastaDestino}>
                  <SelectTrigger><SelectValue placeholder="Selecione a pasta de destino" /></SelectTrigger>
                  <SelectContent className="max-h-[250px]">{folderSelectOptions.map((opt, i) => <SelectItem key={i} value={opt.value} className="font-mono text-xs">{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {useAdvancedForm && codigoPreview && (
                <div className="bg-muted p-3 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 text-primary" />Preview do Código:</div>
                  <code className="block text-xs bg-background p-2 rounded border break-all">{codigoPreview}</code>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><FolderOpen className="h-3 w-3" />Destino: <span className="font-mono">{pastaDestino}</span></div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleUpload} disabled={isUploading || uploadAdvancedMutation.isPending || uploadMutation.isPending}>
                  {(isUploading || uploadAdvancedMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isUploading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Edit ────────────────────────────────────────────────────── */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[750px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" />Editar Documento</DialogTitle>
              <DialogDescription className="font-mono text-xs">{editingDataset?.codigoArquivo || editingDataset?.nome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">

              {/* Botão de Análise Completa com IA — destaque */}
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-violet-100 rounded-full p-2 flex-shrink-0">
                    <BrainCircuit className="h-5 w-5 text-violet-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-violet-900 text-sm">Análise Completa com IA</p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      Extrai automaticamente: tipo, número, órgão, datas, exigências, base legal, riscos e plano de ação do documento.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAnalisarIACompleta}
                  disabled={isAnalisandoIA}
                  className="bg-violet-600 hover:bg-violet-700 text-white gap-2 flex-shrink-0"
                >
                  {isAnalisandoIA
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Analisando...</>
                    : <><Sparkles className="h-4 w-4" />Analisar com IA</>
                  }
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome</Label><Input className="h-8" value={editFields.nome || ""} onChange={e => setEditFields(p => ({ ...p, nome: e.target.value }))} /></div>
                <div><Label className="text-xs">Título</Label><Input className="h-8" value={editFields.titulo || ""} onChange={e => setEditFields(p => ({ ...p, titulo: e.target.value }))} /></div>
              </div>
              <div className="border rounded-lg p-3 space-y-3 bg-blue-50/30">
                <h4 className="text-sm font-semibold text-blue-800">Campos Estruturados</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo Documental</Label>
                    <Select value={editFields.tipoDocumental || ""} onValueChange={v => setEditFields(p => ({ ...p, tipoDocumental: v }))}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{TIPOS_DOCUMENTAIS.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Número do Documento</Label><Input className="h-8" value={editFields.numeroDocumento || ""} onChange={e => setEditFields(p => ({ ...p, numeroDocumento: e.target.value }))} /></div>
                  <div><Label className="text-xs">Órgão Emissor</Label><Input className="h-8" value={editFields.orgaoEmissor || ""} onChange={e => setEditFields(p => ({ ...p, orgaoEmissor: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">Data do Documento <span className="text-muted-foreground font-normal">(emissão)</span></Label>
                    <Input type="date" className="h-8" value={(editFields as any).dataEmissao || ""} onChange={e => setEditFields(p => ({ ...p, dataEmissao: e.target.value }))} />
                  </div>
                  <div><Label className="text-xs">Prazo de Atendimento</Label><Input type="date" className="h-8" value={editFields.prazoAtendimento || ""} onChange={e => setEditFields(p => ({ ...p, prazoAtendimento: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs">Status Documental</Label>
                    <Select value={editFields.statusDocumental || "recebido"} onValueChange={v => setEditFields(p => ({ ...p, statusDocumental: v }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_DOCUMENTAIS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Responsável</Label><Input className="h-8" value={editFields.responsavel || ""} onChange={e => setEditFields(p => ({ ...p, responsavel: e.target.value }))} /></div>
                </div>
                <div><Label className="text-xs">Exigências</Label><Textarea value={editFields.exigencias || ""} onChange={e => setEditFields(p => ({ ...p, exigencias: e.target.value }))} rows={2} className="text-xs" /></div>
                <div><Label className="text-xs">Resumo / Observações</Label><Textarea value={editFields.resumoIA || ""} onChange={e => setEditFields(p => ({ ...p, resumoIA: e.target.value }))} rows={2} className="text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Status do Arquivo</Label>
                  <Select value={editFields.status || "RASC"} onValueChange={v => setEditFields(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{DICIONARIO_SIGLAS.STATUS.map(s => <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Classificação</Label>
                  <Select value={editFields.classificacao || "INT"} onValueChange={v => setEditFields(p => ({ ...p, classificacao: v }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{DICIONARIO_SIGLAS.CLASS.map(c => <SelectItem key={c.sigla} value={c.sigla}>{c.sigla} - {c.descricao}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Descrição</Label><Textarea value={editFields.descricao || ""} onChange={e => setEditFields(p => ({ ...p, descricao: e.target.value }))} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Modal Análise Completa IA ──────────────────────────────────────── */}
        <Dialog open={isAnaliseModalOpen} onOpenChange={setIsAnaliseModalOpen}>
          <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-violet-600" />
                Relatório de Análise Documental — IA
              </DialogTitle>
              <DialogDescription>
                Análise completa e exaustiva realizada pelo Gemini. Campos do documento foram preenchidos automaticamente.
              </DialogDescription>
            </DialogHeader>
            {analiseCompletaResult && (
              <div className="space-y-5 text-sm">

                {/* Ficha Técnica */}
                {analiseCompletaResult.fichaTecnica && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-3 text-violet-800">
                      <FileText className="h-4 w-4" />Ficha Técnica do Documento
                    </h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-violet-50 rounded-lg p-4 border border-violet-100">
                      {Object.entries(analiseCompletaResult.fichaTecnica).map(([k, v]) => v && v !== "null" ? (
                        <div key={k}>
                          <span className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                          <p className="font-medium text-sm">{String(v)}</p>
                        </div>
                      ) : null)}
                    </div>
                  </section>
                )}

                {/* Resumo Executivo */}
                {analiseCompletaResult.resumoExecutivo && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-blue-800">
                      <Info className="h-4 w-4" />Resumo Executivo
                    </h3>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{analiseCompletaResult.resumoExecutivo}</p>
                    </div>
                  </section>
                )}

                {/* Exigências */}
                {analiseCompletaResult.exigencias?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-3 text-orange-800">
                      <AlertTriangle className="h-4 w-4" />Exigências, Obrigações e Condicionantes
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200">{analiseCompletaResult.exigencias.length}</Badge>
                    </h3>
                    <div className="space-y-3">
                      {analiseCompletaResult.exigencias.map((ex: any, i: number) => (
                        <div key={i} className={`border rounded-lg p-3 ${ex.prioridade === "alta" ? "border-red-200 bg-red-50" : ex.prioridade === "media" ? "border-orange-200 bg-orange-50" : "border-yellow-200 bg-yellow-50"}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-sm flex-1">{i + 1}. {ex.descricao}</p>
                            <Badge className={`text-xs flex-shrink-0 ${ex.prioridade === "alta" ? "bg-red-100 text-red-800" : ex.prioridade === "media" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {ex.prioridade}
                            </Badge>
                          </div>
                          {ex.trechoOriginal && <blockquote className="border-l-2 border-gray-300 pl-2 text-xs text-muted-foreground italic mt-1">{ex.trechoOriginal}</blockquote>}
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            {ex.dataLimite && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Prazo: {ex.dataLimite}</span>}
                            {ex.responsavelSugerido && <span>Resp: {ex.responsavelSugerido}</span>}
                          </div>
                          {ex.riscoNaoAtendimento && (
                            <p className="text-xs text-red-700 mt-1 flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />Risco: {ex.riscoNaoAtendimento}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Documentos Relacionados */}
                {analiseCompletaResult.documentosRelacionados?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-teal-800">
                      <Link2 className="h-4 w-4" />Documentos Relacionados
                    </h3>
                    <div className="space-y-2">
                      {analiseCompletaResult.documentosRelacionados.map((doc: any, i: number) => (
                        <div key={i} className="border border-teal-200 bg-teal-50 rounded-lg p-3">
                          <p className="font-medium text-sm">{doc.identificacao}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{doc.relacaoLogica}</p>
                          <Badge variant="outline" className="text-xs mt-1">{doc.tipo?.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Linha do Tempo */}
                {analiseCompletaResult.linhaDoTempo?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-purple-800">
                      <CalendarDays className="h-4 w-4" />Linha do Tempo
                    </h3>
                    <div className="space-y-1">
                      {analiseCompletaResult.linhaDoTempo.map((ev: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ev.status === "concluido" ? "bg-green-500" : ev.status === "vencido" ? "bg-red-500" : ev.status === "em_andamento" ? "bg-blue-500" : "bg-gray-400"}`} />
                          <div className="flex-1">
                            <span className="font-mono text-xs text-muted-foreground">{ev.data}</span>
                            <p className="text-sm">{ev.evento}</p>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">{ev.status?.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Base Legal */}
                {analiseCompletaResult.baseLegal?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-gray-800">
                      <Shield className="h-4 w-4" />Base Legal e Normativa
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analiseCompletaResult.baseLegal.map((norma: any, i: number) => (
                        <div key={i} className="border rounded-lg p-2 bg-gray-50 text-xs">
                          <p className="font-medium">{norma.nome} {norma.numero && `nº ${norma.numero}`}{norma.ano && `/${norma.ano}`}</p>
                          {norma.contexto && <p className="text-muted-foreground mt-0.5">{norma.contexto}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Riscos */}
                {analiseCompletaResult.riscos?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-red-800">
                      <AlertCircle className="h-4 w-4" />Riscos, Lacunas e Inconsistências
                    </h3>
                    <div className="space-y-2">
                      {analiseCompletaResult.riscos.map((r: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                          <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <Badge className="text-xs bg-red-100 text-red-800 mb-1">{r.tipo?.replace(/_/g, " ")}</Badge>
                            <p className="text-xs text-red-900">{r.descricao}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Plano de Ação */}
                {analiseCompletaResult.planoDeAcao?.length > 0 && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-green-800">
                      <Zap className="h-4 w-4" />Plano de Ação Proposto
                    </h3>
                    <div className="space-y-2">
                      {[...analiseCompletaResult.planoDeAcao].sort((a: any, b: any) => (a.ordem || 0) - (b.ordem || 0)).map((acao: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-2 border rounded bg-green-50">
                          <div className="w-6 h-6 rounded-full bg-green-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">{acao.ordem || i + 1}</div>
                          <div className="flex-1">
                            <p className="text-sm">{acao.acao}</p>
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              {acao.responsavel && <span>Resp: {acao.responsavel}</span>}
                              <Badge className={`text-xs ${acao.prioridade === "alta" ? "bg-red-100 text-red-800" : acao.prioridade === "media" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}>{acao.prioridade}</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Dados Técnicos */}
                {analiseCompletaResult.dadosTecnicos && Object.values(analiseCompletaResult.dadosTecnicos).some(v => v && v !== "null") && (
                  <section>
                    <h3 className="font-bold text-base flex items-center gap-2 mb-2 text-slate-800">
                      <BarChart3 className="h-4 w-4" />Dados Técnicos Identificados
                    </h3>
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {Object.entries(analiseCompletaResult.dadosTecnicos).map(([k, v]) => v && v !== "null" ? (
                        <div key={k}>
                          <p className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}:</p>
                          <p className="text-sm">{String(v)}</p>
                        </div>
                      ) : null)}
                    </div>
                  </section>
                )}

                {/* Observações Gerais */}
                {analiseCompletaResult.observacoesGerais && (
                  <section>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                      <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-xs text-amber-800 mb-1">Observações Gerais</p>
                        <p className="text-xs text-amber-900">{analiseCompletaResult.observacoesGerais}</p>
                      </div>
                    </div>
                  </section>
                )}

                <div className="flex justify-between items-center pt-3 border-t">
                  <Button variant="outline" onClick={() => { setIsAnaliseModalOpen(false); setIsEditDialogOpen(true); }}>
                    <Edit className="h-4 w-4 mr-2" />Voltar ao Formulário
                  </Button>
                  <Button onClick={() => { handleSaveEdit(); setIsAnaliseModalOpen(false); }} className="bg-violet-600 hover:bg-violet-700">
                    <CheckCircle2 className="h-4 w-4 mr-2" />Salvar Campos Preenchidos
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Dialog Detalhe ─────────────────────────────────────────────────── */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                {detailDataset?.titulo || detailDataset?.codigoArquivo || detailDataset?.nome}
              </DialogTitle>
              {detailDataset?.numeroDocumento && <DialogDescription>Nº {detailDataset.numeroDocumento} · {detailDataset.orgaoEmissor || "—"}</DialogDescription>}
            </DialogHeader>
            {detailDataset && (
              <div className="space-y-4">
                {/* Status documental badge */}
                <div className="flex flex-wrap gap-2">
                  {detailDataset.tipoDocumental && (
                    <Badge variant="outline" className="gap-1">
                      {getTipoDocumentalInfo(detailDataset.tipoDocumental)?.icon}
                      {getTipoDocumentalInfo(detailDataset.tipoDocumental)?.label || detailDataset.tipoDocumental}
                    </Badge>
                  )}
                  <Badge className={getStatusDocumentalInfo(detailDataset.statusDocumental).color}>
                    {getStatusDocumentalInfo(detailDataset.statusDocumental).label}
                  </Badge>
                  {detailDataset.status && <Badge className={getStatusBadge(detailDataset.status)}>{detailDataset.status}</Badge>}
                  {detailDataset.classificacao && <Badge className={getClassBadge(detailDataset.classificacao)}>{detailDataset.classificacao}</Badge>}
                </div>

                {/* Descrição do documento */}
                {detailDataset.descricao && (
                  <div className="bg-muted/50 border rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />Descrição
                    </p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{detailDataset.descricao}</p>
                  </div>
                )}

                {/* Prazo */}
                {detailDataset.prazoAtendimento && (() => {
                  const dias = diasParaVencer(detailDataset.prazoAtendimento);
                  return (
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${getRiscoColor(dias)}`}>
                      <Clock className="h-5 w-5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Prazo: {new Intl.DateTimeFormat("pt-BR").format(new Date(detailDataset.prazoAtendimento))}</p>
                        <p className="text-xs">{dias !== null && (dias < 0 ? `Vencido há ${Math.abs(dias)} dia(s)` : dias === 0 ? "Vence HOJE!" : `${dias} dia(s) restante(s)`)}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Resumo IA */}
                {detailDataset.resumoIA && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-purple-700 mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" />Resumo Técnico</p>
                    <p className="text-sm text-purple-900">{detailDataset.resumoIA}</p>
                  </div>
                )}

                {/* Exigências */}
                {detailDataset.exigencias && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-orange-700 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Exigências Identificadas</p>
                    <p className="text-sm text-orange-900 whitespace-pre-wrap">{detailDataset.exigencias}</p>
                    <Button size="sm" variant="outline" className="mt-2 gap-1 text-orange-700 border-orange-300" onClick={() => { setIsDetailOpen(false); handleGerarDemanda(detailDataset); }}>
                      <Zap className="h-3 w-3" />Converter em Demanda
                    </Button>
                  </div>
                )}

                {/* Detalhes */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailDataset.orgaoEmissor && <div><span className="text-muted-foreground">Órgão:</span> <strong>{detailDataset.orgaoEmissor}</strong></div>}
                  {detailDataset.responsavel && <div><span className="text-muted-foreground">Responsável:</span> <strong>{detailDataset.responsavel}</strong></div>}
                  {detailDataset.disciplina && <div><span className="text-muted-foreground">Disciplina:</span> <Badge variant="outline" className="text-xs">{detailDataset.disciplina}</Badge></div>}
                  <div><span className="text-muted-foreground">Versão:</span> <strong>{detailDataset.versao || "V0.1"}</strong></div>
                  <div><span className="text-muted-foreground">Upload:</span> {formatDate(detailDataset.dataUpload)}</div>
                  <div><span className="text-muted-foreground">Tamanho:</span> {formatFileSize(detailDataset.tamanho)}</div>
                  {detailDataset.codigoArquivo && <div className="col-span-2"><span className="text-muted-foreground">Código:</span> <code className="text-xs bg-muted px-1 rounded">{detailDataset.codigoArquivo}</code></div>}
                  {detailDataset.vinculoTipo && detailDataset.documentoRelacionadoId && (
                    <div className="col-span-2 flex items-center gap-2"><Link2 className="h-4 w-4 text-blue-500" /><span className="text-muted-foreground">Vínculo:</span> {VINCULOS_TIPOS.find(v => v.value === detailDataset.vinculoTipo)?.label || detailDataset.vinculoTipo} (doc #{detailDataset.documentoRelacionadoId})</div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(detailDataset)}><Download className="h-4 w-4 mr-1" />Baixar</Button>
                  <Button variant="outline" size="sm" onClick={() => { setIsDetailOpen(false); handleEdit(detailDataset); }}><Edit className="h-4 w-4 mr-1" />Editar</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Dialog Preview ─────────────────────────────────────────────────── */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />{previewDataset?.nome}</DialogTitle>
              {previewDataset && <DialogDescription className="flex gap-4 text-sm flex-wrap"><span>Tipo: {previewDataset.tipoDocumento || previewDataset.tipo || "N/A"}</span><span>Tamanho: {formatFileSize(previewDataset.tamanho)}</span><span>Por: {previewDataset.usuario || "N/A"}</span></DialogDescription>}
            </DialogHeader>
            <div className="overflow-auto">
              {previewDataset && (() => {
                const isImage = previewDataset.url?.startsWith("data:image/");
                const isPdf = previewDataset.url?.startsWith("data:application/pdf");
                if (isImage) return <img src={previewDataset.url} alt={previewDataset.nome} className="max-w-full max-h-[70vh] object-contain mx-auto" />;
                if (isPdf) return <iframe src={previewDataset.url} className="w-full h-[70vh]" title={previewDataset.nome} />;
                return <div className="text-center py-8"><FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" /><p className="text-lg font-medium mb-2">{previewDataset.nome}</p><Button onClick={() => handleDownload(previewDataset)}><Download className="mr-2 h-4 w-4" />Baixar Arquivo</Button></div>;
              })()}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Histórico ───────────────────────────────────────────────── */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Histórico de Versões</DialogTitle>
              <DialogDescription>{historyDataset?.codigoArquivo || historyDataset?.nome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Versão Atual</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Versão: {historyDataset?.versao || "V0.1"}</span>
                  <span>Status: {historyDataset?.status || "N/A"}</span>
                  <span>Data: {historyDataset && formatDate(historyDataset.dataUpload)}</span>
                  <span>Usuário: {historyDataset?.usuario}</span>
                </div>
              </div>
              {versoes.length > 0 ? (
                <div className="space-y-2">
                  {versoes.map((v: any) => (
                    <div key={v.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex justify-between"><span className="font-medium">Versão {v.versao}</span><span className="text-muted-foreground">{formatDate(v.criadoEm)}</span></div>
                      <div className="text-muted-foreground">Por: {v.criadoPor} · Status: {v.status}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão anterior registrada.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog Gerar Demanda ───────────────────────────────────────────── */}
        <Dialog open={isGerarDemandaOpen} onOpenChange={setIsGerarDemandaOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-orange-500" />Gerar Demanda a partir de Exigência</DialogTitle>
              <DialogDescription>Crie uma tarefa no módulo de Demandas para atender a exigência identificada no documento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {demandaDoc?.exigencias && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
                  <strong>Exigências do documento:</strong><br />{demandaDoc.exigencias}
                </div>
              )}
              <div><Label>Título da Demanda *</Label><Input value={novaDemandaTitulo} onChange={e => setNovaDemandaTitulo(e.target.value)} /></div>
              <div><Label>Prazo</Label><Input type="date" value={novaDemandaPrazo} onChange={e => setNovaDemandaPrazo(e.target.value)} /></div>
              <div><Label>Responsável</Label><Input value={novaDemandaResponsavel} onChange={e => setNovaDemandaResponsavel(e.target.value)} placeholder="Email ou nome" /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsGerarDemandaOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmitGerarDemanda} disabled={gerarDemandaMutation.isPending || !novaDemandaTitulo}>
                  {gerarDemandaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Zap className="h-4 w-4 mr-2" />Criar Demanda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SensitivePageWrapper>
  );
}

// ─── Componente: Tabela de Documentos ─────────────────────────────────────────

type DocTableProps = {
  datasets: DatasetExt[];
  onPreview: (d: DatasetExt) => void;
  onHistory: (d: DatasetExt) => void;
  onEdit: (d: DatasetExt) => void;
  onDownload: (d: DatasetExt) => void;
  onDelete: (id: number) => void;
  onDetail: (d: DatasetExt) => void;
  onGerarDemanda: (d: DatasetExt) => void;
};

function DocumentosTable({ datasets, onPreview, onHistory, onEdit, onDownload, onDelete, onDetail, onGerarDemanda }: DocTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código/Nome</TableHead>
            <TableHead>Tipo Documental</TableHead>
            <TableHead>Status Documental</TableHead>
            <TableHead>Órgão</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {datasets.map(d => {
            const dias = diasParaVencer(d.prazoAtendimento);
            const statusDoc = getStatusDocumentalInfo(d.statusDocumental);
            const tipoDoc = getTipoDocumentalInfo(d.tipoDocumental);
            return (
              <TableRow key={d.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => onDetail(d)}>
                <TableCell className="max-w-[200px]">
                  <div className="truncate font-mono text-xs" title={d.codigoArquivo || d.nome}>{d.codigoArquivo || d.nome}</div>
                  {d.titulo && <div className="text-xs text-muted-foreground truncate">{d.titulo}</div>}
                </TableCell>
                <TableCell>
                  {tipoDoc ? <span className="text-xs">{tipoDoc.icon} {tipoDoc.label}</span> : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${statusDoc.color}`}>{statusDoc.label}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{d.orgaoEmissor || "—"}</TableCell>
                <TableCell>
                  {d.prazoAtendimento ? (
                    <span className={`text-xs font-medium ${dias !== null && dias < 0 ? "text-red-600" : dias !== null && dias <= 7 ? "text-orange-600" : "text-muted-foreground"}`}>
                      {dias !== null && dias < 0 ? `Venc. (${Math.abs(dias)}d)` : dias !== null ? `${dias}d` : "—"}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell><Badge className={`text-xs ${getStatusBadge(d.status)}`}>{d.status || "N/A"}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(d.dataUpload)}</TableCell>
                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPreview(d)} title="Visualizar"><Eye className="h-3.5 w-3.5 text-blue-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onHistory(d)} title="Histórico"><History className="h-3.5 w-3.5 text-purple-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)} title="Editar"><Edit className="h-3.5 w-3.5 text-orange-600" /></Button>
                    {d.exigencias && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGerarDemanda(d)} title="Gerar Demanda"><Zap className="h-3.5 w-3.5 text-orange-500" /></Button>}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(d)} title="Baixar"><Download className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Excluir este documento?")) onDelete(d.id); }} title="Excluir"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Componente: Documentos Agrupados ─────────────────────────────────────────

function DocumentosGrouped({ datasets, onPreview, onHistory, onEdit, onDownload, onDelete, onDetail, onGerarDemanda }: DocTableProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const groups = datasets.reduce<Record<string, { name: string; docs: DatasetExt[] }>>((acc, d) => {
    const key = String(d.empreendimentoId ?? "sem");
    const name = d.empreendimentoNome || `Empreendimento #${d.empreendimentoId}`;
    if (!acc[key]) acc[key] = { name, docs: [] };
    acc[key].docs.push(d);
    return acc;
  }, {});
  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => a.name.localeCompare(b.name, "pt-BR"));
  const toggle = (key: string) => setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const isOpen = (key: string) => key in openGroups ? openGroups[key] : true;
  return (
    <div className="space-y-3">
      {sortedGroups.map(([key, group]) => (
        <Collapsible key={key} open={isOpen(key)} onOpenChange={() => toggle(key)}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition cursor-pointer select-none">
              <div className="flex items-center gap-2">
                {isOpen(key) ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-primary" />}
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-left">{group.name}</span>
              </div>
              <Badge variant="secondary" className="font-bold">{group.docs.length} doc{group.docs.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Código/Nome</TableHead>
                    <TableHead className="text-xs">Tipo Documental</TableHead>
                    <TableHead className="text-xs">Status Documental</TableHead>
                    <TableHead className="text-xs">Prazo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.docs.map(d => {
                    const dias = diasParaVencer(d.prazoAtendimento);
                    const statusDoc = getStatusDocumentalInfo(d.statusDocumental);
                    const tipoDoc = getTipoDocumentalInfo(d.tipoDocumental);
                    return (
                      <TableRow key={d.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => onDetail(d)}>
                        <TableCell className="max-w-[180px]">
                          <div className="truncate font-mono text-xs">{d.codigoArquivo || d.nome}</div>
                          {d.orgaoEmissor && <div className="text-xs text-muted-foreground">{d.orgaoEmissor}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{tipoDoc ? <span>{tipoDoc.icon} {tipoDoc.label}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><Badge className={`text-xs ${statusDoc.color}`}>{statusDoc.label}</Badge></TableCell>
                        <TableCell>
                          {d.prazoAtendimento ? <span className={`text-xs font-medium ${dias !== null && dias < 0 ? "text-red-600" : dias !== null && dias <= 7 ? "text-orange-600" : "text-muted-foreground"}`}>{dias !== null && dias < 0 ? `Venc.(${Math.abs(dias)}d)` : `${dias}d`}</span> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><Badge className={`text-xs ${getStatusBadge(d.status)}`}>{d.status || "N/A"}</Badge></TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPreview(d)}><Eye className="h-3.5 w-3.5 text-blue-600" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(d)}><Edit className="h-3.5 w-3.5 text-orange-600" /></Button>
                            {d.exigencias && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGerarDemanda(d)} title="Gerar Demanda"><Zap className="h-3.5 w-3.5 text-orange-500" /></Button>}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(d)}><Download className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Excluir?")) onDelete(d.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

// ─── Componente: Timeline Horizontal Butterfly ────────────────────────────────
// Layout horizontal com eixo central colorido, eventos alternando acima e
// abaixo do eixo, marcadores em diamante, escala baseada na DATA DO DOCUMENTO.

// Paleta de marca EcoBrasil
const ECO_BLUE  = "#00599C"; // Azul principal
const ECO_GREEN = "#1A7A45"; // Verde principal

function TimelineView({ datasets, empreendimentos, onDetail, modo: modoProp }: { datasets: DatasetExt[]; empreendimentos: Empreendimento[]; onDetail: (d: DatasetExt) => void; modo?: "documento" | "upload" }) {
  const [modoInterno, setModoInterno] = useState<"documento" | "upload">("documento");
  const modoVisualizacao = modoProp ?? modoInterno;
  const timelineRef = useRef<HTMLDivElement>(null);

  const handleDownloadTimeline = async (format: "jpeg" | "png") => {
    if (!timelineRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;

      // Expõe todo o conteúdo horizontal antes de capturar
      const el = timelineRef.current;
      const prevOverflow = el.style.overflow;
      const prevWidth    = el.style.width;
      el.style.overflow = "visible";
      el.style.width    = el.scrollWidth + "px";

      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        width:  el.scrollWidth,
        height: el.scrollHeight,
        windowWidth:  el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      // Restaura
      el.style.overflow = prevOverflow;
      el.style.width    = prevWidth;

      const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
      const url = canvas.toDataURL(mimeType, 0.95);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timeline-ecobrasil.${format}`;
      a.click();
    } catch (err) {
      console.error("Erro ao exportar timeline:", err);
    }
  };

  // Paleta de cores por tipo documental (harmonizada com EcoBrasil)
  const TYPE_COLORS: Record<string, string> = {
    licenca: "#16a34a", notificacao: "#dc2626", oficio: "#2563eb",
    relatorio: "#9333ea", parecer: "#ca8a04", art: "#ea580c",
    mapa: "#0d9488", documento_legal: "#374151", condicionante: "#db2777", outro: "#6b7280",
  };
  const TYPE_ICONS: Record<string, string> = {
    licenca: "📋", notificacao: "📢", oficio: "📨", relatorio: "📊",
    parecer: "🔍", art: "🔧", mapa: "🗺️", documento_legal: "⚖️", condicionante: "📌", outro: "📄",
  };

  // Retorna a data a usar na timeline (com fallback para dataUpload em modo documento)
  const getDataDocumento = (d: any): Date | null => {
    const raw = modoVisualizacao === "documento"
      ? (d.dataEmissao || (d as any).dataReferencia || d.dataUpload) // fallback para upload
      : d.dataUpload;
    if (!raw) return null;
    const dt = new Date(raw);
    return isNaN(dt.getTime()) ? null : dt;
  };

  // Indica se o documento não tem data de emissão/referência (usando fallback de upload)
  const isDateFallback = (d: any): boolean =>
    modoVisualizacao === "documento" && !d.dataEmissao && !(d as any).dataReferencia && !!d.dataUpload;

  const comData = datasets.filter(d => getDataDocumento(d) !== null);
  const semData: DatasetExt[] = []; // Com fallback, todos têm data

  // Contagem de documentos usando fallback (para banner informativo)
  const fallbackCount = modoVisualizacao === "documento"
    ? datasets.filter(d => isDateFallback(d)).length
    : 0;

  if (datasets.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
      <p>Nenhum documento para exibir na timeline.</p>
    </div>
  );

  // ─── Calcular escala e posições ─────────────────────────────────────────────
  const PAD_LEFT = 70;  // px de margem antes do primeiro mês
  const PAD_RIGHT = 70; // px de margem depois do último mês
  const AXIS_CENTER = 230; // px do topo até o centro da barra de meses
  const AXIS_H = 28;       // altura da barra de meses
  const AXIS_TOP = AXIS_CENTER - AXIS_H / 2;
  const AXIS_BOTTOM = AXIS_CENTER + AXIS_H / 2;
  const LABEL_W = 128;     // largura da caixa de label do evento
  const LABEL_H = 72;      // altura da caixa de label do evento
  const TIER_GAP = 90;     // espaçamento entre tiers (empilhamento vertical)
  const MIN_TIERS = 2;     // tiers máximos (acima e abaixo têm 2 tiers cada)
  const CONTAINER_H = AXIS_CENTER + AXIS_H / 2 + MIN_TIERS * TIER_GAP + LABEL_H + 30;

  // Datas min/max
  const dates = comData.map(d => getDataDocumento(d)!);
  const minDateMs = dates.length ? Math.min(...dates.map(d => d.getTime())) : Date.now();
  const maxDateMs = dates.length ? Math.max(...dates.map(d => d.getTime())) : Date.now();
  const startDate = new Date(new Date(minDateMs).getFullYear(), new Date(minDateMs).getMonth(), 1);
  const endDate   = new Date(new Date(maxDateMs).getFullYear(), new Date(maxDateMs).getMonth() + 1, 0);
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));

  // Pixels por dia: escala dinâmica para caber bem
  const targetInnerWidth = Math.max(900, window.innerWidth - 120);
  const pxPerDay = Math.max(3, Math.min(16, targetInnerWidth / totalDays));
  const innerWidth = Math.ceil(totalDays * pxPerDay);
  const containerWidth = innerWidth + PAD_LEFT + PAD_RIGHT;

  const dateToX = (d: Date) =>
    PAD_LEFT + Math.floor((d.getTime() - startDate.getTime()) / 86400000) * pxPerDay;

  // Segmentos de meses para a barra do eixo
  const monthSegments: { label: string; x: number; w: number; h1: boolean }[] = [];
  let cur = new Date(startDate);
  while (cur <= endDate) {
    const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const mEnd   = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const x0 = dateToX(mStart);
    const x1 = dateToX(mEnd) + pxPerDay;
    monthSegments.push({
      label: mStart.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
      x: x0, w: x1 - x0,
      h1: cur.getMonth() < 6, // Jan-Jun → laranja; Jul-Dez → verde
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  // Posicionamento dos eventos (alterna acima/abaixo e resolve colisões por tier)
  const sortedEvs = [...comData].sort((a, b) => getDataDocumento(a)!.getTime() - getDataDocumento(b)!.getTime());
  type EvSlot = { d: DatasetExt; x: number; above: boolean; tier: number; date: Date; color: string; icon: string; fallback: boolean };
  const slots: EvSlot[] = [];
  const occupancy: Map<string, number[]> = new Map(); // key "above|below" → list of x positions per tier

  sortedEvs.forEach((d, idx) => {
    const date = getDataDocumento(d)!;
    const x = dateToX(date);
    const above = idx % 2 === 0;
    const side = above ? "above" : "below";
    const color = TYPE_COLORS[d.tipoDocumental || "outro"] ?? "#6b7280";
    const icon  = TYPE_ICONS[d.tipoDocumental  || "outro"] ?? "📄";

    if (!occupancy.has(`${side}0`)) occupancy.set(`${side}0`, []);
    // Encontrar o primeiro tier livre (sem evento dentro de LABEL_W + 8 px)
    let tier = 0;
    while (true) {
      const key = `${side}${tier}`;
      if (!occupancy.has(key)) occupancy.set(key, []);
      const positions = occupancy.get(key)!;
      const clash = positions.some(ox => Math.abs(ox - x) < LABEL_W + 8);
      if (!clash) { positions.push(x); break; }
      tier++;
    }
    slots.push({ d, x, above, tier, date, color, icon, fallback: isDateFallback(d) });
  });

  // Helper: calcular Y do topo do label
  const labelTopY = (above: boolean, tier: number) =>
    above
      ? AXIS_TOP - 20 - (tier + 1) * TIER_GAP - LABEL_H + TIER_GAP
      : AXIS_BOTTOM + 20 + tier * TIER_GAP;

  // Ponto da linha que toca o eixo (ponta superior/inferior do diamante)
  const diamondR = 6;
  const lineAxisY = (above: boolean) => above ? AXIS_TOP - diamondR : AXIS_BOTTOM + diamondR;

  return (
    <div className="space-y-4">
      {/* Seletor de modo — só aparece quando não há modo fixo passado por prop */}
      {!modoProp && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button size="sm" variant={modoVisualizacao === "documento" ? "default" : "ghost"}
              onClick={() => setModoInterno("documento")} className="gap-1.5 h-8">
              <FileText className="h-3.5 w-3.5" />Data do Documento
            </Button>
            <Button size="sm" variant={modoVisualizacao === "upload" ? "default" : "ghost"}
              onClick={() => setModoInterno("upload")} className="gap-1.5 h-8">
              <Upload className="h-3.5 w-3.5" />Data de Inserção
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {modoVisualizacao === "documento" ? "Escala temporal pela data de emissão/assinatura do documento" : "Escala temporal pela data de inserção na plataforma"}
          </p>
        </div>
      )}

      {/* Banner: documentos sem data de emissão usando fallback */}
      {fallbackCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{fallbackCount} documento(s)</strong> sem data de emissão — posicionados pela data de inserção (borda tracejada).
            Edite-os para informar a data exata.
          </span>
        </div>
      )}

      {/* Botões de download */}
      {comData.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => handleDownloadTimeline("jpeg")}>
            <Download className="h-3 w-3" />JPEG
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => handleDownloadTimeline("png")}>
            <Download className="h-3 w-3" />PNG
          </Button>
        </div>
      )}

      {/* ── TIMELINE HORIZONTAL BUTTERFLY ────────────────────────────────── */}
      {comData.length > 0 && (
        <div ref={timelineRef} className="border rounded-xl bg-white overflow-x-auto shadow-sm">
          <div style={{ position: "relative", width: containerWidth, height: CONTAINER_H, minHeight: 340 }}>

            {/* Gridlines verticais por mês */}
            {monthSegments.map((m, i) => (
              <div key={i} style={{ position: "absolute", left: m.x, top: 0, width: 1, height: CONTAINER_H, background: "#e5e7eb", zIndex: 0 }} />
            ))}

            {/* Barra do eixo colorida (meses) */}
            {monthSegments.map((m, i) => (
              <div key={i} style={{
                position: "absolute", left: m.x, top: AXIS_TOP, width: m.w, height: AXIS_H, zIndex: 1,
                background: m.h1 ? ECO_BLUE : ECO_GREEN,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.18)",
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", letterSpacing: 0.5 }}>{m.label}</span>
              </div>
            ))}

            {/* Rótulos de ano (quando há múltiplos anos) */}
            {Array.from(new Set(monthSegments.map(m => {
              const d = new Date(startDate.getFullYear(), startDate.getMonth() + monthSegments.indexOf(m), 1);
              return d.getFullYear();
            }))).map(year => {
              const firstMonthOfYear = monthSegments.find((m, i) => {
                const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
                return d.getFullYear() === year;
              });
              if (!firstMonthOfYear) return null;
              return (
                <div key={year} style={{
                  position: "absolute", left: firstMonthOfYear.x + 4, top: AXIS_BOTTOM + 4,
                  fontSize: 10, color: "#9ca3af", fontWeight: 600, zIndex: 2,
                }}>
                  {year}
                </div>
              );
            })}

            {/* Eventos */}
            {slots.map((ev, i) => {
              const labelTop = labelTopY(ev.above, ev.tier);
              const labelLeft = ev.x - LABEL_W / 2;
              const lineTopY  = ev.above ? labelTop + LABEL_H : labelTop;
              const lineBottomY = lineAxisY(ev.above);
              const lineY = Math.min(lineTopY, lineBottomY);
              const lineH = Math.abs(lineTopY - lineBottomY);

              const tipoLabel = getTipoDocumentalInfo(ev.d.tipoDocumental)?.label || "Documento";
              const titulo = (ev.d.titulo || ev.d.codigoArquivo || ev.d.nome || "").slice(0, 32);
              const dataFmt = ev.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

              return (
                <div key={ev.d.id}>
                  {/* Linha vertical ligando label ao eixo */}
                  <div style={{
                    position: "absolute", left: ev.x, top: lineY,
                    width: 2, height: lineH, background: ev.color, zIndex: 2, opacity: 0.7,
                  }} />

                  {/* Marcador diamante no eixo */}
                  <div
                    onClick={() => onDetail(ev.d)}
                    style={{
                      position: "absolute",
                      left: ev.x - diamondR, top: AXIS_CENTER - diamondR,
                      width: diamondR * 2, height: diamondR * 2,
                      background: ev.color, transform: "rotate(45deg)",
                      cursor: "pointer", zIndex: 5,
                      boxShadow: "0 0 0 2px white",
                    }}
                  />

                  {/* Card do label */}
                  <div
                    onClick={() => onDetail(ev.d)}
                    style={{
                      position: "absolute",
                      left: Math.max(4, Math.min(containerWidth - LABEL_W - 4, labelLeft)),
                      top: labelTop,
                      width: LABEL_W, zIndex: 4,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    {/* Data em destaque */}
                    <p style={{ fontSize: 10, color: ev.fallback ? "#9ca3af" : ev.color, fontWeight: 700, marginBottom: 2, lineHeight: 1.2 }}>
                      {ev.fallback ? "📌 " : ""}{dataFmt}
                    </p>
                    {/* Título */}
                    <div style={{
                      background: ev.fallback ? "#f9fafb" : "white",
                      border: ev.fallback ? `1.5px dashed #9ca3af` : `1.5px solid ${ev.color}`,
                      borderRadius: 8,
                      padding: "4px 6px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      transition: "box-shadow 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = ev.fallback ? "0 2px 8px rgba(0,0,0,0.12)" : `0 2px 8px ${ev.color}44`)}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)")}
                    >
                      <p style={{ fontSize: 10, fontWeight: 600, color: ev.fallback ? "#6b7280" : "#111827", lineHeight: 1.3, marginBottom: 1 }}>
                        {ev.icon} {titulo}
                      </p>
                      <p style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.2 }}>{tipoLabel}</p>
                      {ev.fallback && (
                        <p style={{ fontSize: 8, color: "#9ca3af", lineHeight: 1.2, marginTop: 1, fontStyle: "italic" }}>data de inserção</p>
                      )}
                      {!ev.fallback && ev.d.orgaoEmissor && (
                        <p style={{ fontSize: 9, color: "#9ca3af", lineHeight: 1.2, marginTop: 1 }}>{ev.d.orgaoEmissor.slice(0, 20)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda de tipos */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_COLORS).filter(([tipo]) =>
          datasets.some(d => (d.tipoDocumental || "outro") === tipo)
        ).map(([tipo, cor]) => (
          <div key={tipo} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div style={{ width: 10, height: 10, background: cor, transform: "rotate(45deg)", flexShrink: 0 }} />
            <span>{getTipoDocumentalInfo(tipo)?.label || tipo}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
          {fallbackCount > 0 && (
            <div className="flex items-center gap-1">
              <div style={{ width: 14, height: 10, border: "1.5px dashed #9ca3af", borderRadius: 2, background: "#f9fafb" }} />
              <span>Sem data de emissão</span>
            </div>
          )}
          <div className="flex items-center gap-1"><div style={{ width: 14, height: 10, background: ECO_BLUE, borderRadius: 2 }} /><span>Jan–Jun</span></div>
          <div className="flex items-center gap-1"><div style={{ width: 14, height: 10, background: ECO_GREEN, borderRadius: 2 }} /><span>Jul–Dez</span></div>
        </div>
      </div>

    </div>
  );
}

// ─── Componente: Painel de Alertas ────────────────────────────────────────────

function AlertasPanel({ alertas, isLoading, onDetail, onGerarDemanda }: { alertas: any[]; isLoading: boolean; onDetail: (id: number) => void; onGerarDemanda: (id: number) => void }) {
  const criticos = alertas.filter(a => a.risco === "critico");
  const altos = alertas.filter(a => a.risco === "alto");
  const medios = alertas.filter(a => a.risco === "medio");
  const baixos = alertas.filter(a => a.risco === "baixo");

  if (isLoading) return <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" /></div>;

  if (alertas.length === 0) return (
    <div className="text-center py-16">
      <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-400" />
      <h3 className="text-lg font-semibold text-green-700">Sem alertas ativos</h3>
      <p className="text-muted-foreground mt-1">Nenhum documento com prazo próximo ou vencido.</p>
    </div>
  );

  const RiscoSection = ({ title, items, color, icon }: { title: string; items: any[]; color: string; icon: any }) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div>
        <div className={`flex items-center gap-2 mb-3 p-3 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" /><span className="font-semibold">{title}</span>
          <Badge className="ml-auto">{items.length}</Badge>
        </div>
        <div className="space-y-2 mb-6">
          {items.map(a => (
            <div key={a.id} className="border rounded-lg p-3 hover:shadow-sm transition cursor-pointer" onClick={() => onDetail(a.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-sm">{a.titulo || a.codigoArquivo || a.nome}</p>
                  {a.numeroDocumento && <p className="text-xs text-muted-foreground">Nº {a.numeroDocumento}</p>}
                  {a.orgaoEmissor && <p className="text-xs text-muted-foreground">{a.orgaoEmissor}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${a.vencido ? "text-red-600" : "text-orange-600"}`}>
                    {a.vencido ? `Vencido há ${Math.abs(a.diffDays)}d` : `Vence em ${a.diffDays}d`}
                  </p>
                  {a.prazoAtendimento && <p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat("pt-BR").format(new Date(a.prazoAtendimento))}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {a.responsavel && <span className="text-xs text-muted-foreground">Resp: {a.responsavel}</span>}
                <Button size="sm" variant="outline" className="ml-auto h-6 text-xs gap-1 text-orange-600 border-orange-300" onClick={e => { e.stopPropagation(); onGerarDemanda(a.id); }}>
                  <Zap className="h-3 w-3" />Gerar Demanda
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="border-red-300 bg-red-50"><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-red-700">{criticos.length}</div><div className="text-xs text-red-600">Crítico (Vencidos)</div></CardContent></Card>
        <Card className="border-orange-300 bg-orange-50"><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-orange-700">{altos.length}</div><div className="text-xs text-orange-600">Alto Risco (≤7 dias)</div></CardContent></Card>
        <Card className="border-yellow-300 bg-yellow-50"><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-yellow-700">{medios.length}</div><div className="text-xs text-yellow-600">Médio Risco (≤15 dias)</div></CardContent></Card>
        <Card className="border-blue-300 bg-blue-50"><CardContent className="py-3 px-4"><div className="text-2xl font-bold text-blue-700">{baixos.length}</div><div className="text-xs text-blue-600">Baixo Risco (≤30 dias)</div></CardContent></Card>
      </div>
      <RiscoSection title="Crítico — Prazos Vencidos" items={criticos} color="bg-red-100 text-red-800 border-l-4 border-red-500" icon={AlertCircle} />
      <RiscoSection title="Alto Risco — Até 7 dias" items={altos} color="bg-orange-100 text-orange-800 border-l-4 border-orange-500" icon={AlertTriangle} />
      <RiscoSection title="Médio Risco — Até 15 dias" items={medios} color="bg-yellow-100 text-yellow-800 border-l-4 border-yellow-400" icon={Clock} />
      <RiscoSection title="Baixo Risco — Até 30 dias" items={baixos} color="bg-blue-100 text-blue-800 border-l-4 border-blue-400" icon={Info} />
    </div>
  );
}
