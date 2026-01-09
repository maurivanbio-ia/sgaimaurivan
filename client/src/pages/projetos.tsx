"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, X, FolderKanban, Loader2, DollarSign, Calendar, Target, ExternalLink } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/date-utils";

const projetoSchema = z.object({
  id: z.number().optional(),
  empreendimentoId: z.preprocess((v) => Number(v), z.number().min(1, "Empreendimento obrigatório")),
  nome: z.string().min(1, "Nome obrigatório"),
  descricao: z.string().optional(),
  status: z.string().default("em_planejamento"),
  coordenadorId: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
  valorContratado: z.string().optional(),
  valorRecebido: z.string().optional(),
  orcamentoPrevisto: z.string().optional(),
  metaReducaoGastos: z.string().optional(),
  inicioPrevisto: z.string().optional(),
  inicioReal: z.string().optional(),
  fimPrevisto: z.string().optional(),
  fimReal: z.string().optional(),
  bmmServicos: z.string().optional(),
  ndReembolsaveis: z.string().optional(),
});

type Projeto = z.infer<typeof projetoSchema>;

const STATUS_OPTIONS = [
  { value: "em_planejamento", label: "Em Planejamento", color: "bg-blue-100 text-blue-800" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-yellow-100 text-yellow-800" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800" },
  { value: "pausado", label: "Pausado", color: "bg-gray-100 text-gray-800" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-100 text-red-800" },
];

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

export default function ProjetosPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projetoToDelete, setProjetoToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    if (empreendimentoFilter !== "all") params.empreendimentoId = empreendimentoFilter;
    return params;
  }, [debouncedSearch, statusFilter, empreendimentoFilter]);

  const { data: projetos = [], isLoading } = useQuery<(Projeto & { empreendimentoNome?: string })[]>({
    queryKey: ["/api/projetos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/projetos${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar projetos");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: coordenadores = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const form = useForm<Projeto>({
    resolver: zodResolver(projetoSchema),
    defaultValues: {
      empreendimentoId: undefined,
      nome: "",
      descricao: "",
      status: "em_planejamento",
      coordenadorId: undefined,
      valorContratado: "",
      valorRecebido: "",
      orcamentoPrevisto: "",
      metaReducaoGastos: "",
      inicioPrevisto: "",
      inicioReal: "",
      fimPrevisto: "",
      fimReal: "",
      bmmServicos: "",
      ndReembolsaveis: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Projeto) => apiRequest("POST", "/api/projetos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos"] });
      toast({ title: "Sucesso", description: "Projeto cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar projeto",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Projeto }) =>
      apiRequest("PUT", `/api/projetos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos"] });
      toast({ title: "Sucesso", description: "Projeto atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingProjeto(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar projeto",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/projetos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos"] });
      toast({ title: "Sucesso", description: "Projeto excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setProjetoToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir projeto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Projeto) => {
    if (editingProjeto?.id) {
      updateMutation.mutate({ id: editingProjeto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openCreateDialog = () => {
    setEditingProjeto(null);
    form.reset({
      empreendimentoId: undefined,
      nome: "",
      descricao: "",
      status: "em_planejamento",
      coordenadorId: undefined,
      valorContratado: "",
      valorRecebido: "",
      orcamentoPrevisto: "",
      metaReducaoGastos: "",
      inicioPrevisto: "",
      inicioReal: "",
      fimPrevisto: "",
      fimReal: "",
      bmmServicos: "",
      ndReembolsaveis: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (projeto: Projeto) => {
    setEditingProjeto(projeto);
    form.reset({
      ...projeto,
      valorContratado: projeto.valorContratado || "",
      valorRecebido: projeto.valorRecebido || "",
      orcamentoPrevisto: projeto.orcamentoPrevisto || "",
      metaReducaoGastos: projeto.metaReducaoGastos || "",
      inicioPrevisto: projeto.inicioPrevisto || "",
      inicioReal: projeto.inicioReal || "",
      fimPrevisto: projeto.fimPrevisto || "",
      fimReal: projeto.fimReal || "",
      bmmServicos: projeto.bmmServicos || "",
      ndReembolsaveis: projeto.ndReembolsaveis || "",
    });
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find((opt) => opt.value === status);
    return (
      <Badge className={option?.color || "bg-gray-100 text-gray-800"}>
        {option?.label || status}
      </Badge>
    );
  };

  const totalValorContratado = projetos.reduce((sum, p) => sum + Number(p.valorContratado || 0), 0);
  const totalValorRecebido = projetos.reduce((sum, p) => sum + Number(p.valorRecebido || 0), 0);
  const projetosEmAndamento = projetos.filter(p => p.status === 'em_andamento').length;
  const projetosConcluidos = projetos.filter(p => p.status === 'concluido').length;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderKanban className="h-8 w-8" />
            Gestão de Projetos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os projetos vinculados aos empreendimentos
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton queryKey={["/api/projetos"]} />
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total de Projetos</p>
                <p className="text-2xl font-bold">{projetos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-yellow-600">{projetosEmAndamento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Contratado</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalValorContratado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Recebido</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalValorRecebido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
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
            <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Empreendimentos</SelectItem>
                {empreendimentos.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : projetos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum projeto encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Valor Contratado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetos.map((projeto) => (
                  <TableRow key={projeto.id}>
                    <TableCell className="font-medium">{projeto.nome}</TableCell>
                    <TableCell>
                      <Link href={`/empreendimentos/${projeto.empreendimentoId}`}>
                        <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                          {(projeto as any).empreendimentoNome || `#${projeto.empreendimentoId}`}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{getStatusBadge(projeto.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {projeto.inicioPrevisto && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(projeto.inicioPrevisto)} - {projeto.fimPrevisto ? formatDate(projeto.fimPrevisto) : "..."}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(projeto.valorContratado)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(projeto)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setProjetoToDelete(projeto.id!);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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
              {editingProjeto ? "Editar Projeto" : "Novo Projeto"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do projeto
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="empreendimentoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento *</FormLabel>
                      <Select
                        value={field.value?.toString() || ""}
                        onValueChange={(v) => field.onChange(parseInt(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {empreendimentos.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              {emp.nome}
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
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
              </div>

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Projeto *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Monitoramento Fauna" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrição do projeto..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="coordenadorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coordenador</FormLabel>
                    <Select
                      value={field.value?.toString() || ""}
                      onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o coordenador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {coordenadores.map((coord: any) => (
                          <SelectItem key={coord.id} value={coord.id.toString()}>
                            {coord.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valorContratado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Contratado (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valorRecebido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Recebido (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inicioPrevisto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início Previsto</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fimPrevisto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Término Previsto</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bmmServicos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BMM Serviços</FormLabel>
                      <FormControl>
                        <Input placeholder="Número BMM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ndReembolsaveis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ND Reembolsáveis</FormLabel>
                      <FormControl>
                        <Input placeholder="Número ND" {...field} />
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
                  {editingProjeto ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projetoToDelete && deleteMutation.mutate(projetoToDelete)}
              className="bg-red-600 hover:bg-red-700"
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
