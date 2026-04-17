import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus, Download, DollarSign, TrendingUp, TrendingDown, Clock,
  BarChart3, PieChart, LineChart, Wallet, Building, Loader2,
  ArrowUpIcon, ArrowDownIcon, Receipt, FileText,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { FinancialReportPDF } from "@/components/FinancialReportPDF";
import { NovoLancamentoForm } from "@/components/financeiro/NovoLancamentoForm";
import { EditLancamentoForm } from "@/components/financeiro/EditLancamentoForm";
import { LancamentosTabContent } from "@/components/financeiro/LancamentosTabContent";
import { RecibosSection } from "@/components/financeiro/RecibosSection";
import { ReembolsosTabContent } from "@/components/financeiro/ReembolsosTabContent";
import { ReembolsoApprovalDialog } from "@/components/financeiro/ReembolsoApprovalDialog";
import { ReciboDialog } from "@/components/financeiro/ReciboDialog";
import type { LancamentosFilters } from "@/components/financeiro/LancamentosTabContent";
import type { FinanceiroLancamento, Empreendimento } from "@shared/schema";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Pie, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const CHART_COLORS = [
  "rgba(34,197,94,0.8)", "rgba(239,68,68,0.8)", "rgba(59,130,246,0.8)",
  "rgba(168,85,247,0.8)", "rgba(245,158,11,0.8)", "rgba(236,72,153,0.8)",
  "rgba(20,184,166,0.8)", "rgba(249,115,22,0.8)",
];

interface ExpenseEvolutionData {
  categorias: Array<{ id: number; nome: string; tipo: string }>;
  evolucao: Array<{ mes: string; valores: { [categoriaId: number]: number } }>;
}

interface FinancialStats {
  evolucaoMensal?: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
  porCategoria?: Array<{ categoria: string; valor: number }>;
  porEmpreendimento?: Array<{ empreendimento: string; receitas: number; despesas: number; lucro: number }>;
}

export default function FinanceiroPage() {
  const [filters, setFilters] = useState({ tipo: "todos", status: "todos", empreendimento: "", search: "", unidade: "todas" });
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLancamento, setEditingLancamento] = useState<FinanceiroLancamento | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLancamentoId, setDeletingLancamentoId] = useState<number | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState("todas");
  const [selectedReembolso, setSelectedReembolso] = useState<any>(null);
  const [isReembolsoDetailOpen, setIsReembolsoDetailOpen] = useState(false);
  const [reembolsoObservacao, setReembolsoObservacao] = useState("");
  const [pagamentoInfo, setPagamentoInfo] = useState({ formaPagamento: "", dataPagamento: "" });
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [reciboForm, setReciboForm] = useState<any>({ lancamentoId: null, empreendimentoId: null, numero: "", descricao: "", valor: "", pagador: "", recebedor: "", dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", unidade: "" });

  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const expenseEvolutionChartRef = useRef<HTMLCanvasElement>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Queries ──────────────────────────────────────────────────────────────
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status !== "todos") params.append("status", filters.status);
    if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
    if (filters.search) params.append("search", filters.search);
    if (filters.unidade !== "todas") params.append("unidade", filters.unidade);
    const q = params.toString();
    return q ? `?${q}` : "";
  };

  const { data: lancamentos = [], isLoading } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos", filters.tipo, filters.status, selectedEmpreendimentoId, filters.search, filters.unidade],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/lancamentos${buildQueryString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lancamentos");
      return res.json();
    },
  });

  const { data: stats } = useQuery<FinancialStats>({
    queryKey: ["/api/financeiro/stats", selectedEmpreendimentoId],
    queryFn: async () => {
      const params = selectedEmpreendimentoId !== "todos" ? `?empreendimentoId=${selectedEmpreendimentoId}` : "";
      const res = await fetch(`/api/financeiro/stats${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: expenseEvolution } = useQuery<ExpenseEvolutionData>({
    queryKey: ["/api/financeiro/expense-evolution", selectedExpenseCategory, selectedEmpreendimentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId !== "todos") params.append("empreendimentoId", selectedEmpreendimentoId);
      if (selectedExpenseCategory !== "todas") params.append("categoriaId", selectedExpenseCategory);
      const q = params.toString();
      const res = await fetch(`/api/financeiro/expense-evolution${q ? `?${q}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expense evolution");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });
  const { data: recibosData = [] } = useQuery<any[]>({ queryKey: ["/api/recibos"] });

  const { data: reembolsosFinanceiro = [], isLoading: loadingReembolsosFinanceiro } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "financeiroPendente"],
    queryFn: async () => { const res = await fetch("/api/reembolsos?financeiroPendente=true", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const { data: reembolsosDiretor = [], isLoading: loadingReembolsosDiretor } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "diretorPendente"],
    queryFn: async () => { const res = await fetch("/api/reembolsos?diretorPendente=true", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  const { data: reembolsosAprovados = [], isLoading: loadingReembolsosAprovados } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "aprovado_diretor"],
    queryFn: async () => { const res = await fetch("/api/reembolsos?status=aprovado_diretor", { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateFinanceiro = () => queryClient.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith?.("/api/financeiro") ?? false });
  const invalidateReembolsos = () => queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, { status }),
    onSuccess: () => { invalidateFinanceiro(); toast({ title: "Status atualizado" }); },
    onError: (e: Error) => { toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" }); console.error(e); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/financeiro/lancamentos/${id}`),
    onSuccess: () => { invalidateFinanceiro(); toast({ title: "Lançamento excluído" }); setDeleteDialogOpen(false); setDeletingLancamentoId(null); },
    onError: (e: Error) => { toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" }); console.error(e); },
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FinanceiroLancamento> }) => apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, data),
    onSuccess: () => { invalidateFinanceiro(); toast({ title: "Lançamento atualizado" }); setEditDialogOpen(false); setEditingLancamento(null); },
    onError: (e: Error) => { toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }); console.error(e); },
  });

  const createReciboMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/recibos", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recibos"] }); toast({ title: "Recibo emitido" }); setReciboDialogOpen(false); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha", variant: "destructive" }),
  });

  const onReembolsoSuccess = () => { invalidateReembolsos(); toast({ title: "Sucesso" }); setIsReembolsoDetailOpen(false); setSelectedReembolso(null); setReembolsoObservacao(""); };
  const onReembolsoError = (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" });

  const aprovarFinanceiroMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/aprovar-financeiro`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const rejeitarFinanceiroMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/rejeitar-financeiro`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const aprovarDiretorMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/aprovar-diretor`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const rejeitarDiretorMutation = useMutation({
    mutationFn: (args: { id: number; observacao?: string }) => apiRequest("POST", `/api/reembolsos/${args.id}/rejeitar-diretor`, { observacao: args.observacao }),
    onSuccess: onReembolsoSuccess, onError: onReembolsoError,
  });

  const pagarReembolsoMutation = useMutation({
    mutationFn: (args: { id: number; formaPagamento: string; dataPagamento: string }) =>
      apiRequest("POST", `/api/reembolsos/${args.id}/pagar`, { formaPagamento: args.formaPagamento, dataPagamento: args.dataPagamento }),
    onSuccess: () => { invalidateReembolsos(); toast({ title: "Sucesso", description: "Reembolso marcado como pago!" }); setIsReembolsoDetailOpen(false); setSelectedReembolso(null); setPagamentoInfo({ formaPagamento: "", dataPagamento: "" }); },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const recibosLancamentoIds = new Set<number>(recibosData.filter(r => r.lancamentoId).map(r => r.lancamentoId));
  const empMap = new Map<number | null, string>([[null, "Escritório"], ...empreendimentos.map(e => [e.id, e.nome] as [number, string])]);

  const totalReceitas = lancamentos.filter(l => l.tipo === "receita" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesas = lancamentos.filter(l => l.tipo === "despesa" && l.status === "pago").reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.status === "aguardando").reduce((s, l) => s + Number(l.valor), 0);
  const saldoAtual = totalReceitas - totalDespesas;

  const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" as const } } };

  const lineChartData = {
    labels: stats?.evolucaoMensal?.map(m => m.mes) || [],
    datasets: [
      { label: "Receitas", data: stats?.evolucaoMensal?.map(m => m.receitas) || [], borderColor: "rgba(34,197,94,1)", backgroundColor: "rgba(34,197,94,0.1)", fill: true, tension: 0.4 },
      { label: "Despesas", data: stats?.evolucaoMensal?.map(m => m.despesas) || [], borderColor: "rgba(239,68,68,1)", backgroundColor: "rgba(239,68,68,0.1)", fill: true, tension: 0.4 },
      { label: "Lucro", data: stats?.evolucaoMensal?.map(m => m.lucro) || [], borderColor: "rgba(59,130,246,1)", backgroundColor: "rgba(59,130,246,0.1)", fill: true, tension: 0.4 },
    ],
  };

  const pieChartData = {
    labels: stats?.porCategoria?.map(c => c.categoria) || [],
    datasets: [{ data: stats?.porCategoria?.map(c => c.valor) || [], backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: "#fff" }],
  };

  const barChartData = {
    labels: stats?.porEmpreendimento?.map(e => e.empreendimento) || [],
    datasets: [
      { label: "Receitas", data: stats?.porEmpreendimento?.map(e => e.receitas) || [], backgroundColor: "rgba(34,197,94,0.8)" },
      { label: "Despesas", data: stats?.porEmpreendimento?.map(e => e.despesas) || [], backgroundColor: "rgba(239,68,68,0.8)" },
      { label: "Lucro", data: stats?.porEmpreendimento?.map(e => e.lucro) || [], backgroundColor: "rgba(59,130,246,0.8)" },
    ],
  };

  const expenseEvolutionChartData = {
    labels: expenseEvolution?.evolucao?.map(e => e.mes) || [],
    datasets: (() => {
      if (!expenseEvolution) return [];
      const cats = selectedExpenseCategory === "todas" ? expenseEvolution.categorias : expenseEvolution.categorias.filter(c => c.id.toString() === selectedExpenseCategory);
      return cats.map((cat, i) => ({ label: cat.nome, data: expenseEvolution.evolucao.map(e => e.valores[cat.id] || 0), backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }));
    })(),
  };

  const handleOpenReciboFromLancamento = (lancamento: FinanceiroLancamento) => {
    const empNome = empreendimentos.find(e => e.id === lancamento.empreendimentoId)?.nome ?? "";
    setReciboForm({ lancamentoId: lancamento.id, empreendimentoId: lancamento.empreendimentoId, numero: "", descricao: lancamento.descricao ?? "", valor: String(lancamento.valor), pagador: empNome, recebedor: "EcoBrasil Consultoria Ambiental", dataPagamento: lancamento.dataPagamento ?? lancamento.data ?? "", metodoPagamento: "pix", categoria: lancamento.tipo === "receita" ? "Receita" : "Despesa", observacoes: "", unidade: lancamento.unidade ?? "" });
    setReciboDialogOpen(true);
  };

  const handleSelectReembolso = (r: any) => { setSelectedReembolso(r); setIsReembolsoDetailOpen(true); };

  if (isLoading) return (
    <div className="container mx-auto py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
      <p>Carregando módulo financeiro...</p>
    </div>
  );

  const EmptyChart = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center"><Icon className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>{label}</p></div>
    </div>
  );

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
            <FinancialReportPDF stats={stats} empreendimentos={empreendimentos} lineChartRef={lineChartRef} pieChartRef={pieChartRef} barChartRef={barChartRef} expenseEvolutionChartRef={expenseEvolutionChartRef} />
            <Button variant="outline" onClick={() => window.open("/api/financeiro/export-excel", "_blank")} data-testid="button-exportar-excel">
              <Download className="h-4 w-4 mr-2" />Exportar Excel
            </Button>
            <RefreshButton />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-novo-lancamento">
                <Plus className="h-4 w-4 mr-2" />Novo Lançamento
              </Button>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo Lançamento Financeiro</DialogTitle></DialogHeader>
                <NovoLancamentoForm onSuccess={() => setDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Empreendimento Filter */}
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
          <Building className="h-5 w-5 text-muted-foreground" />
          <Label className="text-sm font-medium whitespace-nowrap">Filtrar por Empreendimento:</Label>
          <Select value={selectedEmpreendimentoId} onValueChange={setSelectedEmpreendimentoId}>
            <SelectTrigger className="w-[300px]" data-testid="select-empreendimento-filter">
              <SelectValue placeholder="Todos os empreendimentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Empreendimentos</SelectItem>
              {empreendimentos.map(emp => <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedEmpreendimentoId !== "todos" && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmpreendimentoId("todos")} data-testid="button-limpar-filtro">Limpar Filtro</Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Receitas", value: fmtBRL(totalReceitas), icon: TrendingUp, color: "text-green-600", sub: "Valores recebidos e confirmados", testId: "text-total-receitas" },
          { label: "Total Despesas", value: fmtBRL(totalDespesas), icon: TrendingDown, color: "text-red-600", sub: "Valores pagos e confirmados", testId: "text-total-despesas" },
          { label: "Saldo Atual", value: fmtBRL(saldoAtual), icon: Wallet, color: saldoAtual >= 0 ? "text-green-600" : "text-red-600", sub: "Receitas menos despesas", testId: "text-saldo-atual" },
          { label: "Pendente Aprovação", value: fmtBRL(totalPendente), icon: Clock, color: "text-yellow-600", sub: "Aguardando análise e aprovação", testId: "text-total-pendente" },
        ].map(({ label, value, icon: Icon, color, sub, testId }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${color}`} data-testid={testId}>{value}</div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="resumo" data-testid="tab-resumo"><BarChart3 className="h-4 w-4 mr-2" />Resumo</TabsTrigger>
          <TabsTrigger value="evolucao" data-testid="tab-evolucao"><LineChart className="h-4 w-4 mr-2" />Evolução</TabsTrigger>
          <TabsTrigger value="projetos" data-testid="tab-projetos"><Building className="h-4 w-4 mr-2" />Por Projeto</TabsTrigger>
          <TabsTrigger value="lancamentos" data-testid="tab-lancamentos"><FileText className="h-4 w-4 mr-2" />Lançamentos</TabsTrigger>
          <TabsTrigger value="reembolsos" data-testid="tab-reembolsos">
            <Receipt className="h-4 w-4 mr-2" />
            Reembolsos ({reembolsosFinanceiro.length + reembolsosDiretor.length + reembolsosAprovados.length})
          </TabsTrigger>
          <TabsTrigger value="recibos" data-testid="tab-recibos"><Wallet className="h-4 w-4 mr-2" />Recibos</TabsTrigger>
        </TabsList>

        {/* Resumo */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Evolução Mensal</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.evolucaoMensal?.length ? <Line ref={lineChartRef as any} data={lineChartData} options={chartOptions} /> : <EmptyChart icon={LineChart} label="Sem dados para exibir" />}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" />Gastos por Categoria</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {stats?.porCategoria?.length ? <Pie ref={pieChartRef as any} data={pieChartData} options={chartOptions} /> : <EmptyChart icon={PieChart} label="Sem dados para exibir" />}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolução */}
        <TabsContent value="evolucao" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Evolução Financeira (Últimos 12 meses)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {stats?.evolucaoMensal?.length ? <Line data={lineChartData} options={chartOptions} /> : <EmptyChart icon={LineChart} label="Adicione lançamentos para visualizar a evolução" />}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Evolução de Despesas por Tipo</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium whitespace-nowrap">Filtrar por tipo:</Label>
                  <Select value={selectedExpenseCategory} onValueChange={setSelectedExpenseCategory}>
                    <SelectTrigger className="w-[200px]" data-testid="select-expense-category-filter">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {expenseEvolution?.categorias?.map(cat => <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {expenseEvolutionChartData.datasets.length > 0 ? (
                  <Bar ref={expenseEvolutionChartRef as any} data={expenseEvolutionChartData} options={{ ...chartOptions, scales: { x: { stacked: false }, y: { stacked: false, ticks: { callback: (v) => `R$ ${Number(v).toLocaleString("pt-BR")}` } } } }} />
                ) : <EmptyChart icon={BarChart3} label="Adicione despesas para visualizar a evolução por tipo" />}
              </div>
            </CardContent>
          </Card>
          {stats?.evolucaoMensal && stats.evolucaoMensal.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Detalhamento Mensal</CardTitle></CardHeader>
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
                          <td className="p-4 text-right text-green-600">{fmtBRL(mes.receitas)}</td>
                          <td className="p-4 text-right text-red-600">{fmtBRL(mes.despesas)}</td>
                          <td className={`p-4 text-right font-bold ${mes.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtBRL(mes.lucro)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Por Projeto */}
        <TabsContent value="projetos" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Receitas e Despesas por Projeto</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                {stats?.porEmpreendimento?.length ? <Bar ref={barChartRef as any} data={barChartData} options={chartOptions} /> : <EmptyChart icon={Building} label="Adicione lançamentos para visualizar por projeto" />}
              </div>
            </CardContent>
          </Card>
          {stats?.porEmpreendimento && stats.porEmpreendimento.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.porEmpreendimento.map((emp, idx) => (
                <Card key={idx} className="border-l-4" style={{ borderLeftColor: emp.lucro >= 0 ? "#22c55e" : "#ef4444" }}>
                  <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Building className="h-4 w-4" />{emp.empreendimento}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Receitas:</span><span className="text-green-600 font-medium">{fmtBRL(emp.receitas)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Despesas:</span><span className="text-red-600 font-medium">{fmtBRL(emp.despesas)}</span></div>
                    <div className="flex justify-between border-t pt-2"><span className="font-medium">Lucro:</span><span className={`font-bold ${emp.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtBRL(emp.lucro)}</span></div>
                    <div className="text-xs text-muted-foreground">Margem: {emp.receitas > 0 ? ((emp.lucro / emp.receitas) * 100).toFixed(1) : 0}%</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Lançamentos */}
        <TabsContent value="lancamentos" className="space-y-6">
          <LancamentosTabContent
            lancamentos={lancamentos}
            filters={filters as LancamentosFilters}
            setFilters={setFilters as (f: LancamentosFilters) => void}
            recibosLancamentoIds={recibosLancamentoIds}
            empMap={empMap}
            onUpdateStatus={(id, status) => updateStatusMutation.mutate({ id, status })}
            onEmitirRecibo={handleOpenReciboFromLancamento}
            onEdit={l => { setEditingLancamento(l); setEditDialogOpen(true); }}
            onDelete={id => { setDeletingLancamentoId(id); setDeleteDialogOpen(true); }}
          />
        </TabsContent>

        {/* Reembolsos */}
        <TabsContent value="reembolsos" className="space-y-6">
          <ReembolsosTabContent
            reembolsosFinanceiro={reembolsosFinanceiro}
            reembolsosDiretor={reembolsosDiretor}
            reembolsosAprovados={reembolsosAprovados}
            loadingReembolsosFinanceiro={loadingReembolsosFinanceiro}
            loadingReembolsosDiretor={loadingReembolsosDiretor}
            loadingReembolsosAprovados={loadingReembolsosAprovados}
            onSelectReembolso={handleSelectReembolso}
          />
        </TabsContent>

        {/* Recibos */}
        <TabsContent value="recibos" className="space-y-6">
          <RecibosSection />
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <ReembolsoApprovalDialog
        open={isReembolsoDetailOpen}
        onOpenChange={setIsReembolsoDetailOpen}
        selectedReembolso={selectedReembolso}
        reembolsoObservacao={reembolsoObservacao}
        setReembolsoObservacao={setReembolsoObservacao}
        pagamentoInfo={pagamentoInfo}
        setPagamentoInfo={setPagamentoInfo}
        aprovarFinanceiroMutation={aprovarFinanceiroMutation}
        rejeitarFinanceiroMutation={rejeitarFinanceiroMutation}
        aprovarDiretorMutation={aprovarDiretorMutation}
        rejeitarDiretorMutation={rejeitarDiretorMutation}
        pagarMutation={pagarReembolsoMutation}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingLancamentoId && deleteMutation.mutate(deletingLancamentoId)} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete">
              {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Lançamento</DialogTitle></DialogHeader>
          {editingLancamento && (
            <EditLancamentoForm
              lancamento={editingLancamento}
              onSuccess={() => { setEditDialogOpen(false); setEditingLancamento(null); }}
              onCancel={() => { setEditDialogOpen(false); setEditingLancamento(null); }}
              updateMutation={updateLancamentoMutation}
            />
          )}
        </DialogContent>
      </Dialog>

      <ReciboDialog
        open={reciboDialogOpen}
        onOpenChange={setReciboDialogOpen}
        reciboForm={reciboForm}
        setReciboForm={setReciboForm}
        createReciboMutation={createReciboMutation}
      />

    </div>
    </SensitivePageWrapper>
  );
}
