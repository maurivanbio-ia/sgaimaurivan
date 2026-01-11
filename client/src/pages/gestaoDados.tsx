
import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { 
  Upload, Download, Trash2, FileText, Database, XCircle, Eye, Edit, X, Loader2,
  FolderTree, ChevronDown, ChevronRight, BookOpen, Search, Shield, History, FolderOpen,
  FolderPlus, Plus, File
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { Dataset, Empreendimento, User, DatasetPasta } from "@shared/schema";

// Dicionário de siglas
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
};

export default function GestaoDados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  
  // Estados para edição e preview
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDataset, setHistoryDataset] = useState<Dataset | null>(null);
  
  // Estados para gerenciamento de pastas
  const [selectedPasta, setSelectedPasta] = useState<DatasetPasta | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentFolderId, setParentFolderId] = useState<number | null>(null);
  const [isUploadingToFolder, setIsUploadingToFolder] = useState(false);
  const [folderFiles, setFolderFiles] = useState<Dataset[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  
  // Estados para proteção por senha (senha validada no servidor)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [folderPassword, setFolderPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "delete" | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // Formulário básico
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Formulário avançado com metadados
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

  // Buscar usuário logado
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Busca de dados
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar empreendimentos");
      return res.json();
    },
  });

  const { data: datasets = [], isLoading, refetch } = useQuery<
    Array<Dataset & { empreendimentoNome?: string }>
  >({
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

  // Buscar pastas (using new API endpoint)
  const { data: pastas = [], isLoading: pastasLoading, refetch: refetchPastas } = useQuery<DatasetPasta[]>({
    queryKey: ["/api/pastas"],
    queryFn: async () => {
      const res = await fetch("/api/pastas", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Buscar arquivos da pasta selecionada
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

  // Mutation para criar pasta (requer senha)
  const createFolderMutation = useMutation({
    mutationFn: async (data: { nome: string; paiId?: number | null; empreendimentoId?: number; senha: string }) => {
      const res = await fetch("/api/pastas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao criar pasta");
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
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar pasta.", variant: "destructive" });
    },
  });

  // Mutation para excluir pasta (requer senha)
  const deleteFolderMutation = useMutation({
    mutationFn: async (data: { id: number; senha: string }) => {
      const res = await fetch(`/api/pastas/${data.id}`, { 
        method: "DELETE", 
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: data.senha }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir pasta");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      if (selectedPasta) setSelectedPasta(null);
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

  // Mutation para criar arquivo na pasta
  const createFileInFolderMutation = useMutation({
    mutationFn: async (data: { pastaId: number; nome: string; objectPath: string; tipo?: string; tamanho?: number; empreendimentoId: number }) => {
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
      refetch();
      toast({ title: "Sucesso", description: "Arquivo enviado e registrado com sucesso!" });
      setIsUploadingToFolder(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao registrar arquivo.", variant: "destructive" });
    },
  });

  // Mutation para excluir arquivo
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
      refetch();
      toast({ title: "Sucesso", description: "Arquivo excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir arquivo.", variant: "destructive" });
    },
  });

  // Auto-inicializar estrutura de pastas se estiver vazia
  const [autoInitialized, setAutoInitialized] = useState(false);
  
  useEffect(() => {
    if (!pastasLoading && pastas.length === 0 && !autoInitialized) {
      setAutoInitialized(true);
      fetch("/api/datasets/estrutura/macro", { 
        method: "POST",
        credentials: "include"
      })
        .then(res => {
          if (res.ok) {
            queryClient.invalidateQueries({ queryKey: ["/api/datasets/pastas"] });
          }
        })
        .catch(console.error);
    }
  }, [pastasLoading, pastas.length, autoInitialized]);

  // Gerar preview do código quando campos mudam
  useEffect(() => {
    if (useAdvancedForm && (cliente || projeto || disciplina || tipoDocumento)) {
      generateCodePreview();
    }
  }, [cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, entrega, area, periodo, status, file]);

  const generateCodePreview = async () => {
    try {
      const extensao = file?.name?.split('.').pop() || '';
      const res = await fetch("/api/datasets/gerar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, 
          entrega, area, periodo, status, extensao,
          responsavel: currentUser?.email,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCodigoPreview(data.codigo);
        setPastaDestino(data.pastaDestino);
      }
    } catch (error) {
      console.error("Erro ao gerar preview:", error);
    }
  };

  // Inicializar estrutura macro
  const initMacroMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/datasets/estrutura/macro", { 
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Erro ao inicializar estrutura");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets/pastas"] });
      toast({ title: "Sucesso", description: "Estrutura institucional inicializada!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao inicializar estrutura.", variant: "destructive" });
    },
  });

  // Upload mutations
  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetch();
      toast({ title: "Sucesso", description: "Arquivo enviado com sucesso!" });
      resetForm();
      setIsUploadDialogOpen(false);
      setIsUploading(false);
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
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetch();
      toast({ title: "Sucesso", description: "Documento enviado com código padronizado!" });
      resetForm();
      setIsUploadDialogOpen(false);
      setIsUploading(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao enviar documento.", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetch();
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

  const resetForm = () => {
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
  };

  const handleUpload = () => {
    if (!selectedEmpreendimento || !file) {
      toast({ title: "Erro", description: "Selecione o empreendimento e o arquivo.", variant: "destructive" });
      return;
    }
    
    if (!pastaDestino) {
      toast({ title: "Erro", description: "Selecione a pasta de destino.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (useAdvancedForm) {
        uploadAdvancedMutation.mutate({
          empreendimentoId: parseInt(selectedEmpreendimento),
          nome: file.name,
          descricao,
          tipo: file.type || "outro",
          tamanho: file.size,
          url: reader.result as string,
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
          pastaDestino,
        });
      } else {
        uploadMutation.mutate({
          empreendimentoId: parseInt(selectedEmpreendimento),
          nome: nome || file.name,
          descricao,
          tipo: tipo || "outro",
          tamanho: file.size,
          usuario: currentUser?.email || "Usuário",
          url: reader.result as string,
          dataUpload: new Date().toISOString(),
          pastaDestino,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (dataset: Dataset) => {
    setEditingDataset(dataset);
    setEditNome(dataset.nome);
    setEditDescricao(dataset.descricao || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingDataset) return;
    editMutation.mutate({
      id: editingDataset.id,
      data: { nome: editNome, descricao: editDescricao },
    });
  };

  const handlePreview = (dataset: Dataset) => {
    setPreviewDataset(dataset);
    setIsPreviewOpen(true);
  };

  const handleShowHistory = (dataset: Dataset) => {
    setHistoryDataset(dataset);
    setIsHistoryOpen(true);
  };

  const getPreviewContent = (dataset: Dataset) => {
    const isImage = dataset.url?.startsWith("data:image/");
    const isPdf = dataset.url?.startsWith("data:application/pdf");
    
    if (isImage) {
      return <img src={dataset.url} alt={dataset.nome} className="max-w-full max-h-[70vh] object-contain mx-auto" />;
    }
    if (isPdf) {
      return <iframe src={dataset.url} className="w-full h-[70vh]" title={dataset.nome} />;
    }
    return (
      <div className="text-center py-8">
        <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">{dataset.nome}</p>
        <p className="text-muted-foreground mb-4">Tipo: {dataset.tipoDocumento || dataset.tipo || "N/A"}</p>
        <Button onClick={() => handleDownload(dataset)}>
          <Download className="mr-2 h-4 w-4" />
          Baixar Arquivo
        </Button>
      </div>
    );
  };

  const handleDownload = (dataset: Dataset) => {
    const link = document.createElement("a");
    link.href = dataset.url;
    link.download = dataset.nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleClearFilters = () => {
    setFilterEmpreendimento("all");
    setFilterTipo("all");
    setFilterStatus("all");
  };

  const getStatusBadge = (status: string | null) => {
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
  };

  const getClassBadge = (classificacao: string | null) => {
    const classColors: Record<string, string> = {
      PUB: "bg-green-100 text-green-700",
      INT: "bg-blue-100 text-blue-700",
      CONF: "bg-orange-100 text-orange-700",
      LGPD: "bg-red-100 text-red-700",
    };
    return classColors[classificacao || ""] || "bg-gray-100 text-gray-600";
  };

  // Helper: Toggle folder expansion
  const toggleFolderExpanded = (folderId: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Helper: Build folder tree from flat list
  const buildFolderTree = (allPastas: DatasetPasta[]) => {
    const rootFolders = allPastas.filter(p => !p.paiId);
    return rootFolders;
  };

  // Helper: Get subfolders of a folder
  const getSubfolders = (folderId: number) => {
    return pastas.filter(p => p.paiId === folderId);
  };

  // Helper: Handle folder selection
  const handleSelectFolder = (pasta: DatasetPasta) => {
    setSelectedPasta(pasta);
  };

  // Helper: Build flat list with indentation for folder selector
  const buildFolderSelectOptions = () => {
    const options: { value: string; label: string; depth: number }[] = [];
    
    const addFolderWithChildren = (folder: DatasetPasta, depth: number) => {
      const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(depth);
      const prefix = depth > 0 ? "└─ " : "";
      options.push({
        value: folder.caminho,
        label: `${indent}${prefix}${folder.nome}`,
        depth
      });
      
      const children = pastas.filter(p => p.paiId === folder.id).sort((a, b) => a.nome.localeCompare(b.nome));
      children.forEach(child => addFolderWithChildren(child, depth + 1));
    };
    
    // Start with root folders
    const rootFolders = pastas.filter(p => !p.paiId).sort((a, b) => a.nome.localeCompare(b.nome));
    rootFolders.forEach(folder => addFolderWithChildren(folder, 0));
    
    return options;
  };

  const folderSelectOptions = buildFolderSelectOptions();

  // Helper: Create new subfolder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast({ title: "Erro", description: "Nome da pasta é obrigatório.", variant: "destructive" });
      return;
    }
    createFolderMutation.mutate({
      nome: newFolderName.trim(),
      paiId: parentFolderId,
      empreendimentoId: selectedEmpreendimento ? parseInt(selectedEmpreendimento) : undefined,
    });
  };

  // Helper: Get upload parameters for Object Storage
  const getUploadParameters = async () => {
    const res = await fetch("/api/object-storage/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: `folder_${selectedPasta?.id}_${Date.now()}`,
        directory: ".private",
      }),
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    const data = await res.json();
    return { method: "PUT" as const, url: data.uploadUrl, filePath: data.filePath };
  };

  // Helper: Handle file upload complete
  const handleFileUploadComplete = (result: { uploadURL: string; filePath?: string }, fileName: string, fileSize: number) => {
    if (!selectedPasta || !selectedEmpreendimento) {
      toast({ title: "Erro", description: "Selecione uma pasta e empreendimento primeiro.", variant: "destructive" });
      return;
    }
    createFileInFolderMutation.mutate({
      pastaId: selectedPasta.id,
      nome: fileName,
      objectPath: result.filePath || "",
      tamanho: fileSize,
      empreendimentoId: parseInt(selectedEmpreendimento),
    });
  };

  // Filtrar dicionário
  const filteredDictionary = Object.entries(DICIONARIO_SIGLAS).map(([category, items]) => ({
    category,
    items: items.filter(item => 
      dictionarySearch === "" || 
      item.sigla.toLowerCase().includes(dictionarySearch.toLowerCase()) ||
      item.descricao.toLowerCase().includes(dictionarySearch.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  // Filtrar datasets por status
  const filteredDatasets = datasets.filter(d => 
    filterStatus === "all" || d.status === filterStatus
  );

  return (
    <SensitivePageWrapper moduleName="Gestão de Dados">
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8 text-primary" />
            Gestao de Dados
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistema de gestao documental com codificacao padronizada ECOBRASIL
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
                    ? "Preencha os metadados para gerar o codigo padronizado automaticamente."
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
                  Usar formulario avancado com codigo padronizado
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
                              <SelectItem key={u.sigla} value={u.sigla}>{u.sigla} - {u.descricao}</SelectItem>
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
                              <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} - {d.descricao}</SelectItem>
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
                              <SelectItem key={d.sigla} value={d.sigla}>{d.sigla} - {d.descricao}</SelectItem>
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
                              <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} - {e.descricao}</SelectItem>
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
                              <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Area</Label>
                        <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Opcional" />
                      </div>
                      <div>
                        <Label>Periodo</Label>
                        <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex: CHEIA2025, 2025Q1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Classificacao</Label>
                        <Select value={classificacao} onValueChange={setClassificacao}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DICIONARIO_SIGLAS.CLASS.map((c) => (
                              <SelectItem key={c.sigla} value={c.sigla}>{c.sigla} - {c.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Titulo Curto</Label>
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
                          <SelectItem value="relatorio">Relatorio</SelectItem>
                          <SelectItem value="documento">Documento</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div>
                  <Label>Descricao</Label>
                  <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descricao opcional" />
                </div>

                <div>
                  <Label>Pasta Destino *</Label>
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
                  <p className="text-xs text-muted-foreground mt-1">Selecione onde o arquivo sera armazenado (hierarquia de pastas)</p>
                </div>

                <div>
                  <Label>Arquivo *</Label>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar,.gpkg,.shp,.geojson,.qgz,.py,.r,.R,.sql,.ipynb"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>

                {useAdvancedForm && codigoPreview && (
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-primary" />
                      Preview do Codigo Gerado
                    </div>
                    <code className="block text-xs bg-background p-2 rounded border break-all">{codigoPreview}</code>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderOpen className="h-4 w-4" />
                      Destino: <span className="text-foreground font-mono text-xs">{pastaDestino}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleUpload} disabled={isUploading}>
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

        <TabsContent value="documentos" className="space-y-4">
          {/* Dicionário de Siglas Colapsável */}
          <Collapsible open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Dicionario de Siglas
                    {isDictionaryOpen ? <ChevronDown className="h-4 w-4 ml-auto" /> : <ChevronRight className="h-4 w-4 ml-auto" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar sigla ou descricao..." 
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
                                <Badge variant="outline" className="font-mono">{item.sigla}</Badge>
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
                      <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
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
                    <SelectItem value="relatorio">Relatorio</SelectItem>
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
                      <SelectItem key={s.sigla} value={s.sigla}>{s.sigla} - {s.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Documentos */}
          <Card>
            <CardHeader>
              <CardTitle>Documentos Cadastrados</CardTitle>
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
                        <TableHead>Codigo/Nome</TableHead>
                        <TableHead>Empreendimento</TableHead>
                        <TableHead>Disciplina</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Classificacao</TableHead>
                        <TableHead>Versao</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Acoes</TableHead>
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
                          <TableCell>
                            {d.disciplina && <Badge variant="outline">{d.disciplina}</Badge>}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(d.status)}>{d.status || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getClassBadge(d.classificacao)}>{d.classificacao || "N/A"}</Badge>
                          </TableCell>
                          <TableCell>{d.versao || "V0.1"}</TableCell>
                          <TableCell>{formatFileSize(d.tamanho)}</TableCell>
                          <TableCell>{new Intl.DateTimeFormat("pt-BR").format(new Date(d.dataUpload))}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handlePreview(d)} title="Visualizar">
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleShowHistory(d)} title="Historico">
                                <History className="h-4 w-4 text-purple-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(d)} title="Editar">
                                <Edit className="h-4 w-4 text-orange-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDownload(d)} title="Baixar">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(d.id)} title="Excluir">
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

        <TabsContent value="estrutura">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sidebar: Folder Tree */}
            <Card className="lg:col-span-1">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FolderTree className="h-5 w-5 text-primary" />
                    Pastas
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => { setParentFolderId(null); setIsCreateFolderOpen(true); }}>
                    <FolderPlus className="h-4 w-4 mr-1" />
                    Nova
                  </Button>
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
                      Criar Estrutura Inicial
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
                          <div key={pasta.id}>
                            <div 
                              className={`flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                            >
                              <button
                                onClick={() => toggleFolderExpanded(pasta.id)}
                                className="p-0.5 hover:bg-muted-foreground/10 rounded"
                              >
                                {subfolders.length > 0 ? (
                                  isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                ) : <span className="w-3" />}
                              </button>
                              <FolderOpen className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-amber-500'}`} />
                              <span 
                                className="font-mono text-xs flex-1 truncate" 
                                onClick={() => handleSelectFolder(pasta)}
                                title={pasta.nome}
                              >
                                {pasta.nome}
                              </span>
                              <button
                                onClick={() => { setParentFolderId(pasta.id); setIsCreateFolderOpen(true); }}
                                className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded"
                                title="Criar subpasta"
                              >
                                <Plus className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                            
                            {/* Subfolders */}
                            {isExpanded && subfolders.length > 0 && (
                              <div className="ml-4 pl-2 border-l border-muted">
                                {subfolders.map((sub) => {
                                  const subIsExpanded = expandedFolders.has(sub.id);
                                  const subSubfolders = getSubfolders(sub.id);
                                  const subIsSelected = selectedPasta?.id === sub.id;
                                  
                                  return (
                                    <div key={sub.id}>
                                      <div 
                                        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors ${subIsSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                      >
                                        <button
                                          onClick={() => toggleFolderExpanded(sub.id)}
                                          className="p-0.5"
                                        >
                                          {subSubfolders.length > 0 ? (
                                            subIsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                          ) : <span className="w-3" />}
                                        </button>
                                        <FolderOpen className={`h-3 w-3 ${subIsSelected ? 'text-primary' : 'text-amber-400'}`} />
                                        <span 
                                          className="font-mono text-xs flex-1 truncate"
                                          onClick={() => handleSelectFolder(sub)}
                                          title={sub.nome}
                                        >
                                          {sub.nome}
                                        </span>
                                      </div>
                                      
                                      {/* Third level */}
                                      {subIsExpanded && subSubfolders.length > 0 && (
                                        <div className="ml-4 pl-2 border-l border-muted">
                                          {subSubfolders.map((ssub) => {
                                            const ssubIsExpanded = expandedFolders.has(ssub.id);
                                            const ssubSubfolders = getSubfolders(ssub.id);
                                            const ssubIsSelected = selectedPasta?.id === ssub.id;
                                            return (
                                              <div key={ssub.id}>
                                                <div 
                                                  className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors ${ssubIsSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                                >
                                                  <button
                                                    onClick={() => toggleFolderExpanded(ssub.id)}
                                                    className="p-0.5"
                                                  >
                                                    {ssubSubfolders.length > 0 ? (
                                                      ssubIsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                                                    ) : <span className="w-3" />}
                                                  </button>
                                                  <FolderOpen className={`h-3 w-3 ${ssubIsSelected ? 'text-primary' : 'text-amber-300'}`} />
                                                  <span 
                                                    className="font-mono text-xs truncate flex-1"
                                                    onClick={() => handleSelectFolder(ssub)}
                                                    title={ssub.nome}
                                                  >
                                                    {ssub.nome}
                                                  </span>
                                                </div>
                                                
                                                {/* Fourth level */}
                                                {ssubIsExpanded && ssubSubfolders.length > 0 && (
                                                  <div className="ml-4 pl-2 border-l border-muted">
                                                    {ssubSubfolders.map((l4) => {
                                                      const l4IsSelected = selectedPasta?.id === l4.id;
                                                      return (
                                                        <div 
                                                          key={l4.id}
                                                          className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors ${l4IsSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                                          onClick={() => handleSelectFolder(l4)}
                                                        >
                                                          <span className="w-3" />
                                                          <FolderOpen className={`h-3 w-3 ${l4IsSelected ? 'text-primary' : 'text-amber-200'}`} />
                                                          <span className="font-mono text-xs truncate" title={l4.nome}>{l4.nome}</span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
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

            {/* Main Content: Selected Folder Files */}
            <Card className="lg:col-span-2">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5 text-primary" />
                      {selectedPasta ? selectedPasta.nome : "Selecione uma pasta"}
                    </CardTitle>
                    {selectedPasta && (
                      <CardDescription className="text-xs mt-1">
                        Caminho: {selectedPasta.caminho}
                      </CardDescription>
                    )}
                  </div>
                  {selectedPasta && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir esta pasta e todos os arquivos?")) {
                            deleteFolderMutation.mutate(selectedPasta.id);
                          }
                        }}
                        disabled={deleteFolderMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir Pasta
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedPasta ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>Selecione uma pasta na arvore para ver seus arquivos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* File Upload Section - Opens structured upload modal */}
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Upload className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Cadastrar documento nesta pasta</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Para enviar um arquivo, use o processo estruturado de cadastro com geracao automatica de codigo.
                      </p>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          // Pre-fill pasta destino based on selected folder
                          if (selectedPasta) {
                            setPastaDestino(selectedPasta.caminho);
                            // Try to extract empreendimento from folder path
                            const empFromPath = pastas.find(p => 
                              selectedPasta.caminho.startsWith(p.caminho) && p.empreendimentoId
                            );
                            if (empFromPath?.empreendimentoId) {
                              setSelectedEmpreendimento(empFromPath.empreendimentoId.toString());
                            }
                          }
                          setIsUploadDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Cadastrar Documento com Codigo
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        O codigo sera gerado automaticamente baseado nos metadados informados
                      </p>
                    </div>

                    {/* Files List */}
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
                                      <Badge className={getStatusBadge(arquivo.status)} variant="outline">{arquivo.status}</Badge>
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
                                    if (confirm("Excluir este arquivo?")) {
                                      deleteFileMutation.mutate(arquivo.id);
                                    }
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

      {/* Rodapé Normativo */}
      <Card className="bg-muted/30 border-t-4 border-t-primary">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sistema de gestao de dados e documentos da EcoBrasil Consultoria Ambiental, estruturado com base nas normas 
              e boas praticas internacionais, incluindo: <strong>ISO 15489</strong> e <strong>ABNT NBR ISO 30301</strong>, 
              <strong>ISO 9001</strong>, <strong>ISO 14001</strong>, <strong>ISO/IEC 27001</strong>, <strong>ISO 21502</strong>, 
              <strong>ISO 31000</strong>, <strong>Principios FAIR</strong>, <strong>LGPD (Lei no 13.709/2018)</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Documento</DialogTitle>
            <DialogDescription>Atualize as informacoes do documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} rows={3} />
            </div>
            {editingDataset && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <p><strong>Tipo de Documento:</strong> {editingDataset.tipoDocumento || editingDataset.tipo || "N/A"}</p>
                <p><strong>Tamanho:</strong> {formatFileSize(editingDataset.tamanho)}</p>
                <p><strong>Enviado por:</strong> {editingDataset.usuario || "N/A"}</p>
                <p><strong>Data:</strong> {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(new Date(editingDataset.dataUpload))}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Preview */}
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
                  {previewDataset.versao && <span>Versao: {previewDataset.versao}</span>}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto">
            {previewDataset && getPreviewContent(previewDataset)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historico de Versoes
            </DialogTitle>
            <DialogDescription>
              {historyDataset?.codigoArquivo || historyDataset?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Versao Atual</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Versao: {historyDataset?.versao || "V0.1"}</span>
                <span>Status: {historyDataset?.status || "N/A"}</span>
                <span>Data: {historyDataset && new Intl.DateTimeFormat("pt-BR").format(new Date(historyDataset.dataUpload))}</span>
                <span>Usuario: {historyDataset?.usuario}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center py-4">
              Historico de versoes anteriores sera exibido aqui quando disponivel.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criar Pasta */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Criar Nova Pasta
            </DialogTitle>
            <DialogDescription>
              {parentFolderId ? "Criar subpasta dentro da pasta selecionada." : "Criar nova pasta raiz."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Pasta *</Label>
              <Input 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nome da pasta"
              />
            </div>
            {parentFolderId && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Pasta pai: <span className="font-medium text-foreground">
                    {pastas.find(p => p.id === parentFolderId)?.nome || ""}
                  </span>
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setIsCreateFolderOpen(false); setNewFolderName(""); setParentFolderId(null); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateFolder} disabled={createFolderMutation.isPending}>
                {createFolderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Pasta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </SensitivePageWrapper>
  );
}
