import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RefreshButton } from "@/components/RefreshButton";
import { FinancialReportPDF } from "@/components/FinancialReportPDF";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DateInput } from "@/components/DateInput";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import type { FinanceiroLancamento, Empreendimento, CategoriaFinanceira } from "@shared/schema";
import * as z from "zod";

import {
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  PieChart,
  Receipt,
  FileText,
  Building,
  Loader2,
  ArrowUpIcon,
  ArrowDownIcon,
  LineChart,
  Wallet,
  Pencil,
  Trash2,
  MoreVertical,
  RefreshCw,
  Download,
} from "lucide-react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Pie, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

/* ===========================
   Helpers
=========================== */

// Parse server date (YYYY-MM-DD or ISO) as LOCAL date, set midday to avoid TZ edge cases
function parseServerDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const raw = dateStr.split("T")[0];
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month, day, 12, 0, 0);
}

function formatServerDate(dateStr: string | null | undefined): string {
  const date = parseServerDate(dateStr);
  if (!date) return "–";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function formatDateLocal(date: Date | null | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function moneyBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useDebouncedValue<T>(value: T, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/* ===========================
   Configs
=========================== */

const STATUS_CONFIG = {
  aguardando: { label: "Aguardando", color: "bg-yellow-500", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-blue-500", icon: CheckCircle },
  pago: { label: "Pago", color: "bg-green-500", icon: CheckCircle },
  recusado: { label: "Recusado", color: "bg-red-500", icon: XCircle },
  cancelado: { label: "Cancelado", color: "bg-zinc-600", icon: XCircle },
} as const;

const TIPO_CONFIG = {
  receita: { label: "Receita", color: "bg-green-100 text-green-700", icon: ArrowUpIcon },
  despesa: { label: "Despesa", color: "bg-red-100 text-red-700", icon: ArrowDownIcon },
  reembolso: { label: "Reembolso", color: "bg-blue-100 text-blue-700", icon: Receipt },
  solicitacao_recurso: { label: "Solicitação", color: "bg-purple-100 text-purple-700", icon: FileText },
} as const;

const UNIDADES_CONFIG = {
  salvador: { label: "Salvador (BA)", sigla: "BA" },
  goiania: { label: "Goiânia (GO)", sigla: "GO" },
  lem: { label: "Luís Eduardo Magalhães (LEM)", sigla: "LEM" },
} as const;

const CHART_COLORS = [
  "rgba(34, 197, 94, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(59, 130, 246, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(20, 184, 166, 0.8)",
  "rgba(249, 115, 22, 0.8)",
] as const;

/* ===========================
   Schemas
   (melhoria: preprocess para number)
=========================== */

const novoLancamentoSchema = z.object({
  tipo: z.enum(["receita", "despesa", "reembolso", "solicitacao_recurso"], { required_error: "Tipo é obrigatório" }),
  empreendimentoId: z.preprocess((v) => Number(v), z.number({ required_error: "Empreendimento é obrigatório" }).int().positive()),
  categoriaId: z.preprocess((v) => Number(v), z.number({ required_error: "Categoria é obrigatória" }).int().positive()),
  categoriaOutros: z.string().optional(),
  valor: z.preprocess((v) => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    return Number.isFinite(n) ? n : 0;
  }, z.number().min(0.01, "Valor deve ser maior que zero")),
  data: z.date({ required_error: "Data é obrigatória" }),
  dataVencimento: z.date().optional().nullable(),
  dataPagamento: z.date().optional().nullable(),
  descricao: z.string().min(5, "Descrição deve ter pelo menos 5 caracteres"),
  observacoes: z.string().optional(),
  unidade: z.enum(["salvador", "goiania", "lem"], { required_error: "Unidade é obrigatória" }),
});

type NovoLancamentoFormData = z.infer<typeof novoLancamentoSchema>;

interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
  porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
}

interface ExpenseEvolutionData {
  categorias: Array<{ id: number; nome: string; tipo: string }>;
  evolucao: Array<{ mes: string; valores: { [categoriaId: number]: number } }>;
}

/* ===========================
   Form: Novo Lançamento
   melhorias principais:
   . default valor 0.01 (evita erro instantâneo no schema)
   . initCategoriesMutation aciona automaticamente se categorias vierem vazias
   . evita duplicação de helpers de data
=========================== */

function NovoLancamentoForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOutrosInput, setShowOutrosInput] = useState(false);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar empreendimentos");
      return res.json();
    },
  });

  const {
    data: categorias = [],
    isLoading: loadingCategorias,
    refetch: refetchCategorias,
  } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const res = await fetch("/api/categorias-financeiras", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar categorias");
      return res.json();
    },
  });

  const initCategoriesMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categorias-financeiras/init"),
    onSuccess: async () => {
      await refetchCategorias();
    },
  });

  const syncCategoriesMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categorias-financeiras/sync"),
    onSuccess: async () => {
      await refetchCategorias();
      toast({ title: "Categorias atualizadas", description: "As categorias foram sincronizadas com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível sincronizar categorias.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!loadingCategorias && categorias.length === 0 && !initCategoriesMutation.isPending) {
      initCategoriesMutation.mutate();
    }
  }, [categorias.length, loadingCategorias, initCategoriesMutation]);

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: "despesa",
      valor: 0.01,
      descricao: "",
      observacoes: "",
      categoriaOutros: "",
      data: new Date(),
      dataVencimento: null,
      dataPagamento: null,
      unidade: "salvador",
    },
    mode: "onSubmit",
  });

  const tipoSelecionado = form.watch("tipo");

  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((cat) => (tipoSelecionado === "receita" ? cat.tipo === "receita" : cat.tipo === "despesa"));
  }, [categorias, tipoSelecionado]);

  const createLancamentoMutation = useMutation({
    mutationFn: async (data: NovoLancamentoFormData) => {
      const payload = {
        ...data,
        data: formatDateLocal(data.data),
        dataVencimento: formatDateLocal(data.dataVencimento),
        dataPagamento: formatDateLocal(data.dataPagamento),
      };
      return apiRequest("POST", "/api/financeiro/lancamentos", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey?.[0] === "string" && (q.queryKey[0] as string).startsWith("/api/financeiro"),
      });
      toast({ title: "Lançamento criado", description: "Novo lançamento financeiro foi criado com sucesso!" });
      form.reset({ ...form.getValues(), descricao: "", observacoes: "", valor: 0.01 });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível criar o lançamento.", variant: "destructive" });
    },
  });

  const onSubmit = (data: NovoLancamentoFormData) => createLancamentoMutation.mutate(data);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Lançamento *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="reembolso">Reembolso</SelectItem>
                    <SelectItem value="solicitacao_recurso">Solicitação de Recurso</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="empreendimentoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empreendimento *</FormLabel>
                <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value ? String(field.value) : ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-empreendimento">
                      <SelectValue placeholder="Selecione o empreendimento" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {empreendimentos.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
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
            name="unidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidade *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-unidade">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="salvador">Salvador (BA)</SelectItem>
                    <SelectItem value="goiania">Goiânia (GO)</SelectItem>
                    <SelectItem value="lem">Luís Eduardo Magalhães (LEM)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoriaId"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Categoria *</FormLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => syncCategoriesMutation.mutate()}
                    disabled={syncCategoriesMutation.isPending}
                    className="text-xs h-6"
                    data-testid="button-sync-categorias"
                  >
                    {syncCategoriesMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Atualizar
                  </Button>
                </div>

                {loadingCategorias ? (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">Carregando categorias...</div>
                ) : (
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        if (value === "outros") {
                          setShowOutrosInput(true);
                          const outrosCat = categoriasFiltradas.find((c) => c.nome === "Outras Despesas" || c.nome === "Outras Receitas");
                          if (outrosCat) field.onChange(outrosCat.id);
                        } else {
                          setShowOutrosInput(false);
                          field.onChange(Number(value));
                        }
                      }}
                      value={showOutrosInput ? "outros" : field.value ? String(field.value) : ""}
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                      data-testid="radio-categoria"
                    >
                      {categoriasFiltradas
                        .filter((c) => c.nome !== "Outras Despesas" && c.nome !== "Outras Receitas")
                        .map((cat) => (
                          <div key={cat.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={String(cat.id)} id={`cat-${cat.id}`} data-testid={`radio-categoria-${cat.id}`} />
                            <Label htmlFor={`cat-${cat.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />
                              {cat.nome}
                            </Label>
                          </div>
                        ))}

                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="outros" id="cat-outros" data-testid="radio-categoria-outros" />
                        <Label htmlFor="cat-outros" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400" />
                          Outros
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                )}

                {showOutrosInput && (
                  <div className="mt-3">
                    <Input
                      placeholder="Digite a categoria personalizada..."
                      value={form.watch("categoriaOutros") || ""}
                      onChange={(e) => form.setValue("categoriaOutros", e.target.value, { shouldDirty: true })}
                      className="max-w-md"
                      data-testid="input-categoria-outros"
                    />
                  </div>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={String(field.value ?? "")}
                    onChange={(e) => field.onChange(e.target.value)}
                    data-testid="input-valor"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="data"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data do Lançamento *</FormLabel>
                <FormControl>
                  <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dataVencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Vencimento</FormLabel>
                <FormControl>
                  <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data-vencimento" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dataPagamento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Pagamento</FormLabel>
                <FormControl>
                  <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data-pagamento" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição *</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva o lançamento financeiro..." className="min-h-[100px] resize-none" {...field} data-testid="textarea-descricao" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Observações adicionais..." className="min-h-[60px] resize-none" {...field} data-testid="textarea-observacoes" />
              </FormControl>
              <FormDescription>Informações complementares sobre o lançamento</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => form.reset()} data-testid="button-cancelar">
            Limpar
          </Button>
          <Button type="submit" disabled={createLancamentoMutation.isPending} data-testid="button-criar-lancamento">
            {createLancamentoMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Lançamento"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/* ===========================
   Form: Editar Lançamento
   melhorias:
   . usa mesmo schema/base (preprocess ok)
   . corrige endpoint de categorias (antes estava diferente)
=========================== */

function EditLancamentoForm({
  lancamento,
  onCancel,
  updateMutation,
}: {
  lancamento: FinanceiroLancamento;
  onCancel: () => void;
  updateMutation: ReturnType<typeof useMutation<unknown, Error, { id: number; data: Partial<FinanceiroLancamento> }>>;
}) {
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar empreendimentos");
      return res.json();
    },
  });

  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const res = await fetch("/api/categorias-financeiras", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar categorias");
      return res.json();
    },
  });

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: lancamento.tipo as any,
      empreendimentoId: lancamento.empreendimentoId as any,
      categoriaId: lancamento.categoriaId || 0,
      categoriaOutros: "",
      valor: Number(lancamento.valor),
      data: parseServerDate(lancamento.data) || new Date(),
      dataVencimento: parseServerDate(lancamento.dataVencimento),
      dataPagamento: parseServerDate(lancamento.dataPagamento),
      descricao: lancamento.descricao,
      observacoes: lancamento.observacoes || "",
      unidade: (lancamento.unidade as any) || "salvador",
    },
    mode: "onSubmit",
  });

  const tipoAtual = form.watch("tipo");

  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((cat) => (tipoAtual === "receita" ? cat.tipo === "receita" : cat.tipo === "despesa"));
  }, [categorias, tipoAtual]);

  const onSubmit = (data: NovoLancamentoFormData) => {
    updateMutation.mutate({
      id: lancamento.id,
      data: {
        tipo: data.tipo,
        empreendimentoId: data.empreendimentoId,
        categoriaId: data.categoriaId,
        valor: String(data.valor),
        data: formatDateLocal(data.data) as string,
        dataVencimento: formatDateLocal(data.dataVencimento) || undefined,
        dataPagamento: formatDateLocal(data.dataPagamento) || undefined,
        descricao: data.descricao,
        observacoes: data.observacoes || null,
        unidade: data.unidade,
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Lançamento</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="edit-select-tipo">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="reembolso">Reembolso</SelectItem>
                    <SelectItem value="solicitacao_recurso">Solicitação de Recurso</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="empreendimentoId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Projeto/Empreendimento</FormLabel>
                <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value ? String(field.value) : ""}>
                  <FormControl>
                    <SelectTrigger data-testid="edit-select-empreendimento">
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {empreendimentos.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.nome}
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
          name="unidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="edit-select-unidade">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(UNIDADES_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
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
          name="categoriaId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => field.onChange(Number(value))}
                  value={field.value ? String(field.value) : ""}
                  className="grid grid-cols-2 md:grid-cols-3 gap-2"
                  data-testid="edit-radio-categoria"
                >
                  {categoriasFiltradas.map((cat) => (
                    <div key={cat.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={String(cat.id)} id={`edit-cat-${cat.id}`} />
                      <Label htmlFor={`edit-cat-${cat.id}`} className="text-sm cursor-pointer">
                        {cat.nome}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="valor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={String(field.value ?? "")}
                    onChange={(e) => field.onChange(e.target.value)}
                    data-testid="edit-input-valor"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="data"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data do Lançamento</FormLabel>
                <FormControl>
                  <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="edit-input-data" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea placeholder="Descreva o lançamento financeiro..." className="resize-none" {...field} data-testid="edit-textarea-descricao" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="edit-button-cancel">
            Cancelar
          </Button>
          <Button type="submit" disabled={updateMutation.isPending} data-testid="edit-button-submit">
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/* ===========================
   Page
   melhorias principais:
   . debounce no search (evita flood de requisições)
   . filtro "empreendimento" por texto vira CLIENT-SIDE (não dependente de API)
   . chart/totais em useMemo (menos re-render)
   . dropdown actions: ícone correto (MoreVertical)
   . status "cancelado" padronizado
   . erros de fetch com mensagem via toast
=========================== */

export default function FinanceiroPage() {
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    search: "",
    unidade: "todas",
    empreendimentoTexto: "",
  });

  const debouncedSearch = useDebouncedValue(filters.search, 350);
  const debouncedEmpTxt = useDebouncedValue(filters.empreendimentoTexto, 350);

  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [editingLancamento, setEditingLancamento] = useState<FinanceiroLancamento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLancamentoId, setDeletingLancamentoId] = useState<number | null>(null);

  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>("todas");

  const [selectedReembolso, setSelectedReembolso] = useState<any>(null);
  const [isReembolsoDetailOpen, setIsReembolsoDetailOpen] = useState(false);
  const [reembolsoObservacao, setReembolsoObservacao] = useState("");
  const [pagamentoInfo, setPagamentoInfo] = useState({ formaPagamento: "", dataPagamento: "" });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const expenseEvolutionChartRef = useRef<HTMLCanvasElement>(null);

  const buildQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status !== "todos") params.append("status", filters.status);
    if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
    if (debouncedSearch) params.append("search", debouncedSearch);
    if (filters.unidade !== "todas") params.append("unidade", filters.unidade);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filters.tipo, filters.status, filters.unidade, selectedEmpreendimentoId, debouncedSearch]);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar empreendimentos");
      return res.json();
    },
  });

  const empMap = useMemo(() => new Map<number, string>(empreendimentos.map((e) => [e.id, e.nome])), [empreendimentos]);

  const { data: lancamentosRaw = [], isLoading: isLoadingLanc, isError: isErrorLanc } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos", buildQueryString],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/lancamentos${buildQueryString}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar lançamentos");
      return res.json();
    },
  });

  useEffect(() => {
    if (isErrorLanc) {
      toast({ title: "Erro", description: "Não foi possível carregar os lançamentos.", variant: "destructive" });
    }
  }, [isErrorLanc, toast]);

  // Filtro de empreendimento por texto (CLIENT-SIDE)
  const lancamentos = useMemo(() => {
    const txt = (debouncedEmpTxt || "").trim().toLowerCase();
    if (!txt) return lancamentosRaw;

    return lancamentosRaw.filter((l) => {
      const nome = (empMap.get(l.empreendimentoId) || "").toLowerCase();
      return nome.includes(txt);
    });
  }, [lancamentosRaw, debouncedEmpTxt, empMap]);

  const { data: stats } = useQuery<FinancialStats>({
    queryKey: ["/api/financeiro/stats", selectedEmpreendimentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
      const qs = params.toString();
      const res = await fetch(`/api/financeiro/stats${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar estatísticas");
      return res.json();
    },
  });

  const { data: expenseEvolution } = useQuery<ExpenseEvolutionData>({
    queryKey: ["/api/financeiro/expense-evolution", selectedExpenseCategory, selectedEmpreendimentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
      if (selectedExpenseCategory !== "todas") params.append("categoriaId", selectedExpenseCategory);
      const qs = params.toString();
      const res = await fetch(`/api/financeiro/expense-evolution${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar evolução de despesas");
      return res.json();
    },
  });

  /* ======= Mutations (melhoria: consistent invalidation) ======= */

  const invalidateFinanceiro = () => {
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey?.[0] === "string" && (q.queryKey[0] as string).startsWith("/api/financeiro"),
    });
    queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: keyof typeof STATUS_CONFIG }) =>
      apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, { status }),
    onSuccess: () => {
      invalidateFinanceiro();
      toast({ title: "Status atualizado", description: "O status do lançamento foi alterado com sucesso!" });
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/financeiro/lancamentos/${id}`),
    onSuccess: () => {
      invalidateFinanceiro();
      toast({ title: "Lançamento excluído", description: "O lançamento foi removido com sucesso!" });
      setDeleteDialogOpen(false);
      setDeletingLancamentoId(null);
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível excluir o lançamento.", variant: "destructive" }),
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FinanceiroLancamento> }) =>
      apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, data),
    onSuccess: () => {
      invalidateFinanceiro();
      toast({ title: "Lançamento atualizado", description: "O lançamento foi atualizado com sucesso!" });
      setEditDialogOpen(false);
      setEditingLancamento(null);
    },
    onError: () => toast({ title: "Erro", description: "Não foi possível atualizar o lançamento.", variant: "destructive" }),
  });

  /* ======= Reembolsos (mantido, apenas invalidação reforçada) ======= */

  const { data: reembolsosFinanceiro = [], isLoading: loadingReembolsosFinanceiro } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "financeiroPendente"],
    queryFn: async () => {
      const res = await fetch("/api/reembolsos?financeiroPendente=true", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar reembolsos");
      return res.json();
    },
  });

  const { data: reembolsosDiretor = [], isLoading: loadingReembolsosDiretor } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "diretorPendente"],
    queryFn: async () => {
      const res = await fetch("/api/reembolsos?diretorPendente=true", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar reembolsos");
      return res.json();
    },
  });

  const { data: reembolsosAprovados = [], isLoading: loadingReembolsosAprovados } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "aprovado_diretor"],
    queryFn: async () => {
      const res = await fetch("/api/reembolsos?status=aprovado_diretor", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar reembolsos");
      return res.json();
    },
  });

  const aprovarReembolsoFinanceiroMutation = useMutation({
    mutationFn: ({ id, observacao }: { id: number; observacao?: string }) =>
      apiRequest("POST", `/api/reembolsos/${id}/aprovar-financeiro`, { observacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Reembolso aprovado e enviado para o diretor!" });
      setIsReembolsoDetailOpen(false);
      setSelectedReembolso(null);
      setReembolsoObservacao("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao aprovar reembolso", variant: "destructive" }),
  });

  const rejeitarReembolsoFinanceiroMutation = useMutation({
    mutationFn: ({ id, observacao }: { id: number; observacao?: string }) =>
      apiRequest("POST", `/api/reembolsos/${id}/rejeitar-financeiro`, { observacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Reembolso rejeitado!" });
      setIsReembolsoDetailOpen(false);
      setSelectedReembolso(null);
      setReembolsoObservacao("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao rejeitar reembolso", variant: "destructive" }),
  });

  const aprovarReembolsoDiretorMutation = useMutation({
    mutationFn: ({ id, observacao }: { id: number; observacao?: string }) =>
      apiRequest("POST", `/api/reembolsos/${id}/aprovar-diretor`, { observacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Reembolso aprovado para pagamento!" });
      setIsReembolsoDetailOpen(false);
      setSelectedReembolso(null);
      setReembolsoObservacao("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao aprovar reembolso", variant: "destructive" }),
  });

  const rejeitarReembolsoDiretorMutation = useMutation({
    mutationFn: ({ id, observacao }: { id: number; observacao?: string }) =>
      apiRequest("POST", `/api/reembolsos/${id}/rejeitar-diretor`, { observacao }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Reembolso rejeitado!" });
      setIsReembolsoDetailOpen(false);
      setSelectedReembolso(null);
      setReembolsoObservacao("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao rejeitar reembolso", variant: "destructive" }),
  });

  const pagarReembolsoMutation = useMutation({
    mutationFn: ({ id, formaPagamento, dataPagamento }: { id: number; formaPagamento: string; dataPagamento: string }) =>
      apiRequest("POST", `/api/reembolsos/${id}/pagar`, { formaPagamento, dataPagamento }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Reembolso marcado como pago!" });
      setIsReembolsoDetailOpen(false);
      setSelectedReembolso(null);
      setPagamentoInfo({ formaPagamento: "", dataPagamento: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao registrar pagamento", variant: "destructive" }),
  });

  /* ======= Totais/Charts em useMemo ======= */

  const totals = useMemo(() => {
    const totalReceitas = lancamentos.filter((l) => l.tipo === "receita" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
    const totalDespesas = lancamentos.filter((l) => l.tipo === "despesa" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
    const totalPendente = lancamentos.filter((l) => l.status === "aguardando").reduce((s, l) => s + Number(l.valor), 0);
    const saldoAtual = totalReceitas - totalDespesas;
    return { totalReceitas, totalDespesas, totalPendente, saldoAtual };
  }, [lancamentos]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" as const } },
    }),
    []
  );

  const lineChartData = useMemo(() => {
    return {
      labels: stats?.evolucaoMensal?.map((m) => m.mes) || [],
      datasets: [
        { label: "Receitas", data: stats?.evolucaoMensal?.map((m) => m.receitas) || [], borderColor: "rgba(34, 197, 94, 1)", backgroundColor: "rgba(34, 197, 94, 0.1)", fill: true, tension: 0.4 },
        { label: "Despesas", data: stats?.evolucaoMensal?.map((m) => m.despesas) || [], borderColor: "rgba(239, 68, 68, 1)", backgroundColor: "rgba(239, 68, 68, 0.1)", fill: true, tension: 0.4 },
        { label: "Lucro", data: stats?.evolucaoMensal?.map((m) => m.lucro) || [], borderColor: "rgba(59, 130, 246, 1)", backgroundColor: "rgba(59, 130, 246, 0.1)", fill: true, tension: 0.4 },
      ],
    };
  }, [stats]);

  const pieChartData = useMemo(() => {
    return {
      labels: stats?.porCategoria?.map((c) => c.categoria) || [],
      datasets: [{ data: stats?.porCategoria?.map((c) => c.valor) || [], backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: "#fff" }],
    };
  }, [stats]);

  const barChartData = useMemo(() => {
    return {
      labels: stats?.porEmpreendimento?.map((e) => e.empreendimento) || [],
      datasets: [
        { label: "Receitas", data: stats?.porEmpreendimento?.map((e) => e.receitas) || [], backgroundColor: "rgba(34, 197, 94, 0.8)" },
        { label: "Despesas", data: stats?.porEmpreendimento?.map((e) => e.despesas) || [], backgroundColor: "rgba(239, 68, 68, 0.8)" },
        { label: "Lucro", data: stats?.porEmpreendimento?.map((e) => e.lucro) || [], backgroundColor: "rgba(59, 130, 246, 0.8)" },
      ],
    };
  }, [stats]);

  const expenseEvolutionChartData = useMemo(() => {
    if (!expenseEvolution) return { labels: [], datasets: [] as any[] };
    const categoriasToShow =
      selectedExpenseCategory === "todas"
        ? expenseEvolution.categorias
        : expenseEvolution.categorias.filter((c) => String(c.id) === selectedExpenseCategory);

    return {
      labels: expenseEvolution.evolucao.map((e) => e.mes),
      datasets: categoriasToShow.map((cat, idx) => ({
        label: cat.nome,
        data: expenseEvolution.evolucao.map((e) => e.valores[cat.id] || 0),
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
      })),
    };
  }, [expenseEvolution, selectedExpenseCategory]);

  if (isLoadingLanc) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Carregando módulo financeiro...</p>
        </div>
      </div>
    );
  }

  return (
    <SensitivePageWrapper moduleName="Módulo Financeiro">
      <div className="container mx-auto py-8 space-y-6" data-testid="page-financeiro">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Módulo Financeiro</h1>
              <p className="text-muted-foreground mt-2">Gestão completa dos aspectos econômicos dos projetos</p>
            </div>

            <div className="flex gap-3">
              <FinancialReportPDF
                stats={stats}
                empreendimentos={empreendimentos}
                lineChartRef={lineChartRef}
                pieChartRef={pieChartRef}
                barChartRef={barChartRef}
                expenseEvolutionChartRef={expenseEvolutionChartRef}
              />
              <Button variant="outline" onClick={() => window.open("/api/financeiro/export-excel", "_blank")} data-testid="button-exportar-excel">
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <RefreshButton />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-novo-lancamento">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Lançamento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
                  </DialogHeader>
                  <NovoLancamentoForm onSuccess={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Empreendimento Filter */}
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3 flex-wrap">
            <Building className="h-5 w-5 text-muted-foreground" />
            <Label className="text-sm font-medium whitespace-nowrap">Filtrar por Empreendimento:</Label>
            <Select value={selectedEmpreendimentoId} onValueChange={setSelectedEmpreendimentoId}>
              <SelectTrigger className="w-[320px]" data-testid="select-empreendimento-filter">
                <SelectValue placeholder="Todos os empreendimentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Empreendimentos</SelectItem>
                {empreendimentos.map((emp) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedEmpreendimentoId !== "todos" && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmpreendimentoId("todos")} data-testid="button-limpar-filtro">
                Limpar Filtro
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-receitas">
                R$ {moneyBRL(totals.totalReceitas)}
              </div>
              <p className="text-xs text-muted-foreground">Valores recebidos e confirmados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-total-despesas">
                R$ {moneyBRL(totals.totalDespesas)}
              </div>
              <p className="text-xs text-muted-foreground">Valores pagos e confirmados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
              <Wallet className={`h-4 w-4 ${totals.saldoAtual >= 0 ? "text-green-600" : "text-red-600"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totals.saldoAtual >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-saldo-atual">
                R$ {moneyBRL(totals.saldoAtual)}
              </div>
              <p className="text-xs text-muted-foreground">Receitas menos despesas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendente Aprovação</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-total-pendente">
                R$ {moneyBRL(totals.totalPendente)}
              </div>
              <p className="text-xs text-muted-foreground">Aguardando análise e aprovação</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="resumo" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="resumo" data-testid="tab-resumo">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="evolucao" data-testid="tab-evolucao">
              <LineChart className="h-4 w-4 mr-2" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="projetos" data-testid="tab-projetos">
              <Building className="h-4 w-4 mr-2" />
              Por Projeto
            </TabsTrigger>
            <TabsTrigger value="lancamentos" data-testid="tab-lancamentos">
              <FileText className="h-4 w-4 mr-2" />
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="reembolsos" data-testid="tab-reembolsos">
              <Receipt className="h-4 w-4 mr-2" />
              Reembolsos ({reembolsosFinanceiro.length + reembolsosDiretor.length + reembolsosAprovados.length})
            </TabsTrigger>
          </TabsList>

          {/* Resumo */}
          <TabsContent value="resumo" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    Evolução Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {stats?.evolucaoMensal?.length ? (
                      <Line ref={lineChartRef as any} data={lineChartData} options={chartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <LineChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Sem dados para exibir</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Gastos por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {stats?.porCategoria?.length ? (
                      <Pie ref={pieChartRef as any} data={pieChartData} options={chartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Sem dados para exibir</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Evolução */}
          <TabsContent value="evolucao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Evolução Financeira (Últimos 12 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {stats?.evolucaoMensal?.length ? (
                    <Line data={lineChartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <LineChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Adicione lançamentos para visualizar a evolução</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Evolução de Despesas por Tipo
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium whitespace-nowrap">Filtrar por tipo:</Label>
                    <Select value={selectedExpenseCategory} onValueChange={setSelectedExpenseCategory}>
                      <SelectTrigger className="w-[220px]" data-testid="select-expense-category-filter">
                        <SelectValue placeholder="Todas as categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as categorias</SelectItem>
                        {expenseEvolution?.categorias?.map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {expenseEvolutionChartData.datasets.length ? (
                    <Bar
                      ref={expenseEvolutionChartRef as any}
                      data={expenseEvolutionChartData}
                      options={{
                        ...chartOptions,
                        scales: {
                          x: { stacked: false },
                          y: {
                            stacked: false,
                            ticks: {
                              callback: (value: any) => "R$ " + Number(value).toLocaleString("pt-BR"),
                            },
                          },
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Adicione despesas para visualizar a evolução por tipo</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projetos */}
          <TabsContent value="projetos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Receitas e Despesas por Projeto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {stats?.porEmpreendimento?.length ? (
                    <Bar ref={barChartRef as any} data={barChartData} options={chartOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Building className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Adicione lançamentos para visualizar por projeto</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lançamentos */}
          <TabsContent value="lancamentos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="relative col-span-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar lançamentos..."
                      value={filters.search}
                      onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                      className="pl-9"
                      data-testid="filter-search"
                    />
                  </div>

                  <Select value={filters.tipo} onValueChange={(value) => setFilters((p) => ({ ...p, tipo: value }))}>
                    <SelectTrigger data-testid="filter-tipo">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="reembolso">Reembolso</SelectItem>
                      <SelectItem value="solicitacao_recurso">Solicitação</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.status} onValueChange={(value) => setFilters((p) => ({ ...p, status: value }))}>
                    <SelectTrigger data-testid="filter-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="aguardando">Aguardando</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="recusado">Recusado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.unidade} onValueChange={(value) => setFilters((p) => ({ ...p, unidade: value }))}>
                    <SelectTrigger data-testid="filter-unidade">
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as Unidades</SelectItem>
                      <SelectItem value="salvador">Salvador (BA)</SelectItem>
                      <SelectItem value="goiania">Goiânia (GO)</SelectItem>
                      <SelectItem value="lem">Luís Eduardo Magalhães (LEM)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Empreendimento (texto)"
                    value={filters.empreendimentoTexto}
                    onChange={(e) => setFilters((p) => ({ ...p, empreendimentoTexto: e.target.value }))}
                    data-testid="filter-empreendimento-texto"
                  />

                  <Button
                    onClick={() => setFilters({ tipo: "todos", status: "todos", search: "", unidade: "todas", empreendimentoTexto: "" })}
                    variant="outline"
                    data-testid="button-clear-filters"
                  >
                    Limpar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Lançamentos Financeiros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lancamentos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Nenhum lançamento encontrado</p>
                    <p className="text-sm">Crie um lançamento financeiro no botão “Novo Lançamento”.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4">Data</th>
                          <th className="text-left p-4">Vencimento</th>
                          <th className="text-left p-4">Pagamento</th>
                          <th className="text-left p-4">Tipo</th>
                          <th className="text-left p-4">Descrição</th>
                          <th className="text-left p-4">Valor</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-left p-4">Unidade</th>
                          <th className="text-left p-4">Empreendimento</th>
                          <th className="text-left p-4">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lancamentos.map((l) => {
                          const tipoConfig = TIPO_CONFIG[l.tipo as keyof typeof TIPO_CONFIG];
                          const statusConfig = STATUS_CONFIG[(l.status as keyof typeof STATUS_CONFIG) ?? "aguardando"];

                          const venc = parseServerDate(l.dataVencimento);
                          const overdue = venc ? venc < new Date() && l.status !== "pago" : false;

                          return (
                            <tr key={l.id} className="border-b hover:bg-muted/50" data-testid={`row-lancamento-${l.id}`}>
                              <td className="p-4">{formatServerDate(l.data)}</td>

                              <td className="p-4 text-sm">
                                {l.dataVencimento ? (
                                  <span className={overdue ? "text-red-600 font-medium" : ""}>{formatServerDate(l.dataVencimento)}</span>
                                ) : (
                                  <span className="text-muted-foreground">–</span>
                                )}
                              </td>

                              <td className="p-4 text-sm">{l.dataPagamento ? formatServerDate(l.dataPagamento) : <span className="text-muted-foreground">–</span>}</td>

                              <td className="p-4">
                                <Badge className={tipoConfig?.color}>{tipoConfig?.label}</Badge>
                              </td>

                              <td className="p-4">
                                <div className="max-w-xs truncate">{l.descricao}</div>
                              </td>

                              <td className="p-4 font-medium">
                                <span className={l.tipo === "receita" ? "text-green-600" : "text-red-600"}>
                                  {l.tipo === "receita" ? "+" : "-"}R$ {moneyBRL(Number(l.valor))}
                                </span>
                              </td>

                              <td className="p-4">
                                <Badge variant="outline" className={`${statusConfig?.color} text-white border-transparent`}>
                                  {statusConfig?.label}
                                </Badge>
                              </td>

                              <td className="p-4">
                                <Badge variant="secondary" className="text-xs">
                                  {UNIDADES_CONFIG[l.unidade as keyof typeof UNIDADES_CONFIG]?.sigla || l.unidade || "BA"}
                                </Badge>
                              </td>

                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Building className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{empMap.get(l.empreendimentoId) || `#${l.empreendimentoId}`}</span>
                                </div>
                              </td>

                              <td className="p-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" aria-label="Ações" data-testid={`button-actions-${l.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: l.id, status: "aprovado" })} disabled={l.status === "aprovado"}>
                                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                      Aprovar
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: l.id, status: "aguardando" })} disabled={l.status === "aguardando"}>
                                      <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                                      Aguardando
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: l.id, status: "pago" })} disabled={l.status === "pago"}>
                                      <DollarSign className="h-4 w-4 mr-2 text-blue-500" />
                                      Marcar como Pago
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => updateStatusMutation.mutate({ id: l.id, status: "cancelado" })}
                                      disabled={l.status === "cancelado"}
                                    >
                                      <XCircle className="h-4 w-4 mr-2 text-zinc-600" />
                                      Cancelar
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingLancamento(l);
                                        setEditDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4 mr-2 text-gray-500" />
                                      Editar
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDeletingLancamentoId(l.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reembolsos (mantido como estava, só com pequenos ajustes de estado/dialog) */}
          <TabsContent value="reembolsos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Pendente Aprovação Financeiro ({reembolsosFinanceiro.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReembolsosFinanceiro ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : reembolsosFinanceiro.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum reembolso pendente de aprovação financeira</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3">Solicitante</th>
                          <th className="text-left p-3">Categoria</th>
                          <th className="text-left p-3">Descrição</th>
                          <th className="text-right p-3">Valor</th>
                          <th className="text-left p-3">Data</th>
                          <th className="text-left p-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reembolsosFinanceiro.map((r: any) => (
                          <tr key={r.id} className="border-b hover:bg-muted/30">
                            <td className="p-3">{r.solicitanteNome || "N/A"}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize">
                                {r.categoria}
                              </Badge>
                            </td>
                            <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
                            <td className="p-3 text-right font-medium">R$ {moneyBRL(Number(r.valor))}</td>
                            <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), "dd/MM/yyyy", { locale: ptBR }) : "N/A"}</td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedReembolso(r);
                                  setIsReembolsoDetailOpen(true);
                                }}
                              >
                                Analisar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Pendente Aprovação Diretor ({reembolsosDiretor.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReembolsosDiretor ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : reembolsosDiretor.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum reembolso pendente de aprovação do diretor</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3">Solicitante</th>
                          <th className="text-left p-3">Categoria</th>
                          <th className="text-left p-3">Descrição</th>
                          <th className="text-right p-3">Valor</th>
                          <th className="text-left p-3">Data</th>
                          <th className="text-left p-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reembolsosDiretor.map((r: any) => (
                          <tr key={r.id} className="border-b hover:bg-muted/30">
                            <td className="p-3">{r.solicitanteNome || "N/A"}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize">
                                {r.categoria}
                              </Badge>
                            </td>
                            <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
                            <td className="p-3 text-right font-medium">R$ {moneyBRL(Number(r.valor))}</td>
                            <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), "dd/MM/yyyy", { locale: ptBR }) : "N/A"}</td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedReembolso(r);
                                  setIsReembolsoDetailOpen(true);
                                }}
                              >
                                Analisar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Aprovados . Aguardando Pagamento ({reembolsosAprovados.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReembolsosAprovados ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : reembolsosAprovados.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum reembolso aguardando pagamento</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3">Solicitante</th>
                          <th className="text-left p-3">Categoria</th>
                          <th className="text-left p-3">Descrição</th>
                          <th className="text-right p-3">Valor</th>
                          <th className="text-left p-3">Data</th>
                          <th className="text-left p-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reembolsosAprovados.map((r: any) => (
                          <tr key={r.id} className="border-b hover:bg-muted/30">
                            <td className="p-3">{r.solicitanteNome || "N/A"}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize">
                                {r.categoria}
                              </Badge>
                            </td>
                            <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
                            <td className="p-3 text-right font-medium">R$ {moneyBRL(Number(r.valor))}</td>
                            <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), "dd/MM/yyyy", { locale: ptBR }) : "N/A"}</td>
                            <td className="p-3">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => {
                                  setSelectedReembolso(r);
                                  setIsReembolsoDetailOpen(true);
                                }}
                              >
                                Pagar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reembolso Dialog */}
        <Dialog open={isReembolsoDetailOpen} onOpenChange={setIsReembolsoDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedReembolso?.status === "pendente_financeiro" && "Análise Financeira"}
                {selectedReembolso?.status === "pendente_diretor" && "Análise do Diretor"}
                {selectedReembolso?.status === "aprovado_diretor" && "Registrar Pagamento"}
              </DialogTitle>
            </DialogHeader>

            {selectedReembolso && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Solicitante</Label>
                    <p className="font-medium">{selectedReembolso.solicitanteNome || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Categoria</Label>
                    <Badge variant="outline" className="capitalize mt-1">
                      {selectedReembolso.categoria}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Valor</Label>
                    <p className="font-bold text-lg">R$ {moneyBRL(Number(selectedReembolso.valor))}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data do Gasto</Label>
                    <p>{selectedReembolso.dataGasto ? format(new Date(selectedReembolso.dataGasto), "dd/MM/yyyy", { locale: ptBR }) : "N/A"}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Descrição</Label>
                  <p className="bg-muted p-3 rounded mt-1">{selectedReembolso.descricao}</p>
                </div>

                {selectedReembolso.observacoes && (
                  <div>
                    <Label className="text-muted-foreground">Observações do Solicitante</Label>
                    <p className="bg-muted p-3 rounded mt-1">{selectedReembolso.observacoes}</p>
                  </div>
                )}

                {selectedReembolso.comprovanteUrl && (
                  <div>
                    <Label className="text-muted-foreground">Comprovante</Label>
                    <a href={selectedReembolso.comprovanteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block mt-1">
                      Ver Comprovante
                    </a>
                  </div>
                )}

                {selectedReembolso.status === "pendente_financeiro" && (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <Label>Observações (opcional)</Label>
                      <Textarea value={reembolsoObservacao} onChange={(e) => setReembolsoObservacao(e.target.value)} placeholder="Adicione observações para o diretor..." />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => rejeitarReembolsoFinanceiroMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                        disabled={rejeitarReembolsoFinanceiroMutation.isPending}
                      >
                        {rejeitarReembolsoFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Rejeitar
                      </Button>
                      <Button
                        onClick={() => aprovarReembolsoFinanceiroMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                        disabled={aprovarReembolsoFinanceiroMutation.isPending}
                      >
                        {aprovarReembolsoFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        Aprovar e Enviar para Diretor
                      </Button>
                    </div>
                  </div>
                )}

                {selectedReembolso.status === "pendente_diretor" && (
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <Label>Observações (opcional)</Label>
                      <Textarea value={reembolsoObservacao} onChange={(e) => setReembolsoObservacao(e.target.value)} placeholder="Adicione observações finais..." />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => rejeitarReembolsoDiretorMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                        disabled={rejeitarReembolsoDiretorMutation.isPending}
                      >
                        {rejeitarReembolsoDiretorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Rejeitar
                      </Button>
                      <Button
                        onClick={() => aprovarReembolsoDiretorMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                        disabled={aprovarReembolsoDiretorMutation.isPending}
                      >
                        {aprovarReembolsoDiretorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        Aprovar para Pagamento
                      </Button>
                    </div>
                  </div>
                )}

                {selectedReembolso.status === "aprovado_diretor" && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <Select value={pagamentoInfo.formaPagamento} onValueChange={(v) => setPagamentoInfo((p) => ({ ...p, formaPagamento: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Data do Pagamento</Label>
                        <Input type="date" value={pagamentoInfo.dataPagamento} onChange={(e) => setPagamentoInfo((p) => ({ ...p, dataPagamento: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => pagarReembolsoMutation.mutate({ id: selectedReembolso.id, ...pagamentoInfo })}
                        disabled={pagarReembolsoMutation.isPending || !pagamentoInfo.formaPagamento || !pagamentoInfo.dataPagamento}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {pagarReembolsoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                        Confirmar Pagamento
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingLancamentoId && deleteMutation.mutate(deletingLancamentoId)}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Lançamento</DialogTitle>
            </DialogHeader>
            {editingLancamento && (
              <EditLancamentoForm
                lancamento={editingLancamento}
                onCancel={() => {
                  setEditDialogOpen(false);
                  setEditingLancamento(null);
                }}
                updateMutation={updateLancamentoMutation}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SensitivePageWrapper>
  );
}
