import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Play,
  Check,
  Loader2,
  Timer,
  Filter
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}

const CATEGORIA_LABELS: Record<string, string> = {
  campo: "Campo",
  escritorio: "Escritório",
  relatorio: "Relatório",
  reuniao: "Reunião",
  vistoria: "Vistoria",
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-700 border-gray-300" },
  media: { label: "Média", color: "bg-blue-100 text-blue-700 border-blue-300" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700 border-orange-300" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-700 border-red-300" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pendente: { label: "Pendente", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  em_andamento: { label: "Em Andamento", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  concluida: { label: "Concluída", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  cancelada: { label: "Cancelada", color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" },
};

export default function MinhasTarefasSimples() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pendentes");

  const { data: tarefasHoje = [], isLoading: loadingHoje } = useQuery<Tarefa[]>({
    queryKey: ["/api/minhas-tarefas-hoje"],
  });

  const { data: todasTarefas = [], isLoading: loadingTodas } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
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

  const filteredTarefas = useMemo(() => {
    switch (statusFilter) {
      case "pendentes":
        return todasTarefas.filter(t => t.status === "pendente" || t.status === "em_andamento");
      case "concluidas":
        return todasTarefas.filter(t => t.status === "concluida");
      case "hoje":
        return tarefasHoje;
      default:
        return todasTarefas.filter(t => t.status !== "cancelada");
    }
  }, [todasTarefas, tarefasHoje, statusFilter]);

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

  if (loadingHoje || loadingTodas) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <div className="text-sm opacity-90">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white border-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.pendentes || 0}</div>
            <div className="text-sm opacity-90">Pendentes</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats?.concluidas || 0}</div>
            <div className="text-sm opacity-90">Concluídas</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{tarefasAtrasadas.length}</div>
            <div className="text-sm opacity-90">Atrasadas</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso Geral</span>
            <span className="text-sm text-muted-foreground">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-3" />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Para Hoje</SelectItem>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredTarefas.length} tarefa(s)
        </span>
      </div>

      {filteredTarefas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {statusFilter === "pendentes" 
                ? "Parabéns! Nenhuma tarefa pendente." 
                : "Nenhuma tarefa encontrada."}
            </h3>
            <p className="text-muted-foreground">
              {statusFilter === "pendentes" 
                ? "Todas as suas tarefas foram concluídas." 
                : "Altere o filtro para ver outras tarefas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTarefas.map((tarefa) => {
            const overdue = isOverdue(tarefa);
            const statusConfig = STATUS_CONFIG[tarefa.status];
            const prioridadeConfig = PRIORIDADE_CONFIG[tarefa.prioridade];
            
            return (
              <Card 
                key={tarefa.id}
                className={`transition-all ${overdue ? "border-red-300 bg-red-50/50" : statusConfig?.bgColor || ""}`}
              >
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
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className={overdue ? "text-red-600 font-medium" : ""}>
                        {formatDate(tarefa.dataFim)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
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
          })}
        </div>
      )}
    </div>
  );
}
