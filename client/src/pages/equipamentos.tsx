// EquipamentosModule.tsx
import { useEffect, useMemo, useState } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Eye, Plus, Search, QrCode, Edit, ArrowLeft, Save, Trash2 } from "lucide-react";
import type { Equipamento } from "@shared/schema";

// ---------- Constantes de UI ----------
const statusColors = {
  funcionando: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100",
  com_defeito: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100",
  em_manutencao: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100",
  descartado: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100",
} as const;

const statusLabels = {
  funcionando: "Funcionando",
  com_defeito: "Com Defeito",
  em_manutencao: "Em Manutenção",
  descartado: "Descartado",
} as const;

const localizacaoLabels = {
  escritorio: "Escritório",
  cliente: "Cliente",
  colaborador: "Colaborador",
} as const;

type StatusKey = keyof typeof statusLabels;
type LocalizacaoKey = keyof typeof localizacaoLabels;

// ---------- Utils ----------
const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
};

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  const numValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numValue)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numValue);
};

const toDateInput = (d?: string | null) => {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

// Helpers BRL
const formatBRL = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const parseBRL = (s: string) => {
  if (!s) return null;
  const clean = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

// =====================================================
// LISTA: /equipamentos
// =====================================================
function EquipamentosList() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<string>("");
  const [localizacaoFilter, setLocalizacaoFilter] = useState<string>("");

  // paginação cliente
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: equipamentos = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["/api/equipamentos", searchQuery, statusFilter, tipoFilter, localizacaoFilter],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (tipoFilter && tipoFilter !== "all") params.append("tipo", tipoFilter);
      if (localizacaoFilter && localizacaoFilter !== "all") params.append("localizacao", localizacaoFilter);

      const url = params.toString()
        ? `/api/equipamentos/search?${params.toString()}`
        : "/api/equipamentos";

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("Não foi possível carregar os equipamentos.");
      return (await res.json()) as Equipamento[];
    },
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, tipoFilter, localizacaoFilter]);

  const total = equipamentos.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const pagedData = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return equipamentos.slice(start, start + pageSize);
  }, [equipamentos, pageSafe, pageSize]);

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Equipamentos</h1>
          <p className="text-muted-foreground mt-2">Gerencie todos os equipamentos da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-page-size">
              <SelectValue placeholder="Itens/pág." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / pág.</SelectItem>
              <SelectItem value="20">20 / pág.</SelectItem>
              <SelectItem value="50">50 / pág.</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate("/equipamentos/novo")} className="gap-2" data-testid="button-new-equipment">
            <Plus className="h-4 w-4" />
            Novo Equipamento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Pesquisa
            {isFetching && (
              <span className="text-xs text-muted-foreground ml-2" role="status" aria-live="polite">
                (atualizando…)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pesquisar</label>
              <Input
                placeholder="Patrimônio, marca, modelo..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="funcionando">Funcionando</SelectItem>
                  <SelectItem value="com_defeito">Com Defeito</SelectItem>
                  <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="Notebook">Notebook</SelectItem>
                  <SelectItem value="Desktop">Desktop</SelectItem>
                  <SelectItem value="Monitor">Monitor</SelectItem>
                  <SelectItem value="Impressora">Impressora</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Smartphone">Smartphone</SelectItem>
                  <SelectItem value="Equipamento de Campo">Equipamento de Campo</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Localização</label>
              <Select value={localizacaoFilter} onValueChange={setLocalizacaoFilter}>
                <SelectTrigger data-testid="select-localizacao">
                  <SelectValue placeholder="Todas as localizações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as localizações</SelectItem>
                  <SelectItem value="escritorio">Escritório</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista/Estados */}
      {isLoading ? (
        <Card>
          <CardHeader><CardTitle>Equipamentos</CardTitle></CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3" aria-live="polite" role="status">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardHeader><CardTitle>Equipamentos</CardTitle></CardHeader>
          <CardContent>
            <div className="text-red-600 dark:text-red-400 mb-4" role="alert">
              {(error as Error)?.message || "Erro ao carregar os dados."}
            </div>
            <Button onClick={() => refetch()} variant="outline">Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Equipamentos ({equipamentos.length})</CardTitle></CardHeader>
          <CardContent>
            {equipamentos.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchQuery || statusFilter || tipoFilter || localizacaoFilter
                    ? "Nenhum equipamento encontrado com os filtros aplicados"
                    : "Nenhum equipamento cadastrado"}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patrimônio</TableHead>
                        <TableHead>Tipo/Modelo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Aquisição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Manutenção</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedData.map((equipamento) => (
                        <TableRow key={equipamento.id} data-testid={`row-equipment-${equipamento.id}`}>
                          <TableCell>
                            <div className="font-medium">{equipamento.numeroPatrimonio}</div>
                            <div className="text-sm text-muted-foreground">{equipamento.marca}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{equipamento.tipoEquipamento}</div>
                            <div className="text-sm text-muted-foreground">{equipamento.modelo}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={statusColors[(equipamento.status as StatusKey) ?? "funcionando"]}
                              data-testid={`badge-status-${equipamento.status}`}
                            >
                              {statusLabels[(equipamento.status as StatusKey) ?? "funcionando"]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {localizacaoLabels[(equipamento.localizacaoAtual as LocalizacaoKey) ?? "escritorio"]}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{equipamento.responsavelAtual || "-"}</div>
                          </TableCell>
                          <TableCell><div className="text-sm">{formatDate(equipamento.dataAquisicao)}</div></TableCell>
                          <TableCell><div className="text-sm">{formatCurrency(equipamento.valorAquisicao)}</div></TableCell>
                          <TableCell><div className="text-sm">{formatDate(equipamento.proximaManutencao)}</div></TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => navigate(`/equipamentos/${String(equipamento.id)}`)}
                                title="Visualizar" data-testid={`button-view-${equipamento.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => navigate(`/equipamentos/${String(equipamento.id)}/editar`)}
                                title="Editar" data-testid={`button-edit-${equipamento.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => navigate(`/equipamentos/${String(equipamento.id)}/qr`)}
                                title="QR Code" data-testid={`button-qr-${equipamento.id}`}
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {pageSafe} de {totalPages} • {total} itens
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// VISUALIZAÇÃO: /equipamentos/:id
// =====================================================
function VerEquipamento() {
  const [, params] = useRoute<{ id: string }>("/equipamentos/:id");
  const id = params?.id;
  const [, navigate] = useLocation();

  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: !!id,
    queryKey: ["/api/equipamentos", id],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/equipamentos/${id}`, { signal });
      if (!r.ok) throw new Error("Falha ao carregar o equipamento.");
      return (await r.json()) as Equipamento;
    },
  });

  if (!id) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Equipamento não encontrado</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/equipamentos")}>Voltar à lista</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Carregando…</CardTitle></CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3" aria-live="polite" role="status">
              {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Erro</CardTitle></CardHeader>
          <CardContent>
            <div className="text-red-600 dark:text-red-400 mb-4" role="alert">
              {(error as Error)?.message || "Erro ao carregar."}
            </div>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            <Button className="ml-2" variant="secondary" onClick={() => navigate("/equipamentos")}>
              Voltar à lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-ver-equipamento">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/equipamentos`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{data.numeroPatrimonio}</h1>
            <p className="text-muted-foreground mt-1">{data.marca} {data.modelo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[(data.status as StatusKey) ?? "funcionando"]}>
            {statusLabels[(data.status as StatusKey) ?? "funcionando"]}
          </Badge>
          <Button variant="outline" onClick={() => navigate(`/equipamentos/${data.id}/qr`)}>
            <QrCode className="h-4 w-4 mr-2" /> QR Code
          </Button>
          <Button onClick={() => navigate(`/equipamentos/${data.id}/editar`)}>
            <Edit className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><span className="text-sm text-muted-foreground">Tipo</span><div className="font-medium">{data.tipoEquipamento}</div></div>
          <div><span className="text-sm text-muted-foreground">Localização</span><div className="font-medium">{localizacaoLabels[data.localizacaoAtual as LocalizacaoKey]}</div></div>
          <div><span className="text-sm text-muted-foreground">Responsável</span><div className="font-medium">{data.responsavelAtual || "-"}</div></div>
          <div><span className="text-sm text-muted-foreground">Aquisição</span><div className="font-medium">{formatDate(data.dataAquisicao)}</div></div>
          <div><span className="text-sm text-muted-foreground">Próxima manutenção</span><div className="font-medium">{formatDate(data.proximaManutencao)}</div></div>
          <div><span className="text-sm text-muted-foreground">Valor de aquisição</span><div className="font-medium">{formatCurrency(data.valorAquisicao)}</div></div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// EDIÇÃO: /equipamentos/:id/editar
// =====================================================

// Zod helpers
const isoDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")
  .refine(v => !Number.isNaN(new Date(v).getTime()), "Data inválida");

const formSchema = z.object({
  numeroPatrimonio: z.string().min(1, "Obrigatório"),
  marca: z.string().min(1, "Obrigatório"),
  modelo: z.string().min(1, "Obrigatório"),
  tipoEquipamento: z.enum(
    ["Notebook","Desktop","Monitor","Impressora","Tablet","Smartphone","Equipamento de Campo","Outro"],
    { required_error: "Selecione um tipo" }
  ),
  status: z.enum(["funcionando","com_defeito","em_manutencao","descartado"], { required_error: "Selecione um status" }),
  localizacaoAtual: z.enum(["escritorio","cliente","colaborador"], { required_error: "Selecione a localização" }),
  responsavelAtual: z.string().optional().nullable(),
  dataAquisicao: isoDate,
  valorAquisicao: z.number().finite().nonnegative().nullable().optional(),
  proximaManutencao: isoDate.optional().nullable(),
  observacoes: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof formSchema>;

function EditarEquipamento() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>("/equipamentos/:id/editar");
  const id = params?.id; // não redireciona automaticamente para evitar falsos 404
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    enabled: Boolean(id),
    queryKey: ["/api/equipamentos", id],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/equipamentos/${id}`, { signal });
      if (!res.ok) throw new Error("Não foi possível carregar o equipamento.");
      return (await res.json()) as Equipamento;
    },
  });

  const {
    control, handleSubmit, reset, register, watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numeroPatrimonio: "",
      marca: "",
      modelo: "",
      tipoEquipamento: "Outro",
      status: "funcionando",
      localizacaoAtual: "escritorio",
      responsavelAtual: "",
      dataAquisicao: "",
      valorAquisicao: null,
      proximaManutencao: "",
      observacoes: "",
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      numeroPatrimonio: data.numeroPatrimonio ?? "",
      marca: data.marca ?? "",
      modelo: data.modelo ?? "",
      tipoEquipamento: (data.tipoEquipamento as FormValues["tipoEquipamento"]) ?? "Outro",
      status: (data.status as FormValues["status"]) ?? "funcionando",
      localizacaoAtual: (data.localizacaoAtual as FormValues["localizacaoAtual"]) ?? "escritorio",
      responsavelAtual: data.responsavelAtual ?? "",
      dataAquisicao: toDateInput(data.dataAquisicao),
      valorAquisicao: (typeof data.valorAquisicao === "number" ? data.valorAquisicao : (Number(data.valorAquisicao) || null)) ?? null,
      proximaManutencao: toDateInput(data.proximaManutencao ?? ""),
      observacoes: (data as any).observacoes ?? "",
    }, { keepDirty: false });
  }, [data, reset]);

  // Aviso ao sair com alterações não salvas
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const valorWatch = watch("valorAquisicao");

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Equipamento>) => {
      const res = await fetch(`/api/equipamentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Falha ao salvar equipamento.");
      }
      return (await res.json()) as Equipamento;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      await qc.invalidateQueries({ queryKey: ["/api/equipamentos", id] });
      toast({ title: "Sucesso", description: "Equipamento salvo com sucesso." });
      navigate(`/equipamentos/${id}`);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e?.message ?? "Erro ao salvar.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/equipamentos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir.");
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({ title: "Excluído", description: "Equipamento excluído." });
      navigate(`/equipamentos`);
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e?.message ?? "Erro ao excluir.", variant: "destructive" }),
  });

  const onSubmit = (v: FormValues) => {
    const payload: Partial<Equipamento> = {
      numeroPatrimonio: v.numeroPatrimonio.trim(),
      marca: v.marca.trim(),
      modelo: v.modelo.trim(),
      tipoEquipamento: v.tipoEquipamento,
      status: v.status,
      localizacaoAtual: v.localizacaoAtual,
      responsavelAtual: v.responsavelAtual?.trim() || null,
      dataAquisicao: v.dataAquisicao || null,           // YYYY-MM-DD
      proximaManutencao: v.proximaManutencao || null,   // YYYY-MM-DD
      valorAquisicao: v.valorAquisicao ?? null,
      ...(v.observacoes !== undefined ? { observacoes: v.observacoes } : {}),
    };
    return updateMutation.mutateAsync(payload);
  };

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-xs text-red-600 mt-1">{msg}</p> : null;

  if (!id) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Rota inválida</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/equipamentos")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Edição de Equipamento</CardTitle></CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3" aria-live="polite" role="status">
              {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Edição de Equipamento</CardTitle></CardHeader>
          <CardContent>
            <div className="text-red-600 dark:text-red-400 mb-4" role="alert">
              {(error as Error)?.message || "Erro ao carregar o equipamento."}
            </div>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            <Button className="ml-2" variant="secondary" onClick={() => navigate("/equipamentos")}>
              Voltar à lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-editar-equipamento">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/equipamentos/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Equipamento</h1>
            <p className="text-muted-foreground mt-1">
              {data.numeroPatrimonio} • {data.marca} {data.modelo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[(data.status as StatusKey) ?? "funcionando"]}>
            {statusLabels[(data.status as StatusKey) ?? "funcionando"]}
          </Badge>
          <Button variant="outline" onClick={() => navigate(`/equipamentos/${id}/qr`)}>
            <QrCode className="h-4 w-4 mr-2" /> QR Code
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader><CardTitle>Dados do Equipamento</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {/* Linha 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nº Patrimônio</label>
                <Input placeholder="EB-000123" {...register("numeroPatrimonio")} data-testid="input-numeroPatrimonio" />
                <FieldError msg={errors.numeroPatrimonio?.message} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Marca</label>
                <Input placeholder="Dell" {...register("marca")} data-testid="input-marca" />
                <FieldError msg={errors.marca?.message} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Modelo</label>
                <Input placeholder="Latitude 5430" {...register("modelo")} data-testid="input-modelo" />
                <FieldError msg={errors.modelo?.message} />
              </div>
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <Controller
                  control={control}
                  name="tipoEquipamento"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-tipo">
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Notebook">Notebook</SelectItem>
                        <SelectItem value="Desktop">Desktop</SelectItem>
                        <SelectItem value="Monitor">Monitor</SelectItem>
                        <SelectItem value="Impressora">Impressora</SelectItem>
                        <SelectItem value="Tablet">Tablet</SelectItem>
                        <SelectItem value="Smartphone">Smartphone</SelectItem>
                        <SelectItem value="Equipamento de Campo">Equipamento de Campo</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.tipoEquipamento?.message as string} />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="funcionando">Funcionando</SelectItem>
                        <SelectItem value="com_defeito">Com Defeito</SelectItem>
                        <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                        <SelectItem value="descartado">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.status?.message as string} />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Localização</label>
                <Controller
                  control={control}
                  name="localizacaoAtual"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-localizacao">
                        <SelectValue placeholder="Selecione a localização" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="escritorio">Escritório</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="colaborador">Colaborador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.localizacaoAtual?.message as string} />
              </div>
            </div>

            {/* Linha 3 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Responsável</label>
                <Input placeholder="Nome do colaborador" {...register("responsavelAtual")} data-testid="input-responsavelAtual" />
                <FieldError msg={errors.responsavelAtual?.message as string} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Data de Aquisição</label>
                <Input type="date" {...register("dataAquisicao")} data-testid="input-dataAquisicao" />
                <FieldError msg={errors.dataAquisicao?.message} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Próxima Manutenção</label>
                <Input type="date" {...register("proximaManutencao")} data-testid="input-proximaManutencao" />
                <FieldError msg={errors.proximaManutencao?.message as string} />
              </div>
            </div>

            {/* Linha 4 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Valor de Aquisição</label>
                <Controller
                  control={control}
                  name="valorAquisicao"
                  render={({ field }) => (
                    <Input
                      placeholder="R$ 0,00"
                      value={field.value == null ? "" : formatBRL(field.value)}
                      onChange={(e) => field.onChange(parseBRL(e.target.value))}
                      inputMode="decimal"
                      data-testid="input-valorAquisicao"
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {valorWatch ? `Valor: ${formatBRL(valorWatch)}` : "Informe o valor em reais"}
                </p>
                <FieldError msg={errors.valorAquisicao?.message as string} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Observações</label>
                <Textarea rows={4} placeholder="Observações gerais, estado, acessórios, etc."
                  {...register("observacoes")} data-testid="textarea-observacoes" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
                {isFetching ? "Sincronizando..." : isDirty ? "Alterações não salvas" : "Tudo salvo"}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/equipamentos/${id}`)}>
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2" disabled={isSubmitting || updateMutation.isPending}
                  data-testid="button-save-equipment">
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>

                {/* Exclusão com AlertDialog */}
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-equipment"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir este equipamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é irreversível. O equipamento <b>{data.numeroPatrimonio}</b> será removido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Confirmar exclusão
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

// =====================================================
// QR CODE: /equipamentos/:id/qr (placeholder)
// =====================================================
function QREquipamento() {
  const [, params] = useRoute<{ id: string }>("/equipamentos/:id/qr");
  const id = params?.id!;
  const [, navigate] = useLocation();
  const url = typeof window !== "undefined" ? `${location.origin}/equipamentos/${id}` : `/equipamentos/${id}`;

  return (
    <div className="container mx-auto py-8">
      <Button variant="ghost" onClick={() => navigate(`/equipamentos/${id}`)}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>
      <Card className="mt-4">
        <CardHeader><CardTitle>QR Code</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Substitua por componente real de QR (ex.: qrcode.react) se disponível */}
          <div className="p-6 border rounded text-center select-all">
            [QR de {url}]
          </div>
          <div className="text-sm text-muted-foreground break-all">{url}</div>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// NOVO (placeholder) : /equipamentos/novo
// =====================================================
function NovoEquipamento() {
  const [, navigate] = useLocation();
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader><CardTitle>Novo Equipamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>Formulário de criação em desenvolvimento.</p>
          <Button onClick={() => navigate("/equipamentos")}>Voltar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// MÓDULO / EXPORT ÚNICO COM ROTAS
//  Correção: rotas mais específicas ANTES das genéricas
// =====================================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function EquipamentosRoutes() {
  return (
    <Switch>
      {/* Coloque as rotas mais específicas primeiro */}
      <Route path="/equipamentos/:id/editar" component={EditarEquipamento} />
      <Route path="/equipamentos/:id/qr" component={QREquipamento} />
      <Route path="/equipamentos/novo" component={NovoEquipamento} />
      <Route path="/equipamentos/:id" component={VerEquipamento} />
      <Route path="/equipamentos" component={EquipamentosList} />
      {/* fallback simples */}
      <Route>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader><CardTitle>Página não encontrada</CardTitle></CardHeader>
            <CardContent>
              <Button asChild><a href="/equipamentos">Ir para Equipamentos</a></Button>
            </CardContent>
          </Card>
        </div>
      </Route>
    </Switch>
  );
}

export default function EquipamentosModule() {
  return (
    <QueryClientProvider client={queryClient}>
      <EquipamentosRoutes />
    </QueryClientProvider>
  );
}
