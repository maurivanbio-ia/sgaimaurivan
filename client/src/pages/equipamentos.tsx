import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Wrench,
  Loader2,
  Camera,
  Image as ImageIcon,
  Upload,
  XCircle,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const equipamentoSchema = z.object({
  id: z.number().optional(),
  nome: z.string().min(1, "Nome obrigatório"),
  tipo: z.string().min(1, "Selecione o tipo"),
  status: z.string().min(1, "Status obrigatório"),
  localizacaoAtual: z.string().min(1, "Selecione a localização"),
  responsavel: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroPatrimonio: z.string().optional(),
  dataAquisicao: z.string().optional(),
  ultimaManutencao: z.string().optional(),
  proximaManutencao: z.string().optional(),
  valorAquisicao: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional())
    .optional(),
  observacoes: z.string().optional(),
  empreendimentoId: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional())
    .optional(),
});

type Equipamento = z.infer<typeof equipamentoSchema>;

type EmpreendimentoListItem = {
  id: number;
  nome: string;
};

type ImagemDano = {
  filePath: string;
  descricao?: string;
  dataUpload: string;
  signedUrl?: string;
};

const EQUIPMENT_TYPES = [
  "Veículo",
  "GPS",
  "Drone",
  "Armadilha Fotográfica",
  "Estação Meteorológica",
  "Equipamento de Campo",
  "Notebook",
  "Tablet",
  "Smartphone",
  "Outro",
];

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível", color: "bg-green-500" },
  { value: "em_uso", label: "Em Uso", color: "bg-blue-500" },
  { value: "manutencao", label: "Manutenção", color: "bg-yellow-500" },
];

const LOCATION_OPTIONS = [
  "Escritório Central",
  "Almoxarifado",
  "Em Campo",
  "Cliente",
  "Colaborador",
  "Em Manutenção Externa",
  "Outro",
];

function extractErrorMessage(err: unknown, fallback: string) {
  if (!err) return fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}

function isAllowedImageType(mime: string) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return allowed.includes(mime);
}

export default function EquipamentosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localizacaoFilter, setLocalizacaoFilter] = useState("all");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipamentoToDelete, setEquipamentoToDelete] = useState<number | null>(null);

  const [imagensDialogOpen, setImagensDialogOpen] = useState(false);
  const [imagensEquipamentoId, setImagensEquipamentoId] = useState<number | null>(null);
  const [imagensEquipamentoNome, setImagensEquipamentoNome] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDescricao, setImageDescricao] = useState("");

  const [imageDeleteDialogOpen, setImageDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    if (localizacaoFilter !== "all") params.localizacaoAtual = localizacaoFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter, localizacaoFilter]);

  const statusLabelByValue = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    for (const s of STATUS_OPTIONS) map.set(s.value, { label: s.label, color: s.color });
    return map;
  }, []);

  const getStatusBadge = useCallback(
    (status: string) => {
      const s = statusLabelByValue.get(status);
      if (!s) return null;
      return <Badge className={s.color}>{s.label}</Badge>;
    },
    [statusLabelByValue],
  );

  const { data: equipamentos = [], isLoading } = useQuery<Equipamento[]>({
    queryKey: ["/api/equipamentos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await apiRequest("GET", `/api/equipamentos${qs ? `?${qs}` : ""}`);
      return res.json();
    },
    staleTime: 10_000,
  });

  const { data: empreendimentos = [] } = useQuery<EmpreendimentoListItem[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/empreendimentos");
      return res.json();
    },
    staleTime: 30_000,
  });

  const form = useForm<Equipamento>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: {
      nome: "",
      tipo: "",
      status: "disponivel",
      localizacaoAtual: "",
    },
  });

  const invalidateEquipamentos = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"], exact: false });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (data: Equipamento) => apiRequest("POST", "/api/equipamentos", data),
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Equipamento cadastrado com sucesso!" });
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      form.reset();
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha ao cadastrar equipamento"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Equipamento }) => apiRequest("PUT", `/api/equipamentos/${id}`, data),
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Equipamento atualizado!" });
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      form.reset();
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha ao atualizar equipamento"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/equipamentos/${id}`),
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Equipamento removido!" });
      setDeleteDialogOpen(false);
      setEquipamentoToDelete(null);
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha ao excluir equipamento"),
        variant: "destructive",
      });
    },
  });

  const { data: imagensDano = [], refetch: refetchImagens } = useQuery<ImagemDano[]>({
    queryKey: ["/api/equipamentos", imagensEquipamentoId, "imagens"],
    queryFn: async () => {
      if (!imagensEquipamentoId) return [];
      const res = await apiRequest("GET", `/api/equipamentos/${imagensEquipamentoId}/imagens`);
      return res.json();
    },
    enabled: !!imagensEquipamentoId && imagensDialogOpen,
    staleTime: 0,
  });

  const openFormDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeFormDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingEquipamento(null);
    form.reset({
      nome: "",
      tipo: "",
      status: "disponivel",
      localizacaoAtual: "",
      responsavel: "",
      marca: "",
      modelo: "",
      numeroPatrimonio: "",
      dataAquisicao: "",
      ultimaManutencao: "",
      proximaManutencao: "",
      valorAquisicao: undefined,
      observacoes: "",
      empreendimentoId: undefined,
    });
  }, [form]);

  const handleNew = useCallback(() => {
    setEditingEquipamento(null);
    form.reset({
      nome: "",
      tipo: "",
      status: "disponivel",
      localizacaoAtual: "",
      responsavel: "",
      marca: "",
      modelo: "",
      numeroPatrimonio: "",
      dataAquisicao: "",
      ultimaManutencao: "",
      proximaManutencao: "",
      valorAquisicao: undefined,
      observacoes: "",
      empreendimentoId: undefined,
    });
    openFormDialog();
  }, [form, openFormDialog]);

  const handleEdit = useCallback(
    (equipamento: Equipamento) => {
      setEditingEquipamento(equipamento);
      form.reset({
        ...equipamento,
        dataAquisicao: equipamento.dataAquisicao || "",
        ultimaManutencao: equipamento.ultimaManutencao || "",
        proximaManutencao: equipamento.proximaManutencao || "",
      });
      openFormDialog();
    },
    [form, openFormDialog],
  );

  const handleDelete = useCallback((id: number) => {
    setEquipamentoToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (equipamentoToDelete) deleteMutation.mutate(equipamentoToDelete);
  }, [deleteMutation, equipamentoToDelete]);

  const onSubmit = useCallback(
    (data: Equipamento) => {
      if (editingEquipamento?.id) {
        updateMutation.mutate({ id: editingEquipamento.id, data });
        return;
      }
      createMutation.mutate(data);
    },
    [createMutation, editingEquipamento?.id, updateMutation],
  );

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setTipoFilter("all");
    setStatusFilter("all");
    setLocalizacaoFilter("all");
  }, []);

  const handleOpenImagens = useCallback((equipamento: Equipamento) => {
    if (!equipamento.id) return;
    setImagensEquipamentoId(equipamento.id);
    setImagensEquipamentoNome(equipamento.nome);
    setImageDescricao("");
    setImageToDelete(null);
    setImageDeleteDialogOpen(false);
    setImagensDialogOpen(true);
  }, []);

  const closeImagensDialog = useCallback(() => {
    setImagensDialogOpen(false);
    setImagensEquipamentoId(null);
    setImagensEquipamentoNome("");
    setImageDescricao("");
    setUploadingImage(false);
    setImageToDelete(null);
    setImageDeleteDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const validateImageFile = useCallback(
    (file: File) => {
      if (!isAllowedImageType(file.type)) {
        toast({
          title: "Arquivo inválido",
          description: "Envie uma imagem JPG, PNG, WebP ou GIF.",
          variant: "destructive",
        });
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({
          title: "Arquivo muito grande",
          description: "Tamanho máximo permitido é 10MB.",
          variant: "destructive",
        });
        return false;
      }
      return true;
    },
    [toast],
  );

  const handleUploadImage = useCallback(
    async (file: File) => {
      if (!imagensEquipamentoId) return;
      if (!validateImageFile(file)) return;

      setUploadingImage(true);
      try {
        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

        const urlRes = await apiRequest("POST", `/api/equipamentos/${imagensEquipamentoId}/imagens/upload-url`, {
          extension,
          contentType: file.type,
          filename: file.name,
        });
        const { uploadUrl, filePath } = await urlRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadRes.ok) {
          throw new Error("Falha ao enviar arquivo");
        }

        const registerRes = await apiRequest("POST", `/api/equipamentos/${imagensEquipamentoId}/imagens`, {
          filePath,
          descricao: imageDescricao?.trim() ? imageDescricao.trim() : undefined,
        });

        if (!registerRes.ok) {
          const msg = await registerRes.text().catch(() => "");
          throw new Error(msg || "Falha ao registrar imagem");
        }

        toast({ title: "Sucesso", description: "Imagem enviada com sucesso!" });
        setImageDescricao("");
        await refetchImagens();
        invalidateEquipamentos();

        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        toast({
          title: "Erro",
          description: extractErrorMessage(error, "Falha ao enviar imagem"),
          variant: "destructive",
        });
      } finally {
        setUploadingImage(false);
      }
    },
    [imageDescricao, imagensEquipamentoId, invalidateEquipamentos, refetchImagens, toast, validateImageFile],
  );

  const requestDeleteImage = useCallback((filePath: string) => {
    setImageToDelete(filePath);
    setImageDeleteDialogOpen(true);
  }, []);

  const confirmDeleteImage = useCallback(async () => {
    if (!imagensEquipamentoId || !imageToDelete) return;

    try {
      const res = await apiRequest("DELETE", `/api/equipamentos/${imagensEquipamentoId}/imagens`, {
        filePath: imageToDelete,
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Falha ao excluir imagem");
      }

      toast({ title: "Sucesso", description: "Imagem removida!" });
      setImageDeleteDialogOpen(false);
      setImageToDelete(null);
      await refetchImagens();
      invalidateEquipamentos();
    } catch (error) {
      toast({
        title: "Erro",
        description: extractErrorMessage(error, "Falha ao excluir imagem"),
        variant: "destructive",
      });
    }
  }, [imageToDelete, imagensEquipamentoId, invalidateEquipamentos, refetchImagens, toast]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(searchTerm) || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all";
  }, [localizacaoFilter, searchTerm, statusFilter, tipoFilter]);

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Gestão de Equipamentos
          </h1>
          <p className="text-muted-foreground mt-2">Gerencie equipamentos ambientais e operacionais utilizados nos projetos</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Button onClick={handleNew} data-testid="button-novo-equipamento">
            <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, marca, modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-equipamentos"
                aria-label="Buscar equipamentos"
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger data-testid="select-tipo-filter" aria-label="Filtro por tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {EQUIPMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter" aria-label="Filtro por status">
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

            <Select value={localizacaoFilter} onValueChange={setLocalizacaoFilter}>
              <SelectTrigger data-testid="select-localizacao-filter" aria-label="Filtro por localização">
                <SelectValue placeholder="Localização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Localizações</SelectItem>
                {LOCATION_OPTIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters" aria-label="Limpar filtros">
              <X className="h-4 w-4 mr-2" /> Limpar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : equipamentos.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum equipamento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters ? "Tente ajustar os filtros para encontrar equipamentos." : "Comece cadastrando seu primeiro equipamento."}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters} aria-label="Limpar filtros">
                  Limpar Filtros
                </Button>
              ) : (
                <Button onClick={handleNew} aria-label="Cadastrar primeiro equipamento">
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar Primeiro Equipamento
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label="Tabela de equipamentos cadastrados">
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Marca. Modelo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Última Manutenção</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipamentos.map((e) => {
                    const marcaModelo = [e.marca, e.modelo].filter(Boolean).join(" . ") || " . ";
                    return (
                      <TableRow key={e.id} data-testid={`row-equipamento-${e.id}`}>
                        <TableCell className="font-medium">{e.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{e.nome}</p>
                            {e.numeroPatrimonio && <p className="text-xs text-muted-foreground">#{e.numeroPatrimonio}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{e.tipo}</TableCell>
                        <TableCell>{marcaModelo}</TableCell>
                        <TableCell>{getStatusBadge(e.status)}</TableCell>
                        <TableCell>{e.localizacaoAtual}</TableCell>
                        <TableCell>{e.responsavel || " . "}</TableCell>
                        <TableCell>
                          {e.ultimaManutencao ? new Date(e.ultimaManutencao).toLocaleDateString("pt-BR") : " . "}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label="Ver e adicionar imagens de dano"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenImagens(e)}
                              title="Ver. Adicionar imagens de dano"
                            >
                              <Camera className="h-4 w-4 text-orange-500" />
                            </Button>

                            <Button aria-label="Editar equipamento" variant="ghost" size="sm" onClick={() => handleEdit(e)}>
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              aria-label="Excluir equipamento"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(e.id!)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog();
            return;
          }
          setIsDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
            <DialogDescription>{editingEquipamento ? "Atualize os dados do equipamento." : "Preencha as informações para cadastrar."}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="nome"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input {...field} aria-label="Nome do equipamento" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="tipo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Tipo do equipamento">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EQUIPMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="marca"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Marca" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="modelo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Modelo" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Status do equipamento">
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
                  name="localizacaoAtual"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização Atual *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Localização atual do equipamento">
                            <SelectValue placeholder="Selecione a localização" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATION_OPTIONS.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="responsavel"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Responsável" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="empreendimentoId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-empreendimento" aria-label="Empreendimento associado">
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {empreendimentos.map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>
                              {e.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="numeroPatrimonio"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Patrimônio</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Número de patrimônio" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="dataAquisicao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Aquisição</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} aria-label="Data de aquisição" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="ultimaManutencao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Última Manutenção</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} aria-label="Última manutenção" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="proximaManutencao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próxima Manutenção</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} aria-label="Próxima manutenção" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="valorAquisicao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Aquisição (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value === undefined || field.value === null ? "" : String(field.value)}
                          onChange={(e) => {
                            const v = e.target.value;
                            field.onChange(v === "" ? undefined : Number(v));
                          }}
                          placeholder="0.00"
                          aria-label="Valor de aquisição"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                name="observacoes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} rows={3} aria-label="Observações" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeFormDialog} aria-label="Cancelar">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} aria-label="Salvar equipamento">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingEquipamento ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={imagensDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeImagensDialog();
            return;
          }
          setImagensDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-orange-500" />
              Imagens de Dano . {imagensEquipamentoNome}
            </DialogTitle>
            <DialogDescription>Registre fotos de danos, avarias ou problemas do equipamento para acompanhamento</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card className="border-dashed border-2 border-orange-300 bg-orange-50 dark:bg-orange-900/10">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Descrição do Dano (opcional)</label>
                    <Input
                      placeholder="Ex: Arranhão na lateral, Tela trincada, etc."
                      value={imageDescricao}
                      onChange={(e) => setImageDescricao(e.target.value)}
                      aria-label="Descrição do dano"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file);
                        }}
                        disabled={uploadingImage}
                      />
                      <div
                        className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") fileInputRef.current?.click();
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Selecionar imagem para upload"
                      >
                        {uploadingImage ? (
                          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                        ) : (
                          <Upload className="h-5 w-5 text-orange-500" />
                        )}
                        <span className="text-sm font-medium">{uploadingImage ? "Enviando..." : "Clique para selecionar imagem"}</span>
                      </div>
                    </label>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG, GIF, WebP. Tamanho máximo: 10MB
                  </p>
                </div>
              </CardContent>
            </Card>

            {imagensDano.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma imagem de dano registrada</p>
                <p className="text-sm text-muted-foreground">Use o botão acima para adicionar fotos</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imagensDano.map((img, index) => (
                  <Card key={`${img.filePath}-${index}`} className="overflow-hidden">
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                      {img.signedUrl ? (
                        <img
                          src={img.signedUrl}
                          alt={img.descricao || `Imagem de dano ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => requestDeleteImage(img.filePath)}
                        aria-label="Excluir imagem"
                        title="Excluir imagem"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>

                    <CardContent className="p-3">
                      {img.descricao && <p className="text-sm font-medium mb-1">{img.descricao}</p>}
                      <p className="text-xs text-muted-foreground">
                        Enviado em:{" "}
                        {new Date(img.dataUpload).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImagensDialog} aria-label="Fechar">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={imageDeleteDialogOpen} onOpenChange={setImageDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente remover esta imagem de dano? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setImageDeleteDialogOpen(false);
                setImageToDelete(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteImage}
              className="bg-red-500 hover:bg-red-600"
              disabled={!imageToDelete}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
