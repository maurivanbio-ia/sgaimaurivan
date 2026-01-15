
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  ExternalLink,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { apiRequest, queryClient } from "@/lib/queryClient";

const baseConhecimentoSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  tipo: z.string().min(1, "Selecione o tipo"),
  categoria: z.string().optional(),
  subcategoria: z.string().optional(),
  conteudo: z.string().optional(),
  arquivoUrl: z.string().optional(),
  arquivoNome: z.string().optional(),
  arquivoTipo: z.string().optional(),
  versao: z.string().optional(),
  tags: z.string().optional(),
  publico: z.boolean().optional(),
  destaque: z.boolean().optional(),
  status: z.string().optional(),
});

type BaseConhecimento = {
  id: number;
  titulo: string;
  descricao?: string;
  tipo: string;
  categoria?: string;
  subcategoria?: string;
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
  { value: "outro", label: "Outro", icon: File },
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

function getStatusBadge(status: string) {
  const s = STATUS_OPTIONS.find((x) => x.value === status);
  return s ? <Badge className={s.color}>{s.label}</Badge> : null;
}

export default function BaseConhecimentoPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseConhecimento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (categoriaFilter !== "all") params.categoria = categoriaFilter;
    return params;
  }, [debouncedSearch, tipoFilter, categoriaFilter]);

  const { data: items = [], isLoading } = useQuery<BaseConhecimento[]>({
    queryKey: ["/api/base-conhecimento", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/base-conhecimento${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar documentos");
      return res.json();
    },
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
      conteudo: "",
      arquivoUrl: "",
      arquivoNome: "",
      arquivoTipo: "",
      versao: "1.0",
      tags: "",
      publico: false,
      destaque: false,
      status: "ativo",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => apiRequest("POST", "/api/base-conhecimento", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar documento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) =>
      apiRequest("PUT", `/api/base-conhecimento/${id}`, data),
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
        description: e?.message ?? "Falha ao atualizar documento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/base-conhecimento/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
      toast({ title: "Sucesso", description: "Documento removido!" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir documento",
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/base-conhecimento/${id}/download`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-conhecimento"] });
    },
  });

  const onSubmit = (data: FormData) => {
    editingItem
      ? updateMutation.mutate({ id: editingItem.id, data })
      : createMutation.mutate(data);
  };

  const handleNew = () => {
    setEditingItem(null);
    form.reset({
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      subcategoria: "",
      conteudo: "",
      arquivoUrl: "",
      arquivoNome: "",
      arquivoTipo: "",
      versao: "1.0",
      tags: "",
      publico: false,
      destaque: false,
      status: "ativo",
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
      conteudo: item.conteudo || "",
      arquivoUrl: item.arquivoUrl || "",
      arquivoNome: item.arquivoNome || "",
      arquivoTipo: item.arquivoTipo || "",
      versao: item.versao || "1.0",
      tags: item.tags || "",
      publico: item.publico || false,
      destaque: item.destaque || false,
      status: item.status || "ativo",
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

  const handleDownload = (item: BaseConhecimento) => {
    downloadMutation.mutate(item.id);
    if (item.arquivoUrl) {
      window.open(item.arquivoUrl, "_blank");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setCategoriaFilter("all");
  };

  const DocumentCard = ({ item, featured = false }: { item: BaseConhecimento; featured?: boolean }) => (
    <Card className={`group hover:shadow-lg transition-shadow ${featured ? "border-yellow-400 border-2" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${featured ? "bg-yellow-100 text-yellow-700" : "bg-primary/10 text-primary"}`}>
              {getTipoIcon(item.tipo)}
            </div>
            {item.destaque && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-lg line-clamp-2 mt-2">{item.titulo}</CardTitle>
        <div className="flex flex-wrap gap-2 mt-1">
          <Badge variant="outline">{getTipoLabel(item.tipo)}</Badge>
          {item.categoria && (
            <Badge variant="secondary">{getCategoriaLabel(item.categoria)}</Badge>
          )}
          {getStatusBadge(item.status)}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        {item.descricao && (
          <CardDescription className="line-clamp-3">{item.descricao}</CardDescription>
        )}
        {item.tags && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.split(",").map((tag, i) => (
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
        <div className="flex gap-2">
          {item.versao && (
            <span className="text-xs">v{item.versao}</span>
          )}
          {item.arquivoUrl && (
            <Button variant="outline" size="sm" onClick={() => handleDownload(item)}>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
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
                    {searchTerm || tipoFilter !== "all" || categoriaFilter !== "all"
                      ? "Tente ajustar os filtros ou busca"
                      : "Comece adicionando seu primeiro documento"}
                  </p>
                  {!searchTerm && tipoFilter === "all" && categoriaFilter === "all" && (
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
            <DialogTitle>
              {editingItem ? "Editar Documento" : "Novo Documento"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do documento
            </DialogDescription>
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
                  name="descricao"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição do documento"
                          rows={3}
                          {...field}
                        />
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
                        <Textarea
                          placeholder="Conteúdo do documento (texto ou markdown)"
                          rows={5}
                          {...field}
                        />
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
                        <p className="text-sm text-muted-foreground">
                          Visível para todos os usuários
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
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
                        <p className="text-sm text-muted-foreground">
                          Aparecer em destaque na listagem
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
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
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
