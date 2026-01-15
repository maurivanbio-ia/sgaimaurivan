import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Edit,
  Eye,
  File,
  FileText,
  FolderOpen,
  FolderPlus,
  FolderTree,
  History,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Dataset, Empreendimento, User, DatasetPasta } from "@shared/schema";

/**
 * Melhorias implementadas (principais):
 * 1) Corrigido fluxo de senha para criar/excluir pasta (antes quebrava porque API exige senha, mas UI não enviava).
 * 2) Corrigidas chamadas deleteFolderMutation e createFolderMutation para enviar payload correto.
 * 3) Debounce no generateCodePreview para reduzir spam de requests ao digitar.
 * 4) useMemo/useCallback em cálculos pesados (dicionário filtrado, options de pasta, datasets filtrados).
 * 5) Validações mínimas no upload avançado, e botão “Enviar” desabilita corretamente.
 * 6) Ajustados invalidates/refetch para chaves coerentes (/api/pastas e /api/datasets).
 */

type PendingAction = "create_folder" | "delete_folder" | null;

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
    { sigla: "AC", descricao: "Acre" },
    { sigla: "AL", descricao: "Alagoas" },
    { sigla: "AP", descricao: "Amapá" },
    { sigla: "AM", descricao: "Amazonas" },
    { sigla: "BA", descricao: "Bahia" },
    { sigla: "CE", descricao: "Ceará" },
    { sigla: "DF", descricao: "Distrito Federal" },
    { sigla: "ES", descricao: "Espírito Santo" },
    { sigla: "GO", descricao: "Goiás" },
    { sigla: "MA", descricao: "Maranhão" },
    { sigla: "MT", descricao: "Mato Grosso" },
    { sigla: "MS", descricao: "Mato Grosso do Sul" },
    { sigla: "MG", descricao: "Minas Gerais" },
    { sigla: "PA", descricao: "Pará" },
    { sigla: "PB", descricao: "Paraíba" },
    { sigla: "PR", descricao: "Paraná" },
    { sigla: "PE", descricao: "Pernambuco" },
    { sigla: "PI", descricao: "Piauí" },
    { sigla: "RJ", descricao: "Rio de Janeiro" },
    { sigla: "RN", descricao: "Rio Grande do Norte" },
    { sigla: "RS", descricao: "Rio Grande do Sul" },
    { sigla: "RO", descricao: "Rondônia" },
    { sigla: "RR", descricao: "Roraima" },
    { sigla: "SC", descricao: "Santa Catarina" },
    { sigla: "SP", descricao: "São Paulo" },
    { sigla: "SE", descricao: "Sergipe" },
    { sigla: "TO", descricao: "Tocantins" },
  ],
} as const;

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadgeClass(status: string | null) {
  const statusColors: Record<string, string> = {
    RASC: "bg-gray-200 text-gray-800",
    PRELIM: "bg-yellow-200 text-yellow-800",
    FINAL: "bg-green-200 text-green-800",
    ASSIN: "bg-blue-200 text-blue-800",
    PROTOC: "bg-purple-200 text-purple-800",
    ENVIADO: "bg-teal-200 text-teal-800",
    ARQ: "bg-slate-200 text-slate-800",
  };
  return statusColors[status || ""] || "bg-gray-100 text-gray-600";
}

function getClassBadgeClass(classificacao: string | null) {
  const classColors: Record<string, string> = {
    PUB: "bg-green-100 text-green-700",
    INT: "bg-blue-100 text-blue-700",
    CONF: "bg-orange-100 text-orange-700",
    LGPD: "bg-red-100 text-red-700",
  };
  return classColors[classificacao || ""] || "bg-gray-100 text-gray-600";
}

export default function GestaoDados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado para demanda pendente de conclusão
  const [demandaPendente, setDemandaPendente] = useState<{ id: number; titulo: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("demandaPendenteConclusao");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.id && parsed?.titulo) setDemandaPendente(parsed);
      else localStorage.removeItem("demandaPendenteConclusao");
    } catch {
      localStorage.removeItem("demandaPendenteConclusao");
    }
  }, []);

  const concluirDemandaPendente = useCallback(async () => {
    if (!demandaPendente) return;

    try {
      const res = await fetch(`/api/demandas/${demandaPendente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "concluido" }),
      });

      if (res.ok) {
        toast({
          title: "Demanda concluída",
          description: `"${demandaPendente.titulo}" foi concluída após salvar o documento.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
        localStorage.removeItem("demandaPendenteConclusao");
        setDemandaPendente(null);
      } else {
        toast({
          title: "Erro ao concluir demanda",
          description:
            "Documento salvo, mas houve erro ao concluir a demanda. Tente concluir novamente.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível concluir a demanda. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [demandaPendente, queryClient, toast]);

  const cancelarDemandaPendente = useCallback(() => {
    localStorage.removeItem("demandaPendenteConclusao");
    setDemandaPendente(null);
    toast({ title: "Cancelado", description: "A demanda não será concluída automaticamente." });
  }, [toast]);

  // Estados principais
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isUploading, setIsUploading] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionarySearch, setDictionarySearch] = useState("");
  const [activeTab, setActiveTab] = useState("documentos");

  // Edição, preview, histórico
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDataset, setHistoryDataset] = useState<Dataset | null>(null);

  // Pastas
  const [selectedPasta, setSelectedPasta] = useState<DatasetPasta | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentFolderId, setParentFolderId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // Senha (server-side)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [folderPassword, setFolderPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Form básico
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Form avançado
  const [useAdvancedForm, setUseAdvancedForm] = useState(true);
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

  // Preview do código gerado
  const [codigoPreview, setCodigoPreview] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");

  // Debounce ref
  const previewTimerRef = useRef<number | null>(null);

  // Usuário
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Empreendimentos
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar empreendimentos");
      return res.json();
    },
  });

  // Datasets
  const {
    data: datasets = [],
    isLoading,
    refetch: refetchDatasets,
  } = useQuery<Array<Dataset & { empreendimentoNome?: string }>>({
    queryKey: ["/api/datasets", { empreendimentoId: filterEmpreendimento, tipo: filterTipo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      if (filterTipo !== "all") params.append("tipo", filterTipo);
      const res = await fetch(`/api/datasets?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar arquivos");
      return res.json();
    },
  });

  // Pastas
  const {
    data: pastas = [],
    isLoading: pastasLoading,
    refetch: refetchPastas,
  } = useQuery<DatasetPasta[]>({
    queryKey: ["/api/pastas"],
    queryFn: async () => {
      const res = await fetch("/api/pastas", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Arquivos da pasta selecionada
  const {
    data: selectedFolderFiles = [],
    refetch: refetchFolderFiles,
  } = useQuery<Dataset[]>({
    queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"],
    queryFn: async () => {
      if (!selectedPasta?.id) return [];
      const res = await fetch(`/api/pastas/${selectedPasta.id}/arquivos`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPasta?.id,
  });

  // --------- Helpers memoizados ---------
  const filteredDictionary = useMemo(() => {
    const q = dictionarySearch.trim().toLowerCase();
    return Object.entries(DICIONARIO_SIGLAS)
      .map(([category, items]) => ({
        category,
        items: (items as Array<{ sigla: string; descricao: string }>).filter((item) => {
          if (!q) return true;
          return item.sigla.toLowerCase().includes(q) || item.descricao.toLowerCase().includes(q);
        }),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [dictionarySearch]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => filterStatus === "all" || d.status === filterStatus);
  }, [datasets, filterStatus]);

  const folderSelectOptions = useMemo(() => {
    const options: { value: string; label: string; depth: number }[] = [];

    const addFolderWithChildren = (folder: DatasetPasta, depth: number) => {
      const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(depth);
      const prefix = depth > 0 ? "└─ " : "";
      options.push({
        value: folder.caminho,
        label: `${indent}${prefix}${folder.nome}`,
        depth,
      });

      const children = pastas
        .filter((p) => p.paiId === folder.id)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      children.forEach((child) => addFolderWithChildren(child, depth + 1));
    };

    const rootFolders = pastas.filter((p) => !p.paiId).sort((a, b) => a.nome.localeCompare(b.nome));
    rootFolders.forEach((folder) => addFolderWithChildren(folder, 0));

    return options;
  }, [pastas]);

  const buildFolderTree = useCallback((allPastas: DatasetPasta[]) => {
    return allPastas.filter((p) => !p.paiId).sort((a, b) => a.nome.localeCompare(b.nome));
  }, []);

  const getSubfolders = useCallback(
    (folderId: number) => pastas.filter((p) => p.paiId === folderId).sort((a, b) => a.nome.localeCompare(b.nome)),
    [pastas]
  );

  const toggleFolderExpanded = useCallback((folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const expandAllFolders = useCallback(() => {
    setExpandedFolders(new Set(pastas.map((p) => p.id)));
  }, [pastas]);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterEmpreendimento("all");
    setFilterTipo("all");
    setFilterStatus("all");
  }, []);

  // --------- API helpers ---------
  const resetForm = useCallback(() => {
    setNome("");
    setDescricao("");
    setTipo("");
    setFile(null);
    setSelectedEmpreendimento("");
    setCliente("");
    setUf("");
    setProjeto("");
    setSubprojeto("");
    setDisciplina("");
    setTipoDocumento("");
    setEntrega("");
    setArea("");
    setPeriodo("");
    setStatus("RASC");
    setClassificacao("INT");
    setTitulo("");
    setCodigoPreview("");
    setPastaDestino("");
  }, []);

  // --------- Mutations ---------
  const initMacroMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/datasets/estrutura/macro", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao inicializar estrutura");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      toast({ title: "Sucesso", description: "Estrutura institucional inicializada!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao inicializar estrutura.", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchDatasets();
      toast({ title: "Sucesso", description: "Arquivo enviado com sucesso!" });
      resetForm();
      setIsUploadDialogOpen(false);
      setIsUploading(false);
      if (demandaPendente) concluirDemandaPendente();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao enviar arquivo.", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const uploadAdvancedMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets/upload-avancado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchDatasets();
      toast({ title: "Sucesso", description: "Documento enviado com código padronizado!" });
      resetForm();
      setIsUploadDialogOpen(false);
      setIsUploading(false);
      if (demandaPendente) concluirDemandaPendente();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao enviar documento.", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchDatasets();
      toast({ title: "Sucesso", description: "Arquivo excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir arquivo.", variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { nome: string; descricao: string } }) => {
      const res = await fetch(`/api/datasets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      toast({ title: "Sucesso", description: "Arquivo atualizado com sucesso!" });
      setIsEditDialogOpen(false);
      setEditingDataset(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar arquivo.", variant: "destructive" });
    },
  });

  // Pastas: criar/excluir exigem senha
  const createFolderMutation = useMutation({
    mutationFn: async (data: { nome: string; paiId?: number | null; empreendimentoId?: number; senha: string }) => {
      const res = await fetch("/api/pastas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao criar pasta");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      toast({ title: "Sucesso", description: "Pasta criada com sucesso!" });
      setIsCreateFolderOpen(false);
      setIsPasswordDialogOpen(false);
      setFolderPassword("");
      setPendingAction(null);
      setNewFolderName("");
      setParentFolderId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message || "Falha ao criar pasta.", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (data: { id: number; senha: string }) => {
      const res = await fetch(`/api/pastas/${data.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: data.senha }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao excluir pasta");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      setSelectedPasta(null);
      toast({ title: "Sucesso", description: "Pasta excluída com sucesso!" });
      setIsPasswordDialogOpen(false);
      setFolderPassword("");
      setPendingAction(null);
      setPendingDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message || "Falha ao excluir pasta.", variant: "destructive" });
    },
  });

  const createFileInFolderMutation = useMutation({
    mutationFn: async (data: {
      pastaId: number;
      nome: string;
      objectPath: string;
      tipo?: string;
      tamanho?: number;
      empreendimentoId: number;
    }) => {
      const res = await fetch(`/api/pastas/${data.pastaId}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao registrar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchFolderFiles();
      refetchDatasets();
      toast({ title: "Sucesso", description: "Arquivo enviado e registrado com sucesso!" });
      if (demandaPendente) concluirDemandaPendente();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao registrar arquivo.", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/arquivos/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchFolderFiles();
      refetchDatasets();
      toast({ title: "Sucesso", description: "Arquivo excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir arquivo.", variant: "destructive" });
    },
  });

  // --------- Auto inicializar estrutura se vazio ---------
  const [autoInitialized, setAutoInitialized] = useState(false);
  useEffect(() => {
    if (pastasLoading) return;
    if (pastas.length !== 0) return;
    if (autoInitialized) return;

    setAutoInitialized(true);
    fetch("/api/datasets/estrutura/macro", { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
          refetchPastas();
        }
      })
      .catch(console.error);
  }, [pastasLoading, pastas.length, autoInitialized, queryClient, refetchPastas]);

  // --------- Preview do código (debounced) ---------
  const generateCodePreview = useCallback(async () => {
    try {
      const extensao = file?.name?.split(".").pop() || "";
      const res = await fetch("/api/datasets/gerar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cliente,
          uf,
          projeto,
          subprojeto,
          disciplina,
          tipoDocumento,
          entrega,
          area,
          periodo,
          status,
          extensao,
          responsavel: currentUser?.email,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCodigoPreview(data.codigo || "");
      setPastaDestino(data.pastaDestino || "");
    } catch (error) {
      console.error("Erro ao gerar preview:", error);
    }
  }, [file, cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, entrega, area, periodo, status, currentUser?.email]);

  useEffect(() => {
    if (!useAdvancedForm) return;

    const shouldPreview =
      !!cliente || !!projeto || !!disciplina || !!tipoDocumento || !!entrega || !!status || !!file;

    if (!shouldPreview) return;

    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      generateCodePreview();
    }, 350);

    return () => {
      if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    };
  }, [useAdvancedForm, cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, entrega, area, periodo, status, file, generateCodePreview]);

  // --------- Fluxo senha para criar/excluir pastas ---------
  const openPasswordDialog = useCallback((action: PendingAction, deleteId?: number) => {
    setPendingAction(action);
    setPendingDeleteId(deleteId ?? null);
    setFolderPassword("");
    setIsPasswordDialogOpen(true);
  }, []);

  const confirmPasswordAction = useCallback(() => {
    const senha = folderPassword.trim();
    if (!senha) {
      toast({ title: "Senha obrigatória", description: "Informe a senha para continuar.", variant: "destructive" });
      return;
    }

    if (pendingAction === "create_folder") {
      if (!newFolderName.trim()) {
        toast({ title: "Nome obrigatório", description: "Informe o nome da pasta.", variant: "destructive" });
        return;
      }

      createFolderMutation.mutate({
        nome: newFolderName.trim(),
        paiId: parentFolderId,
        empreendimentoId: selectedEmpreendimento ? parseInt(selectedEmpreendimento) : undefined,
        senha,
      });
      return;
    }

    if (pendingAction === "delete_folder") {
      if (!pendingDeleteId) {
        toast({ title: "Erro", description: "Pasta inválida para exclusão.", variant: "destructive" });
        return;
      }

      deleteFolderMutation.mutate({ id: pendingDeleteId, senha });
      return;
    }

    setIsPasswordDialogOpen(false);
  }, [
    folderPassword,
    pendingAction,
    pendingDeleteId,
    newFolderName,
    parentFolderId,
    selectedEmpreendimento,
    toast,
    createFolderMutation,
    deleteFolderMutation,
  ]);

  // --------- Upload ---------
  const isAdvancedValid = useMemo(() => {
    if (!useAdvancedForm) return true;
    // Campos mínimos realmente críticos para gerar código padronizado
    return (
      !!selectedEmpreendimento &&
      !!cliente.trim() &&
      !!uf.trim() &&
      !!projeto.trim() &&
      !!disciplina.trim() &&
      !!tipoDocumento.trim() &&
      !!entrega.trim() &&
      !!status.trim()
    );
  }, [useAdvancedForm, selectedEmpreendimento, cliente, uf, projeto, disciplina, tipoDocumento, entrega, status]);

  const handleUpload = useCallback(() => {
    if (!selectedEmpreendimento) {
      toast({ title: "Erro", description: "Selecione o empreendimento.", variant: "destructive" });
      return;
    }
    if (!file) {
      toast({ title: "Erro", description: "Selecione um arquivo.", variant: "destructive" });
      return;
    }
    if (!pastaDestino) {
      toast({ title: "Erro", description: "Selecione a pasta de destino.", variant: "destructive" });
      return;
    }
    if (useAdvancedForm && !isAdvancedValid) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha os campos obrigatórios do formulário avançado para gerar o código.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const basePayload = {
        empreendimentoId: parseInt(selectedEmpreendimento),
        descricao,
        tamanho: file.size,
        url: reader.result as string,
        pastaDestino,
        dataUpload: new Date().toISOString(),
      };

      if (useAdvancedForm) {
        uploadAdvancedMutation.mutate({
          ...basePayload,
          nome: file.name,
          tipo: file.type || "outro",
          cliente,
          uf,
          projeto,
          subprojeto,
          disciplina,
          tipoDocumento,
          entrega,
          area,
          periodo,
          status,
          classificacao,
          titulo,
        });
      } else {
        uploadMutation.mutate({
          ...basePayload,
          nome: nome || file.name,
          tipo: tipo || file.type || "outro",
          usuario: currentUser?.email || "Usuário",
        });
      }
    };

    reader.onerror = () => {
      toast({ title: "Erro", description: "Falha ao ler o arquivo.", variant: "destructive" });
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  }, [
    selectedEmpreendimento,
    file,
    pastaDestino,
    useAdvancedForm,
    isAdvancedValid,
    toast,
    descricao,
    cliente,
    uf,
    projeto,
    subprojeto,
    disciplina,
    tipoDocumento,
    entrega,
    area,
    periodo,
    status,
    classificacao,
    titulo,
    uploadAdvancedMutation,
    uploadMutation,
    nome,
    tipo,
    currentUser?.email,
  ]);

  // --------- UI handlers ---------
  const handleEdit = useCallback((dataset: Dataset) => {
    setEditingDataset(dataset);
    setEditNome(dataset.nome);
    setEditDescricao(dataset.descricao || "");
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingDataset) return;
    editMutation.mutate({ id: editingDataset.id, data: { nome: editNome, descricao: editDescricao } });
  }, [editingDataset, editNome, editDescricao, editMutation]);

  const handlePreview = useCallback((dataset: Dataset) => {
    setPreviewDataset(dataset);
    setIsPreviewOpen(true);
  }, []);

  const handleShowHistory = useCallback((dataset: Dataset) => {
    setHistoryDataset(dataset);
    setIsHistoryOpen(true);
  }, []);

  const handleDownload = useCallback((dataset: Dataset) => {
    if (!dataset.url) return;
    const link = document.createElement("a");
    link.href = dataset.url;
    link.download = dataset.nome || "arquivo";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const getPreviewContent = useCallback(
    (dataset: Dataset) => {
      const url = dataset.url || "";
      const isImage = url.startsWith("data:image/");
      const isPdf = url.startsWith("data:application/pdf");

      if (isImage) {
        return <img src={url} alt={dataset.nome} className="max-w-full max-h-[70vh] object-contain mx-auto" />;
      }
      if (isPdf) {
        return <iframe src={url} className="w-full h-[70vh]" title={dataset.nome} />;
      }

      return (
        <div className="text-center py-8">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">{dataset.nome}</p>
          <p className="text-muted-foreground mb-4">Tipo: {dataset.tipoDocumento || dataset.tipo || "N/A"}</p>
          <Button onClick={() => handleDownload(dataset)}>
            <Download className="mr-2 h-4 w-4" />
            Baixar arquivo
          </Button>
        </div>
      );
    },
    [handleDownload]
  );

  // --------- Render ---------
  return (
    <SensitivePageWrapper moduleName="Gestão de Dados">
      <div className="container mx-auto p-6 space-y-6">
        {demandaPendente && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 rounded-full p-2">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">Demanda aguardando conclusão</p>
                <p className="text-sm text-amber-700">
                  "{demandaPendente.titulo}" será concluída automaticamente após salvar o documento.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={concluirDemandaPendente}
                className="text-green-600 hover:text-green-800 border-green-200 hover:bg-green-50"
              >
                Concluir agora
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelarDemandaPendente} className="text-amber-600 hover:text-amber-800">
                <X className="h-4 w-4 mr-1" />
                Cancelar
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
            <p className="text-muted-foreground mt-1">
              Sistema de gestão documental com codificação padronizada ECOBRASIL
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => initMacroMutation.mutate()} disabled={initMacroMutation.isPending}>
              <FolderTree className="h-4 w-4 mr-2" />
              {initMacroMutation.isPending ? "Inicializando..." : "Inicializar Estrutura"}
            </Button>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" /> Enviar Documento
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload de Documento</DialogTitle>
                  <DialogDescription>
                    {useAdvancedForm
                      ? "Preencha os metadados para gerar o código padronizado automaticamente."
                      : "Upload simples de arquivo."}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="useAdvanced"
                    checked={useAdvancedForm}
                    onChange={(e) => setUseAdvancedForm(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useAdvanced" className="cursor-pointer">
                    Usar formulário avançado com código padronizado
                  </Label>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Empreendimento *</Label>
                    <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o empreendimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {empreendimentos.map((e) => (
                          <SelectItem key={e.id} value={e.id.toString()}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {useAdvancedForm ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Cliente *</Label>
                          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
                        </div>
                        <div>
                          <Label>UF *</Label>
                          <Select value={uf} onValueChange={setUf}>
                            <SelectTrigger>
                              <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.UF.map((u) => (
                                <SelectItem key={u.sigla} value={u.sigla}>
                                  {u.sigla} . {u.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Projeto *</Label>
                          <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder="Nome do projeto" />
                        </div>
                        <div>
                          <Label>Subprojeto</Label>
                          <Input value={subprojeto} onChange={(e) => setSubprojeto(e.target.value)} placeholder="Opcional" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Disciplina *</Label>
                          <Select value={disciplina} onValueChange={setDisciplina}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.DISC.map((d) => (
                                <SelectItem key={d.sigla} value={d.sigla}>
                                  {d.sigla} . {d.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Tipo de Documento *</Label>
                          <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.DOC.map((d) => (
                                <SelectItem key={d.sigla} value={d.sigla}>
                                  {d.sigla} . {d.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Entrega *</Label>
                          <Select value={entrega} onValueChange={setEntrega}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.ENTREGA.map((e) => (
                                <SelectItem key={e.sigla} value={e.sigla}>
                                  {e.sigla} . {e.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Status *</Label>
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.STATUS.map((s) => (
                                <SelectItem key={s.sigla} value={s.sigla}>
                                  {s.sigla} . {s.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Área</Label>
                          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Opcional" />
                        </div>
                        <div>
                          <Label>Período</Label>
                          <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex: CHEIA2025, 2025Q1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Classificação</Label>
                          <Select value={classificacao} onValueChange={setClassificacao}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.CLASS.map((c) => (
                                <SelectItem key={c.sigla} value={c.sigla}>
                                  {c.sigla} . {c.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Título curto</Label>
                          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Opcional" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Nome *</Label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do arquivo" />
                      </div>
                      <div>
                        <Label>Tipo *</Label>
                        <Select value={tipo} onValueChange={setTipo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planilha">Planilha</SelectItem>
                            <SelectItem value="relatorio">Relatório</SelectItem>
                            <SelectItem value="documento">Documento</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      rows={2}
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descrição opcional"
                    />
                  </div>

                  <div>
                    <Label>Pasta destino *</Label>
                    <Select value={pastaDestino} onValueChange={setPastaDestino}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a pasta de destino" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {folderSelectOptions.map((option, idx) => (
                          <SelectItem key={idx} value={option.value} className="font-mono text-xs">
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecione onde o arquivo será armazenado (hierarquia de pastas)
                    </p>
                  </div>

                  <div>
                    <Label>Arquivo *</Label>
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar,.gpkg,.shp,.geojson,.qgz,.py,.r,.R,.sql,.ipynb"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Observação: este fluxo salva via Base64. Para arquivos grandes, o ideal é migrar para upload via Object Storage (URL assinada) e registrar apenas o caminho.
                    </p>
                  </div>

                  {useAdvancedForm && codigoPreview && (
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4 text-primary" />
                        Preview do código gerado
                      </div>
                      <code className="block text-xs bg-background p-2 rounded border break-all">{codigoPreview}</code>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FolderOpen className="h-4 w-4" />
                        Destino: <span className="text-foreground font-mono text-xs">{pastaDestino}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleUpload} disabled={isUploading || !selectedEmpreendimento || !file || !pastaDestino || (useAdvancedForm && !isAdvancedValid)}>
                      {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {isUploading ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="estrutura">Estrutura de Pastas</TabsTrigger>
          </TabsList>

          {/* Documentos */}
          <TabsContent value="documentos" className="space-y-4">
            <Collapsible open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Search className="h-5 w-5 text-primary" />
                      Dicionário de siglas
                      {isDictionaryOpen ? (
                        <ChevronDown className="h-4 w-4 ml-auto" />
                      ) : (
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar sigla ou descrição..."
                          value={dictionarySearch}
                          onChange={(e) => setDictionarySearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredDictionary.map(({ category, items }) => (
                          <div key={category} className="space-y-2">
                            <h4 className="font-semibold text-sm text-primary">{category}</h4>
                            <div className="space-y-1">
                              {items.map((item) => (
                                <div key={item.sigla} className="text-sm flex gap-2">
                                  <Badge variant="outline" className="font-mono">
                                    {item.sigla}
                                  </Badge>
                                  <span className="text-muted-foreground">{item.descricao}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Filtros */}
            <Card>
              <CardHeader className="flex flex-row justify-between items-center py-3">
                <CardTitle className="text-base">Filtros</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  <XCircle className="h-4 w-4 mr-1" /> Limpar
                </Button>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Empreendimento</Label>
                  <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {empreendimentos.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="planilha">Planilha</SelectItem>
                      <SelectItem value="relatorio">Relatório</SelectItem>
                      <SelectItem value="documento">Documento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {DICIONARIO_SIGLAS.STATUS.map((s) => (
                        <SelectItem key={s.sigla} value={s.sigla}>
                          {s.sigla} . {s.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
              <CardHeader>
                <CardTitle>Documentos cadastrados</CardTitle>
                <CardDescription>{filteredDatasets.length} documento(s) encontrado(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Carregando...
                  </div>
                ) : filteredDatasets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    Nenhum documento encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código/Nome</TableHead>
                          <TableHead>Empreendimento</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead>Versão</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDatasets.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="max-w-[200px]">
                              <div className="truncate font-mono text-xs" title={d.codigoArquivo || d.nome}>
                                {d.codigoArquivo || d.nome}
                              </div>
                            </TableCell>
                            <TableCell>{d.empreendimentoNome || `#${d.empreendimentoId}`}</TableCell>
                            <TableCell>{d.disciplina && <Badge variant="outline">{d.disciplina}</Badge>}</TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeClass(d.status)}>{d.status || "N/A"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getClassBadgeClass(d.classificacao)}>{d.classificacao || "N/A"}</Badge>
                            </TableCell>
                            <TableCell>{d.versao || "V0.1"}</TableCell>
                            <TableCell>{formatFileSize(d.tamanho)}</TableCell>
                            <TableCell>{new Intl.DateTimeFormat("pt-BR").format(new Date(d.dataUpload))}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => handlePreview(d)} title="Visualizar">
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleShowHistory(d)} title="Histórico">
                                  <History className="h-4 w-4 text-purple-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(d)} title="Editar">
                                  <Edit className="h-4 w-4 text-orange-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDownload(d)} title="Baixar">
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Excluir este documento?")) deleteMutation.mutate(d.id);
                                  }}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Estrutura */}
          <TabsContent value="estrutura">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderTree className="h-5 w-5 text-primary" />
                      Pastas
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={collapseAllFolders}
                        title="Recolher todas"
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={expandAllFolders}
                        title="Expandir todas"
                        className="h-7 w-7 p-0"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setParentFolderId(null);
                          setIsCreateFolderOpen(true);
                        }}
                      >
                        <FolderPlus className="h-4 w-4 mr-1" />
                        Nova
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {pastasLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                      <p className="text-sm">Carregando...</p>
                    </div>
                  ) : pastas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground px-4">
                      <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma pasta encontrada.</p>
                      <Button size="sm" className="mt-3" onClick={() => initMacroMutation.mutate()}>
                        <FolderPlus className="h-4 w-4 mr-1" />
                        Criar estrutura inicial
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[450px] px-2 pb-2">
                      <div className="space-y-0.5">
                        {buildFolderTree(pastas).map((pasta) => {
                          const isExpanded = expandedFolders.has(pasta.id);
                          const subfolders = getSubfolders(pasta.id);
                          const isSelected = selectedPasta?.id === pasta.id;

                          return (
                            <div key={pasta.id} className="group">
                              <div
                                className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors ${
                                  isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                }`}
                              >
                                <button
                                  onClick={() => toggleFolderExpanded(pasta.id)}
                                  className="p-0.5 hover:bg-muted-foreground/10 rounded"
                                  type="button"
                                >
                                  {subfolders.length > 0 ? (
                                    isExpanded ? (
                                      <ChevronDown className="h-3 w-3" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3" />
                                    )
                                  ) : (
                                    <span className="w-3" />
                                  )}
                                </button>

                                <FolderOpen className={`h-4 w-4 ${isSelected ? "text-primary" : "text-amber-500"}`} />
                                <span
                                  className="font-mono text-xs flex-1 truncate"
                                  onClick={() => setSelectedPasta(pasta)}
                                  title={pasta.nome}
                                >
                                  {pasta.nome}
                                </span>

                                <button
                                  onClick={() => {
                                    setParentFolderId(pasta.id);
                                    setIsCreateFolderOpen(true);
                                  }}
                                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded"
                                  title="Criar subpasta"
                                  type="button"
                                >
                                  <Plus className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>

                              {isExpanded && subfolders.length > 0 && (
                                <div className="ml-4 pl-2 border-l border-muted">
                                  {subfolders.map((sub) => {
                                    const subIsExpanded = expandedFolders.has(sub.id);
                                    const subSubfolders = getSubfolders(sub.id);
                                    const subIsSelected = selectedPasta?.id === sub.id;

                                    return (
                                      <div key={sub.id}>
                                        <div
                                          className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors ${
                                            subIsSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                          }`}
                                        >
                                          <button
                                            onClick={() => toggleFolderExpanded(sub.id)}
                                            className="p-0.5"
                                            type="button"
                                          >
                                            {subSubfolders.length > 0 ? (
                                              subIsExpanded ? (
                                                <ChevronDown className="h-3 w-3" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3" />
                                              )
                                            ) : (
                                              <span className="w-3" />
                                            )}
                                          </button>
                                          <FolderOpen className={`h-3 w-3 ${subIsSelected ? "text-primary" : "text-amber-400"}`} />
                                          <span
                                            className="font-mono text-xs flex-1 truncate"
                                            onClick={() => setSelectedPasta(sub)}
                                            title={sub.nome}
                                          >
                                            {sub.nome}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-primary" />
                        {selectedPasta ? selectedPasta.nome : "Selecione uma pasta"}
                      </CardTitle>
                      {selectedPasta && (
                        <CardDescription className="text-xs mt-1">Caminho: {selectedPasta.caminho}</CardDescription>
                      )}
                    </div>

                    {selectedPasta && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (!selectedPasta) return;
                          if (!confirm("Tem certeza que deseja excluir esta pasta e todos os arquivos?")) return;
                          openPasswordDialog("delete_folder", selectedPasta.id);
                        }}
                        disabled={deleteFolderMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir pasta
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {!selectedPasta ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      <p>Selecione uma pasta na árvore para ver seus arquivos.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Upload className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Cadastrar documento nesta pasta</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Para enviar um arquivo, use o processo estruturado de cadastro com geração automática de código.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => {
                            setPastaDestino(selectedPasta.caminho);
                            if (selectedPasta.empreendimentoId) setSelectedEmpreendimento(String(selectedPasta.empreendimentoId));
                            setIsUploadDialogOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Cadastrar documento com código
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          O código será gerado automaticamente baseado nos metadados informados
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">Arquivos ({selectedFolderFiles.length})</span>
                        </div>

                        {selectedFolderFiles.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                            <File className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Nenhum arquivo nesta pasta.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedFolderFiles.map((arquivo) => (
                              <div
                                key={arquivo.id}
                                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate" title={arquivo.nome}>
                                    {arquivo.codigoArquivo || arquivo.nome}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{formatFileSize(arquivo.tamanho)}</span>
                                    <span>•</span>
                                    <span>{new Intl.DateTimeFormat("pt-BR").format(new Date(arquivo.dataUpload))}</span>
                                    {arquivo.status && (
                                      <>
                                        <span>•</span>
                                        <Badge className={getStatusBadgeClass(arquivo.status)} variant="outline">
                                          {arquivo.status}
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handlePreview(arquivo)} title="Visualizar">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(arquivo)} title="Baixar">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => {
                                      if (confirm("Excluir este arquivo?")) deleteFileMutation.mutate(arquivo.id);
                                    }}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Rodapé normativo */}
        <Card className="bg-muted/30 border-t-4 border-t-primary">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sistema de gestão de dados e documentos da EcoBrasil Consultoria Ambiental, estruturado com base em boas práticas e normas, incluindo: <strong>ISO 15489</strong> e <strong>ABNT NBR ISO 30301</strong>, <strong>ISO 9001</strong>, <strong>ISO 14001</strong>, <strong>ISO/IEC 27001</strong>, <strong>ISO 21502</strong>, <strong>ISO 31000</strong>, <strong>Princípios FAIR</strong>, <strong>LGPD (Lei nº 13.709/2018)</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dialog edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar documento</DialogTitle>
              <DialogDescription>Atualize as informações do documento.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} rows={3} />
              </div>
              {editingDataset && (
                <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                  <p>
                    <strong>Tipo de documento:</strong> {editingDataset.tipoDocumento || editingDataset.tipo || "N/A"}
                  </p>
                  <p>
                    <strong>Tamanho:</strong> {formatFileSize(editingDataset.tamanho)}
                  </p>
                  <p>
                    <strong>Enviado por:</strong> {editingDataset.usuario || "N/A"}
                  </p>
                  <p>
                    <strong>Data:</strong>{" "}
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(
                      new Date(editingDataset.dataUpload)
                    )}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog preview */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewDataset?.nome}
              </DialogTitle>
              <DialogDescription>
                {previewDataset && (
                  <span className="flex gap-4 text-sm flex-wrap">
                    <span>Tipo: {previewDataset.tipoDocumento || previewDataset.tipo || "N/A"}</span>
                    <span>Tamanho: {formatFileSize(previewDataset.tamanho)}</span>
                    <span>Por: {previewDataset.usuario || "N/A"}</span>
                    {previewDataset.versao && <span>Versão: {previewDataset.versao}</span>}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto">{previewDataset && getPreviewContent(previewDataset)}</div>
          </DialogContent>
        </Dialog>

        {/* Dialog histórico */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de versões
              </DialogTitle>
              <DialogDescription>{historyDataset?.codigoArquivo || historyDataset?.nome}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Versão atual</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span>Versão: {historyDataset?.versao || "V0.1"}</span>
                  <span>Status: {historyDataset?.status || "N/A"}</span>
                  <span>
                    Data:{" "}
                    {historyDataset
                      ? new Intl.DateTimeFormat("pt-BR").format(new Date(historyDataset.dataUpload))
                      : "N/A"}
                  </span>
                  <span>Usuário: {historyDataset?.usuario || "N/A"}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center py-4">
                Histórico de versões anteriores será exibido aqui quando disponível.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog criar pasta */}
        <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                Criar nova pasta
              </DialogTitle>
              <DialogDescription>
                {parentFolderId ? "Criar subpasta dentro da pasta selecionada." : "Criar nova pasta raiz."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da pasta *</Label>
                <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome da pasta" />
              </div>
              {parentFolderId && (
                <div className="bg-muted p-3 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    Pasta pai:{" "}
                    <span className="font-medium text-foreground">
                      {pastas.find((p) => p.id === parentFolderId)?.nome || ""}
                    </span>
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateFolderOpen(false);
                    setNewFolderName("");
                    setParentFolderId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!newFolderName.trim()) {
                      toast({ title: "Erro", description: "Nome da pasta é obrigatório.", variant: "destructive" });
                      return;
                    }
                    // ABRE A SENHA, e só cria após confirmar a senha
                    openPasswordDialog("create_folder");
                  }}
                  disabled={createFolderMutation.isPending}
                >
                  {createFolderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar pasta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog senha */}
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmação de senha</DialogTitle>
              <DialogDescription>
                Informe a senha para {pendingAction === "delete_folder" ? "excluir a pasta" : "criar a pasta"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={folderPassword}
                  onChange={(e) => setFolderPassword(e.target.value)}
                  placeholder="Digite a senha"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPasswordDialogOpen(false);
                    setFolderPassword("");
                    setPendingAction(null);
                    setPendingDeleteId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmPasswordAction}
                  disabled={createFolderMutation.isPending || deleteFolderMutation.isPending}
                >
                  {(createFolderMutation.isPending || deleteFolderMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SensitivePageWrapper>
  );
}
