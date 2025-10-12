import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, X, Wrench, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertEquipamentoSchema, type Equipamento } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

// Equipment types
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

// Equipment status options
const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível", color: "bg-green-500" },
  { value: "em_uso", label: "Em Uso", color: "bg-blue-500" },
  { value: "manutencao", label: "Manutenção", color: "bg-yellow-500" },
];

// Location options
const LOCATION_OPTIONS = [
  "Escritório Central",
  "Almoxarifado",
  "Em Campo",
  "Cliente",
  "Colaborador",
  "Em Manutenção Externa",
  "Outro",
];

// Form schema (extends the insert schema with optional fields)
const equipamentoFormSchema = insertEquipamentoSchema.extend({
  valorAquisicao: z.union([
    z.string().optional(),
    z.number().optional(),
    z.null(),
  ]).optional(),
});

type EquipamentoFormData = z.infer<typeof equipamentoFormSchema>;

export default function EquipamentosPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [localizacaoFilter, setLocalizacaoFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipamentoToDelete, setEquipamentoToDelete] = useState<number | null>(null);

  // Build filters for API request
  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter && tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter && statusFilter !== "all") params.status = statusFilter;
    if (localizacaoFilter && localizacaoFilter !== "all") params.localizacaoAtual = localizacaoFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter, localizacaoFilter]);

  // Fetch equipamentos
  const { data: equipamentos = [], isLoading } = useQuery<Equipamento[]>({
    queryKey: ["/api/equipamentos", filters],
  });

  // Form setup
  const form = useForm<EquipamentoFormData>({
    resolver: zodResolver(equipamentoFormSchema),
    defaultValues: {
      nome: "",
      tipo: "",
      localizacaoAtual: "",
      status: "disponivel",
      responsavel: "",
      numeroPatrimonio: "",
      marca: "",
      modelo: "",
      observacoes: "",
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: EquipamentoFormData) => {
      return apiRequest("POST", "/api/equipamentos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({
        title: "Sucesso",
        description: "Equipamento cadastrado com sucesso!",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao cadastrar equipamento",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<EquipamentoFormData> }) => {
      return apiRequest("PUT", `/api/equipamentos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({
        title: "Sucesso",
        description: "Equipamento atualizado com sucesso!",
      });
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar equipamento",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/equipamentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({
        title: "Sucesso",
        description: "Equipamento excluído com sucesso!",
      });
      setDeleteDialogOpen(false);
      setEquipamentoToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir equipamento",
        variant: "destructive",
      });
    },
  });

  // Handle form submit
  const onSubmit = (data: EquipamentoFormData) => {
    if (editingEquipamento) {
      updateMutation.mutate({ id: editingEquipamento.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Open dialog for new equipment
  const handleNewEquipamento = () => {
    setEditingEquipamento(null);
    form.reset({
      nome: "",
      tipo: "",
      localizacaoAtual: "",
      status: "disponivel",
      responsavel: "",
      numeroPatrimonio: "",
      marca: "",
      modelo: "",
      observacoes: "",
    });
    setIsDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (equipamento: Equipamento) => {
    setEditingEquipamento(equipamento);
    form.reset({
      nome: equipamento.nome,
      tipo: equipamento.tipo,
      localizacaoAtual: equipamento.localizacaoAtual,
      status: equipamento.status,
      responsavel: equipamento.responsavel || "",
      numeroPatrimonio: equipamento.numeroPatrimonio || "",
      marca: equipamento.marca || "",
      modelo: equipamento.modelo || "",
      dataAquisicao: equipamento.dataAquisicao || undefined,
      ultimaManutencao: equipamento.ultimaManutencao || undefined,
      proximaManutencao: equipamento.proximaManutencao || undefined,
      valorAquisicao: equipamento.valorAquisicao || undefined,
      observacoes: equipamento.observacoes || "",
      empreendimentoId: equipamento.empreendimentoId || undefined,
    });
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = (id: number) => {
    setEquipamentoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (equipamentoToDelete) {
      deleteMutation.mutate(equipamentoToDelete);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setTipoFilter("all");
    setStatusFilter("all");
    setLocalizacaoFilter("all");
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find((s) => s.value === status);
    if (!statusConfig) return null;

    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      {/* Header */}
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
        <Button onClick={handleNewEquipamento} data-testid="button-novo-equipamento">
          <Plus className="h-4 w-4 mr-2" />
          Novo Equipamento
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, marca, modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-equipamentos"
              />
            </div>

            {/* Type Filter */}
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger data-testid="select-tipo-filter">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {EQUIPMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Location Filter */}
            <Select value={localizacaoFilter} onValueChange={setLocalizacaoFilter}>
              <SelectTrigger data-testid="select-localizacao-filter">
                <SelectValue placeholder="Localização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Localizações</SelectItem>
                {LOCATION_OPTIONS.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {(searchTerm || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <X className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : equipamentos.length === 0 ? (
            <div className="text-center py-12" role="status">
              <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum equipamento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all"
                  ? "Tente ajustar os filtros para encontrar equipamentos."
                  : "Comece cadastrando seu primeiro equipamento."}
              </p>
              {(searchTerm || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all") && (
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              )}
              {!searchTerm && tipoFilter === "all" && statusFilter === "all" && localizacaoFilter === "all" && (
                <Button onClick={handleNewEquipamento}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Equipamento
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
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
                  {equipamentos.map((equipamento) => (
                    <TableRow key={equipamento.id} data-testid={`row-equipamento-${equipamento.id}`}>
                      <TableCell className="font-medium">{equipamento.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{equipamento.nome}</p>
                          {equipamento.numeroPatrimonio && (
                            <p className="text-xs text-muted-foreground">
                              #{equipamento.numeroPatrimonio}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{equipamento.tipo}</TableCell>
                      <TableCell>
                        {equipamento.marca && equipamento.modelo
                          ? `${equipamento.marca} ${equipamento.modelo}`
                          : equipamento.marca || equipamento.modelo || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(equipamento.status)}</TableCell>
                      <TableCell>{equipamento.localizacaoAtual}</TableCell>
                      <TableCell>{equipamento.responsavel || "-"}</TableCell>
                      <TableCell>
                        {equipamento.ultimaManutencao
                          ? new Date(equipamento.ultimaManutencao).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(equipamento)}
                            data-testid={`button-edit-${equipamento.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(equipamento.id)}
                            data-testid={`button-delete-${equipamento.id}`}
                          >
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

      {/* Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}
            </DialogTitle>
            <DialogDescription>
              {editingEquipamento
                ? "Atualize as informações do equipamento."
                : "Preencha os dados para cadastrar um novo equipamento."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Drone DJI Mavic Air 2" data-testid="input-nome" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo */}
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipo">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EQUIPMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Marca */}
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: DJI" data-testid="input-marca" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Modelo */}
                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Mavic Air 2" data-testid="input-modelo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Número Patrimônio */}
                <FormField
                  control={form.control}
                  name="numeroPatrimonio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Patrimônio</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: PAT-001" data-testid="input-patrimonio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Localização Atual */}
                <FormField
                  control={form.control}
                  name="localizacaoAtual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização Atual *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-localizacao">
                            <SelectValue placeholder="Selecione a localização" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATION_OPTIONS.map((location) => (
                            <SelectItem key={location} value={location}>
                              {location}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Responsável */}
                <FormField
                  control={form.control}
                  name="responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do responsável" data-testid="input-responsavel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Data Aquisição */}
                <FormField
                  control={form.control}
                  name="dataAquisicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Aquisição</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-data-aquisicao"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Valor Aquisição */}
                <FormField
                  control={form.control}
                  name="valorAquisicao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Aquisição (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value || ""}
                          placeholder="0.00"
                          data-testid="input-valor"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Última Manutenção */}
                <FormField
                  control={form.control}
                  name="ultimaManutencao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Última Manutenção</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-ultima-manutencao"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Próxima Manutenção */}
                <FormField
                  control={form.control}
                  name="proximaManutencao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próxima Manutenção</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-proxima-manutencao"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Observações adicionais sobre o equipamento"
                        rows={3}
                        data-testid="input-observacoes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingEquipamento(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingEquipamento ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
