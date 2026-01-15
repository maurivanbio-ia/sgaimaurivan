import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, X, FlaskConical, Loader2, MapPin, Download, AlertTriangle, RefreshCcw } from "lucide-react";
import * as XLSX from "xlsx";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const isValidISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const finiteOptionalNumber = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === "" || v === undefined || v === null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

const amostraSchema = z.object({
  id: z.number().optional(),
  codigo: z.string().trim().min(1, "Código obrigatório"),
  tipo: z.string().min(1, "Selecione o tipo"),
  subtipo: z.string().trim().optional(),
  pontoColeta: z.string().trim().min(1, "Ponto de coleta obrigatório"),

  latitude: finiteOptionalNumber.refine((v) => v === undefined || (v >= -90 && v <= 90), {
    message: "Latitude deve estar entre -90 e 90",
  }).optional(),

  longitude: finiteOptionalNumber.refine((v) => v === undefined || (v >= -180 && v <= 180), {
    message: "Longitude deve estar entre -180 e 180",
  }).optional(),

  dataColeta: z
    .string()
    .min(1, "Data de coleta obrigatória")
    .refine(isValidISODate, "Data inválida (formato esperado: AAAA-MM-DD)"),

  horaColeta: z.string().optional(),
  coletorNome: z.string().trim().optional(),
  laboratorioNome: z.string().trim().optional(),
  status: z.string().min(1, "Status obrigatório"),
  parametrosAnalisados: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  empreendimentoId: finiteOptionalNumber.optional(),
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
] as const;

const STATUS_OPTIONS = [
  { value: "coletada", label: "Coletada", color: "bg-blue-500" },
  { value: "enviada_lab", label: "Enviada ao Lab", color: "bg-purple-500" },
  { value: "em_analise", label: "Em Análise", color: "bg-yellow-500" },
  { value: "resultado_parcial", label: "Resultado Parcial", color: "bg-orange-500" },
  { value: "concluida", label: "Concluída", color: "bg-green-500" },
  { value: "descartada", label: "Descartada", color: "bg-red-500" },
] as const;

type EmpreendimentoMini = { id: number; nome: string };

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return { message: txt };
  }
}

function formatDateBR(dateStr?: string | null) {
  if (!dateStr) return ".";
  // suporta "YYYY-MM-DD" sem timezone
  if (isValidISODate(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("pt-BR");
  }
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return ".";
  return dt.toLocaleDateString("pt-BR");
}

export default function AmostrasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const amostrasQuery = useQuery<Amostra[]>({
    queryKey: ["/api/amostras", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/amostras${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message || "Erro ao buscar amostras");
      }
      return res.json();
    },
    staleTime: 15_000,
    retry: 2,
  });

  const amostras = amostrasQuery.data ?? [];

  const empreendimentosQuery = useQuery<EmpreendimentoMini[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos");
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message || "Erro ao buscar empreendimentos");
      }
      return res.json();
    },
    staleTime: 60_000,
    retry: 2,
  });

  const empreendimentos = empreendimentosQuery.data ?? [];
  const empreendimentoNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of empreendimentos) map.set(e.id, e.nome);
    return map;
  }, [empreendimentos]);

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
      latitude: undefined,
      longitude: undefined,
      empreendimentoId: undefined,
    },
  });

  const invalidateAmostras = () => {
    // invalida todas as variações do queryKey /api/amostras, inclusive com filtros
    queryClient.invalidateQueries({ queryKey: ["/api/amostras"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: Amostra) => {
      const res = await apiRequest("POST", "/api/amostras", data);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao cadastrar amostra");
      return json;
    },
    onSuccess: () => {
      invalidateAmostras();
      toast({ title: "Sucesso", description: "Amostra cadastrada com sucesso!" });
      setIsDialogOpen(false);
      setEditingAmostra(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message || "Falha ao cadastrar amostra", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Amostra }) => {
      const res = await apiRequest("PUT", `/api/amostras/${id}`, data);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao atualizar amostra");
      return json;
    },
    onSuccess: () => {
      invalidateAmostras();
      toast({ title: "Sucesso", description: "Amostra atualizada!" });
      setIsDialogOpen(false);
      setEditingAmostra(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message || "Falha ao atualizar amostra", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/amostras/${id}`);
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.message || "Falha ao excluir amostra");
      return json;
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/amostras"] });
      const previous = queryClient.getQueryData<Amostra[]>(["/api/amostras", filters]);
      // remove do cache atual (com filtros ativos)
      queryClient.setQueryData<Amostra[]>(["/api/amostras", filters], (old) => (old ?? []).filter((x) => x.id !== id));
      return { previous };
    },
    onError: (e: any, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/amostras", filters], ctx.previous);
      toast({ title: "Erro", description: e?.message || "Falha ao excluir amostra", variant: "destructive" });
    },
    onSuccess: () => {
      invalidateAmostras();
      toast({ title: "Sucesso", description: "Amostra removida!" });
      setDeleteDialogOpen(false);
      setAmostraToDelete(null);
    },
  });

  const onSubmit = (data: Amostra) => {
    if (editingAmostra?.id) updateMutation.mutate({ id: editingAmostra.id, data });
    else createMutation.mutate(data);
  };

  const handleExportExcel = () => {
    if (amostras.length === 0) {
      toast({ title: "Nenhuma amostra para exportar", variant: "destructive" });
      return;
    }

    const exportData = amostras.map((a) => ({
      "ID": a.id ?? "",
      "Código": a.codigo,
      "Tipo": TIPO_OPTIONS.find((t) => t.value === a.tipo)?.label || a.tipo,
      "Subtipo": a.subtipo || "",
      "Ponto de Coleta": a.pontoColeta,
      "Latitude": Number.isFinite(Number(a.latitude)) ? Number(a.latitude) : "",
      "Longitude": Number.isFinite(Number(a.longitude)) ? Number(a.longitude) : "",
      "Data da Coleta": a.dataColeta ? formatDateBR(a.dataColeta) : "",
      "Hora da Coleta": a.horaColeta || "",
      "Coletor": a.coletorNome || "",
      "Laboratório": a.laboratorioNome || "",
      "Empreendimento": a.empreendimentoId ? (empreendimentoNameById.get(Number(a.empreendimentoId)) || String(a.empreendimentoId)) : "",
      "Status": STATUS_OPTIONS.find((s) => s.value === a.status)?.label || a.status,
      "Parâmetros Analisados": a.parametrosAnalisados || "",
      "Observações": a.observacoes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Amostras");

    ws["!cols"] = [
      { wch: 8 },   // ID
      { wch: 15 },  // Código
      { wch: 12 },  // Tipo
      { wch: 14 },  // Subtipo
      { wch: 28 },  // Ponto
      { wch: 12 },  // Lat
      { wch: 12 },  // Long
      { wch: 14 },  // Data
      { wch: 10 },  // Hora
      { wch: 20 },  // Coletor
      { wch: 20 },  // Lab
      { wch: 25 },  // Empreendimento
      { wch: 16 },  // Status
      { wch: 30 },  // Parâmetros
      { wch: 32 },  // Observações
    ];

    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `amostras_${today}.xlsx`);
    toast({ title: "Excel exportado com sucesso!" });
  };

  const handleNew = () => {
    setEditingAmostra(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (a: Amostra) => {
    setEditingAmostra(a);
    form.reset({
      ...a,
      latitude: a.latitude ?? undefined,
      longitude: a.longitude ?? undefined,
      empreendimentoId: a.empreendimentoId ?? undefined,
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

  const hasCoords = (a: Amostra) => Number.isFinite(Number(a.latitude)) && Number.isFinite(Number(a.longitude));

  // quando fechar manualmente o dialog, garante reset do estado
  useEffect(() => {
    if (!isDialogOpen) {
      setEditingAmostra(null);
      form.reset();
    }
  }, [isDialogOpen, form]);

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-amostras">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="h-8 w-8" />
            Gestão de Amostras
          </h1>
          <p className="text-muted-foreground mt-2">Gerencie amostras coletadas para análise ambiental</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportExcel} disabled={amostras.length === 0}>
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
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
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
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
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
          {amostrasQuery.isLoading ? (
            <div className="flex justify-center py-12" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : amostrasQuery.isError ? (
            <div className="py-10">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-8 w-8 text-yellow-500 mt-1" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Erro ao carregar amostras</h3>
                  <p className="text-sm text-muted-foreground">
                    {(amostrasQuery.error as any)?.message || "Falha desconhecida"}
                  </p>
                  <Button onClick={() => amostrasQuery.refetch()} className="gap-2" data-testid="button-retry-amostras">
                    <RefreshCcw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                </div>
              </div>
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
              {searchTerm || tipoFilter !== "all" || statusFilter !== "all" ? (
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              ) : (
                <Button onClick={handleNew}>
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar Primeira Amostra
                </Button>
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
                          {a.subtipo && <p className="text-xs text-muted-foreground">{a.subtipo}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{a.pontoColeta}</TableCell>
                      <TableCell>
                        <div>
                          <p>{formatDateBR(a.dataColeta)}</p>
                          {a.horaColeta && <p className="text-xs text-muted-foreground">{a.horaColeta}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(a.status)}</TableCell>
                      <TableCell>
                        {hasCoords(a) ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {Number(a.latitude).toFixed(6)}, {Number(a.longitude).toFixed(6)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">.</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button aria-label={`Editar amostra ${a.codigo}`} variant="ghost" size="sm" onClick={() => handleEdit(a)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button aria-label={`Excluir amostra ${a.codigo}`} variant="ghost" size="sm" onClick={() => handleDelete(a.id!)}>
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
            <DialogDescription>{editingAmostra ? "Atualize os dados da amostra." : "Preencha as informações para cadastrar."}</DialogDescription>
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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPO_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
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
                        inputMode="decimal"
                        type="number"
                        step="any"
                        placeholder="-23.550520"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>

                <FormField name="longitude" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        type="number"
                        step="any"
                        placeholder="-46.633308"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>

                <FormField name="empreendimentoId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empreendimento</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                      value={field.value != null ? String(field.value) : "none"}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {empreendimentos.map((e) => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
              </div>

              <FormField name="parametrosAnalisados" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Parâmetros Analisados</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Ex: pH, DBO, DQO, Metais Pesados..." rows={2} /></FormControl>
                </FormItem>
              )}/>

              <FormField name="observacoes" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Observações adicionais sobre a amostra..." rows={3} /></FormControl>
                </FormItem>
              )}/>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
            <AlertDialogDescription>Tem certeza que deseja excluir esta amostra? Esta ação não pode ser desfeita.</AlertDialogDescription>
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
