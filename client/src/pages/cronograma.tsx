import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Plus,
  FileText,
  Target,
  Flag,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Filter,
  Loader2,
  CalendarDays,
  Building2,
  FolderOpen,
  Repeat,
  ChevronDown,
  ChevronRight,
  CheckCheck,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import type { CronogramaItem, Empreendimento, Projeto } from "@shared/schema";

const TIPO_OPTIONS = [
  { value: "campanha", label: "Campanha", icon: Target, color: "bg-blue-500" },
  { value: "relatorio", label: "Relatório", icon: FileText, color: "bg-green-500" },
  { value: "marco", label: "Marco/Milestone", icon: Flag, color: "bg-purple-500" },
  { value: "etapa", label: "Etapa", icon: Calendar, color: "bg-orange-500" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-500" },
  { value: "concluido", label: "Concluído", color: "bg-green-500" },
  { value: "atrasado", label: "Atrasado", color: "bg-red-500" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa", color: "text-green-600" },
  { value: "media", label: "Média", color: "text-yellow-600" },
  { value: "alta", label: "Alta", color: "text-red-600" },
];

const RECORRENCIA_OPTIONS = [
  { value: "nenhuma", label: "Sem recorrência" },
  { value: "mensal", label: "🗓️ Mensal (todo mês)" },
  { value: "bimestral", label: "🗓️ Bimestral (a cada 2 meses)" },
  { value: "trimestral", label: "🗓️ Trimestral (a cada 3 meses)" },
  { value: "semestral", label: "🗓️ Semestral (a cada 6 meses)" },
  { value: "anual", label: "🗓️ Anual (todo ano)" },
  { value: "bianual", label: "🗓️ Bianual (a cada 2 anos)" },
];

const RECORRENCIA_LABELS: Record<string, string> = {
  mensal: "Mensal", bimestral: "Bimestral", trimestral: "Trimestral",
  semestral: "Semestral", anual: "Anual", bianual: "Bianual",
};

function getItemStatus(item: CronogramaItem): "atrasado" | "em_andamento" | "pendente" | "concluido" {
  if (item.concluido) return "concluido";
  if (isPast(parseISO(item.dataFim))) return "atrasado";
  if (item.status === "em_andamento") return "em_andamento";
  return "pendente";
}

function getTimeProgress(dataInicio: string, dataFim: string): number {
  const start = parseISO(dataInicio).getTime();
  const end = parseISO(dataFim).getTime();
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

const STATUS_STYLE: Record<string, { border: string; bg: string; label: string; icon: any; badgeClass: string }> = {
  atrasado: {
    border: "border-l-4 border-l-red-500",
    bg: "bg-red-50 dark:bg-red-950/10",
    label: "Atrasado",
    icon: AlertCircle,
    badgeClass: "bg-red-500 text-white",
  },
  em_andamento: {
    border: "border-l-4 border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/10",
    label: "Em Andamento",
    icon: Clock,
    badgeClass: "bg-blue-500 text-white",
  },
  pendente: {
    border: "border-l-4 border-l-yellow-400",
    bg: "",
    label: "Pendente",
    icon: Clock,
    badgeClass: "bg-yellow-500 text-white",
  },
  concluido: {
    border: "border-l-4 border-l-green-500",
    bg: "bg-green-50 dark:bg-green-950/10",
    label: "Concluído",
    icon: CheckCircle,
    badgeClass: "bg-green-500 text-white",
  },
};

// ─── Modal rápido para confirmar execução ───────────────────────────────────
function ExecuteModal({
  item,
  open,
  onClose,
  onConfirm,
  isLoading,
}: {
  item: CronogramaItem;
  open: boolean;
  onClose: () => void;
  onConfirm: (obs: string) => void;
  isLoading: boolean;
}) {
  const [obs, setObs] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCheck className="h-5 w-5" />
            Confirmar Execução
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Marcar <span className="font-semibold text-foreground">"{item.titulo}"</span> como executado?
          </p>
          <div>
            <Label htmlFor="obs-exec">Observações de execução (opcional)</Label>
            <Textarea
              id="obs-exec"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Descreva o que foi realizado, resultados, pendências..."
              rows={3}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onConfirm(obs)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Marcar como Executado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card individual do item ─────────────────────────────────────────────────
function ItemCard({
  item,
  empMap,
  projMap,
  onEdit,
  onDelete,
  onToggleExecute,
  executeMutationPending,
}: {
  item: CronogramaItem;
  empMap: Map<number, string>;
  projMap: Map<number, string>;
  onEdit: () => void;
  onDelete: () => void;
  onToggleExecute: (item: CronogramaItem) => void;
  executeMutationPending: boolean;
}) {
  const status = getItemStatus(item);
  const style = STATUS_STYLE[status];
  const Icon = style.icon;
  const tipoOpt = TIPO_OPTIONS.find(t => t.value === item.tipo);
  const TipoIcon = tipoOpt?.icon || Calendar;
  const progress = getTimeProgress(item.dataInicio, item.dataFim);

  const daysLabel = (() => {
    const days = differenceInDays(parseISO(item.dataFim), new Date());
    if (item.concluido) return null;
    if (days < 0) return <span className="text-red-600 font-semibold text-xs">{Math.abs(days)} dias atrasado</span>;
    if (days === 0) return <span className="text-orange-600 font-semibold text-xs">Vence hoje</span>;
    if (days <= 7) return <span className="text-yellow-600 font-semibold text-xs">{days} dias restantes</span>;
    return <span className="text-muted-foreground text-xs">{days} dias restantes</span>;
  })();

  return (
    <div
      className={`rounded-lg border ${style.border} ${style.bg} p-4 transition-all hover:shadow-md`}
      data-testid={`cronograma-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Ícone do tipo */}
        <div className={`p-2 rounded-lg ${tipoOpt?.color || "bg-gray-500"} text-white flex-shrink-0 mt-0.5`}>
          <TipoIcon className="h-4 w-4" />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`font-semibold text-base leading-tight ${item.concluido ? "line-through text-muted-foreground" : ""}`}>
                {item.titulo}
              </h3>
              {item.descricao && (
                <p className="text-muted-foreground text-sm mt-0.5 truncate">{item.descricao}</p>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={item.concluido
                        ? "text-muted-foreground hover:text-orange-600"
                        : "text-green-600 hover:bg-green-100 hover:text-green-700"}
                      onClick={() => onToggleExecute(item)}
                      disabled={executeMutationPending}
                    >
                      {item.concluido
                        ? <RotateCcw className="h-4 w-4" />
                        : <CheckCheck className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {item.concluido ? "Desfazer execução" : "Marcar como executado"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-${item.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                data-testid={`button-delete-${item.id}`}
              >
                <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
              </Button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge className={style.badgeClass + " text-xs"}>
              <Icon className="h-3 w-3 mr-1" />
              {style.label}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{item.tipo}</Badge>
            {item.prioridade && (
              <Badge variant="outline" className={`text-xs ${PRIORIDADE_OPTIONS.find(p => p.value === item.prioridade)?.color}`}>
                {item.prioridade}
              </Badge>
            )}
            {(item as any).recorrencia && (item as any).recorrencia !== "nenhuma" && (
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/20">
                <Repeat className="h-3 w-3 mr-1" />
                {RECORRENCIA_LABELS[(item as any).recorrencia] || (item as any).recorrencia}
              </Badge>
            )}
            {(item as any).recorrenciaPaiId && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/20">
                <Repeat className="h-3 w-3 mr-1" />
                Recorrente
              </Badge>
            )}
          </div>

          {/* Datas e responsável */}
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(parseISO(item.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
              {" — "}
              {format(parseISO(item.dataFim), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            {daysLabel}
            {item.responsavel && <span>Resp: <span className="font-medium text-foreground">{item.responsavel}</span></span>}
          </div>

          {/* Empreendimento / Projeto */}
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {item.empreendimentoId && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {empMap.get(item.empreendimentoId) || `ID ${item.empreendimentoId}`}
              </span>
            )}
            {item.projetoId && (
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {projMap.get(item.projetoId) || `Projeto ID ${item.projetoId}`}
              </span>
            )}
          </div>

          {/* Barra de progresso de tempo */}
          {!item.concluido && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progresso de tempo</span>
                <span>{progress}%</span>
              </div>
              <Progress
                value={progress}
                className={`h-1.5 ${status === "atrasado" ? "[&>div]:bg-red-500" : status === "em_andamento" ? "[&>div]:bg-blue-500" : "[&>div]:bg-yellow-400"}`}
              />
            </div>
          )}

          {/* Observações da execução, se houver */}
          {item.concluido && item.observacoes && (
            <div className="mt-2 text-xs text-muted-foreground bg-green-100 dark:bg-green-950/20 rounded px-2 py-1 border border-green-200 dark:border-green-800">
              <span className="font-medium text-green-700 dark:text-green-400">Obs: </span>
              {item.observacoes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Seção agrupada por status ───────────────────────────────────────────────
function StatusSection({
  title,
  items,
  defaultOpen = true,
  emptyMessage,
  empMap,
  projMap,
  onEdit,
  onDelete,
  onToggleExecute,
  executeMutationPending,
  accentClass,
}: {
  title: string;
  items: CronogramaItem[];
  defaultOpen?: boolean;
  emptyMessage?: string;
  empMap: Map<number, string>;
  projMap: Map<number, string>;
  onEdit: (item: CronogramaItem) => void;
  onDelete: (item: CronogramaItem) => void;
  onToggleExecute: (item: CronogramaItem) => void;
  executeMutationPending: boolean;
  accentClass: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${accentClass} cursor-pointer select-none hover:opacity-90 transition`}>
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-semibold">{title}</span>
            <Badge variant="secondary" className="ml-1 font-bold">{items.length}</Badge>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
          ) : (
            items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                empMap={empMap}
                projMap={projMap}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
                onToggleExecute={onToggleExecute}
                executeMutationPending={executeMutationPending}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function CronogramaPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CronogramaItem | null>(null);
  const [executeModal, setExecuteModal] = useState<CronogramaItem | null>(null);
  const [filters, setFilters] = useState({ tipo: "todos", status: "todos", empreendimentoId: "", projetoId: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status !== "todos") params.append("status", filters.status);
    if (filters.empreendimentoId) params.append("empreendimentoId", filters.empreendimentoId);
    if (filters.projetoId) params.append("projetoId", filters.projetoId);
    return params.toString() ? `?${params.toString()}` : "";
  };

  const { data: cronogramaItens = [], isLoading } = useQuery<CronogramaItem[]>({
    queryKey: ["/api/cronograma", filters],
    queryFn: async () => {
      const res = await fetch(`/api/cronograma${buildQueryString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cronograma");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ["/api/empreendimentos"] });
  const { data: projetos = [] } = useQuery<Projeto[]>({ queryKey: ["/api/projetos"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/cronograma", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Sucesso", description: "Item adicionado ao cronograma!" });
      setDialogOpen(false);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/cronograma/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Sucesso", description: "Item atualizado!" });
      setDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cronograma/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Sucesso", description: "Item excluído!" });
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: async ({ id, concluido, obs }: { id: number; concluido: boolean; obs?: string }) =>
      apiRequest("PUT", `/api/cronograma/${id}`, {
        concluido,
        status: concluido ? "concluido" : "pendente",
        ...(obs ? { observacoes: obs } : {}),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({
        title: vars.concluido ? "Executado!" : "Reaberto",
        description: vars.concluido ? "Item marcado como executado." : "Item reaberto como pendente.",
      });
      setExecuteModal(null);
    },
    onError: (error: any) => toast({ title: "Erro", description: error.message, variant: "destructive" }),
  });

  const handleToggleExecute = (item: CronogramaItem) => {
    if (item.concluido) {
      executeMutation.mutate({ id: item.id, concluido: false });
    } else {
      setExecuteModal(item);
    }
  };

  const handleDelete = (item: CronogramaItem) => {
    const msg = (item as any).recorrencia
      ? "Este item é recorrente. Excluir apagará também todas as ocorrências futuras. Confirma?"
      : "Tem certeza que deseja excluir este item?";
    if (confirm(msg)) deleteMutation.mutate(item.id);
  };

  const empMap = new Map(empreendimentos.map(e => [e.id, e.nome]));
  const projMap = new Map(projetos.map(p => [p.id, p.nome]));

  const atrasados = cronogramaItens.filter(i => getItemStatus(i) === "atrasado");
  const emAndamento = cronogramaItens.filter(i => getItemStatus(i) === "em_andamento");
  const pendentes = cronogramaItens.filter(i => getItemStatus(i) === "pendente");
  const concluidos = cronogramaItens.filter(i => getItemStatus(i) === "concluido");

  const sharedProps = {
    empMap,
    projMap,
    onEdit: (item: CronogramaItem) => { setEditingItem(item); setDialogOpen(true); },
    onDelete: handleDelete,
    onToggleExecute: handleToggleExecute,
    executeMutationPending: executeMutation.isPending,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            Cronograma de Projetos
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie campanhas, relatórios e marcos dos seus projetos</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingItem(null); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-novo-cronograma">
                <Plus className="h-4 w-4 mr-2" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Editar Item" : "Novo Item do Cronograma"}</DialogTitle>
              </DialogHeader>
              <CronogramaForm
                item={editingItem}
                empreendimentos={empreendimentos}
                projetos={projetos}
                onSubmit={(data) => {
                  if (editingItem) updateMutation.mutate({ id: editingItem.id, data });
                  else createMutation.mutate(data);
                }}
                isLoading={createMutation.isPending || updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 dark:text-red-400">Atrasados</p>
              <p className="text-2xl font-bold text-red-800 dark:text-red-300">{atrasados.length}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-400">Em Andamento</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{emAndamento.length}</p>
            </div>
            <Target className="h-8 w-8 text-blue-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{pendentes.length}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 dark:text-green-400">Concluídos</p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-300">{concluidos.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={filters.tipo} onValueChange={(v) => setFilters(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger data-testid="select-filter-tipo"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
                <SelectTrigger data-testid="select-filter-status"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empreendimento</Label>
              <Select value={filters.empreendimentoId || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, empreendimentoId: v === "all" ? "" : v }))}>
                <SelectTrigger data-testid="select-filter-empreendimento"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {empreendimentos.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={filters.projetoId || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, projetoId: v === "all" ? "" : v }))}>
                <SelectTrigger data-testid="select-filter-projeto"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {projetos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista agrupada */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : cronogramaItens.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="font-medium">Nenhum item encontrado no cronograma</p>
          <p className="text-sm mt-1">Adicione campanhas, relatórios ou marcos para seus projetos</p>
        </div>
      ) : (
        <div className="space-y-4">
          <StatusSection
            title="Atrasados"
            items={atrasados}
            defaultOpen={true}
            emptyMessage="Nenhum item atrasado"
            accentClass="border-red-200 bg-red-50 dark:bg-red-950/10 text-red-800 dark:text-red-300"
            {...sharedProps}
          />
          <StatusSection
            title="Em Andamento"
            items={emAndamento}
            defaultOpen={true}
            emptyMessage="Nenhum item em andamento"
            accentClass="border-blue-200 bg-blue-50 dark:bg-blue-950/10 text-blue-800 dark:text-blue-300"
            {...sharedProps}
          />
          <StatusSection
            title="Pendentes"
            items={pendentes}
            defaultOpen={true}
            emptyMessage="Nenhum item pendente"
            accentClass="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10 text-yellow-800 dark:text-yellow-300"
            {...sharedProps}
          />
          <StatusSection
            title="Concluídos"
            items={concluidos}
            defaultOpen={false}
            emptyMessage="Nenhum item concluído ainda"
            accentClass="border-green-200 bg-green-50 dark:bg-green-950/10 text-green-800 dark:text-green-300"
            {...sharedProps}
          />
        </div>
      )}

      {/* Modal de confirmação de execução */}
      {executeModal && (
        <ExecuteModal
          item={executeModal}
          open={!!executeModal}
          onClose={() => setExecuteModal(null)}
          onConfirm={(obs) => executeMutation.mutate({ id: executeModal.id, concluido: true, obs })}
          isLoading={executeMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Formulário de criação/edição ────────────────────────────────────────────
function CronogramaForm({
  item,
  empreendimentos,
  projetos,
  onSubmit,
  isLoading,
}: {
  item: CronogramaItem | null;
  empreendimentos: Empreendimento[];
  projetos: Projeto[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    titulo: item?.titulo || "",
    tipo: item?.tipo || "campanha",
    descricao: item?.descricao || "",
    dataInicio: item?.dataInicio || format(new Date(), "yyyy-MM-dd"),
    dataFim: item?.dataFim || format(new Date(), "yyyy-MM-dd"),
    status: item?.status || "pendente",
    prioridade: item?.prioridade || "media",
    responsavel: item?.responsavel || "",
    empreendimentoId: item?.empreendimentoId ? String(item.empreendimentoId) : "",
    projetoId: item?.projetoId ? String(item.projetoId) : "",
    observacoes: item?.observacoes || "",
    recorrencia: (item as any)?.recorrencia || "nenhuma",
    recorrenciaFim: (item as any)?.recorrenciaFim || "",
  });

  const filteredProjetos = formData.empreendimentoId
    ? projetos.filter(p => p.empreendimentoId === parseInt(formData.empreendimentoId))
    : projetos;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      empreendimentoId: formData.empreendimentoId ? parseInt(formData.empreendimentoId) : null,
      projetoId: formData.projetoId ? parseInt(formData.projetoId) : null,
      recorrencia: formData.recorrencia === "nenhuma" ? null : formData.recorrencia,
      recorrenciaFim: formData.recorrenciaFim || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="titulo">Título *</Label>
          <Input
            id="titulo"
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Campanha de Monitoramento Q1"
            required
            data-testid="input-titulo"
          />
        </div>

        <div>
          <Label htmlFor="tipo">Tipo *</Label>
          <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
            <SelectTrigger data-testid="select-tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
            <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dataInicio">Data Início *</Label>
          <Input id="dataInicio" type="date" value={formData.dataInicio}
            onChange={(e) => setFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
            required data-testid="input-data-inicio" />
        </div>

        <div>
          <Label htmlFor="dataFim">Data Fim *</Label>
          <Input id="dataFim" type="date" value={formData.dataFim}
            onChange={(e) => setFormData(prev => ({ ...prev, dataFim: e.target.value }))}
            required data-testid="input-data-fim" />
        </div>

        <div>
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select value={formData.prioridade} onValueChange={(v) => setFormData(prev => ({ ...prev, prioridade: v }))}>
            <SelectTrigger data-testid="select-prioridade"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORIDADE_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="responsavel">Responsável</Label>
          <Input id="responsavel" value={formData.responsavel}
            onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
            placeholder="Nome do responsável" data-testid="input-responsavel" />
        </div>

        <div>
          <Label htmlFor="empreendimento">Empreendimento *</Label>
          <Select value={formData.empreendimentoId} onValueChange={(v) => setFormData(prev => ({ ...prev, empreendimentoId: v, projetoId: "" }))}>
            <SelectTrigger data-testid="select-empreendimento"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {empreendimentos.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="projeto">Projeto (opcional)</Label>
          <Select value={formData.projetoId || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, projetoId: v === "none" ? "" : v }))}>
            <SelectTrigger data-testid="select-projeto"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {filteredProjetos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Recorrência */}
        <div className="col-span-2 border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Repeat className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold">Recorrência</Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Frequência</Label>
              <Select value={formData.recorrencia} onValueChange={(v) => setFormData(prev => ({ ...prev, recorrencia: v }))}>
                <SelectTrigger data-testid="select-recorrencia"><SelectValue placeholder="Sem recorrência" /></SelectTrigger>
                <SelectContent>
                  {RECORRENCIA_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formData.recorrencia !== "nenhuma" && (
              <div>
                <Label className="text-xs text-muted-foreground">Data final da recorrência</Label>
                <Input type="date" value={formData.recorrenciaFim}
                  onChange={(e) => setFormData(prev => ({ ...prev, recorrenciaFim: e.target.value }))} />
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea id="descricao" value={formData.descricao}
            onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descreva o item do cronograma..." rows={2} data-testid="input-descricao" />
        </div>

        <div className="col-span-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea id="observacoes" value={formData.observacoes}
            onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
            placeholder="Observações adicionais..." rows={2} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isLoading} data-testid="button-submit-cronograma">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {item ? "Salvar Alterações" : "Adicionar ao Cronograma"}
        </Button>
      </div>
    </form>
  );
}
