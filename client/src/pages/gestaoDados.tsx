"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  FolderTree, ChevronDown, ChevronRight, BookOpen, Search, Shield, History, FolderOpen
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Dataset, Empreendimento, User } from "@shared/schema";

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
      const res = await fetch("/api/empreendimentos");
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
      const res = await fetch(`/api/datasets?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar arquivos");
      return res.json();
    },
  });

  // Buscar pastas
  const { data: pastas = [] } = useQuery<any[]>({
    queryKey: ["/api/datasets/pastas"],
    queryFn: async () => {
      const res = await fetch("/api/datasets/pastas");
      if (!res.ok) return [];
      return res.json();
    },
  });

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
        <p className="text-muted-foreground mb-4">Tipo: {dataset.tipo}</p>
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
                    <SelectContent>
                      {pastas.filter(p => p.tipo !== "macro" || p.caminho === "/ECOBRASIL_GESTAO_DADOS").map((pasta) => (
                        <SelectItem key={pasta.id} value={pasta.caminho}>
                          {pasta.caminho.replace("/ECOBRASIL_GESTAO_DADOS/", "").replace("/ECOBRASIL_GESTAO_DADOS", "Raiz") || pasta.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Selecione onde o arquivo sera armazenado</p>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                Estrutura de Pastas Institucional
              </CardTitle>
              <CardDescription>
                Hierarquia de pastas para organizacao dos documentos do projeto. Clique em uma pasta para ver seus arquivos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pastas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderTree className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Estrutura de pastas nao inicializada.</p>
                  <Button className="mt-4" onClick={() => initMacroMutation.mutate()}>
                    Inicializar Estrutura
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {pastas.filter(p => !p.pai || p.pai === "/ECOBRASIL_GESTAO_DADOS").map((pasta) => {
                      const subpastas = pastas.filter(p => p.pai === pasta.caminho);
                      const arquivosDaPasta = datasets.filter(d => d.pastaDestino === pasta.caminho);
                      
                      return (
                        <Collapsible key={pasta.id}>
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center gap-2 py-2 px-2 hover:bg-muted rounded cursor-pointer">
                              <ChevronRight className="h-4 w-4 text-muted-foreground collapsible-chevron" />
                              <FolderOpen className="h-4 w-4 text-amber-500" />
                              <span className="font-mono text-sm font-medium">{pasta.nome}</span>
                              <Badge variant="outline" className="text-xs ml-auto">
                                {arquivosDaPasta.length} {arquivosDaPasta.length === 1 ? "arquivo" : "arquivos"}
                              </Badge>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-6 pl-4 border-l-2 border-muted">
                              {subpastas.map((subpasta) => {
                                const arquivosSubpasta = datasets.filter(d => d.pastaDestino === subpasta.caminho);
                                const subsubpastas = pastas.filter(p => p.pai === subpasta.caminho);
                                
                                return (
                                  <Collapsible key={subpasta.id}>
                                    <CollapsibleTrigger className="w-full">
                                      <div className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer">
                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        <FolderOpen className="h-3 w-3 text-amber-400" />
                                        <span className="font-mono text-xs">{subpasta.nome}</span>
                                        {arquivosSubpasta.length > 0 && (
                                          <Badge variant="secondary" className="text-xs ml-auto">{arquivosSubpasta.length}</Badge>
                                        )}
                                      </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <div className="ml-4 pl-2 border-l border-muted">
                                        {subsubpastas.map((ssp) => {
                                          const arquivosSsp = datasets.filter(d => d.pastaDestino === ssp.caminho);
                                          return (
                                            <div key={ssp.id} className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded">
                                              <FolderOpen className="h-3 w-3 text-amber-300" />
                                              <span className="font-mono text-xs text-muted-foreground">{ssp.nome}</span>
                                              {arquivosSsp.length > 0 && (
                                                <Badge variant="secondary" className="text-xs ml-auto">{arquivosSsp.length}</Badge>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {arquivosSubpasta.map((arq) => (
                                          <div key={arq.id} className="flex items-center gap-2 py-1 px-2 hover:bg-blue-50 dark:hover:bg-blue-950 rounded">
                                            <FileText className="h-3 w-3 text-blue-500" />
                                            <span className="text-xs truncate flex-1">{arq.codigoArquivo || arq.nome}</span>
                                            <div className="flex gap-1">
                                              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handlePreview(arq)}>
                                                <Eye className="h-3 w-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleDownload(arq)}>
                                                <Download className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                );
                              })}
                              {arquivosDaPasta.map((arq) => (
                                <div key={arq.id} className="flex items-center gap-2 py-1 px-2 hover:bg-blue-50 dark:hover:bg-blue-950 rounded">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm truncate flex-1">{arq.codigoArquivo || arq.nome}</span>
                                  <Badge className={getStatusBadge(arq.status)} variant="outline">{arq.status || "N/A"}</Badge>
                                  <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handlePreview(arq)}>
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDownload(arq)}>
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {subpastas.length === 0 && arquivosDaPasta.length === 0 && (
                                <p className="text-xs text-muted-foreground py-2 px-2 italic">Pasta vazia</p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
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
                <p><strong>Tipo:</strong> {editingDataset.tipo}</p>
                <p><strong>Tamanho:</strong> {formatFileSize(editingDataset.tamanho)}</p>
                <p><strong>Enviado por:</strong> {editingDataset.usuario}</p>
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
                  <span>Tipo: {previewDataset.tipo}</span>
                  <span>Tamanho: {formatFileSize(previewDataset.tamanho)}</span>
                  <span>Por: {previewDataset.usuario}</span>
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
    </div>
  );
}
