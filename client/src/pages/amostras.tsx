
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, X, FlaskConical, Loader2, MapPin, Download } from "lucide-react";
import * as XLSX from "xlsx";
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
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

const amostraSchema = z.object({
  id: z.number().optional(),
  codigo: z.string().min(1, "Código obrigatório"),
  tipo: z.string().min(1, "Selecione o tipo"),
  subtipo: z.string().optional(),
  pontoColeta: z.string().min(1, "Ponto de coleta obrigatório"),
  latitude: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
  longitude: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
  dataColeta: z.string().min(1, "Data de coleta obrigatória"),
  horaColeta: z.string().optional(),
  coletorNome: z.string().optional(),
  laboratorioNome: z.string().optional(),
  status: z.string().min(1, "Status obrigatório"),
  parametrosAnalisados: z.string().optional(),
  observacoes: z.string().optional(),
  empreendimentoId: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
});

type Amostra = z.infer<typeof amostraSchema>;

const TIPO_OPTIONS = [
  { value: "agua", label: "Água" },
  { value: "solo", label: "Solo" },
  { value: "ar", label: "Ar" },
  { value: "sedimento", label: "Sedimento" },
  { value: "efluente", label: "Efluente" },
  { value: "residuo", label: "Resíduo" },
  { value: "outro", label: "Outro" },
];

const STATUS_OPTIONS = [
  { value: "coletada", label: "Coletada", color: "bg-blue-500" },
  { value: "enviada_lab", label: "Enviada ao Lab", color: "bg-purple-500" },
  { value: "em_analise", label: "Em Análise", color: "bg-yellow-500" },
  { value: "resultado_parcial", label: "Resultado Parcial", color: "bg-orange-500" },
  { value: "concluida", label: "Concluída", color: "bg-green-500" },
  { value: "descartada", label: "Descartada", color: "bg-red-500" },
];

export default function AmostrasPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAmostra, setEditingAmostra] = useState<Amostra | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [amostraToDelete, setAmostraToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter]);

  const { data: amostras = [], isLoading } = useQuery<Amostra[]>({
    queryKey: ["/api/amostras", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/amostras${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar amostras");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const form = useForm<Amostra>({
    resolver: zodResolver(amostraSchema),
    defaultValues: {
      codigo: "",
      tipo: "",
      subtipo: "",
      pontoColeta: "",
      dataColeta: "",
      horaColeta: "",
      coletorNome: "",
      laboratorioNome: "",
      status: "coletada",
      parametrosAnalisados: "",
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Amostra) => apiRequest("POST", "/api/amostras", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
      toast({ title: "Sucesso", description: "Amostra cadastrada com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar amostra",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Amostra }) =>
      apiRequest("PUT", `/api/amostras/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
      toast({ title: "Sucesso", description: "Amostra atualizada!" });
      setIsDialogOpen(false);
      setEditingAmostra(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar amostra",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/amostras/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
      toast({ title: "Sucesso", description: "Amostra removida!" });
      setDeleteDialogOpen(false);
      setAmostraToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir amostra",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Amostra) => {
    editingAmostra
      ? updateMutation.mutate({ id: editingAmostra.id!, data })
      : createMutation.mutate(data);
  };

  const handleExportExcel = () => {
    if (amostras.length === 0) {
      toast({ title: "Nenhuma amostra para exportar", variant: "destructive" });
      return;
    }

    const exportData = amostras.map((amostra: any) => ({
      "Código": amostra.codigo,
      "Tipo": TIPO_OPTIONS.find(t => t.value === amostra.tipo)?.label || amostra.tipo,
      "Subtipo": amostra.subtipo || "",
      "Ponto de Coleta": amostra.pontoColeta,
      "Latitude": amostra.latitude || "",
      "Longitude": amostra.longitude || "",
      "Data da Coleta": amostra.dataColeta ? new Date(amostra.dataColeta).toLocaleDateString('pt-BR') : "",
      "Hora da Coleta": amostra.horaColeta || "",
      "Coletor": amostra.coletorNome || "",
      "Laboratório": amostra.laboratorioNome || "",
      "Status": STATUS_OPTIONS.find(s => s.value === amostra.status)?.label || amostra.status,
      "Parâmetros Analisados": amostra.parametrosAnalisados || "",
      "Observações": amostra.observacoes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Amostras");

    const colWidths = [
      { wch: 15 }, // Código
      { wch: 12 }, // Tipo
      { wch: 12 }, // Subtipo
      { wch: 25 }, // Ponto de Coleta
      { wch: 12 }, // Latitude
      { wch: 12 }, // Longitude
      { wch: 12 }, // Data
      { wch: 10 }, // Hora
      { wch: 20 }, // Coletor
      { wch: 20 }, // Laboratório
      { wch: 15 }, // Status
      { wch: 30 }, // Parâmetros
      { wch: 30 }, // Observações
    ];
    ws["!cols"] = colWidths;

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `amostras_${today}.xlsx`);
    toast({ title: "Excel exportado com sucesso!" });
  };

  const handleNew = () => {
    setEditingAmostra(null);
    form.reset({
      codigo: "",
      tipo: "",
      subtipo: "",
      pontoColeta: "",
      dataColeta: "",
      horaColeta: "",
      coletorNome: "",
      laboratorioNome: "",
      status: "coletada",
      parametrosAnalisados: "",
      observacoes: "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (amostra: Amostra) => {
    setEditingAmostra(amostra);
    form.reset({
      ...amostra,
      latitude: amostra.latitude ?? undefined,
      longitude: amostra.longitude ?? undefined,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setAmostraToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (amostraToDelete) deleteMutation.mutate(amostraToDelete);
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
    return t ? t.label : tipo;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-amostras">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="h-8 w-8" />
            Gestão de Amostras
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie amostras coletadas para análise ambiental
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            disabled={amostras.length === 0}
          >
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
          <RefreshButton />
          <Button onClick={handleNew} data-testid="button-nova-amostra">
            <Plus className="h-4 w-4 mr-2" /> Nova Amostra
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, ponto de coleta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-amostras"
              />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger data-testid="select-tipo-filter">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {TIPO_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(searchTerm || tipoFilter !== "all" || statusFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
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
          ) : amostras.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma amostra encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || tipoFilter !== "all" || statusFilter !== "all"
                  ? "Tente ajustar os filtros para encontrar amostras."
                  : "Comece cadastrando sua primeira amostra."}
              </p>
              {(searchTerm || tipoFilter !== "all" || statusFilter !== "all") ? (
                <Button variant="outline" onClick={clearFilters}>Limpar Filtros</Button>
              ) : (
                <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" /> Cadastrar Primeira Amostra</Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label="Tabela de amostras cadastradas">
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ponto de Coleta</TableHead>
                    <TableHead>Data Coleta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Coordenadas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amostras.map((a) => (
                    <TableRow key={a.id} data-testid={`row-amostra-${a.id}`}>
                      <TableCell className="font-medium">{a.codigo}</TableCell>
                      <TableCell>
                        <div>
                          <p>{getTipoLabel(a.tipo)}</p>
                          {a.subtipo && (
                            <p className="text-xs text-muted-foreground">{a.subtipo}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{a.pontoColeta}</TableCell>
                      <TableCell>
                        <div>
                          <p>{formatDate(a.dataColeta)}</p>
                          {a.horaColeta && (
                            <p className="text-xs text-muted-foreground">{a.horaColeta}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(a.status)}</TableCell>
                      <TableCell>
                        {a.latitude && a.longitude ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {Number(a.latitude).toFixed(6)}, {Number(a.longitude).toFixed(6)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button aria-label="Editar" variant="ghost" size="sm" onClick={() => handleEdit(a)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button aria-label="Excluir" variant="ghost" size="sm" onClick={() => handleDelete(a.id!)}>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAmostra ? "Editar Amostra" : "Nova Amostra"}</DialogTitle>
            <DialogDescription>
              {editingAmostra ? "Atualize os dados da amostra." : "Preencha as informações para cadastrar."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="codigo" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: AM-2026-001" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="tipo" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="subtipo" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtipo</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Água Superficial" /></FormControl>
                  </FormItem>
                )}/>
                <FormField name="pontoColeta" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ponto de Coleta *</FormLabel>
                    <FormControl><Input {...field} placeholder="Local da coleta" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="dataColeta" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Coleta *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="horaColeta" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora da Coleta</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                  </FormItem>
                )}/>
                <FormField name="latitude" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="-23.550520"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                  </FormItem>
                )}/>
                <FormField name="longitude" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="any"
                        placeholder="-46.633308"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                  </FormItem>
                )}/>
                <FormField name="coletorNome" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Coletor</FormLabel>
                    <FormControl><Input {...field} placeholder="Responsável pela coleta" /></FormControl>
                  </FormItem>
                )}/>
                <FormField name="laboratorioNome" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Laboratório</FormLabel>
                    <FormControl><Input {...field} placeholder="Nome do laboratório" /></FormControl>
                  </FormItem>
                )}/>
                <FormField name="status" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="empreendimentoId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empreendimento</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))}
                      value={field.value?.toString() || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {empreendimentos.map((e) => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
              </div>

              <FormField name="parametrosAnalisados" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Parâmetros Analisados</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Ex: pH, DBO, DQO, Metais Pesados..." rows={2} />
                  </FormControl>
                </FormItem>
              )}/>

              <FormField name="observacoes" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Observações adicionais sobre a amostra..." rows={3} />
                  </FormControl>
                </FormItem>
              )}/>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingAmostra ? "Atualizar" : "Cadastrar"}
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
              Tem certeza que deseja excluir esta amostra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
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
