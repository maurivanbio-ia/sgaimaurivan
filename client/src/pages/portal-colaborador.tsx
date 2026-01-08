"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Play,
  Pause,
  Check,
  Loader2,
  ClipboardList,
  Timer,
  FileText
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  observacoes?: string;
  observacoesColaborador?: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  campo: "Campo",
  escritorio: "Escritório",
  relatorio: "Relatório",
  reuniao: "Reunião",
  vistoria: "Vistoria",
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-gray-500" },
  media: { label: "Média", color: "bg-blue-500" },
  alta: { label: "Alta", color: "bg-orange-500" },
  urgente: { label: "Urgente", color: "bg-red-500" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-yellow-500", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500", icon: Play },
  concluida: { label: "Concluída", color: "bg-green-500", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-gray-500", icon: Pause },
};

export default function PortalColaboradorPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hoje");
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [horasRealizadas, setHorasRealizadas] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tarefasHoje = [], isLoading: loadingHoje } = useQuery<Tarefa[]>({
    queryKey: ["/api/minhas-tarefas-hoje"],
  });

  const { data: todasTarefas = [], isLoading: loadingTodas } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
  });

  const { data: tarefasAtrasadas = [] } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas-atrasadas"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/tarefas-stats"],
  });

  const updateTarefaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Tarefa> }) =>
      apiRequest("PUT", `/api/tarefas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/minhas-tarefas-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-atrasadas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      toast({ title: "Sucesso", description: "Tarefa atualizada!" });
      setIsDetailDialogOpen(false);
      setSelectedTarefa(null);
      setObservacao("");
      setHorasRealizadas("");
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar tarefa", variant: "destructive" });
    },
  });

  const filteredTarefas = useMemo(() => {
    if (statusFilter === "all") return todasTarefas;
    return todasTarefas.filter(t => t.status === statusFilter);
  }, [todasTarefas, statusFilter]);

  const handleOpenDetail = (tarefa: Tarefa) => {
    setSelectedTarefa(tarefa);
    setObservacao(tarefa.observacoesColaborador || "");
    setHorasRealizadas(tarefa.horasRealizadas?.toString() || "");
    setIsDetailDialogOpen(true);
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (!selectedTarefa) return;
    updateTarefaMutation.mutate({
      id: selectedTarefa.id,
      data: {
        status: newStatus,
        observacoesColaborador: observacao,
        horasRealizadas: horasRealizadas ? parseFloat(horasRealizadas) : undefined,
      },
    });
  };

  const handleSaveObservation = () => {
    if (!selectedTarefa) return;
    updateTarefaMutation.mutate({
      id: selectedTarefa.id,
      data: {
        observacoesColaborador: observacao,
        horasRealizadas: horasRealizadas ? parseFloat(horasRealizadas) : undefined,
      },
    });
  };

  const quickUpdateStatus = (tarefa: Tarefa, newStatus: string) => {
    updateTarefaMutation.mutate({
      id: tarefa.id,
      data: { status: newStatus },
    });
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const config = PRIORIDADE_CONFIG[prioridade];
    return (
      <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
        {config?.label || prioridade}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
        {config?.label || status}
      </Badge>
    );
  };

  const completionRate = stats?.total > 0 
    ? Math.round((stats?.concluidas / stats?.total) * 100) 
    : 0;

  const TarefaCard = ({ tarefa, showQuickActions = true }: { tarefa: Tarefa; showQuickActions?: boolean }) => {
    const isOverdue = new Date(tarefa.dataFim) < new Date() && tarefa.status !== 'concluida' && tarefa.status !== 'cancelada';
    
    return (
      <Card 
        className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-500' : ''}`}
        onClick={() => handleOpenDetail(tarefa)}
        data-testid={`card-tarefa-${tarefa.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base font-medium line-clamp-2">{tarefa.titulo}</CardTitle>
            {isOverdue && <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />}
          </div>
          <CardDescription className="line-clamp-2">{tarefa.descricao || "Sem descrição"}</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {getPrioridadeBadge(tarefa.prioridade)}
            {getStatusBadge(tarefa.status)}
            <Badge variant="outline">{CATEGORIA_LABELS[tarefa.categoria] || tarefa.categoria}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Prazo: {tarefa.dataFim}</span>
          </div>
          {tarefa.horasEstimadas && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Timer className="h-4 w-4" />
              <span>
                {tarefa.horasRealizadas || 0}h / {tarefa.horasEstimadas}h
              </span>
            </div>
          )}
        </CardContent>
        {showQuickActions && tarefa.status !== 'concluida' && tarefa.status !== 'cancelada' && (
          <CardFooter className="pt-0">
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {tarefa.status === 'pendente' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => quickUpdateStatus(tarefa, 'em_andamento')}
                  data-testid={`button-iniciar-tarefa-${tarefa.id}`}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>
              )}
              {tarefa.status === 'em_andamento' && (
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => quickUpdateStatus(tarefa, 'concluida')}
                  data-testid={`button-concluir-tarefa-${tarefa.id}`}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Concluir
                </Button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Minhas Tarefas</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas atividades diárias</p>
        </div>
        <RefreshButton queryKeys={["/api/tarefas", "/api/minhas-tarefas-hoje", "/api/tarefas-atrasadas", "/api/tarefas-stats"]} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-minhas-pendentes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-minhas-pendentes">{stats?.pendentes || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-minhas-andamento">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-minhas-andamento">{stats?.emAndamento || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-minhas-concluidas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-minhas-concluidas">{stats?.concluidas || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-minhas-atrasadas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-minhas-atrasadas">{tarefasAtrasadas.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meu Progresso</CardTitle>
          <CardDescription>Taxa de conclusão das suas tarefas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={completionRate} className="flex-1" />
            <span className="text-lg font-semibold" data-testid="text-meu-progresso">{completionRate}%</span>
          </div>
        </CardContent>
      </Card>

      {tarefasAtrasadas.length > 0 && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Tarefas Atrasadas
            </CardTitle>
            <CardDescription>Estas tarefas precisam de atenção imediata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tarefasAtrasadas.map((tarefa) => (
                <TarefaCard key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hoje" data-testid="tab-hoje">
            <Calendar className="h-4 w-4 mr-2" />
            Tarefas de Hoje ({tarefasHoje.length})
          </TabsTrigger>
          <TabsTrigger value="todas" data-testid="tab-todas">
            <ClipboardList className="h-4 w-4 mr-2" />
            Todas as Tarefas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="space-y-4">
          {loadingHoje ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tarefasHoje.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">Nenhuma tarefa para hoje!</h3>
                <p className="text-muted-foreground">Aproveite o tempo livre ou verifique as outras tarefas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tarefasHoje.map((tarefa) => (
                <TarefaCard key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="todas" className="space-y-4">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48" data-testid="select-filter-status">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingTodas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTarefas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhuma tarefa encontrada</h3>
                <p className="text-muted-foreground">Não há tarefas com este filtro.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTarefas.map((tarefa) => (
                <TarefaCard key={tarefa.id} tarefa={tarefa} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTarefa?.titulo}</DialogTitle>
            <DialogDescription>Detalhes e atualização da tarefa</DialogDescription>
          </DialogHeader>
          
          {selectedTarefa && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {getPrioridadeBadge(selectedTarefa.prioridade)}
                {getStatusBadge(selectedTarefa.status)}
                <Badge variant="outline">{CATEGORIA_LABELS[selectedTarefa.categoria]}</Badge>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Descrição</h4>
                <p className="text-muted-foreground">{selectedTarefa.descricao || "Sem descrição"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium">Data Início</h4>
                  <p className="text-muted-foreground">{selectedTarefa.dataInicio}</p>
                </div>
                <div>
                  <h4 className="font-medium">Data Fim</h4>
                  <p className="text-muted-foreground">{selectedTarefa.dataFim}</p>
                </div>
              </div>

              {selectedTarefa.horasEstimadas && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium">Horas Estimadas</h4>
                    <p className="text-muted-foreground">{selectedTarefa.horasEstimadas}h</p>
                  </div>
                  <div>
                    <label className="font-medium">Horas Realizadas</label>
                    <Input
                      type="number"
                      step="0.5"
                      value={horasRealizadas}
                      onChange={(e) => setHorasRealizadas(e.target.value)}
                      placeholder="0"
                      data-testid="input-horas-realizadas"
                    />
                  </div>
                </div>
              )}

              {selectedTarefa.observacoes && (
                <div>
                  <h4 className="font-medium">Observações do Coordenador</h4>
                  <p className="text-muted-foreground text-sm bg-muted p-2 rounded">{selectedTarefa.observacoes}</p>
                </div>
              )}

              <div>
                <label className="font-medium">Minhas Observações</label>
                <Textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Adicione observações sobre esta tarefa..."
                  className="mt-1"
                  data-testid="input-minhas-observacoes"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedTarefa?.status !== 'concluida' && selectedTarefa?.status !== 'cancelada' && (
              <>
                {selectedTarefa?.status === 'pendente' && (
                  <Button 
                    variant="outline"
                    onClick={() => handleUpdateStatus('em_andamento')}
                    disabled={updateTarefaMutation.isPending}
                    data-testid="button-iniciar"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Tarefa
                  </Button>
                )}
                {selectedTarefa?.status === 'em_andamento' && (
                  <Button 
                    variant="default"
                    onClick={() => handleUpdateStatus('concluida')}
                    disabled={updateTarefaMutation.isPending}
                    data-testid="button-concluir"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Concluir Tarefa
                  </Button>
                )}
              </>
            )}
            <Button 
              variant="secondary"
              onClick={handleSaveObservation}
              disabled={updateTarefaMutation.isPending}
              data-testid="button-salvar-observacao"
            >
              {updateTarefaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Observações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
