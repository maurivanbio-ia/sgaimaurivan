import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  AlertCircle,
  Building,
  Loader2,
  ArrowUpIcon,
  ArrowDownIcon
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FinanceiroLancamento, InsertFinanceiroLancamento, Empreendimento, CategoriaFinanceira } from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { financeiroLancamentos } from "@shared/schema";
import * as z from "zod";

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

// Novo Lançamento Form Component
interface NovoLancamentoFormProps {
  onSuccess: () => void;
}

function NovoLancamentoForm({ onSuccess }: NovoLancamentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch empreendimentos for dropdown
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  // Fetch categorias for dropdown  
  // Auto-initialize categories if empty and fetch categories
  const { data: categorias = [], refetch: refetchCategorias } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Initialize categories if empty
  const initCategoriesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/categorias-financeiras/init");
    },
    onSuccess: () => {
      refetchCategorias();
    },
  });

  // Auto-initialize categories on mount if empty
  React.useEffect(() => {
    if (categorias.length === 0) {
      initCategoriesMutation.mutate();
    }
  }, [categorias.length]);

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: "despesa",
      valor: 0,
      descricao: "",
      observacoes: "",
    },
  });

  const createLancamentoMutation = useMutation({
    mutationFn: async (data: NovoLancamentoFormData) => {
      return apiRequest("POST", "/api/financeiro/lancamentos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financeiro/lancamentos"] });
      toast({
        title: "Lançamento criado",
        description: "Novo lançamento financeiro foi criado com sucesso!",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o lançamento. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao criar lançamento:", error);
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
                      <SelectItem value="" disabled>
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

export default function FinanceiroPage() {
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    empreendimento: "",
    search: ""
  });

  // Fetch financial data
  const { data: lancamentos = [], isLoading } = useQuery<FinanceiroLancamento[]>({
    queryKey: ["/api/financeiro/lancamentos", filters],
  });

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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Carregando módulo financeiro...</div>
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
          <Dialog>
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
              <NovoLancamentoForm onSuccess={() => {}} />
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
            <div className="text-2xl font-bold text-green-600">
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
            <div className="text-2xl font-bold text-red-600">
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
            <DollarSign className={`h-4 w-4 ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoAtual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            <div className="text-2xl font-bold text-yellow-600">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Aguardando análise e aprovação
            </p>
          </CardContent>
        </Card>
      </div>

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
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((lancamento) => {
                    const tipoConfig = TIPO_CONFIG[lancamento.tipo as keyof typeof TIPO_CONFIG];
                    const statusConfig = STATUS_CONFIG[lancamento.status as keyof typeof STATUS_CONFIG];
                    
                    return (
                      <tr key={lancamento.id} className="border-b hover:bg-muted/50">
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
                            <span className="text-sm">Empreendimento #{lancamento.empreendimentoId}</span>
                          </div>
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
    </div>
  );
}