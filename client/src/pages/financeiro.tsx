import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/DateInput";
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
  Pencil,
  Trash2,
  RefreshCw,
  Download,
  Link2,
  FileCheck,
  ExternalLink
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RefreshButton } from "@/components/RefreshButton";
import { FinancialReportPDF } from "@/components/FinancialReportPDF";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { NovoLancamentoForm } from '@/components/financeiro/NovoLancamentoForm';
import { EditLancamentoForm } from '@/components/financeiro/EditLancamentoForm';
import { parseServerDate, formatServerDate } from '@/components/financeiro/types';

import { useToast } from "@/hooks/use-toast";
import type { FinanceiroLancamento, Empreendimento, CategoriaFinanceira } from "@shared/schema";
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

// Unidades configuration
const UNIDADES_CONFIG = {
  salvador: { label: "Salvador (BA)", sigla: "BA" },
  goiania: { label: "Goiânia (GO)", sigla: "GO" },
  lem: { label: "Luís Eduardo Magalhães (LEM)", sigla: "LEM" }
};

// Create form schema for Novo Lançamento
// NovoLancamentoForm → extraído para client/src/components/financeiro/NovoLancamentoForm.tsx
// EditLancamentoForm → extraído para client/src/components/financeiro/EditLancamentoForm.tsx

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

// EditLancamentoFormProps + EditLancamentoForm → extraído para EditLancamentoForm.tsx


interface ExpenseEvolutionData {
  categorias: Array<{ id: number; nome: string; tipo: string }>;
  evolucao: Array<{ mes: string; valores: { [categoriaId: number]: number } }>;
}

// ─── RECIBOS SECTION ─────────────────────────────────────────────────────────
function RecibosSection() {
  const queryClientHook = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ descricao: "", valor: "", pagador: "", recebedor: "", dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", numero: "" });

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/recibos"],
    queryFn: () => fetch("/api/recibos", { credentials: "include" }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? fetch(`/api/recibos/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json())
              : fetch("/api/recibos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { queryClientHook.invalidateQueries({ queryKey: ["/api/recibos"] }); setOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/recibos/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClientHook.invalidateQueries({ queryKey: ["/api/recibos"] }),
  });

  const totalValor = items.reduce((acc: number, r: any) => acc + parseFloat(r.valor || "0"), 0);

  function openNew() { setEditing(null); setForm({ descricao: "", valor: "", pagador: "", recebedor: "", dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", numero: "" }); setOpen(true); }
  function openEdit(item: any) { setEditing(item); setForm({ descricao: item.descricao, valor: item.valor, pagador: item.pagador || "", recebedor: item.recebedor || "", dataPagamento: item.dataPagamento || "", metodoPagamento: item.metodoPagamento || "pix", categoria: item.categoria || "", observacoes: item.observacoes || "", numero: item.numero || "" }); setOpen(true); }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Recibos de Pagamento</h3>
              <p className="text-sm text-muted-foreground">Total: <span className="font-medium text-green-600">R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> ({items.length} recibos)</p>
            </div>
            <Button onClick={openNew} size="sm" className="gap-2"><Plus className="h-4 w-4" />Novo Recibo</Button>
          </div>

          {isLoading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Wallet className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nenhum recibo registrado</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs"><th className="text-left py-2 px-3">Nº</th><th className="text-left py-2 px-3">Descrição</th><th className="text-left py-2 px-3">Lançamento</th><th className="text-left py-2 px-3">Empreendimento</th><th className="text-left py-2 px-3">Pagador</th><th className="text-left py-2 px-3">Data</th><th className="text-left py-2 px-3">Método</th><th className="text-right py-2 px-3">Valor</th><th className="py-2 px-3"></th></tr></thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 text-muted-foreground">{item.numero || "-"}</td>
                      <td className="py-2 px-3 font-medium max-w-[160px] truncate">{item.descricao}</td>
                      <td className="py-2 px-3">
                        {item.lancamentoId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
                            <Link2 className="h-3 w-3" />
                            #{item.lancamentoId}
                            {item.lancamentoDescricao && <span className="hidden sm:inline text-muted-foreground ml-1 truncate max-w-[80px]">{item.lancamentoDescricao}</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Avulso</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{item.empreendimentoNome || "-"}</td>
                      <td className="py-2 px-3">{item.pagador || "-"}</td>
                      <td className="py-2 px-3">{item.dataPagamento || "-"}</td>
                      <td className="py-2 px-3"><span className="capitalize">{item.metodoPagamento}</span></td>
                      <td className="py-2 px-3 text-right font-medium text-green-700">R$ {parseFloat(item.valor || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover recibo?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Recibo" : "Novo Recibo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Número</Label><Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="REC-001" /></div>
              <div className="space-y-1">
                <Label>Método</Label>
                <Select value={form.metodoPagamento} onValueChange={v => setForm(f => ({ ...f, metodoPagamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pix","transferencia","boleto","dinheiro","cheque"].map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Valor (R$) *</Label><Input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" /></div>
              <div className="space-y-1"><Label>Data Pagamento</Label><Input type="date" value={form.dataPagamento} onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Pagador</Label><Input value={form.pagador} onChange={e => setForm(f => ({ ...f, pagador: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Recebedor</Label><Input value={form.recebedor} onChange={e => setForm(f => ({ ...f, recebedor: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Categoria</Label><Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Serviços, Material, Taxa" /></div>
            <div className="space-y-1"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.descricao || !form.valor || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinanceiroPage() {
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    empreendimento: "",
    search: "",
    unidade: "todas"
  });
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
  const [reciboDialogOpen, setReciboDialogOpen] = useState(false);
  const [reciboForm, setReciboForm] = useState<any>({ lancamentoId: null, empreendimentoId: null, numero: "", descricao: "", valor: "", pagador: "", recebedor: "", dataPagamento: "", metodoPagamento: "pix", categoria: "", observacoes: "", unidade: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Chart refs for PDF export
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const expenseEvolutionChartRef = useRef<HTMLCanvasElement>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/financeiro/lancamentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith?.("/api/financeiro") ?? false;
        }
      });
      toast({
        title: "Lançamento excluído",
        description: "O lançamento foi removido com sucesso!",
      });
      setDeleteDialogOpen(false);
      setDeletingLancamentoId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o lançamento. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao excluir lançamento:", error);
    },
  });

  const updateLancamentoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FinanceiroLancamento> }) => {
      return apiRequest("PUT", `/api/financeiro/lancamentos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith?.("/api/financeiro") ?? false;
        }
      });
      toast({
        title: "Lançamento atualizado",
        description: "O lançamento foi atualizado com sucesso!",
      });
      setEditDialogOpen(false);
      setEditingLancamento(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o lançamento. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao atualizar lançamento:", error);
    },
  });

  // Build query string from filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.tipo && filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status && filters.status !== "todos") params.append("status", filters.status);
    // Usar o filtro principal de empreendimento
    if (selectedEmpreendimentoId && selectedEmpreendimentoId !== "todos") {
      params.append("empreendimentoId", selectedEmpreendimentoId);
    }
    if (filters.search) params.append("search", filters.search);
    if (filters.unidade && filters.unidade !== "todas") params.append("unidade", filters.unidade);
    const queryStr = params.toString();
    return queryStr ? `?${queryStr}` : "";
  };

  // Fetch financial data with proper query string
  const { data: lancamentos = [], isLoading } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos", filters.tipo, filters.status, selectedEmpreendimentoId, filters.search, filters.unidade],
    queryFn: async () => {
      const res = await fetch(`/api/financeiro/lancamentos${buildQueryString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch lancamentos");
      return res.json();
    },
  });

  // Fetch financial stats for charts (filtered by empreendimento)
  const { data: stats } = useQuery<FinancialStats>({
    queryKey: ["/api/financeiro/stats", selectedEmpreendimentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId && selectedEmpreendimentoId !== "todos") {
        params.append("empreendimentoId", selectedEmpreendimentoId);
      }
      const queryStr = params.toString();
      const res = await fetch(`/api/financeiro/stats${queryStr ? `?${queryStr}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Fetch expense evolution by category (filtered by empreendimento)
  const { data: expenseEvolution } = useQuery<ExpenseEvolutionData>({
    queryKey: ["/api/financeiro/expense-evolution", selectedExpenseCategory, selectedEmpreendimentoId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmpreendimentoId && selectedEmpreendimentoId !== "todos") {
        params.append("empreendimentoId", selectedEmpreendimentoId);
      }
      if (selectedExpenseCategory && selectedExpenseCategory !== "todas") {
        params.append("categoriaId", selectedExpenseCategory);
      }
      const queryStr = params.toString();
      const res = await fetch(`/api/financeiro/expense-evolution${queryStr ? `?${queryStr}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expense evolution");
      return res.json();
    },
  });

  // Fetch empreendimentos for lookup
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: recibosData = [] } = useQuery<any[]>({
    queryKey: ["/api/recibos"],
  });

  const recibosLancamentoIds = new Set<number>(
    recibosData.filter(r => r.lancamentoId).map(r => r.lancamentoId)
  );

  const createReciboMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/recibos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recibos"] });
      toast({ title: "Recibo emitido", description: "Recibo gerado com sucesso!" });
      setReciboDialogOpen(false);
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao emitir recibo", variant: "destructive" });
    },
  });

  const handleOpenReciboFromLancamento = (lancamento: FinanceiroLancamento) => {
    const empNome = empreendimentos.find(e => e.id === lancamento.empreendimentoId)?.nome ?? "";
    setReciboForm({
      lancamentoId: lancamento.id,
      empreendimentoId: lancamento.empreendimentoId,
      numero: "",
      descricao: lancamento.descricao ?? "",
      valor: String(lancamento.valor),
      pagador: empNome,
      recebedor: "EcoBrasil Consultoria Ambiental",
      dataPagamento: lancamento.dataPagamento ?? lancamento.data ?? "",
      metodoPagamento: "pix",
      categoria: lancamento.tipo === "receita" ? "Receita" : "Despesa",
      observacoes: "",
      unidade: lancamento.unidade ?? "",
    });
    setReciboDialogOpen(true);
  };

  // Fetch pending reembolsos for finance/director approval
  const { data: reembolsosFinanceiro = [], isLoading: loadingReembolsosFinanceiro } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "financeiroPendente"],
    queryFn: async () => {
      const res = await fetch("/api/reembolsos?financeiroPendente=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reembolsos");
      return res.json();
    },
  });

  const { data: reembolsosDiretor = [], isLoading: loadingReembolsosDiretor } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "diretorPendente"],
    queryFn: async () => {
      const res = await fetch("/api/reembolsos?diretorPendente=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reembolsos");
      return res.json();
    },
  });

  const { data: reembolsosAprovados = [], isLoading: loadingReembolsosAprovados } = useQuery<any[]>({
    queryKey: ["/api/reembolsos", "aprovado_diretor"],
    queryFn: async () => {
      const res = await fetch("/api/reembolsos?status=aprovado_diretor", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reembolsos");
      return res.json();
    },
  });

  // Reembolso approval mutations
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
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao aprovar reembolso", variant: "destructive" });
    },
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
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao rejeitar reembolso", variant: "destructive" });
    },
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
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao aprovar reembolso", variant: "destructive" });
    },
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
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao rejeitar reembolso", variant: "destructive" });
    },
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
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao registrar pagamento", variant: "destructive" });
    },
  });

  // Create empreendimento lookup map
  const empMap = new Map<number | null, string>([
    [null, 'Escritório'],
    ...empreendimentos.map(e => [e.id, e.nome] as [number, string])
  ]);

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

  // Expense evolution by category bar chart data
  const expenseEvolutionChartData = {
    labels: expenseEvolution?.evolucao?.map(e => e.mes) || [],
    datasets: (() => {
      if (!expenseEvolution) return [];
      
      const categoriasToShow = selectedExpenseCategory === "todas"
        ? expenseEvolution.categorias
        : expenseEvolution.categorias.filter(c => c.id.toString() === selectedExpenseCategory);
      
      return categoriasToShow.map((cat, index) => ({
        label: cat.nome,
        data: expenseEvolution.evolucao.map(e => e.valores[cat.id] || 0),
        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
      }));
    })(),
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
    <SensitivePageWrapper moduleName="Módulo Financeiro">
    <div className="container mx-auto py-8 space-y-6" data-testid="page-financeiro">
      {/* Header */}
      <div className="flex flex-col gap-4">
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
          <FinancialReportPDF 
            stats={stats} 
            empreendimentos={empreendimentos}
            lineChartRef={lineChartRef}
            pieChartRef={pieChartRef}
            barChartRef={barChartRef}
            expenseEvolutionChartRef={expenseEvolutionChartRef}
          />
          <Button 
            variant="outline" 
            onClick={() => window.open('/api/financeiro/export-excel', '_blank')}
            data-testid="button-exportar-excel"
          >
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
        <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
          <Building className="h-5 w-5 text-muted-foreground" />
          <Label className="text-sm font-medium whitespace-nowrap">Filtrar por Empreendimento:</Label>
          <Select value={selectedEmpreendimentoId} onValueChange={setSelectedEmpreendimentoId}>
            <SelectTrigger className="w-[300px]" data-testid="select-empreendimento-filter">
              <SelectValue placeholder="Todos os empreendimentos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Empreendimentos</SelectItem>
              {empreendimentos.map((emp) => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedEmpreendimentoId !== "todos" && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedEmpreendimentoId("todos")}
              data-testid="button-limpar-filtro"
            >
              Limpar Filtro
            </Button>
          )}
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
        <TabsList className="grid w-full grid-cols-6">
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
          <TabsTrigger value="recibos" data-testid="tab-recibos">
            <Wallet className="h-4 w-4 mr-2" />
            Recibos
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

          {/* Expense Evolution by Category Bar Chart */}
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
                    <SelectTrigger className="w-[200px]" data-testid="select-expense-category-filter">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {expenseEvolution?.categorias?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
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
                {expenseEvolutionChartData.datasets.length > 0 ? (
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
                            callback: function(value) {
                              return 'R$ ' + Number(value).toLocaleString('pt-BR');
                            }
                          }
                        }
                      }
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

                <Select value={filters.unidade} onValueChange={(value) => setFilters({...filters, unidade: value})}>
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
                  placeholder="Empreendimento"
                  value={filters.empreendimento}
                  onChange={(e) => setFilters({...filters, empreendimento: e.target.value})}
                  data-testid="filter-empreendimento"
                />

                <Button 
                  onClick={() => setFilters({ tipo: "todos", status: "todos", empreendimento: "", search: "", unidade: "todas" })}
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
                      {lancamentos.map((lancamento) => {
                        const tipoConfig = TIPO_CONFIG[lancamento.tipo as keyof typeof TIPO_CONFIG];
                        const statusConfig = STATUS_CONFIG[lancamento.status as keyof typeof STATUS_CONFIG];
                        
                        return (
                          <tr key={lancamento.id} className="border-b hover:bg-muted/50" data-testid={`row-lancamento-${lancamento.id}`}>
                            <td className="p-4">
                              {formatServerDate(lancamento.data)}
                            </td>
                            <td className="p-4 text-sm">
                              {lancamento.dataVencimento ? (
                                <span className={(parseServerDate(lancamento.dataVencimento) || new Date()) < new Date() && lancamento.status !== 'pago' ? 'text-red-600 font-medium' : ''}>
                                  {formatServerDate(lancamento.dataVencimento)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-4 text-sm">
                              {lancamento.dataPagamento ? (
                                formatServerDate(lancamento.dataPagamento)
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
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
                              <div className="flex flex-col gap-1">
                                <Badge 
                                  variant="outline" 
                                  className={`${statusConfig?.color} text-white border-transparent w-fit`}
                                >
                                  {statusConfig?.label}
                                </Badge>
                                {recibosLancamentoIds.has(lancamento.id) && (
                                  <Badge variant="outline" className="bg-violet-600 text-white border-transparent w-fit text-xs">
                                    <FileCheck className="h-3 w-3 mr-1" />
                                    Recibo
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="secondary" className="text-xs">
                                {UNIDADES_CONFIG[lancamento.unidade as keyof typeof UNIDADES_CONFIG]?.sigla || lancamento.unidade || 'BA'}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className={`text-sm ${lancamento.empreendimentoId === null ? 'font-medium text-blue-600' : ''}`}>
                                  {empMap.get(lancamento.empreendimentoId) || (lancamento.empreendimentoId ? `#${lancamento.empreendimentoId}` : 'Escritório')}
                                </span>
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
                                    onClick={() => handleOpenReciboFromLancamento(lancamento)}
                                    disabled={recibosLancamentoIds.has(lancamento.id)}
                                  >
                                    <FileCheck className="h-4 w-4 mr-2 text-violet-500" />
                                    {recibosLancamentoIds.has(lancamento.id) ? "Recibo Emitido ✓" : "Emitir Recibo"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: lancamento.id, status: "cancelado" })}
                                    disabled={lancamento.status === "cancelado"}
                                    data-testid={`action-cancel-${lancamento.id}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                    Cancelar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingLancamento(lancamento);
                                      setEditDialogOpen(true);
                                    }}
                                    data-testid={`action-edit-${lancamento.id}`}
                                  >
                                    <Pencil className="h-4 w-4 mr-2 text-gray-500" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setDeletingLancamentoId(lancamento.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-red-600"
                                    data-testid={`action-delete-${lancamento.id}`}
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

        {/* Reembolsos Tab - Approval and Payment Management */}
        <TabsContent value="reembolsos" className="space-y-6">
          {/* Pending Finance Approval */}
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
                          <td className="p-3">{r.solicitanteNome || 'N/A'}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">{r.categoria}</Badge>
                          </td>
                          <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
                          <td className="p-3 text-right font-medium">
                            R$ {Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedReembolso(r);
                                setIsReembolsoDetailOpen(true);
                              }}
                              data-testid={`button-view-reembolso-financeiro-${r.id}`}
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

          {/* Pending Director Approval */}
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
                          <td className="p-3">{r.solicitanteNome || 'N/A'}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">{r.categoria}</Badge>
                          </td>
                          <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
                          <td className="p-3 text-right font-medium">
                            R$ {Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedReembolso(r);
                                setIsReembolsoDetailOpen(true);
                              }}
                              data-testid={`button-view-reembolso-diretor-${r.id}`}
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

          {/* Approved, Pending Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Aprovados - Aguardando Pagamento ({reembolsosAprovados.length})
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
                          <td className="p-3">{r.solicitanteNome || 'N/A'}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">{r.categoria}</Badge>
                          </td>
                          <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
                          <td className="p-3 text-right font-medium">
                            R$ {Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setSelectedReembolso(r);
                                setIsReembolsoDetailOpen(true);
                              }}
                              data-testid={`button-pay-reembolso-${r.id}`}
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

        {/* Recibos Tab */}
        <TabsContent value="recibos" className="space-y-6">
          <RecibosSection />
        </TabsContent>
      </Tabs>

      {/* Reembolso Detail/Approval Dialog */}
      <Dialog open={isReembolsoDetailOpen} onOpenChange={setIsReembolsoDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedReembolso?.status === 'pendente_financeiro' && 'Análise Financeira'}
              {selectedReembolso?.status === 'pendente_diretor' && 'Análise do Diretor'}
              {selectedReembolso?.status === 'aprovado_diretor' && 'Registrar Pagamento'}
            </DialogTitle>
          </DialogHeader>
          {selectedReembolso && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Solicitante</Label>
                  <p className="font-medium">{selectedReembolso.solicitanteNome || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Categoria</Label>
                  <Badge variant="outline" className="capitalize mt-1">{selectedReembolso.categoria}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor</Label>
                  <p className="font-bold text-lg">R$ {Number(selectedReembolso.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data do Gasto</Label>
                  <p>{selectedReembolso.dataGasto ? format(new Date(selectedReembolso.dataGasto), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</p>
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

              {/* Finance approval form */}
              {selectedReembolso.status === 'pendente_financeiro' && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      value={reembolsoObservacao}
                      onChange={(e) => setReembolsoObservacao(e.target.value)}
                      placeholder="Adicione observações para o diretor..."
                      data-testid="input-reembolso-observacao-financeiro"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => rejeitarReembolsoFinanceiroMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                      disabled={rejeitarReembolsoFinanceiroMutation.isPending}
                      data-testid="button-rejeitar-financeiro"
                    >
                      {rejeitarReembolsoFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Rejeitar
                    </Button>
                    <Button
                      onClick={() => aprovarReembolsoFinanceiroMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                      disabled={aprovarReembolsoFinanceiroMutation.isPending}
                      data-testid="button-aprovar-financeiro"
                    >
                      {aprovarReembolsoFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Aprovar e Enviar para Diretor
                    </Button>
                  </div>
                </div>
              )}

              {/* Director approval form */}
              {selectedReembolso.status === 'pendente_diretor' && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Observações (opcional)</Label>
                    <Textarea
                      value={reembolsoObservacao}
                      onChange={(e) => setReembolsoObservacao(e.target.value)}
                      placeholder="Adicione observações finais..."
                      data-testid="input-reembolso-observacao-diretor"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => rejeitarReembolsoDiretorMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                      disabled={rejeitarReembolsoDiretorMutation.isPending}
                      data-testid="button-rejeitar-diretor"
                    >
                      {rejeitarReembolsoDiretorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Rejeitar
                    </Button>
                    <Button
                      onClick={() => aprovarReembolsoDiretorMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                      disabled={aprovarReembolsoDiretorMutation.isPending}
                      data-testid="button-aprovar-diretor"
                    >
                      {aprovarReembolsoDiretorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Aprovar para Pagamento
                    </Button>
                  </div>
                </div>
              )}

              {/* Payment form */}
              {selectedReembolso.status === 'aprovado_diretor' && (
                <div className="space-y-4 border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={pagamentoInfo.formaPagamento} onValueChange={(v) => setPagamentoInfo(p => ({ ...p, formaPagamento: v }))}>
                        <SelectTrigger data-testid="select-forma-pagamento">
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
                      <Input
                        type="date"
                        value={pagamentoInfo.dataPagamento}
                        onChange={(e) => setPagamentoInfo(p => ({ ...p, dataPagamento: e.target.value }))}
                        data-testid="input-data-pagamento"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => pagarReembolsoMutation.mutate({ id: selectedReembolso.id, ...pagamentoInfo })}
                      disabled={pagarReembolsoMutation.isPending || !pagamentoInfo.formaPagamento || !pagamentoInfo.dataPagamento}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-confirmar-pagamento"
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingLancamentoId && deleteMutation.mutate(deletingLancamentoId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
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
              onSuccess={() => {
                setEditDialogOpen(false);
                setEditingLancamento(null);
              }}
              onCancel={() => {
                setEditDialogOpen(false);
                setEditingLancamento(null);
              }}
              updateMutation={updateLancamentoMutation}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Emitir Recibo Dialog */}
      <Dialog open={reciboDialogOpen} onOpenChange={setReciboDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-violet-600" />
              Emitir Recibo
            </DialogTitle>
            <DialogDescription>
              Gerar recibo vinculado ao lançamento financeiro selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {reciboForm.lancamentoId && (
              <div className="bg-violet-50 border border-violet-200 rounded-md p-3 flex items-center gap-2 text-sm text-violet-800">
                <Link2 className="h-4 w-4 shrink-0" />
                <span>Vinculado ao lançamento #{reciboForm.lancamentoId}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Número do Recibo</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Ex: REC-001" value={reciboForm.numero} onChange={e => setReciboForm((f: any) => ({ ...f, numero: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Valor (R$)</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="number" step="0.01" value={reciboForm.valor} onChange={e => setReciboForm((f: any) => ({ ...f, valor: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Descrição</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" value={reciboForm.descricao} onChange={e => setReciboForm((f: any) => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Pagador</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={reciboForm.pagador} onChange={e => setReciboForm((f: any) => ({ ...f, pagador: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Recebedor</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" value={reciboForm.recebedor} onChange={e => setReciboForm((f: any) => ({ ...f, recebedor: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Data de Pagamento</label>
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="date" value={reciboForm.dataPagamento} onChange={e => setReciboForm((f: any) => ({ ...f, dataPagamento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Método de Pagamento</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={reciboForm.metodoPagamento} onChange={e => setReciboForm((f: any) => ({ ...f, metodoPagamento: e.target.value }))}>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência Bancária</option>
                  <option value="boleto">Boleto</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao">Cartão</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm" value={reciboForm.categoria} onChange={e => setReciboForm((f: any) => ({ ...f, categoria: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Observações</label>
              <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2} value={reciboForm.observacoes} onChange={e => setReciboForm((f: any) => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setReciboDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => createReciboMutation.mutate({
                  lancamentoId: reciboForm.lancamentoId,
                  empreendimentoId: reciboForm.empreendimentoId,
                  numero: reciboForm.numero,
                  descricao: reciboForm.descricao,
                  valor: reciboForm.valor,
                  pagador: reciboForm.pagador,
                  recebedor: reciboForm.recebedor,
                  dataPagamento: reciboForm.dataPagamento,
                  metodoPagamento: reciboForm.metodoPagamento,
                  categoria: reciboForm.categoria,
                  observacoes: reciboForm.observacoes,
                  unidade: reciboForm.unidade,
                })}
                disabled={createReciboMutation.isPending || !reciboForm.descricao || !reciboForm.valor}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {createReciboMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Emitindo...</> : <><FileCheck className="mr-2 h-4 w-4" />Emitir Recibo</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </SensitivePageWrapper>
  );
}
