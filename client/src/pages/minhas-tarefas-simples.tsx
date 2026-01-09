import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Play,
  Check,
  Loader2,
  Timer,
  Plus,
  DollarSign,
  Eye,
  RefreshCw
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Tarefa {
  id: number;
  titulo: string;
  descricao?: string;
  responsavelId: number;
  categoria: string;
  prioridade: string;
  status: string;
  dataInicio: string;
  dataFim: string;
  horasEstimadas?: number;
  horasRealizadas?: number;
}

interface Demanda {
  id: number;
  titulo: string;
  descricao?: string;
  setor: string;
  status: string;
  prioridade: string;
  dataEntrega: string;
  responsavelId: number;
}

interface PedidoReembolso {
  id: number;
  titulo: string;
  descricao?: string;
  categoria: string;
  valor: string;
  dataGasto: string;
  status: string;
  criadoEm: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  campo: "Campo",
  escritorio: "Escritório",
  relatorio: "Relatório",
  reuniao: "Reunião",
  vistoria: "Vistoria",
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-700" },
  media: { label: "Média", color: "bg-blue-100 text-blue-700" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-700" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-700" },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-700" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700" },
  cancelada: { label: "Cancelada", color: "bg-gray-100 text-gray-500" },
};

const REEMBOLSO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente_coordenador: { label: "Aguardando Coordenador", color: "bg-yellow-100 text-yellow-700" },
  pendente_financeiro: { label: "Aguardando Financeiro", color: "bg-blue-100 text-blue-700" },
  pendente_diretor: { label: "Aguardando Diretor", color: "bg-purple-100 text-purple-700" },
  aprovado_diretor: { label: "Aprovado", color: "bg-green-100 text-green-700" },
  rejeitado_coordenador: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
  rejeitado_financeiro: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
  rejeitado_diretor: { label: "Rejeitado", color: "bg-red-100 text-red-700" },
  pago: { label: "Pago", color: "bg-emerald-100 text-emerald-700" },
};

const REEMBOLSO_CATEGORIA_LABELS: Record<string, string> = {
  viagem: "Viagem",
  alimentacao: "Alimentação",
  materiais: "Materiais",
  hospedagem: "Hospedagem",
  combustivel: "Combustível",
  transporte: "Transporte",
  outros: "Outros",
};

const reembolsoFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  valor: z.string().min(1, "Valor é obrigatório"),
  dataGasto: z.string().min(1, "Data do gasto é obrigatória"),
});

type ReembolsoFormData = z.infer<typeof reembolsoFormSchema>;

export default function MinhasTarefasSimples() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hoje");
  const [isReembolsoDialogOpen, setIsReembolsoDialogOpen] = useState(false);
  const [selectedReembolso, setSelectedReembolso] = useState<PedidoReembolso | null>(null);

  const reembolsoForm = useForm<ReembolsoFormData>({
    resolver: zodResolver(reembolsoFormSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      categoria: "",
      valor: "",
      dataGasto: new Date().toISOString().split('T')[0],
    },
  });

  const { data: tarefasHoje = [], isLoading: loadingHoje } = useQuery<Tarefa[]>({
    queryKey: ["/api/minhas-tarefas-hoje"],
  });

  const { data: todasTarefas = [], isLoading: loadingTodas } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
  });

  const { data: minhasDemandas = [], isLoading: loadingDemandas } = useQuery<Demanda[]>({
    queryKey: ["/api/minhas-demandas"],
  });

  const { data: reembolsos = [], isLoading: loadingReembolsos } = useQuery<PedidoReembolso[]>({
    queryKey: ["/api/reembolsos"],
  });

  const { data: stats } = useQuery<{ total: number; concluidas: number; pendentes: number; emAndamento: number }>({
    queryKey: ["/api/tarefas-stats"],
  });

  const updateTarefaMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/tarefas/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/minhas-tarefas-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      toast({ title: "Tarefa atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar tarefa", variant: "destructive" });
    },
  });

  const createReembolsoMutation = useMutation({
    mutationFn: async (data: ReembolsoFormData) =>
      apiRequest("POST", "/api/reembolsos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Pedido de reembolso criado!" });
      setIsReembolsoDialogOpen(false);
      reembolsoForm.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar pedido", variant: "destructive" });
    },
  });

  const tarefasAtrasadas = todasTarefas.filter(t => 
    new Date(t.dataFim) < new Date() && 
    t.status !== "concluida" && 
    t.status !== "cancelada"
  );

  const completionRate = stats?.total ? Math.round((stats.concluidas / stats.total) * 100) : 0;

  const handleStatusChange = (tarefa: Tarefa, newStatus: string) => {
    updateTarefaMutation.mutate({ id: tarefa.id, status: newStatus });
  };

  const isOverdue = (tarefa: Tarefa) => 
    new Date(tarefa.dataFim) < new Date() && 
    tarefa.status !== "concluida" && 
    tarefa.status !== "cancelada";

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value || '0'));
  };

  const onSubmitReembolso = (data: ReembolsoFormData) => {
    createReembolsoMutation.mutate(data);
  };

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/minhas-tarefas-hoje"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/minhas-demandas"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
    toast({ title: "Dados atualizados!" });
  };

  const TarefaCard = ({ tarefa }: { tarefa: Tarefa }) => {
    const overdue = isOverdue(tarefa);
    const prioridadeConfig = PRIORIDADE_CONFIG[tarefa.prioridade];
    const statusConfig = STATUS_CONFIG[tarefa.status];
    
    return (
      <Card className={`transition-all ${overdue ? "border-red-300 bg-red-50/50" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {overdue && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                <CardTitle className="text-base font-semibold truncate">
                  {tarefa.titulo}
                </CardTitle>
              </div>
              {tarefa.descricao && (
                <CardDescription className="line-clamp-2">
                  {tarefa.descricao}
                </CardDescription>
              )}
            </div>
            <Badge variant="outline" className={prioridadeConfig?.color}>
              {prioridadeConfig?.label}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pb-3">
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
            <Badge variant="secondary" className={statusConfig?.color}>
              {statusConfig?.label}
            </Badge>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className={overdue ? "text-red-600 font-medium" : ""}>
                {formatDate(tarefa.dataFim)}
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {CATEGORIA_LABELS[tarefa.categoria] || tarefa.categoria}
            </Badge>
            {tarefa.horasEstimadas && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Timer className="h-4 w-4" />
                <span>{tarefa.horasRealizadas || 0}h / {tarefa.horasEstimadas}h</span>
              </div>
            )}
          </div>

          {tarefa.status !== "concluida" && tarefa.status !== "cancelada" && (
            <div className="flex gap-2">
              {tarefa.status === "pendente" && (
                <Button 
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleStatusChange(tarefa, "em_andamento")}
                  disabled={updateTarefaMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>
              )}
              <Button 
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusChange(tarefa, "concluida")}
                disabled={updateTarefaMutation.isPending}
              >
                {updateTarefaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Concluir
                  </>
                )}
              </Button>
            </div>
          )}

          {tarefa.status === "concluida" && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Tarefa concluída</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const isLoading = loadingHoje || loadingTodas || loadingDemandas || loadingReembolsos;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meu Portal</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas tarefas e reembolsos</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.pendentes || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.emAndamento || 0}</p>
              </div>
              <Play className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">{stats?.concluidas || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atrasadas</p>
                <p className="text-2xl font-bold text-red-600">{tarefasAtrasadas.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Meu Progresso</CardTitle>
          <CardDescription>Taxa de conclusão das suas tarefas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={completionRate} className="flex-1 h-3" />
            <span className="text-sm font-medium w-12 text-right">{completionRate}%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="hoje" className="gap-2">
              <Calendar className="h-4 w-4" />
              Hoje ({tarefasHoje.length})
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="gap-2">
              <Clock className="h-4 w-4" />
              Tarefas ({todasTarefas.filter(t => t.status !== "concluida" && t.status !== "cancelada").length})
            </TabsTrigger>
            <TabsTrigger value="demandas" className="gap-2">
              <Eye className="h-4 w-4" />
              Demandas ({minhasDemandas.length})
            </TabsTrigger>
            <TabsTrigger value="reembolsos" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Reembolsos ({reembolsos.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "reembolsos" && (
            <Button size="sm" onClick={() => setIsReembolsoDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Reembolso
            </Button>
          )}
        </div>

        <TabsContent value="hoje" className="mt-4">
          {tarefasHoje.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma tarefa para hoje!</h3>
                <p className="text-muted-foreground">Aproveite o tempo livre ou verifique as outras tarefas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tarefasHoje.map((tarefa) => (
                <TarefaCard key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          {todasTarefas.filter(t => t.status !== "concluida" && t.status !== "cancelada").length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Todas as tarefas concluídas!</h3>
                <p className="text-muted-foreground">Parabéns pelo excelente trabalho.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todasTarefas
                .filter(t => t.status !== "concluida" && t.status !== "cancelada")
                .map((tarefa) => (
                  <TarefaCard key={tarefa.id} tarefa={tarefa} />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="demandas" className="mt-4">
          {minhasDemandas.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Eye className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma demanda atribuída</h3>
                <p className="text-muted-foreground">Você não possui demandas no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {minhasDemandas.map((demanda) => (
                <Card key={demanda.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{demanda.titulo}</CardTitle>
                      <Badge variant="outline" className={PRIORIDADE_CONFIG[demanda.prioridade]?.color}>
                        {PRIORIDADE_CONFIG[demanda.prioridade]?.label}
                      </Badge>
                    </div>
                    {demanda.descricao && (
                      <CardDescription className="line-clamp-2">{demanda.descricao}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="secondary" className={STATUS_CONFIG[demanda.status]?.color}>
                        {STATUS_CONFIG[demanda.status]?.label || demanda.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Entrega: {formatDate(demanda.dataEntrega)}</span>
                      </div>
                      <Badge variant="outline">{demanda.setor}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reembolsos" className="mt-4">
          {reembolsos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <DollarSign className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum pedido de reembolso</h3>
                <p className="text-muted-foreground">Clique em "Novo Reembolso" para criar um pedido.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reembolsos.map((reembolso) => (
                <Card key={reembolso.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedReembolso(reembolso)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{reembolso.titulo}</CardTitle>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(reembolso.valor)}</span>
                    </div>
                    {reembolso.descricao && (
                      <CardDescription className="line-clamp-2">{reembolso.descricao}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge className={REEMBOLSO_STATUS_CONFIG[reembolso.status]?.color}>
                        {REEMBOLSO_STATUS_CONFIG[reembolso.status]?.label || reembolso.status}
                      </Badge>
                      <Badge variant="outline">{REEMBOLSO_CATEGORIA_LABELS[reembolso.categoria] || reembolso.categoria}</Badge>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(reembolso.dataGasto)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isReembolsoDialogOpen} onOpenChange={setIsReembolsoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Pedido de Reembolso</DialogTitle>
            <DialogDescription>Preencha os dados do seu pedido de reembolso.</DialogDescription>
          </DialogHeader>
          <Form {...reembolsoForm}>
            <form onSubmit={reembolsoForm.handleSubmit(onSubmitReembolso)} className="space-y-4">
              <FormField
                control={reembolsoForm.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Combustível viagem cliente" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reembolsoForm.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalhes do gasto..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={reembolsoForm.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(REEMBOLSO_CATEGORIA_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={reembolsoForm.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={reembolsoForm.control}
                name="dataGasto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Gasto</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsReembolsoDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createReembolsoMutation.isPending}>
                  {createReembolsoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Enviar Pedido
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReembolso} onOpenChange={() => setSelectedReembolso(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedReembolso?.titulo}</DialogTitle>
            <DialogDescription>Detalhes do pedido de reembolso</DialogDescription>
          </DialogHeader>
          {selectedReembolso && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(selectedReembolso.valor)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={REEMBOLSO_STATUS_CONFIG[selectedReembolso.status]?.color}>
                  {REEMBOLSO_STATUS_CONFIG[selectedReembolso.status]?.label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Categoria:</span>
                <span>{REEMBOLSO_CATEGORIA_LABELS[selectedReembolso.categoria]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data do gasto:</span>
                <span>{formatDate(selectedReembolso.dataGasto)}</span>
              </div>
              {selectedReembolso.descricao && (
                <div>
                  <span className="text-muted-foreground">Descrição:</span>
                  <p className="mt-1">{selectedReembolso.descricao}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReembolso(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
