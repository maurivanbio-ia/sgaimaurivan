import { useState, useMemo } from "react";
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
import {
  format,
  parseISO,
  isPast,
  differenceInDays,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
  min as minDate,
  max as maxDate,
} from "date-fns";
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
  LayoutList,
  GitBranch,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RefreshButton } from "@/components/RefreshButton";
import { formatDateBR } from "@/lib/date-utils";
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
                onEdit={() => { onEdit(item); }}
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

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  atrasado:    { bg: "#fee2e2", text: "#991b1b", border: "#ef4444", dot: "#ef4444" },
  em_andamento:{ bg: "#dbeafe", text: "#1e40af", border: "#3b82f6", dot: "#3b82f6" },
  pendente:    { bg: "#fef9c3", text: "#854d0e", border: "#eab308", dot: "#eab308" },
  concluido:   { bg: "#dcfce7", text: "#166534", border: "#22c55e", dot: "#22c55e" },
};

const TIPO_LABEL: Record<string, string> = {
  campanha: "Campanha", relatorio: "Relatório", marco: "Marco", etapa: "Etapa",
};

// ─── Timeline Horizontal (calendário) ────────────────────────────────────────
const MONTH_W = 140; // px por mês
const BAR_H   = 40;  // altura da barra de meses
const CARD_H  = 108; // altura de cada card flutuante
const LANE_GAP = 8;  // espaço entre lanes

function dateToX(date: Date, rangeStart: Date): number {
  const totalMs = 30 * 24 * 3600 * 1000; // ~1 mês em ms
  const ms = date.getTime() - startOfMonth(rangeStart).getTime();
  return (ms / totalMs) * MONTH_W;
}

function assignLanes(items: CronogramaItem[], rangeStart: Date): Map<number, number> {
  const laneMap = new Map<number, number>();
  const laneEndX: number[] = [];
  const CARD_W = 132;

  const sorted = [...items]
    .filter(i => i.dataFim)
    .sort((a, b) => a.dataFim.localeCompare(b.dataFim));

  for (const item of sorted) {
    const x = dateToX(parseISO(item.dataFim), rangeStart);
    let lane = 0;
    while (laneEndX[lane] !== undefined && laneEndX[lane] > x - 4) lane++;
    laneMap.set(item.id, lane);
    laneEndX[lane] = x + CARD_W;
  }
  return laneMap;
}

function CronogramaTimelineView({
  items,
  empMap,
  projMap,
  onEdit,
  onDelete,
  onToggleExecute,
  executeMutationPending,
}: {
  items: CronogramaItem[];
  empMap: Map<number, string>;
  projMap: Map<number, string>;
  onEdit: (i: CronogramaItem) => void;
  onDelete: (i: CronogramaItem) => void;
  onToggleExecute: (i: CronogramaItem) => void;
  executeMutationPending: boolean;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);

  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const validItems = useMemo(() => items.filter(i => i.dataFim), [items]);

  const { rangeStart, months } = useMemo(() => {
    if (validItems.length === 0) {
      const rs = startOfMonth(addMonths(today, -2));
      const ms = Array.from({ length: 12 }, (_, i) => addMonths(rs, i));
      return { rangeStart: rs, months: ms };
    }
    const dates = validItems.map(i => parseISO(i.dataFim));
    const minD = startOfMonth(addMonths(minDate([...dates, today]), -2));
    const maxD = startOfMonth(addMonths(maxDate([...dates, today]),  2));
    const count = Math.max(differenceInDays(maxD, minD) / 30, 8);
    const ms = Array.from({ length: Math.ceil(count) + 1 }, (_, i) => addMonths(minD, i));
    return { rangeStart: minD, months: ms };
  }, [validItems, today]);

  const laneMap = useMemo(() => assignLanes(validItems, rangeStart), [validItems, rangeStart]);
  const maxLane = useMemo(() => Math.max(0, ...Array.from(laneMap.values())), [laneMap]);

  const totalW = months.length * MONTH_W;
  const cardsAreaH = (maxLane + 1) * (CARD_H + LANE_GAP) + LANE_GAP + 24;

  const todayX = dateToX(today, rangeStart);
  const todayInRange = todayX >= 0 && todayX <= totalW;

  const CARD_W = 132;

  if (validItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum item com datas encontrado no cronograma.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex-row items-center gap-3">
        <CalendarDays className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Timeline Horizontal</CardTitle>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground font-normal">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Atrasado</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Em Andamento</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Pendente</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Concluído</span>
          <span className="flex items-center gap-1"><span className="text-purple-600 font-bold">◆</span>Marco</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div style={{ width: totalW, minWidth: "100%", position: "relative" }}>

            {/* Cards area */}
            <div style={{ height: cardsAreaH, position: "relative", background: "#f8fafc" }}>
              {/* Vertical month guides */}
              {months.map((m, mi) => (
                <div
                  key={mi}
                  style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: mi * MONTH_W, width: 1,
                    background: mi === 0 ? "transparent" : "#e2e8f0",
                    zIndex: 0,
                  }}
                />
              ))}

              {/* Today vertical line */}
              {todayInRange && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: todayX, width: 2, background: "#2563eb", opacity: 0.35, zIndex: 1 }} />
              )}

              {/* Item cards */}
              {validItems.map(item => {
                const st = getItemStatus(item);
                const sc = STATUS_COLOR_MAP[st] ?? STATUS_COLOR_MAP.pendente;
                const isMilestone = item.tipo === "marco";
                const empNome = item.empreendimentoId ? empMap.get(item.empreendimentoId) : null;
                const lane = laneMap.get(item.id) ?? 0;
                const x = dateToX(parseISO(item.dataFim), rangeStart);
                const isActive = activeId === item.id;
                const isOverdue = st === "atrasado";
                const isHoje = item.dataFim === todayStr && !item.concluido;

                const top = LANE_GAP + lane * (CARD_H + LANE_GAP);
                const cardX = Math.max(0, Math.min(x - 6, totalW - CARD_W - 4));

                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveId(isActive ? null : item.id)}
                    style={{
                      position: "absolute",
                      left: cardX,
                      top,
                      width: CARD_W,
                      height: CARD_H,
                      zIndex: isActive ? 30 : 10,
                      cursor: "pointer",
                    }}
                  >
                    {/* Connector dot on card bottom-left */}
                    <div style={{
                      position: "absolute", bottom: -4, left: x - cardX - 5,
                      width: isMilestone ? 12 : 10, height: isMilestone ? 12 : 10,
                      background: sc.dot, borderRadius: isMilestone ? 0 : "50%",
                      transform: isMilestone ? "rotate(45deg)" : "none",
                      border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      zIndex: 20,
                    }} />

                    {/* Vertical tick line */}
                    <div style={{
                      position: "absolute", bottom: 0, left: x - cardX - 0.5,
                      width: 1.5, height: 8,
                      background: sc.dot, zIndex: 15,
                    }} />

                    {/* Card */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0,
                      height: CARD_H - 14,
                      border: `1.5px ${isOverdue ? "dashed" : "solid"} ${isActive ? sc.border : isOverdue ? "#ef4444" : "#cbd5e1"}`,
                      borderRadius: 8,
                      background: isActive ? sc.bg : "#ffffff",
                      padding: "6px 8px",
                      boxShadow: isActive ? `0 4px 16px ${sc.dot}44` : "0 1px 4px rgba(0,0,0,0.08)",
                      transition: "all 0.15s",
                      overflow: "hidden",
                    }}>
                      {/* Date */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: isOverdue ? "#dc2626" : "#475569", marginBottom: 2 }}>
                        {isHoje ? "⚡ Hoje" : isOverdue ? "⚠ " + formatDateBR(item.dataFim) : formatDateBR(item.dataFim)}
                      </div>
                      {/* Title */}
                      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, color: item.concluido ? "#94a3b8" : "#1e293b",
                        textDecoration: item.concluido ? "line-through" : "none",
                        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                        {isMilestone && "◆ "}{item.titulo}
                      </div>
                      {/* Type */}
                      <div style={{ fontSize: 9, color: "#64748b", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {TIPO_LABEL[item.tipo] ?? item.tipo}
                      </div>
                      {/* Emp */}
                      {empNome && (
                        <div style={{ fontSize: 9, color: "#64748b", marginTop: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          🏗 {empNome}
                        </div>
                      )}
                      {/* Responsible */}
                      {item.responsavel && (
                        <div style={{ fontSize: 9, color: "#64748b", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          👤 {item.responsavel}
                        </div>
                      )}
                    </div>

                    {/* Expanded actions panel */}
                    {isActive && (
                      <div style={{
                        position: "absolute", top: CARD_H - 14 + 4, left: 0, width: CARD_W + 16,
                        background: "#1e293b", borderRadius: 8, padding: "6px 8px",
                        display: "flex", gap: 4, zIndex: 40,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                      }}>
                        <button
                          onClick={e => { e.stopPropagation(); onToggleExecute(item); setActiveId(null); }}
                          disabled={executeMutationPending}
                          style={{ flex: 1, fontSize: 10, color: "#86efac", background: "transparent", border: "1px solid #86efac22", borderRadius: 4, padding: "3px 2px", cursor: "pointer" }}
                          title={item.concluido ? "Reabrir" : "Concluir"}
                        >
                          {item.concluido ? "↩ Reabrir" : "✓ Concluir"}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onEdit(item); setActiveId(null); }}
                          style={{ flex: 1, fontSize: 10, color: "#93c5fd", background: "transparent", border: "1px solid #93c5fd22", borderRadius: 4, padding: "3px 2px", cursor: "pointer" }}
                        >
                          ✎ Editar
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(item); setActiveId(null); }}
                          style={{ flex: 1, fontSize: 10, color: "#fca5a5", background: "transparent", border: "1px solid #fca5a522", borderRadius: 4, padding: "3px 2px", cursor: "pointer" }}
                        >
                          ✕ Excluir
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Month bar */}
            <div style={{ display: "flex", height: BAR_H, position: "relative" }}>
              {months.map((m, mi) => {
                const isCurrentMonth = format(m, "yyyy-MM") === format(today, "yyyy-MM");
                const isPast = m < startOfMonth(today);
                return (
                  <div
                    key={mi}
                    style={{
                      width: MONTH_W, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: isCurrentMonth ? "#0369a1" : isPast ? "#334155" : "#1e7a45",
                      color: isCurrentMonth ? "#fff" : isPast ? "#94a3b8" : "#d1fae5",
                      borderRight: "1px solid rgba(255,255,255,0.1)",
                      position: "relative",
                      cursor: "default",
                    }}
                  >
                    {isCurrentMonth && (
                      <span style={{
                        position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)",
                        color: "#2563eb", fontSize: 14, filter: "drop-shadow(0 0 3px #2563eb88)",
                      }}>◆</span>
                    )}
                    {format(m, "MMM", { locale: ptBR }).toUpperCase()}
                  </div>
                );
              })}

              {/* Today marker on bar */}
              {todayInRange && (
                <div style={{
                  position: "absolute", top: 0, bottom: 0, left: todayX,
                  width: 2, background: "#2563eb", zIndex: 20,
                }} />
              )}
            </div>

            {/* Year labels */}
            <div style={{ display: "flex", height: 22, background: "#f1f5f9", borderTop: "1px solid #e2e8f0" }}>
              {months.map((m, mi) => {
                const showYear = mi === 0 || format(m, "MM") === "01";
                return (
                  <div key={mi} style={{ width: MONTH_W, flexShrink: 0, position: "relative" }}>
                    {showYear && (
                      <span style={{
                        position: "absolute", left: 6, top: 3,
                        fontSize: 10, color: "#64748b", fontWeight: 600,
                      }}>
                        {format(m, "yyyy")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground px-4 py-2 border-t bg-gray-50 flex items-center gap-2">
          <span className="text-blue-600 font-bold">◆</span>
          <span>Mês atual destacado em azul</span>
          <span className="mx-2 text-gray-300">|</span>
          <span>Clique em um card para ver as ações</span>
          <span className="mx-2 text-gray-300">|</span>
          <span>Borda tracejada = item atrasado</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Gantt Cronograma ─────────────────────────────────────────────────────────
const GANTT_ROW_H = 42;
const GANTT_LABEL_W = 270;

function CronogramaGanttView({
  items,
  empMap,
  projMap,
}: {
  items: CronogramaItem[];
  empMap: Map<number, string>;
  projMap: Map<number, string>;
}) {
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const validItems = useMemo(() =>
    items.filter(i => i.dataInicio && i.dataFim),
  [items]);

  const { rangeStart, totalDays } = useMemo(() => {
    if (validItems.length === 0) {
      const rs = addDays(today, -7);
      return { rangeStart: rs, totalDays: 45 };
    }
    const starts = validItems.map(i => parseISO(i.dataInicio));
    const ends   = validItems.map(i => parseISO(i.dataFim));
    const minD = startOfDay(addDays(minDate(starts), -3));
    const maxD = startOfDay(addDays(maxDate(ends),   5));
    const days = Math.max(differenceInDays(maxD, minD) + 1, 30);
    return { rangeStart: minD, totalDays: days };
  }, [validItems, today]);

  const sorted = useMemo(() =>
    [...validItems].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)),
  [validItems]);

  const dayPct = 100 / totalDays;

  // Month headers
  const months = useMemo(() => {
    const result: { label: string; startDay: number; span: number }[] = [];
    let cur = startOfMonth(rangeStart);
    const rangeEnd = addDays(rangeStart, totalDays - 1);
    while (cur <= rangeEnd) {
      const mStart = Math.max(differenceInDays(cur, rangeStart), 0);
      const mEnd   = Math.min(differenceInDays(endOfMonth(cur), rangeStart), totalDays - 1);
      if (mEnd >= 0) {
        result.push({ label: format(cur, "MMM yyyy", { locale: ptBR }), startDay: mStart, span: mEnd - mStart + 1 });
      }
      cur = addMonths(startOfMonth(cur), 1);
    }
    return result;
  }, [rangeStart, totalDays]);

  const todayOffset = useMemo(() => {
    const diff = differenceInDays(today, rangeStart);
    if (diff < 0 || diff >= totalDays) return null;
    return diff * dayPct;
  }, [today, rangeStart, totalDays, dayPct]);

  const getBarStyle = (item: CronogramaItem) => {
    const startDay = Math.max(differenceInDays(parseISO(item.dataInicio), rangeStart), 0);
    const endDay   = Math.min(differenceInDays(parseISO(item.dataFim),   rangeStart), totalDays - 1);
    return {
      left:  `${startDay * dayPct}%`,
      width: `${Math.max((endDay - startDay + 1) * dayPct, dayPct * 0.5)}%`,
    };
  };

  const barColor = (item: CronogramaItem) => {
    const st = getItemStatus(item);
    if (st === "concluido")    return { bg: "#22c55e", fg: "#fff" };
    if (st === "atrasado")     return { bg: "#ef4444", fg: "#fff" };
    if (st === "em_andamento") return { bg: "#3b82f6", fg: "#fff" };
    return { bg: "#eab308", fg: "#fff" };
  };

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum item com datas encontrado.</p>
        </CardContent>
      </Card>
    );
  }

  const chartH = sorted.length * GANTT_ROW_H + 56;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-5 w-5" />
          Gantt do Cronograma
          <span className="ml-auto flex gap-4 text-xs font-normal text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-400" />Atrasado</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />Em Andamento</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-400" />Pendente</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-400" />Concluído</span>
            <span className="flex items-center gap-1"><span className="text-purple-600 font-bold text-base">◆</span>Marco</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pr-0">
        <div style={{ minWidth: `${GANTT_LABEL_W + 600}px` }}>
          {/* Month headers */}
          <div className="flex" style={{ marginLeft: GANTT_LABEL_W }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="border-r border-gray-200 text-xs text-center py-1 font-semibold text-gray-500 bg-gray-50"
                style={{ width: `${m.span * dayPct}%`, flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap" }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="relative" style={{ height: chartH }}>
            {/* Label column */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col" style={{ width: GANTT_LABEL_W, zIndex: 10 }}>
              <div style={{ height: 28 }} className="border-b border-gray-200 bg-white" />
              {sorted.map(item => {
                const st = getItemStatus(item);
                const sc = STATUS_COLOR_MAP[st] ?? STATUS_COLOR_MAP.pendente;
                const empNome = item.empreendimentoId ? empMap.get(item.empreendimentoId) : null;
                return (
                  <div
                    key={item.id}
                    className="border-b border-gray-100 bg-white flex items-center gap-2 px-3"
                    style={{ height: GANTT_ROW_H }}
                  >
                    <div className={cn("w-2 h-2 flex-shrink-0", item.tipo === "marco" ? "rotate-45 rounded-none" : "rounded-full")}
                      style={{ backgroundColor: sc.dot }} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium leading-tight truncate", item.concluido ? "line-through text-muted-foreground" : "")}>
                        {item.tipo === "marco" && "◆ "}{item.titulo}
                      </p>
                      {empNome && <p className="text-[10px] text-muted-foreground truncate">{empNome}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid + bars */}
            <div className="absolute top-0 bottom-0 overflow-hidden" style={{ left: GANTT_LABEL_W, right: 0 }}>
              {/* Week grid lines */}
              <div className="absolute inset-0">
                {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, wi) => (
                  <div key={wi} className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${wi * 7 * dayPct}%` }} />
                ))}
              </div>

              {/* Day header */}
              <div className="absolute top-0 left-0 right-0 border-b border-gray-200" style={{ height: 28 }}>
                {Array.from({ length: totalDays }).map((_, di) => {
                  const d = addDays(rangeStart, di);
                  const isWknd = [0,6].includes(d.getDay());
                  const isTod = format(d, "yyyy-MM-dd") === todayStr;
                  return (
                    <div key={di} className="absolute top-0 bottom-0 flex items-center justify-center text-[9px]"
                      style={{ left: `${di * dayPct}%`, width: `${dayPct}%`,
                        color: isTod ? "#2563eb" : isWknd ? "#d1d5db" : "#9ca3af", fontWeight: isTod ? 700 : 400 }}>
                      {di % 3 === 0 ? format(d, "d") : ""}
                    </div>
                  );
                })}
              </div>

              {/* Today line */}
              {todayOffset !== null && (
                <div className="absolute top-0 bottom-0 w-0.5 z-20" style={{ left: `${todayOffset}%`, backgroundColor: "#2563eb", opacity: 0.7 }}>
                  <div className="absolute -top-0.5 -translate-x-1/2 text-[9px] bg-blue-600 text-white px-1 rounded" style={{ whiteSpace: "nowrap" }}>Hoje</div>
                </div>
              )}

              {/* Rows */}
              {sorted.map((item, i) => {
                const isMilestone = item.tipo === "marco";
                const bc = barColor(item);
                const barStyle = getBarStyle(item);
                const st = getItemStatus(item);
                const isOverdue = st === "atrasado";

                return (
                  <div key={item.id} className="absolute left-0 right-0 border-b border-gray-50"
                    style={{ top: 28 + i * GANTT_ROW_H, height: GANTT_ROW_H }}>

                    {/* Weekend shading */}
                    {Array.from({ length: totalDays }).map((_, di) => {
                      const d = addDays(rangeStart, di);
                      if (![0,6].includes(d.getDay())) return null;
                      return <div key={di} className="absolute top-0 bottom-0 bg-gray-50"
                        style={{ left: `${di * dayPct}%`, width: `${dayPct}%` }} />;
                    })}

                    {isMilestone ? (
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: barStyle.left }} title={`Marco: ${item.titulo}`}>
                        <div className="text-purple-600 drop-shadow" style={{ fontSize: 20, lineHeight: 1 }}>◆</div>
                      </div>
                    ) : (
                      <div className="absolute top-2 bottom-2 rounded flex items-center px-1.5 overflow-hidden"
                        style={{ left: barStyle.left, width: barStyle.width, backgroundColor: bc.bg,
                          outline: isOverdue ? "2px solid #ef4444" : "none", outlineOffset: "1px" }}
                        title={item.titulo}>
                        <span className="text-[10px] font-medium truncate" style={{ color: bc.fg }}>{item.titulo}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-right py-1 pr-4 border-t border-gray-100 bg-gray-50">
            ◆ Marco = milestone de data única &nbsp;|&nbsp; Linha azul = hoje &nbsp;|&nbsp; Contorno vermelho = atrasado
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function CronogramaPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CronogramaItem | null>(null);
  const [executeModal, setExecuteModal] = useState<CronogramaItem | null>(null);
  const [filters, setFilters] = useState({ tipo: "todos", status: "todos", empreendimentoId: "", projetoId: "" });
  const [viewMode, setViewMode] = useState<"lista" | "timeline" | "gantt">("lista");

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
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            Cronograma de Projetos
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === "lista" && "Gerencie campanhas, relatórios e marcos dos seus projetos"}
            {viewMode === "timeline" && "Linha do tempo ordenada por prazo de conclusão"}
            {viewMode === "gantt" && "Gráfico de Gantt com marcação de marcos (◆)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* View toggle */}
          <div className="flex rounded-lg border overflow-hidden shadow-sm">
            {([
              { key: "lista",    icon: <LayoutList className="h-4 w-4" />,  label: "Lista" },
              { key: "timeline", icon: <CalendarDays className="h-4 w-4" />, label: "Timeline" },
              { key: "gantt",    icon: <GitBranch className="h-4 w-4" />,   label: "Gantt" },
            ] as const).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                )}
                title={label}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
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
              <Select value={filters.status} onValueChange={(v) => { setFilters(prev => ({ ...prev, status: v })); }}>
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

      {/* Views */}
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
      ) : viewMode === "lista" ? (
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
      ) : viewMode === "timeline" ? (
        <CronogramaTimelineView
          items={cronogramaItens}
          empMap={empMap}
          projMap={projMap}
          onEdit={sharedProps.onEdit}
          onDelete={sharedProps.onDelete}
          onToggleExecute={handleToggleExecute}
          executeMutationPending={executeMutation.isPending}
        />
      ) : (
        <CronogramaGanttView
          items={cronogramaItens}
          empMap={empMap}
          projMap={projMap}
        />
      )}

      {/* Modal de confirmação de execução */}
      {executeModal && (
        <ExecuteModal
          item={executeModal}
          open={!!executeModal}
          onClose={() => setExecuteModal(null)}
          onConfirm={(obs) => { executeMutation.mutate({ id: executeModal.id, concluido: true, obs }); }}
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
          <Select value={formData.status} onValueChange={(v) => { setFormData(prev => ({ ...prev, status: v })); }}>
            <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dataInicio">Data Início *</Label>
          <Input id="dataInicio" type="date" value={formData.dataInicio}
            onChange={(e) => { setFormData(prev => ({ ...prev, dataInicio: e.target.value })); }}
            required data-testid="input-data-inicio" />
        </div>

        <div>
          <Label htmlFor="dataFim">Data Fim *</Label>
          <Input id="dataFim" type="date" value={formData.dataFim}
            onChange={(e) => { setFormData(prev => ({ ...prev, dataFim: e.target.value })); }}
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
          <Select value={formData.empreendimentoId} onValueChange={(v) => { setFormData(prev => ({ ...prev, empreendimentoId: v, projetoId: "" })); }}>
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
