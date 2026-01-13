import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Eye,
  Star,
  FileText,
  BookOpen,
  Scale,
  ClipboardList,
  FileCheck,
  CheckSquare,
  File,
  Filter,
  Loader2,
  GraduationCap,
  Quote,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return { message: txt };
  }
}

const baseConhecimentoSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  tipo: z.string().min(1, "Selecione o tipo"),
  categoria: z.string().optional(),
  subcategoria: z.string().optional(),
  tema: z.string().optional(),
  conteudo: z.string().optional(),
  arquivoUrl: z.string().optional(),
  arquivoNome: z.string().optional(),
  arquivoTipo: z.string().optional(),
  versao: z.string().optional(),
  tags: z.string().optional(),
  publico: z.boolean().optional(),
  destaque: z.boolean().optional(),
  status: z.string().optional(),
  isArtigoCientifico: z.boolean().optional(),
  citacaoAbnt: z.string().optional(),
  referenciaAbnt: z.string().optional(),
  resumoAuto: z.string().optional(),
  autores: z.string().optional(),
  anoPublicacao: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}$/.test(v), "Ano deve conter 4 dígitos (ex.: 2024)"),
  periodico: z.string().optional(),
  doi: z
    .string()
    .optional()
    .refine((v) => !v || /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(v), "DOI inválido"),
});

type BaseConhecimento = {
  id: number;
  titulo: string;
  descricao?: string;
  tipo: string;
  categoria?: string;
  subcategoria?: string;
  tema?: string;
  conteudo?: string;
  arquivoUrl?: string;
  arquivoNome?: string;
  arquivoTipo?: string;
  versao?: string;
  tags?: string;
  publico?: boolean;
  destaque?: boolean;
  visualizacoes?: number;
  downloads?: number;
  status: string;
  isArtigoCientifico?: boolean;
  citacaoAbnt?: string;
  referenciaAbnt?: string;
  resumoAuto?: string;
  autores?: string;
  anoPublicacao?: string;
  periodico?: string;
  doi?: string;
  criadoEm?: string;
};

type FormData = z.infer<typeof baseConhecimentoSchema>;

const TIPOS = [
  { value: "modelo", label: "Modelo", icon: FileText },
  { value: "procedimento", label: "Procedimento", icon: ClipboardList },
  { value: "legislacao", label: "Legislação", icon: Scale },
  { value: "manual", label: "Manual", icon: BookOpen },
  { value: "formulario", label: "Formulário", icon: FileCheck },
  { value: "checklist", label: "Checklist", icon: CheckSquare },
  { value: "artigo_cientifico", label: "Artigo Científico", icon: GraduationCap },
  { value: "outro", label: "Outro", icon: File },
];

const TEMAS = [
  { value: "fauna", label: "Fauna" },
  { value: "flora", label: "Flora" },
  { value: "recursos_hidricos", label: "Recursos Hídricos" },
  { value: "residuos", label: "Resíduos" },
  { value: "qualidade_ar", label: "Qualidade do Ar" },
  { value: "solo", label: "Solo" },
  { value: "ruido", label: "Ruído" },
  { value: "mudancas_climaticas", label: "Mudanças Climáticas" },
  { value: "biodiversidade", label: "Biodiversidade" },
  { value: "areas_protegidas", label: "Áreas Protegidas" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "educacao_ambiental", label: "Educação Ambiental" },
  { value: "legislacao", label: "Legislação" },
  { value: "gestao_ambiental", label: "Gestão Ambiental" },
  { value: "outro", label: "Outro" },
];

const CATEGORIAS = [
  { value: "licenciamento", label: "Licenciamento" },
  { value: "monitoramento", label: "Monitoramento" },
  { value: "sst", label: "SST" },
  { value: "rh", label: "RH" },
  { value: "financeiro", label: "Financeiro" },
  { value: "qualidade", label: "Qualidade" },
  { value: "meio_ambiente", label: "Meio Ambiente" },
  { value: "administrativo", label: "Administrativo" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo", color: "bg-green-500" },
  { value: "rascunho", label: "Rascunho", color: "bg-yellow-500" },
  { value: "arquivado", label: "Arquivado", color: "bg-gray-500" },
];

function getTipoIcon(tipo: string) {
  const tipoConfig = TIPOS.find((t) => t.value === tipo);
  if (tipoConfig) {
    const Icon = tipoConfig.icon;
    return <Icon className="h-5 w-5" />;
  }
  return <File className="h-5 w-5" />;
}

function getTipoLabel(tipo: string) {
  return TIPOS.find((t) => t.value === tipo)?.label || tipo;
}

function getCategoriaLabel(categoria: string | undefined) {
  if (!categoria) return "-";
  return CATEGORIAS.find((c) => c.value === categoria)?.label || categoria;
}

function getTemaLabel(tema: string | undefined) {
  if (!tema) return "-";
  return TEMAS.find((t) => t.value === tema)?.label || tema;
}

function getStatusBadge(status: string) {
  const s = STATUS_OPTIONS.find((x) => x.value === status);
  return s ? <Badge className={s.color}>{s.label}</Badge> : null;
}

export default function BaseConhecimentoPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [temaFilter, setTemaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseConhecimento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (categoriaFilter !== "all") params.categoria = categoriaFilter;
    if (temaFilter !== "all") params.tema = temaFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, tipoFilter, categoriaFilter, temaFilter, statusFilter]);

  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<BaseConhecimento[]>({
    queryKey: ["/api/base-conhecimento", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/base-conhecimento${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message || "Erro ao buscar documentos");
      }
      return res.json();
    },
    retry: 2,
    staleTime: 15_000,
  });

  const destaqueItems = useMemo(() => items.filter((item) => item.destaque), [items]);
  const regularItems = useMemo(() => items.filter((item) => !item.destaque), [items]);

  const form = useForm<FormData>({
    resolver: zodResolver(baseConhecimentoSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      subcategoria: "",
      tema: "",
      conteudo: "",
      arquivoUrl: "",
      arquivoNome: "",
      arquivoTipo: "",
      versao: "1.0",
      tags: "",
      publico: false,
      destaque: false,
      status: "ativo",
      isArtigoCientifico: false,
      citacaoAbnt: "",
      referenciaAbnt: "",
      resumoAuto: "",
      autores: "",
      anoPublicacao: "",
      periodico: "",
      doi: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/base-conhecimento", data);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao cadastrar documento");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento cadastrado com sucesso!" });
      setIsDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message || "Falha ao cadastrar documento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const res = await apiRequest("PUT", `/api/base-conhecimento/${id}`, data);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao atualizar documento");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento atualizado!" });
      setIsDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message || "Falha ao atualizar documento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/base-conhecimento/${id}`);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao excluir documento");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento removido!" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message || "Falha ao excluir documento",
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/base-conhecimento/${id}/download`);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao registrar download");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
    },
  });

  const onSubmit = (data: FormData) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
      return;
    }
    createMutation.mutate(data);
  };

  const handleNew = () => {
    setEditingItem(null);
    form.reset({
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      subcategoria: "",
      tema: "",
      conteudo: "",
      arquivoUrl: "",
      arquivoNome: "",
      arquivoTipo: "",
      versao: "1.0",
      tags: "",
      publico: false,
      destaque: false,
      status: "ativo",
      isArtigoCientifico: false,
      citacaoAbnt: "",
      referenciaAbnt: "",
      resumoAuto: "",
      autores: "",
      anoPublicacao: "",
      periodico: "",
      doi: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (item: BaseConhecimento) => {
    setEditingItem(item);
    form.reset({
      titulo: item.titulo,
      descricao: item.descricao || "",
      tipo: item.tipo,
      categoria: item.categoria || "",
      subcategoria: item.subcategoria || "",
      tema: item.tema || "",
      conteudo: item.conteudo || "",
      arquivoUrl: item.arquivoUrl || "",
      arquivoNome: item.arquivoNome || "",
      arquivoTipo: item.arquivoTipo || "",
      versao: item.versao || "1.0",
      tags: item.tags || "",
      publico: item.publico || false,
      destaque: item.destaque || false,
      status: item.status || "ativo",
      isArtigoCientifico: item.isArtigoCientifico || false,
      citacaoAbnt: item.citacaoAbnt || "",
      referenciaAbnt: item.referenciaAbnt || "",
      resumoAuto: item.resumoAuto || "",
      autores: item.autores || "",
      anoPublicacao: item.anoPublicacao || "",
      periodico: item.periodico || "",
      doi: item.doi || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) deleteMutation.mutate(itemToDelete);
  };

  const handleDownload = async (item: BaseConhecimento) => {
    if (!item.arquivoUrl) {
      toast({
        title: "Sem arquivo",
        description: "Este item não possui URL de arquivo.",
        variant: "destructive",
      });
      return;
    }

    window.open(item.arquivoUrl, "_blank");

    try {
      await downloadMutation.mutateAsync(item.id);
    } catch (e: any) {
      toast({
        title: "Aviso",
        description: e?.message || "Não foi possível registrar o download",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setCategoriaFilter("all");
    setTemaFilter("all");
    setStatusFilter("all");
  };

  const handleAnalyzeDocument = async () => {
    const filename = form.getValues("arquivoNome");
    const conteudo = form.getValues("conteudo");

    if (!filename && !conteudo) {
      toast({
        title: "Atenção",
        description: "Informe o nome do arquivo ou conteúdo para análise",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const contentPreview = conteudo ? conteudo.slice(0, 4000) : "";
      const res = await apiRequest("POST", "/api/base-conhecimento/analyze", {
        filename: filename || "documento.pdf",
        contentPreview,
      });
      const analysis = await safeJson(res);
      if (!res.ok) throw new Error(analysis?.message || "Falha ao analisar documento");

      if (analysis.titulo) form.setValue("titulo", analysis.titulo);
      if (analysis.tema) form.setValue("tema", analysis.tema);
      if (analysis.tags) form.setValue("tags", analysis.tags);
      if (analysis.resumoAuto) form.setValue("resumoAuto", analysis.resumoAuto);

      if (analysis.isArtigoCientifico) {
        form.setValue("isArtigoCientifico", true);
        form.setValue("tipo", "artigo_cientifico");

        if (analysis.autores) form.setValue("autores", analysis.autores);
        if (analysis.anoPublicacao) form.setValue("anoPublicacao", analysis.anoPublicacao);
        if (analysis.periodico) form.setValue("periodico", analysis.periodico);
        if (analysis.doi) form.setValue("doi", analysis.doi);
        if (analysis.citacaoAbnt) form.setValue("citacaoAbnt", analysis.citacaoAbnt);
        if (analysis.referenciaAbnt) form.setValue("referenciaAbnt", analysis.referenciaAbnt);
      }

      toast({
        title: "Análise concluída",
        description: analysis.isArtigoCientifico
          ? "Artigo científico identificado. Citação e referência geradas."
          : "Documento analisado com sucesso.",
      });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível analisar o documento",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copiado!",
        description: "Texto copiado para a área de transferência",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar. Verifique permissões do navegador.",
        variant: "destructive",
      });
    }
  };

  const DocumentCard = ({
    item,
    featured = false,
  }: {
    item: BaseConhecimento;
    featured?: boolean;
  }) => (
    <Card className={`group hover:shadow-lg transition-shadow ${featured ? "border-yellow-400 border-2" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${featured ? "bg-yellow-100 text-yellow-700" : "bg-primary/10 text-primary"}`}>
              {getTipoIcon(item.tipo)}
            </div>
            {item.destaque && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
            {item.isArtigoCientifico && <GraduationCap className="h-4 w-4 text-blue-500" />}
          </div>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} aria-label="Editar documento">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} aria-label="Excluir documento">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <CardTitle className="text-lg line-clamp-2 mt-2">{item.titulo}</CardTitle>

        <div className="flex flex-wrap gap-2 mt-1">
          <Badge variant="outline">{getTipoLabel(item.tipo)}</Badge>
          {item.categoria && <Badge variant="secondary">{getCategoriaLabel(item.categoria)}</Badge>}
          {item.tema && <Badge className="bg-green-100 text-green-700">{getTemaLabel(item.tema)}</Badge>}
          {getStatusBadge(item.status)}
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {item.resumoAuto && (
          <CardDescription className="line-clamp-3 mb-2 italic text-sm">{item.resumoAuto}</CardDescription>
        )}
        {item.descricao && !item.resumoAuto && (
          <CardDescription className="line-clamp-3">{item.descricao}</CardDescription>
        )}

        {item.isArtigoCientifico && item.citacaoAbnt && (
          <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
                <Quote className="h-3 w-3" /> Citação ABNT
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(item.citacaoAbnt!, "citacao")}
                aria-label="Copiar citação ABNT"
              >
                {copiedField === "citacao" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-1">{item.citacaoAbnt}</p>
          </div>
        )}

        {item.tags && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags
              .split(",")
              .map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag.trim()}
                </Badge>
              ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" /> {item.visualizacoes || 0}
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-4 w-4" /> {item.downloads || 0}
          </span>
        </div>

        <div className="flex gap-2 items-center">
          {item.versao && <span className="text-xs">v{item.versao}</span>}
          {item.arquivoUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(item)}
              disabled={downloadMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Base de Conhecimento
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie documentos, modelos, procedimentos e manuais da organização
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Documento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPOS.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={temaFilter} onValueChange={setTemaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Temas</SelectItem>
                {TEMAS.map((tema) => (
                  <SelectItem key={tema.value} value={tema.value}>
                    {tema.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="py-10">
          <CardContent className="space-y-2">
            <h3 className="text-lg font-semibold">Erro ao carregar documentos</h3>
            <p className="text-sm text-muted-foreground">
              {(error as any)?.message || "Falha desconhecida"}
            </p>
            <Button variant="outline" onClick={() => refetch()} className="gap-2">
              <Loader2 className="h-4 w-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {destaqueItems.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" /> Em Destaque
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {destaqueItems.map((item) => (
                  <DocumentCard key={item.id} item={item} featured />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {destaqueItems.length > 0 && regularItems.length > 0 && (
              <h2 className="text-xl font-semibold">Todos os Documentos</h2>
            )}

            {items.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nenhum documento encontrado</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || tipoFilter !== "all" || categoriaFilter !== "all" || temaFilter !== "all" || statusFilter !== "all"
                      ? "Tente ajustar os filtros ou a busca."
                      : "Comece adicionando seu primeiro documento."}
                  </p>
                  {!searchTerm &&
                    tipoFilter === "all" &&
                    categoriaFilter === "all" &&
                    temaFilter === "all" &&
                    statusFilter === "all" && (
                      <Button className="mt-4" onClick={handleNew}>
                        <Plus className="h-4 w-4 mr-2" /> Adicionar Documento
                      </Button>
                    )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(destaqueItems.length > 0 ? regularItems : items).map((item) => (
                  <DocumentCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Documento" : "Novo Documento"}</DialogTitle>
            <DialogDescription>Preencha as informações do documento</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input placeholder="Título do documento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIAS.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subcategoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subcategoria</FormLabel>
                      <FormControl>
                        <Input placeholder="Subcategoria (opcional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tema"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Tema</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tema" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TEMAS.map((tema) => (
                            <SelectItem key={tema.value} value={tema.value}>
                              {tema.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição do documento" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conteudo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Conteúdo</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Conteúdo do documento (texto ou markdown)" rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arquivoUrl"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>URL do Arquivo</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arquivoNome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Arquivo</FormLabel>
                      <FormControl>
                        <Input placeholder="documento.pdf" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAnalyzeDocument}
                    disabled={isAnalyzing}
                    className="gap-2"
                  >
                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Analisar Documento com IA
                  </Button>
                </div>

                {form.watch("isArtigoCientifico") && (
                  <div className="md:col-span-2 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                    <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Dados do Artigo Científico
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="autores"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Autores</FormLabel>
                            <FormControl>
                              <Input placeholder="SOBRENOME, Nome; SOBRENOME2, Nome2" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="anoPublicacao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ano de Publicação</FormLabel>
                            <FormControl>
                              <Input placeholder="2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="periodico"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Periódico/Revista</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do periódico" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="doi"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>DOI</FormLabel>
                            <FormControl>
                              <Input placeholder="10.xxxx/xxxxx" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="citacaoAbnt"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel className="flex items-center gap-1">
                              <Quote className="h-3 w-3" /> Citação ABNT
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="SILVA; SANTOS, 2023" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="referenciaAbnt"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Referência ABNT Completa</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="SOBRENOME, Nome. Título do artigo. Nome da Revista, v. X, n. Y, p. XX-XX, ano."
                                rows={2}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="resumoAuto"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Resumo (gerado automaticamente)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Resumo do documento..." rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arquivoTipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo do Arquivo</FormLabel>
                      <FormControl>
                        <Input placeholder="pdf, docx, xlsx..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="versao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Versão</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input placeholder="tag1, tag2, tag3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publico"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Público</FormLabel>
                        <p className="text-sm text-muted-foreground">Visível para todos os usuários</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destaque"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Destaque</FormLabel>
                        <p className="text-sm text-muted-foreground">Aparecer em destaque na listagem</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingItem ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
