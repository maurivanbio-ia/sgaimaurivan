"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, Users, Loader2, GraduationCap, UserPlus, X } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const treinamentoSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  tipo: z.string().min(1, "Tipo obrigatório"),
  categoria: z.string().optional(),
  cargaHoraria: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().optional()
  ),
  modalidade: z.string().default("presencial"),
  instituicao: z.string().optional(),
  instrutor: z.string().optional(),
  local: z.string().optional(),
  dataInicio: z.string().min(1, "Data de início obrigatória"),
  dataFim: z.string().optional(),
  dataValidade: z.string().optional(),
  status: z.string().default("agendado"),
  custoTotal: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : String(v)),
    z.string().optional()
  ),
  observacoes: z.string().optional(),
  obrigatorio: z.boolean().default(false),
});

const participanteSchema = z.object({
  treinamentoId: z.number(),
  nome: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  presenca: z.boolean().default(false),
  aprovado: z.boolean().optional(),
  observacoes: z.string().optional(),
});

type Treinamento = z.infer<typeof treinamentoSchema>;
type Participante = z.infer<typeof participanteSchema> & { id?: number };

const TIPO_OPTIONS = [
  { value: "nr", label: "NR (Norma Regulamentadora)" },
  { value: "tecnico", label: "Técnico" },
  { value: "obrigatorio", label: "Obrigatório" },
  { value: "reciclagem", label: "Reciclagem" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
  { value: "outro", label: "Outro" },
];

const MODALIDADE_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "hibrido", label: "Híbrido" },
];

const STATUS_OPTIONS = [
  { value: "agendado", label: "Agendado", color: "bg-blue-500" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-yellow-500" },
  { value: "concluido", label: "Concluído", color: "bg-green-500" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-500" },
];

export default function TreinamentosPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTreinamento, setEditingTreinamento] = useState<Treinamento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [treinamentoToDelete, setTreinamentoToDelete] = useState<number | null>(null);
  
  const [participantesDialogOpen, setParticipantesDialogOpen] = useState(false);
  const [selectedTreinamento, setSelectedTreinamento] = useState<Treinamento | null>(null);
  const [addParticipanteDialogOpen, setAddParticipanteDialogOpen] = useState(false);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter]);

  const { data: treinamentos = [], isLoading } = useQuery<Treinamento[]>({
    queryKey: ["/api/treinamentos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/treinamentos${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar treinamentos");
      return res.json();
    },
  });

  const { data: participantes = [], isLoading: loadingParticipantes } = useQuery<Participante[]>({
    queryKey: ["/api/treinamento-participantes", selectedTreinamento?.id],
    queryFn: async () => {
      if (!selectedTreinamento?.id) return [];
      const res = await fetch(`/api/treinamento-participantes?treinamentoId=${selectedTreinamento.id}`);
      if (!res.ok) throw new Error("Erro ao buscar participantes");
      return res.json();
    },
    enabled: !!selectedTreinamento?.id && participantesDialogOpen,
  });

  const form = useForm<Treinamento>({
    resolver: zodResolver(treinamentoSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      tipo: "",
      categoria: "",
      modalidade: "presencial",
      instituicao: "",
      instrutor: "",
      local: "",
      dataInicio: "",
      dataFim: "",
      dataValidade: "",
      status: "agendado",
      observacoes: "",
      obrigatorio: false,
    },
  });

  const participanteForm = useForm<Participante>({
    resolver: zodResolver(participanteSchema),
    defaultValues: {
      treinamentoId: 0,
      nome: "",
      email: "",
      presenca: false,
      aprovado: undefined,
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Treinamento) => apiRequest("POST", "/api/treinamentos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treinamentos"] });
      toast({ title: "Sucesso", description: "Treinamento cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar treinamento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Treinamento }) =>
      apiRequest("PUT", `/api/treinamentos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treinamentos"] });
      toast({ title: "Sucesso", description: "Treinamento atualizado!" });
      setIsDialogOpen(false);
      setEditingTreinamento(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar treinamento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/treinamentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treinamentos"] });
      toast({ title: "Sucesso", description: "Treinamento removido!" });
      setDeleteDialogOpen(false);
      setTreinamentoToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir treinamento",
        variant: "destructive",
      });
    },
  });

  const addParticipanteMutation = useMutation({
    mutationFn: async (data: Participante) => apiRequest("POST", "/api/treinamento-participantes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treinamento-participantes", selectedTreinamento?.id] });
      toast({ title: "Sucesso", description: "Participante adicionado!" });
      setAddParticipanteDialogOpen(false);
      participanteForm.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao adicionar participante",
        variant: "destructive",
      });
    },
  });

  const deleteParticipanteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/treinamento-participantes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/treinamento-participantes", selectedTreinamento?.id] });
      toast({ title: "Sucesso", description: "Participante removido!" });
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao remover participante",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Treinamento) => {
    editingTreinamento
      ? updateMutation.mutate({ id: editingTreinamento.id!, data })
      : createMutation.mutate(data);
  };

  const onSubmitParticipante = (data: Participante) => {
    addParticipanteMutation.mutate({
      ...data,
      treinamentoId: selectedTreinamento?.id!,
    });
  };

  const handleNew = () => {
    setEditingTreinamento(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (treinamento: Treinamento) => {
    setEditingTreinamento(treinamento);
    form.reset({
      ...treinamento,
      custoTotal: treinamento.custoTotal ? String(treinamento.custoTotal) : "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setTreinamentoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (treinamentoToDelete) deleteMutation.mutate(treinamentoToDelete);
  };

  const handleOpenParticipantes = (treinamento: Treinamento) => {
    setSelectedTreinamento(treinamento);
    setParticipantesDialogOpen(true);
  };

  const handleAddParticipante = () => {
    participanteForm.reset({
      treinamentoId: selectedTreinamento?.id,
      nome: "",
      email: "",
      presenca: false,
      aprovado: undefined,
      observacoes: "",
    });
    setAddParticipanteDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setStatusFilter("all");
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_OPTIONS.find((x) => x.value === status);
    return s ? <Badge className={s.color}>{s.label}</Badge> : <Badge>{status}</Badge>;
  };

  const getTipoLabel = (tipo: string) => {
    const t = TIPO_OPTIONS.find((x) => x.value === tipo);
    return t?.label || tipo;
  };

  const getModalidadeLabel = (modalidade: string) => {
    const m = MODALIDADE_OPTIONS.find((x) => x.value === modalidade);
    return m?.label || modalidade;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-treinamentos">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-8 w-8" />
            Gestão de Treinamentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie treinamentos e capacitações da equipe
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Button onClick={handleNew} data-testid="button-novo-treinamento">
            <Plus className="h-4 w-4 mr-2" /> Novo Treinamento
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
                placeholder="Buscar por título, instituição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-treinamentos"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
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

      <Card>
        <CardHeader>
          <CardTitle>Treinamentos ({treinamentos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : treinamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum treinamento encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Carga Horária</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {treinamentos.map((treinamento) => (
                  <TableRow key={treinamento.id}>
                    <TableCell className="font-medium">
                      <div>
                        {treinamento.titulo}
                        {treinamento.obrigatorio && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      {treinamento.instituicao && (
                        <div className="text-sm text-muted-foreground">
                          {treinamento.instituicao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getTipoLabel(treinamento.tipo)}</TableCell>
                    <TableCell>{getModalidadeLabel(treinamento.modalidade)}</TableCell>
                    <TableCell>{formatDate(treinamento.dataInicio)}</TableCell>
                    <TableCell>
                      {treinamento.cargaHoraria ? `${treinamento.cargaHoraria}h` : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(treinamento.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenParticipantes(treinamento)}
                          title="Gerenciar Participantes"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(treinamento)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(treinamento.id!)}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTreinamento ? "Editar Treinamento" : "Novo Treinamento"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do treinamento
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
                        <Input placeholder="Nome do treinamento" {...field} />
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
                          {TIPO_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
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
                  name="modalidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modalidade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a modalidade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODALIDADE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
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
                          {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
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
                  name="cargaHoraria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carga Horária (horas)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ex: 8"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Término</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataValidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Validade (Certificado)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instituicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instituição</FormLabel>
                      <FormControl>
                        <Input placeholder="Instituição responsável" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="instrutor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instrutor</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do instrutor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="local"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local</FormLabel>
                      <FormControl>
                        <Input placeholder="Local do treinamento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="custoTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custo Total (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="Ex: NR-10, NR-35" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="obrigatorio"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Treinamento Obrigatório</FormLabel>
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
                  name="descricao"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição do treinamento"
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
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observações adicionais"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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
                  {editingTreinamento ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={participantesDialogOpen} onOpenChange={setParticipantesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Participantes - {selectedTreinamento?.titulo}
            </DialogTitle>
            <DialogDescription>
              Gerencie os participantes deste treinamento
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-4">
            <Button onClick={handleAddParticipante}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Participante
            </Button>
          </div>

          {loadingParticipantes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : participantes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum participante cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Presença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participantes.map((participante) => (
                  <TableRow key={participante.id}>
                    <TableCell className="font-medium">{participante.nome}</TableCell>
                    <TableCell>{participante.email || "-"}</TableCell>
                    <TableCell>
                      {participante.presenca ? (
                        <Badge className="bg-green-500">Presente</Badge>
                      ) : (
                        <Badge variant="outline">Ausente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {participante.aprovado === true && (
                        <Badge className="bg-green-500">Aprovado</Badge>
                      )}
                      {participante.aprovado === false && (
                        <Badge className="bg-red-500">Reprovado</Badge>
                      )}
                      {participante.aprovado === null || participante.aprovado === undefined ? (
                        <Badge variant="outline">Pendente</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteParticipanteMutation.mutate(participante.id!)}
                        title="Remover"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addParticipanteDialogOpen} onOpenChange={setAddParticipanteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Participante</DialogTitle>
            <DialogDescription>
              Adicione um novo participante ao treinamento
            </DialogDescription>
          </DialogHeader>
          <Form {...participanteForm}>
            <form onSubmit={participanteForm.handleSubmit(onSubmitParticipante)} className="space-y-4">
              <FormField
                control={participanteForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do participante" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={participanteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={participanteForm.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddParticipanteDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={addParticipanteMutation.isPending}>
                  {addParticipanteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Adicionar
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
            <AlertDialogDescription>
              Tem certeza que deseja excluir este treinamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
