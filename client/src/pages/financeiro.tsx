import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
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
  MoreVertical,
  RefreshCw
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FinanceiroLancamento, Empreendimento, CategoriaFinanceira } from "@shared/schema";
import * as z from "zod";
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
} from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Status configuration
const STATUS_CONFIG = {
  aguardando: { label: "Aguardando", color: "bg-yellow-500", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-blue-500", icon: CheckCircle },
  pago: { label: "Pago", color: "bg-green-500", icon: CheckCircle },
  recusado: { label: "Recusado", color: "bg-red-500", icon: XCircle }
};

// Tipo configuration
const TIPO_CONFIG = {
  receita: { label: "Receita", color: "bg-green-100 text-green-700", icon: ArrowUpIcon },
  despesa: { label: "Despesa", color: "bg-red-100 text-red-700", icon: ArrowDownIcon },
  reembolso: { label: "Reembolso", color: "bg-blue-100 text-blue-700", icon: Receipt },
  solicitacao_recurso: { label: "Solicitação", color: "bg-purple-100 text-purple-700", icon: FileText }
};

// Create form schema for Novo Lançamento
const novoLancamentoSchema = z.object({
  tipo: z.enum(["receita", "despesa", "reembolso", "solicitacao_recurso"], { required_error: "Tipo é obrigatório" }),
  empreendimentoId: z.number({ required_error: "Empreendimento é obrigatório" }),
  categoriaId: z.number({ required_error: "Categoria é obrigatória" }),
  valor: z.number().min(0.01, "Valor deve ser maior que zero"),
  data: z.date({ required_error: "Data é obrigatória" }),
  descricao: z.string().min(5, "Descrição deve ter pelo menos 5 caracteres"),
  observacoes: z.string().optional(),
});

type NovoLancamentoFormData = z.infer<typeof novoLancamentoSchema>;

// Types for financial stats
interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
  porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
}

// Novo Lançamento Form Component
interface NovoLancamentoFormProps {
  onSuccess: () => void;
}

function NovoLancamentoForm({ onSuccess }: NovoLancamentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: categorias = [], refetch: refetchCategorias } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    staleTime: 1000 * 60 * 5,
  });

  const initCategoriesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/categorias-financeiras/init");
    },
    onSuccess: () => {
      refetchCategorias();
    },
  });

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: "despesa",
      valor: 0,
      descricao: "",
      observacoes: "",
      data: new Date(),
    },
  });

  const createLancamentoMutation = useMutation({
    mutationFn: async (data: NovoLancamentoFormData) => {
      return apiRequest("POST", "/api/financeiro/lancamentos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith?.("/api/financeiro") ?? false;
        }
      });
      toast({
        title: "Lançamento criado",
        description: "Novo lançamento financeiro foi criado com sucesso!",
      });
      form.reset();
    },
  });

  const onSubmit = (data: NovoLancamentoFormData) => {
    createLancamentoMutation.mutate(data);
  };

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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger data-testid="select-empreendimento">
                      <SelectValue placeholder="Selecione o empreendimento" />
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
            name="categoriaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria *</FormLabel>
                <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger data-testid="select-categoria">
                      <SelectValue placeholder={categorias.length === 0 ? "Carregando categorias..." : "Selecione a categoria"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categorias.length === 0 ? (
                      <SelectItem value="loading" disabled>
                        {initCategoriesMutation.isPending ? "Inicializando categorias..." : "Carregando categorias..."}
                      </SelectItem>
                    ) : (
                      categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cat.cor }}
                            />
                            {cat.nome} ({cat.tipo})
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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
                    placeholder="0,00"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
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
              <FormItem className="md:col-span-2">
                <FormLabel>Data *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-data"
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Selecione a data</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
                <Textarea
                  placeholder="Descreva o lançamento financeiro..."
                  className="min-h-[100px] resize-none"
                  {...field}
                  data-testid="textarea-descricao"
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
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observações adicionais..."
                  className="min-h-[60px] resize-none"
                  {...field}
                  data-testid="textarea-observacoes"
                />
              </FormControl>
              <FormDescription>
                Informações complementares sobre o lançamento
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            data-testid="button-cancelar"
          >
            Limpar
          </Button>
          <Button
            type="submit"
            disabled={createLancamentoMutation.isPending}
            data-testid="button-criar-lancamento"
          >
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

// Chart color palette
const CHART_COLORS = [
  'rgba(34, 197, 94, 0.8)',   // green
  'rgba(239, 68, 68, 0.8)',   // red
  'rgba(59, 130, 246, 0.8)',  // blue
  'rgba(168, 85, 247, 0.8)',  // purple
  'rgba(245, 158, 11, 0.8)',  // amber
  'rgba(236, 72, 153, 0.8)',  // pink
  'rgba(20, 184, 166, 0.8)',  // teal
  'rgba(249, 115, 22, 0.8)',  // orange
];

export default function FinanceiroPage() {
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    empreendimento: "",
    search: ""
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith?.("/api/financeiro") ?? false;
        }
      });
      toast({
        title: "Status atualizado",
        description: "O status do lançamento foi alterado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao atualizar status:", error);
    },
  });

  // Build query string from filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.tipo && filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status && filters.status !== "todos") params.append("status", filters.status);
    if (filters.empreendimento) params.append("empreendimentoId", filters.empreendimento);
    if (filters.search) params.append("search", filters.search);
    const queryStr = params.toString();
    return queryStr ? `?${queryStr}` : "";
  };

  // Fetch financial data with proper query string
  const { data: lancamentos = [], isLoading } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos", filters.tipo, filters.status, filters.empreendimento, filters.search],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/lancamentos${buildQueryString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch lancamentos");
      return res.json();
    },
  });

  // Fetch financial stats for charts
  const { data: stats } = useQuery<FinancialStats>({
    queryKey: ["/api/financeiro/stats"],
  });

  // Fetch empreendimentos for lookup
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  // Create empreendimento lookup map
  const empMap = new Map(empreendimentos.map(e => [e.id, e.nome]));

  // Calculate totals for dashboard cards
  const totalReceitas = lancamentos
    .filter(l => l.tipo === "receita" && l.status === "pago")
    .reduce((sum, l) => sum + Number(l.valor), 0);

  const totalDespesas = lancamentos
    .filter(l => l.tipo === "despesa" && l.status === "pago")
    .reduce((sum, l) => sum + Number(l.valor), 0);

  const totalPendente = lancamentos
    .filter(l => l.status === "aguardando")
    .reduce((sum, l) => sum + Number(l.valor), 0);

  const saldoAtual = totalReceitas - totalDespesas;

  // Line chart data for monthly evolution
  const lineChartData = {
    labels: stats?.evolucaoMensal?.map(m => m.mes) || [],
    datasets: [
      {
        label: 'Receitas',
        data: stats?.evolucaoMensal?.map(m => m.receitas) || [],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Despesas',
        data: stats?.evolucaoMensal?.map(m => m.despesas) || [],
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Lucro',
        data: stats?.evolucaoMensal?.map(m => m.lucro) || [],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Pie chart data for categories
  const pieChartData = {
    labels: stats?.porCategoria?.map(c => c.categoria) || [],
    datasets: [
      {
        data: stats?.porCategoria?.map(c => c.valor) || [],
        backgroundColor: CHART_COLORS,
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  // Bar chart data for empreendimentos
  const barChartData = {
    labels: stats?.porEmpreendimento?.map(e => e.empreendimento) || [],
    datasets: [
      {
        label: 'Receitas',
        data: stats?.porEmpreendimento?.map(e => e.receitas) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      },
      {
        label: 'Despesas',
        data: stats?.porEmpreendimento?.map(e => e.despesas) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
      },
      {
        label: 'Lucro',
        data: stats?.porEmpreendimento?.map(e => e.lucro) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  if (isLoading) {
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
    <div className="container mx-auto py-8 space-y-6" data-testid="page-financeiro">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Módulo Financeiro
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestão completa dos aspectos econômicos dos projetos
          </p>
        </div>
        
        <div className="flex gap-3">
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

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Receitas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-receitas">
              R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Valores recebidos e confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Despesas
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-despesas">
              R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Valores pagos e confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo Atual
            </CardTitle>
            <Wallet className={`h-4 w-4 ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-saldo-atual">
              R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Receitas menos despesas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pendente Aprovação
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-total-pendente">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando análise e aprovação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
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
        </TabsList>

        {/* Resumo Tab - Overview with charts */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Evolution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Evolução Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.evolucaoMensal && stats.evolucaoMensal.length > 0 ? (
                    <Line data={lineChartData} options={chartOptions} />
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

            {/* Category Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Gastos por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.porCategoria && stats.porCategoria.length > 0 ? (
                    <Pie data={pieChartData} options={chartOptions} />
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

        {/* Evolução Tab - Detailed monthly evolution */}
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
                {stats?.evolucaoMensal && stats.evolucaoMensal.length > 0 ? (
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

          {/* Monthly Summary Table */}
          {stats?.evolucaoMensal && stats.evolucaoMensal.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Mês</th>
                        <th className="text-right p-4">Receitas</th>
                        <th className="text-right p-4">Despesas</th>
                        <th className="text-right p-4">Lucro/Prejuízo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.evolucaoMensal.map((mes, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-4 font-medium">{mes.mes}</td>
                          <td className="p-4 text-right text-green-600">
                            R$ {mes.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right text-red-600">
                            R$ {mes.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={`p-4 text-right font-bold ${mes.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            R$ {mes.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Projetos Tab - Per project analysis */}
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
                {stats?.porEmpreendimento && stats.porEmpreendimento.length > 0 ? (
                  <Bar data={barChartData} options={chartOptions} />
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

          {/* Project Cards */}
          {stats?.porEmpreendimento && stats.porEmpreendimento.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.porEmpreendimento.map((emp, idx) => (
                <Card key={idx} className="border-l-4" style={{ borderLeftColor: emp.lucro >= 0 ? '#22c55e' : '#ef4444' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {emp.empreendimento}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receitas:</span>
                      <span className="text-green-600 font-medium">
                        R$ {emp.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Despesas:</span>
                      <span className="text-red-600 font-medium">
                        R$ {emp.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Lucro:</span>
                      <span className={`font-bold ${emp.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {emp.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Margem: {emp.receitas > 0 ? ((emp.lucro / emp.receitas) * 100).toFixed(1) : 0}%
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Lançamentos Tab - Transaction list */}
        <TabsContent value="lancamentos" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lançamentos..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="pl-9"
                    data-testid="filter-search"
                  />
                </div>
                
                <Select value={filters.tipo} onValueChange={(value) => setFilters({...filters, tipo: value})}>
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

                <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                  <SelectTrigger data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aguardando">Aguardando</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="recusado">Recusado</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Empreendimento"
                  value={filters.empreendimento}
                  onChange={(e) => setFilters({...filters, empreendimento: e.target.value})}
                  data-testid="filter-empreendimento"
                />

                <Button 
                  onClick={() => setFilters({ tipo: "todos", status: "todos", empreendimento: "", search: "" })}
                  variant="outline"
                  data-testid="button-clear-filters"
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Financial Transactions Table */}
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
                  <p className="text-sm">
                    Comece criando seu primeiro lançamento financeiro clicando no botão "Novo Lançamento"
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Data</th>
                        <th className="text-left p-4">Tipo</th>
                        <th className="text-left p-4">Descrição</th>
                        <th className="text-left p-4">Valor</th>
                        <th className="text-left p-4">Status</th>
                        <th className="text-left p-4">Empreendimento</th>
                        <th className="text-left p-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((lancamento) => {
                        const tipoConfig = TIPO_CONFIG[lancamento.tipo as keyof typeof TIPO_CONFIG];
                        const statusConfig = STATUS_CONFIG[lancamento.status as keyof typeof STATUS_CONFIG];
                        
                        return (
                          <tr key={lancamento.id} className="border-b hover:bg-muted/50" data-testid={`row-lancamento-${lancamento.id}`}>
                            <td className="p-4">
                              {format(new Date(lancamento.data), "dd/MM/yyyy", { locale: ptBR })}
                            </td>
                            <td className="p-4">
                              <Badge className={tipoConfig?.color}>
                                {tipoConfig?.label}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="max-w-xs truncate">
                                {lancamento.descricao}
                              </div>
                            </td>
                            <td className="p-4 font-medium">
                              <span className={lancamento.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}>
                                {lancamento.tipo === 'receita' ? '+' : '-'}R$ {Number(lancamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="p-4">
                              <Badge 
                                variant="outline" 
                                className={`${statusConfig?.color} text-white border-transparent`}
                              >
                                {statusConfig?.label}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{empMap.get(lancamento.empreendimentoId) || `#${lancamento.empreendimentoId}`}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" data-testid={`button-actions-${lancamento.id}`}>
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: lancamento.id, status: "aprovado" })}
                                    disabled={lancamento.status === "aprovado"}
                                    data-testid={`action-approve-${lancamento.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                    Aprovar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: lancamento.id, status: "aguardando" })}
                                    disabled={lancamento.status === "aguardando"}
                                    data-testid={`action-pending-${lancamento.id}`}
                                  >
                                    <Clock className="h-4 w-4 mr-2 text-yellow-500" />
                                    Aguardando
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: lancamento.id, status: "pago" })}
                                    disabled={lancamento.status === "pago"}
                                    data-testid={`action-paid-${lancamento.id}`}
                                  >
                                    <DollarSign className="h-4 w-4 mr-2 text-blue-500" />
                                    Marcar como Pago
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: lancamento.id, status: "cancelado" })}
                                    disabled={lancamento.status === "cancelado"}
                                    data-testid={`action-cancel-${lancamento.id}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                    Cancelar
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
      </Tabs>
    </div>
  );
}
