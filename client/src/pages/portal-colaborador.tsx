
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDateBR } from "@/lib/date-utils";
import { z } from "zod";
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
  FileText,
  Receipt,
  Plus,
  DollarSign,
  Eye,
  History,
  Trash2,
  Edit,
  Lock,
  Globe
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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
  visivelCalendarioGeral?: boolean;
}

interface Demanda {
  id: number;
  titulo: string;
  descricao?: string;
  setor: string;
  status: string;
  prioridade: string;
  dataEntrega: string;
  dataConclusao?: string;
  empreendimentoId?: number;
  responsavelId: number;
  observacoes?: string;
}

interface PedidoReembolso {
  id: number;
  solicitanteId: number;
  unidade: string;
  titulo: string;
  descricao?: string;
  categoria: string;
  valor: string;
  dataGasto: string;
  comprovante?: string;
  status: string;
  empreendimentoId?: number;
  projetoId?: number;
  coordenadorId?: number;
  coordenadorAprovadoEm?: string;
  coordenadorObservacao?: string;
  financeiroId?: number;
  financeiroAprovadoEm?: string;
  financeiroObservacao?: string;
  diretorId?: number;
  diretorAprovadoEm?: string;
  diretorObservacao?: string;
  formaPagamento?: string;
  dataPagamento?: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface HistoricoReembolso {
  id: number;
  pedidoId: number;
  usuarioId: number;
  acao: string;
  statusAnterior?: string;
  statusNovo: string;
  observacao?: string;
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

const REEMBOLSO_CATEGORIA_LABELS: Record<string, string> = {
  viagem: "Viagem",
  alimentacao: "Alimentação",
  materiais: "Materiais",
  hospedagem: "Hospedagem",
  combustivel: "Combustível",
  transporte: "Transporte",
  outros: "Outros",
};

const REEMBOLSO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente_coordenador: { label: "Aguardando Coordenador", color: "bg-yellow-500" },
  pendente_financeiro: { label: "Aguardando Financeiro", color: "bg-blue-500" },
  pendente_diretor: { label: "Aguardando Diretor", color: "bg-purple-500" },
  aprovado_diretor: { label: "Aprovado", color: "bg-green-500" },
  rejeitado_coordenador: { label: "Rejeitado (Coordenador)", color: "bg-red-500" },
  rejeitado_financeiro: { label: "Rejeitado (Financeiro)", color: "bg-red-500" },
  rejeitado_diretor: { label: "Rejeitado (Diretor)", color: "bg-red-500" },
  pago: { label: "Pago", color: "bg-emerald-600" },
};

const reembolsoFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  valor: z.string().min(1, "Valor é obrigatório"),
  dataGasto: z.string().min(1, "Data do gasto é obrigatória"),
  comprovante: z.string().optional(),
});

type ReembolsoFormData = z.infer<typeof reembolsoFormSchema>;

const tarefaFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  prioridade: z.string().min(1, "Prioridade é obrigatória"),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
  dataFim: z.string().min(1, "Data de fim é obrigatória"),
  horasEstimadas: z.string().optional(),
  visivelCalendarioGeral: z.boolean().default(false),
});

type TarefaFormData = z.infer<typeof tarefaFormSchema>;

export default function PortalColaboradorPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hoje");
  const [selectedTarefa, setSelectedTarefa] = useState<Tarefa | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [horasRealizadas, setHorasRealizadas] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [isReembolsoDialogOpen, setIsReembolsoDialogOpen] = useState(false);
  const [isViewReembolsoOpen, setIsViewReembolsoOpen] = useState(false);
  const [selectedReembolso, setSelectedReembolso] = useState<PedidoReembolso | null>(null);
  const [reembolsoStatusFilter, setReembolsoStatusFilter] = useState("all");
  const [isTarefaDialogOpen, setIsTarefaDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTarefaId, setEditingTarefaId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const reembolsoForm = useForm<ReembolsoFormData>({
    resolver: zodResolver(reembolsoFormSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      categoria: "",
      valor: "",
      dataGasto: new Date().toISOString().split('T')[0],
      comprovante: "",
    },
  });

  const tarefaForm = useForm<TarefaFormData>({
    resolver: zodResolver(tarefaFormSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      categoria: "",
      prioridade: "media",
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
      horasEstimadas: "",
      visivelCalendarioGeral: false,
    },
  });

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

  const { data: reembolsos = [], isLoading: loadingReembolsos } = useQuery<PedidoReembolso[]>({
    queryKey: ["/api/reembolsos"],
  });

  const { data: historicoReembolso = [] } = useQuery<HistoricoReembolso[]>({
    queryKey: ["/api/reembolsos", selectedReembolso?.id, "historico"],
    enabled: !!selectedReembolso,
  });

  const { data: minhasDemandas = [], isLoading: loadingDemandas } = useQuery<Demanda[]>({
    queryKey: ["/api/minhas-demandas"],
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

  const createReembolsoMutation = useMutation({
    mutationFn: async (data: ReembolsoFormData) =>
      apiRequest("POST", "/api/reembolsos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Pedido de reembolso criado!" });
      setIsReembolsoDialogOpen(false);
      reembolsoForm.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar pedido de reembolso", variant: "destructive" });
    },
  });

  const deleteReembolsoMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/reembolsos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reembolsos"] });
      toast({ title: "Sucesso", description: "Pedido de reembolso excluído!" });
      setIsViewReembolsoOpen(false);
      setSelectedReembolso(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir pedido", variant: "destructive" });
    },
  });

  const createTarefaMutation = useMutation({
    mutationFn: async (data: TarefaFormData) =>
      apiRequest("POST", "/api/minhas-tarefas", {
        ...data,
        horasEstimadas: data.horasEstimadas ? parseFloat(data.horasEstimadas) : null,
        visivelCalendarioGeral: data.visivelCalendarioGeral || false,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/minhas-tarefas-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licencas/calendar"] });
      toast({ title: "Sucesso", description: "Tarefa criada com sucesso!" });
      setIsTarefaDialogOpen(false);
      tarefaForm.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar tarefa", variant: "destructive" });
    },
  });

  const deleteTarefaMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/tarefas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/minhas-tarefas-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-atrasadas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licencas/calendar"] });
      toast({ title: "Sucesso", description: "Tarefa excluída!" });
      setIsDetailDialogOpen(false);
      setSelectedTarefa(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir tarefa", variant: "destructive" });
    },
  });

  const filteredTarefas = useMemo(() => {
    if (statusFilter === "all") return todasTarefas;
    return todasTarefas.filter(t => t.status === statusFilter);
  }, [todasTarefas, statusFilter]);

  const filteredReembolsos = useMemo(() => {
    if (reembolsoStatusFilter === "all") return reembolsos;
    return reembolsos.filter(r => r.status === reembolsoStatusFilter);
  }, [reembolsos, reembolsoStatusFilter]);

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

  const handleEditTarefa = (tarefa: Tarefa) => {
    setEditingTarefaId(tarefa.id);
    tarefaForm.reset({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      categoria: tarefa.categoria,
      prioridade: tarefa.prioridade,
      dataInicio: tarefa.dataInicio,
      dataFim: tarefa.dataFim,
      horasEstimadas: tarefa.horasEstimadas?.toString() || "",
      visivelCalendarioGeral: tarefa.visivelCalendarioGeral || false,
    });
    setIsDetailDialogOpen(false);
    setIsTarefaDialogOpen(true);
    setIsEditMode(true);
  };

  const handleDeleteTarefa = () => {
    if (!selectedTarefa) return;
    deleteTarefaMutation.mutate(selectedTarefa.id);
    setShowDeleteConfirm(false);
  };

  const handleSaveEditedTarefa = (data: TarefaFormData) => {
    if (!editingTarefaId) return;
    updateTarefaMutation.mutate({
      id: editingTarefaId,
      data: {
        titulo: data.titulo,
        descricao: data.descricao || "",
        categoria: data.categoria,
        prioridade: data.prioridade,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        horasEstimadas: data.horasEstimadas ? parseFloat(data.horasEstimadas) : null,
        visivelCalendarioGeral: data.visivelCalendarioGeral || false,
      },
    });
    setIsEditMode(false);
    setEditingTarefaId(null);
    setIsTarefaDialogOpen(false);
    tarefaForm.reset();
  };

  const quickUpdateStatus = (tarefa: Tarefa, newStatus: string) => {
    updateTarefaMutation.mutate({
      id: tarefa.id,
      data: { status: newStatus },
    });
  };

  const onSubmitReembolso = (data: ReembolsoFormData) => {
    createReembolsoMutation.mutate(data);
  };

  const onSubmitTarefa = (data: TarefaFormData) => {
    if (isEditMode && editingTarefaId) {
      handleSaveEditedTarefa(data);
    } else {
      createTarefaMutation.mutate(data);
    }
  };

  const handleCloseTarefaDialog = () => {
    setIsTarefaDialogOpen(false);
    setIsEditMode(false);
    setEditingTarefaId(null);
    tarefaForm.reset();
  };

  const handleViewReembolso = (reembolso: PedidoReembolso) => {
    setSelectedReembolso(reembolso);
    setIsViewReembolsoOpen(true);
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

  const getReembolsoStatusBadge = (status: string) => {
    const config = REEMBOLSO_STATUS_CONFIG[status];
    return (
      <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
        {config?.label || status}
      </Badge>
    );
  };

  const completionRate = stats?.total > 0 
    ? Math.round((stats?.concluidas / stats?.total) * 100) 
    : 0;

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(value));
  };

  const totalReembolsos = reembolsos.reduce((acc, r) => acc + parseFloat(r.valor || '0'), 0);
  const reembolsosPendentes = reembolsos.filter(r => 
    ['pendente_coordenador', 'pendente_financeiro', 'pendente_diretor'].includes(r.status)
  ).length;
  const reembolsosAprovados = reembolsos.filter(r => r.status === 'aprovado_diretor' || r.status === 'pago').length;

  const TarefaCard = ({ tarefa, showQuickActions = true }: { tarefa: Tarefa; showQuickActions?: boolean }) => {
    const isOverdue = new Date(tarefa.dataFim) < new Date() && tarefa.status !== 'concluida' && tarefa.status !== 'cancelada';
    
    const handleQuickDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedTarefa(tarefa);
      setShowDeleteConfirm(true);
    };
    
    return (
      <Card 
        className={`cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-red-500' : ''}`}
        onClick={() => handleOpenDetail(tarefa)}
        data-testid={`card-tarefa-${tarefa.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base font-medium line-clamp-2">{tarefa.titulo}</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {tarefa.visivelCalendarioGeral ? (
                <Globe className="h-4 w-4 text-blue-500" title="Visível no calendário geral" />
              ) : (
                <Lock className="h-4 w-4 text-gray-400" title="Tarefa privada" />
              )}
              {isOverdue && <AlertTriangle className="h-5 w-5 text-red-500" />}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
                onClick={handleQuickDelete}
                title="Excluir tarefa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
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
          <CardFooter className="pt-2 border-t">
            <div className="flex gap-2 w-full" onClick={(e) => { e.stopPropagation(); }}>
              {tarefa.status === 'pendente' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => quickUpdateStatus(tarefa, 'em_andamento')}
                  disabled={updateTarefaMutation.isPending}
                  data-testid={`button-iniciar-${tarefa.id}`}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>
              )}
              {tarefa.status === 'em_andamento' && (
                <Button 
                  size="sm" 
                  variant="default" 
                  className="flex-1"
                  onClick={() => quickUpdateStatus(tarefa, 'concluida')}
                  disabled={updateTarefaMutation.isPending}
                  data-testid={`button-concluir-${tarefa.id}`}
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

  const ReembolsoCard = ({ reembolso }: { reembolso: PedidoReembolso }) => {
    const canEdit = reembolso.status === 'pendente_coordenador';
    
    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => { handleViewReembolso(reembolso); }}
        data-testid={`card-reembolso-${reembolso.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-base font-medium line-clamp-2">{reembolso.titulo}</CardTitle>
            <span className="text-lg font-bold text-green-600">{formatCurrency(reembolso.valor)}</span>
          </div>
          <CardDescription className="line-clamp-2">{reembolso.descricao || "Sem descrição"}</CardDescription>
        </CardHeader>
        <CardContent className="pb-2">
          <div className="flex flex-wrap gap-2 mb-2">
            {getReembolsoStatusBadge(reembolso.status)}
            <Badge variant="outline">{REEMBOLSO_CATEGORIA_LABELS[reembolso.categoria] || reembolso.categoria}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Data do gasto: {reembolso.dataGasto}</span>
          </div>
        </CardContent>
        {canEdit && (
          <CardFooter className="pt-2 border-t">
            <div className="flex gap-2 w-full text-xs text-muted-foreground">
              Você ainda pode editar ou excluir este pedido
            </div>
          </CardFooter>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-titulo-portal">Meu Portal</h1>
          <p className="text-muted-foreground">Gerencie suas tarefas e reembolsos</p>
        </div>
        <RefreshButton />
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

      <div className="flex justify-between items-center">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="hoje" data-testid="tab-hoje">
              <Calendar className="h-4 w-4 mr-2" />
              Hoje ({tarefasHoje.length})
            </TabsTrigger>
            <TabsTrigger value="todas" data-testid="tab-todas">
              <ClipboardList className="h-4 w-4 mr-2" />
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="demandas" data-testid="tab-demandas">
              <FileText className="h-4 w-4 mr-2" />
              Demandas ({minhasDemandas.length})
            </TabsTrigger>
            <TabsTrigger value="reembolsos" data-testid="tab-reembolsos">
              <Receipt className="h-4 w-4 mr-2" />
              Reembolsos ({reembolsos.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button 
          onClick={() => setIsTarefaDialogOpen(true)}
          className="ml-4"
          data-testid="button-nova-tarefa"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>

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

        <TabsContent value="demandas" className="space-y-4">
          {loadingDemandas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : minhasDemandas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhuma demanda atribuída</h3>
                <p className="text-muted-foreground">Quando você for responsável por uma demanda, ela aparecerá aqui.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {minhasDemandas.map((demanda) => (
                <Card key={demanda.id} className="hover:shadow-lg transition-shadow" data-testid={`card-demanda-${demanda.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{demanda.titulo}</CardTitle>
                      <Badge className={PRIORIDADE_CONFIG[demanda.prioridade]?.color || 'bg-gray-500'}>
                        {PRIORIDADE_CONFIG[demanda.prioridade]?.label || demanda.prioridade}
                      </Badge>
                    </div>
                    <CardDescription>{demanda.setor}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Badge variant="outline" className={
                          demanda.status === 'concluido' ? 'bg-green-50 text-green-700' :
                          demanda.status === 'em_andamento' ? 'bg-blue-50 text-blue-700' :
                          demanda.status === 'em_revisao' ? 'bg-purple-50 text-purple-700' :
                          'bg-yellow-50 text-yellow-700'
                        }>
                          {demanda.status === 'a_fazer' ? 'A Fazer' :
                           demanda.status === 'em_andamento' ? 'Em Andamento' :
                           demanda.status === 'em_revisao' ? 'Em Revisão' :
                           demanda.status === 'concluido' ? 'Concluído' :
                           demanda.status}
                        </Badge>
                      </div>
                      {demanda.dataEntrega && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-1" />
                          Entrega: {formatDateBR(demanda.dataEntrega)}
                        </div>
                      )}
                      {demanda.descricao && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{demanda.descricao}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reembolsos" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Solicitado</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600" data-testid="text-total-reembolsos">
                  {formatCurrency(totalReembolsos.toString())}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-yellow-600" data-testid="text-reembolsos-pendentes">
                  {reembolsosPendentes}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aprovados/Pagos</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600" data-testid="text-reembolsos-aprovados">
                  {reembolsosAprovados}
                </div>
              </CardContent>
            </Card>
            <Card className="flex items-center justify-center">
              <Button 
                onClick={() => { setIsReembolsoDialogOpen(true); }} 
                className="w-full h-full"
                data-testid="button-novo-reembolso"
              >
                <Plus className="h-5 w-5 mr-2" />
                Novo Pedido
              </Button>
            </Card>
          </div>

          <div className="flex gap-4 mb-4">
            <Select value={reembolsoStatusFilter} onValueChange={setReembolsoStatusFilter}>
              <SelectTrigger className="w-64" data-testid="select-filter-reembolso-status">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="pendente_coordenador">Aguardando Coordenador</SelectItem>
                <SelectItem value="pendente_financeiro">Aguardando Financeiro</SelectItem>
                <SelectItem value="pendente_diretor">Aguardando Diretor</SelectItem>
                <SelectItem value="aprovado_diretor">Aprovados</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingReembolsos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReembolsos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhum pedido de reembolso</h3>
                <p className="text-muted-foreground mb-4">Você ainda não fez nenhum pedido de reembolso.</p>
                <Button onClick={() => setIsReembolsoDialogOpen(true)} data-testid="button-criar-primeiro-reembolso">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Pedido
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredReembolsos.map((reembolso) => (
                <ReembolsoCard key={reembolso.id} reembolso={reembolso} />
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
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => selectedTarefa && handleEditTarefa(selectedTarefa)}
                disabled={updateTarefaMutation.isPending}
                data-testid="button-editar-tarefa"
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button 
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteTarefaMutation.isPending}
                data-testid="button-excluir-tarefa"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
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

      <Dialog open={isReembolsoDialogOpen} onOpenChange={setIsReembolsoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Pedido de Reembolso</DialogTitle>
            <DialogDescription>
              Preencha os dados do gasto para solicitar reembolso
            </DialogDescription>
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
                      <Input placeholder="Ex: Almoço com cliente" {...field} data-testid="input-reembolso-titulo" />
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
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o gasto..." 
                        {...field} 
                        data-testid="input-reembolso-descricao"
                      />
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
                          <SelectTrigger data-testid="select-reembolso-categoria">
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
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-reembolso-valor"
                        />
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
                      <Input type="date" {...field} data-testid="input-reembolso-data" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reembolsoForm.control}
                name="comprovante"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link do Comprovante (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="URL do comprovante ou foto" 
                        {...field} 
                        data-testid="input-reembolso-comprovante"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsReembolsoDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createReembolsoMutation.isPending}
                  data-testid="button-submit-reembolso"
                >
                  {createReembolsoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Solicitar Reembolso
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewReembolsoOpen} onOpenChange={setIsViewReembolsoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Reembolso</DialogTitle>
            <DialogDescription>
              Visualize o status e histórico do pedido
            </DialogDescription>
          </DialogHeader>
          
          {selectedReembolso && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold">{selectedReembolso.titulo}</h3>
                <span className="text-xl font-bold text-green-600">{formatCurrency(selectedReembolso.valor)}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {getReembolsoStatusBadge(selectedReembolso.status)}
                <Badge variant="outline">{REEMBOLSO_CATEGORIA_LABELS[selectedReembolso.categoria]}</Badge>
              </div>

              {selectedReembolso.descricao && (
                <div>
                  <h4 className="font-medium mb-1">Descrição</h4>
                  <p className="text-muted-foreground text-sm">{selectedReembolso.descricao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Data do Gasto</h4>
                  <p className="text-muted-foreground text-sm">{selectedReembolso.dataGasto}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Data da Solicitação</h4>
                  <p className="text-muted-foreground text-sm">
                    {new Date(selectedReembolso.criadoEm).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {selectedReembolso.comprovante && (
                <div>
                  <h4 className="font-medium mb-1">Comprovante</h4>
                  <a 
                    href={selectedReembolso.comprovante} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Ver comprovante
                  </a>
                </div>
              )}

              {(selectedReembolso.coordenadorObservacao || selectedReembolso.financeiroObservacao || selectedReembolso.diretorObservacao) && (
                <div className="space-y-2">
                  <h4 className="font-medium">Observações</h4>
                  {selectedReembolso.coordenadorObservacao && (
                    <div className="bg-muted p-2 rounded text-sm">
                      <span className="font-medium">Coordenador:</span> {selectedReembolso.coordenadorObservacao}
                    </div>
                  )}
                  {selectedReembolso.financeiroObservacao && (
                    <div className="bg-muted p-2 rounded text-sm">
                      <span className="font-medium">Financeiro:</span> {selectedReembolso.financeiroObservacao}
                    </div>
                  )}
                  {selectedReembolso.diretorObservacao && (
                    <div className="bg-muted p-2 rounded text-sm">
                      <span className="font-medium">Diretor:</span> {selectedReembolso.diretorObservacao}
                    </div>
                  )}
                </div>
              )}

              {selectedReembolso.status === 'pago' && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
                  <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">Pagamento Realizado</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Forma:</span> {selectedReembolso.formaPagamento}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span> {selectedReembolso.dataPagamento}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico
                </h4>
                <div className="space-y-2">
                  {historicoReembolso.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Carregando histórico...</p>
                  ) : (
                    historicoReembolso.map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-sm border-l-2 border-muted pl-3">
                        <div>
                          <span className="font-medium">{h.acao.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground ml-2">
                            {new Date(h.criadoEm).toLocaleString('pt-BR')}
                          </span>
                          {h.observacao && (
                            <p className="text-muted-foreground mt-1">{h.observacao}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedReembolso?.status === 'pendente_coordenador' && (
              <Button 
                variant="destructive" 
                onClick={() => selectedReembolso && deleteReembolsoMutation.mutate(selectedReembolso.id)}
                disabled={deleteReembolsoMutation.isPending}
                data-testid="button-excluir-reembolso"
              >
                {deleteReembolsoMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Pedido
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsViewReembolsoOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTarefaDialogOpen} onOpenChange={handleCloseTarefaDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Editar Tarefa' : 'Nova Tarefa Pessoal'}</DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? 'Atualize os dados da tarefa conforme necessário.'
                : 'Crie uma tarefa pessoal para organizar suas atividades. Esta tarefa será visível apenas para você.'
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...tarefaForm}>
            <form onSubmit={tarefaForm.handleSubmit(onSubmitTarefa)} className="space-y-4">
              <FormField
                control={tarefaForm.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Revisar documentação" {...field} data-testid="input-tarefa-titulo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={tarefaForm.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva os detalhes da tarefa..." 
                        {...field} 
                        data-testid="input-tarefa-descricao"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={tarefaForm.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tarefa-categoria">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="campo">Campo</SelectItem>
                          <SelectItem value="escritorio">Escritório</SelectItem>
                          <SelectItem value="relatorio">Relatório</SelectItem>
                          <SelectItem value="reuniao">Reunião</SelectItem>
                          <SelectItem value="vistoria">Vistoria</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tarefaForm.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tarefa-prioridade">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="urgente">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={tarefaForm.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-tarefa-data-inicio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tarefaForm.control}
                  name="dataFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fim</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-tarefa-data-fim" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={tarefaForm.control}
                name="horasEstimadas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas Estimadas (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.5" 
                        placeholder="Ex: 2.5" 
                        {...field} 
                        data-testid="input-tarefa-horas"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={tarefaForm.control}
                name="visivelCalendarioGeral"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Visível no Calendário Geral</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Quando ativado, esta tarefa aparece no calendário de todos os usuários
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-calendario-geral"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseTarefaDialog}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTarefaMutation.isPending || updateTarefaMutation.isPending}
                  data-testid="button-salvar-tarefa"
                >
                  {(createTarefaMutation.isPending || updateTarefaMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {isEditMode ? 'Salvar Alterações' : 'Criar Tarefa'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTarefa}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTarefaMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
