"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, X, Wrench, Loader2 } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
});

type Equipamento = z.infer<typeof equipamentoSchema>;

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

export default function EquipamentosPage() {
  const { toast } = useToast();

  // Estado de filtros e UI
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localizacaoFilter, setLocalizacaoFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipamentoToDelete, setEquipamentoToDelete] = useState<number | null>(null);

  // Filtros → query string
  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    if (localizacaoFilter !== "all") params.localizacaoAtual = localizacaoFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter, localizacaoFilter]);

  // Busca equipamentos
  const { data: equipamentos = [], isLoading } = useQuery<Equipamento[]>({
    queryKey: ["/api/equipamentos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/equipamentos${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar equipamentos");
      return res.json();
    },
  });

  // Formulário
  const form = useForm<Equipamento>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: {
      nome: "",
      tipo: "",
      status: "disponivel",
      localizacaoAtual: "",
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Equipamento) => apiRequest("POST", "/api/equipamentos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({ title: "Sucesso", description: "Equipamento cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar equipamento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Equipamento }) =>
      apiRequest("PUT", `/api/equipamentos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({ title: "Sucesso", description: "Equipamento atualizado!" });
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar equipamento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/equipamentos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({ title: "Sucesso", description: "Equipamento removido!" });
      setDeleteDialogOpen(false);
      setEquipamentoToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir equipamento",
        variant: "destructive",
      });
    },
  });

  // Ações
  const onSubmit = (data: Equipamento) => {
    editingEquipamento
      ? updateMutation.mutate({ id: editingEquipamento.id!, data })
      : createMutation.mutate(data);
  };

  const handleNew = () => {
    setEditingEquipamento(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (equipamento: Equipamento) => {
    setEditingEquipamento(equipamento);
    form.reset(equipamento);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setEquipamentoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (equipamentoToDelete) deleteMutation.mutate(equipamentoToDelete);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setStatusFilter("all");
    setLocalizacaoFilter("all");
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_OPTIONS.find((x) => x.value === status);
    return s ? <Badge className={s.color}>{s.label}</Badge> : null;
    };

  // UI
  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Gestão de Equipamentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie equipamentos ambientais e operacionais utilizados nos projetos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleNew} data-testid="button-novo-equipamento">
            <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
          </Button>
        </div>
      </div>

      {/* Filtros */}
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
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger data-testid="select-tipo-filter"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {EQUIPMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={localizacaoFilter} onValueChange={setLocalizacaoFilter}>
              <SelectTrigger data-testid="select-localizacao-filter"><SelectValue placeholder="Localização" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Localizações</SelectItem>
                {LOCATION_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(searchTerm || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-2" /> Limpar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
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
                {searchTerm || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all"
                  ? "Tente ajustar os filtros para encontrar equipamentos."
                  : "Comece cadastrando seu primeiro equipamento."}
              </p>
              {(searchTerm || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all") ? (
                <Button variant="outline" onClick={clearFilters}>Limpar Filtros</Button>
              ) : (
                <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" /> Cadastrar Primeiro Equipamento</Button>
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
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Última Manutenção</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipamentos.map((e) => (
                    <TableRow key={e.id} data-testid={`row-equipamento-${e.id}`}>
                      <TableCell className="font-medium">{e.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{e.nome}</p>
                          {e.numeroPatrimonio && (
                            <p className="text-xs text-muted-foreground">#{e.numeroPatrimonio}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{e.tipo}</TableCell>
                      <TableCell>{e.marca || "-"} {e.modelo || ""}</TableCell>
                      <TableCell>{getStatusBadge(e.status)}</TableCell>
                      <TableCell>{e.localizacaoAtual}</TableCell>
                      <TableCell>{e.responsavel || "-"}</TableCell>
                      <TableCell>
                        {e.ultimaManutencao
                          ? new Date(e.ultimaManutencao).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button aria-label="Editar" variant="ghost" size="sm" onClick={() => handleEdit(e)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button aria-label="Excluir" variant="ghost" size="sm" onClick={() => handleDelete(e.id!)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Formulário (Dialog) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
            <DialogDescription>
              {editingEquipamento ? "Atualize os dados do equipamento." : "Preencha as informações para cadastrar."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="nome" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField name="tipo" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                      <SelectContent>{EQUIPMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )}/>
                <FormField name="marca" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Marca</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="modelo" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="status" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger></FormControl>
                      <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )}/>
                <FormField name="localizacaoAtual" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Localização Atual *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione a localização" /></SelectTrigger></FormControl>
                      <SelectContent>{LOCATION_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )}/>
                <FormField name="responsavel" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Responsável</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="numeroPatrimonio" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Nº Patrimônio</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="dataAquisicao" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Data de Aquisição</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                )}/>
                <FormField name="ultimaManutencao" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Última Manutenção</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                )}/>
                <FormField name="proximaManutencao" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Próxima Manutenção</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                )}/>
                <FormField name="valorAquisicao" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Valor de Aquisição (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value as any || ""} placeholder="0.00" /></FormControl>
                  </FormItem>
                )}/>
              </div>

              <FormField name="observacoes" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl></FormItem>
              )}/>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingEquipamento(null); form.reset(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingEquipamento ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
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
    </div>
  );
}
