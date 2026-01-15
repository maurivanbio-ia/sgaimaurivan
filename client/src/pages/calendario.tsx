import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileText,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  parseISO,
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* =========================
   Tipos
========================= */

interface Licenca {
  id: number;
  numero: string;
  tipo: string;
  empreendimentoId: number;
  empreendimentoNome: string;
  validade: string;
  status: string;
}

interface Demanda {
  id: number;
  titulo: string;
  empreendimentoId: number;
  empreendimentoNome: string;
  dataInicio?: string | null;
  dataEntrega: string;
  status: string;
  prioridade: string;
}

interface Condicionante {
  id: number;
  descricao: string;
  licencaId: number;
  licencaNumero: string;
  prazo: string;
  status: string;
}

interface CronogramaItem {
  id: number;
  titulo: string;
  tipo: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  status: string;
  empreendimentoId: number;
  projetoId: number | null;
  responsavel: string | null;
  prioridade: string | null;
}

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string | null;
  dataLimite: string | null;
  prazo: string | null;
  dataFim: string | null;
  status: string;
  prioridade: string;
  responsavelId: number | null;
  visivelCalendarioGeral?: boolean;
}

type EventType = "licenca" | "demanda" | "condicionante" | "cronograma" | "tarefa";

interface CalendarEvent {
  id: string; // id único do evento no calendário
  entityId: string; // id lógico do item original (para contagens e de-dup)
  title: string;
  date: Date;
  type: EventType;
  status: string;
  link: string;
  color: string;
  prioridade?: string;
  cronogramaTipo?: string;
  overdue?: boolean;
}

/* =========================
   Constantes (estáveis)
========================= */

const EVENT_COLORS: Record<EventType, string> = {
  licenca: "#ef4444",
  demanda: "#3b82f6",
  condicionante: "#f59e0b",
  cronograma: "#8b5cf6",
  tarefa: "#10b981",
};

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  urgente: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-yellow-100 text-yellow-800 border-yellow-200",
  baixa: "bg-green-100 text-green-800 border-green-200",
};

const PRIORITY_RANK: Record<string, number> = {
  urgente: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

const EVENT_TYPE_RANK: Record<EventType, number> = {
  licenca: 5,
  condicionante: 4,
  demanda: 3,
  cronograma: 2,
  tarefa: 1,
};

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  licenca: "Licença",
  demanda: "Demanda",
  condicionante: "Condicionante",
  cronograma: "Cronograma",
  tarefa: "Tarefa",
};

const CRONOGRAMA_TIPO_LABEL: Record<string, string> = {
  campanha: "Campanha",
  relatorio: "Relatório",
  marco: "Marco",
};

type EventCountCardKey = "licenca" | "demanda" | "condicionante" | "cronograma" | "tarefa" | "total";

type FilterKey = "todos" | EventType;

type CountCard = {
  key: EventCountCardKey;
  filterKey?: EventType; // para cards clicáveis
  label: string;
  icon: LucideIcon;
  ringClass: string;
  iconBgClass: string;
  iconTextClass: string;
  testId: string;
};

/* =========================
   Helpers (testáveis)
========================= */

function safeParseISO(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Trata "YYYY-MM-DD" como data local (12:00) para reduzir risco de “virar o dia” por timezone/DST.
 * Se não bater com YYYY-MM-DD, cai no safeParseISO.
 */
function parseLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return safeParseISO(dateStr);

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);

  const dt = new Date(y, mo, d, 12, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isDoneStatus(status?: string) {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s.includes("conclu") ||
    s.includes("final") ||
    s === "concluida" ||
    s === "concluído" ||
    s === "concluída" ||
    s === "done" ||
    s === "finalizado" ||
    s === "finalizada"
  );
}

function monthTitle(date: Date) {
  const raw = format(date, "MMMM yyyy", { locale: ptBR });
  return raw.replace(/^\w/, (c) => c.toUpperCase());
}

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function truncate(text: string, max = 45) {
  const t = (text ?? "").trim();
  if (!t) return "Sem descrição";
  return t.length > max ? `${t.substring(0, max)}...` : t;
}

/**
 * Evita explosão de eventos quando demandas têm longos intervalos.
 * Ajuste conforme UX.
 */
function shouldExpandRangeToDailyEvents(start: Date, end: Date, maxDays = 31) {
  const diffDays = Math.ceil((startOfDay(end).getTime() - startOfDay(start).getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return diffDays > 1 && diffDays <= maxDays;
}

/* =========================
   Fetcher (padronizado + erro informativo)
========================= */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const msg = `Falha ao buscar ${url}. HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/* =========================
   UI: Card de contagem clicável
========================= */

function CountCard({
  card,
  count,
  filterType,
  onToggle,
}: {
  card: CountCard;
  count: number;
  filterType: FilterKey;
  onToggle?: (type: EventType) => void;
}) {
  const isActive = card.filterKey ? filterType === card.filterKey : false;

  const clickable = Boolean(card.filterKey && onToggle);

  return (
    <Card
      className={`transition-all ${clickable ? "cursor-pointer" : ""} ${isActive ? card.ringClass : ""}`}
      onClick={() => {
        if (card.filterKey && onToggle) onToggle(card.filterKey);
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") onToggle?.(card.filterKey!);
      }}
      data-testid={card.testId}
      aria-label={clickable ? `Filtrar por ${card.label}` : undefined}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-full ${card.iconBgClass}`}>
          <card.icon className={`h-5 w-5 ${card.iconTextClass}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{count}</p>
          <p className="text-xs text-muted-foreground">{card.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================
   Componente principal
========================= */

export default function Calendario() {
  const [, navigate] = useLocation();

  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [filterType, setFilterType] = React.useState<FilterKey>("todos");

  // Queries em paralelo
  const { data: licencas = [], isLoading: licencasLoading, isError: licencasError } = useQuery<Licenca[]>({
    queryKey: ["/api/licencas"],
    queryFn: () => fetchJson<Licenca[]>("/api/licencas"),
    staleTime: 60_000,
    retry: 2,
  });

  const { data: demandas = [], isLoading: demandasLoading, isError: demandasError } = useQuery<Demanda[]>({
    queryKey: ["/api/demandas"],
    queryFn: () => fetchJson<Demanda[]>("/api/demandas"),
    staleTime: 60_000,
    retry: 2,
  });

  const { data: condicionantes = [], isLoading: condicionantesLoading, isError: condicionantesError } = useQuery<Condicionante[]>({
    queryKey: ["/api/condicionantes"],
    queryFn: () => fetchJson<Condicionante[]>("/api/condicionantes"),
    staleTime: 60_000,
    retry: 2,
  });

  const { data: cronogramaItens = [], isLoading: cronogramaLoading, isError: cronogramaError } = useQuery<CronogramaItem[]>({
    queryKey: ["/api/cronograma"],
    queryFn: () => fetchJson<CronogramaItem[]>("/api/cronograma"),
    staleTime: 60_000,
    retry: 2,
  });

  const { data: tarefas = [], isLoading: tarefasLoading, isError: tarefasError } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
    queryFn: () => fetchJson<Tarefa[]>("/api/tarefas"),
    staleTime: 60_000,
    retry: 2,
  });

  const isLoading = licencasLoading || demandasLoading || condicionantesLoading || cronogramaLoading || tarefasLoading;
  const hasError = licencasError || demandasError || condicionantesError || cronogramaError || tarefasError;

  // Handlers estáveis
  const toggleFilter = React.useCallback((type: EventType) => {
    setFilterType((prev) => (prev === type ? "todos" : type));
  }, []);

  const goPrevMonth = React.useCallback(() => {
    setCurrentDate((prev) => subMonths(prev, 1));
    setSelectedDate(null);
  }, []);

  const goNextMonth = React.useCallback(() => {
    setCurrentDate((prev) => addMonths(prev, 1));
    setSelectedDate(null);
  }, []);

  const goToday = React.useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }, []);

  // Montagem dos eventos (com guardrails para range de demandas)
  const events = React.useMemo(() => {
    const allEvents: CalendarEvent[] = [];
    const today = startOfDay(new Date());

    // Licenças
    for (const lic of licencas) {
      const d = parseLocalDate(lic.validade);
      if (!d) continue;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(lic.status);

      allEvents.push({
        id: `lic-${lic.id}`,
        entityId: `lic-${lic.id}`,
        title: `Venc. Licença: ${lic.numero}`,
        date: d,
        type: "licenca",
        status: lic.status,
        link: `/empreendimentos/${lic.empreendimentoId}`,
        color: EVENT_COLORS.licenca,
        overdue,
      });
    }

    // Demandas
    for (const dem of demandas) {
      const end = parseLocalDate(dem.dataEntrega);
      if (!end) continue;

      const start = parseLocalDate(dem.dataInicio) ?? end;
      const overdue = isBefore(startOfDay(end), today) && !isDoneStatus(dem.status);

      // Se start > end, cai no end como única data
      if (start > end) {
        allEvents.push({
          id: `dem-${dem.id}`,
          entityId: `dem-${dem.id}`,
          title: dem.titulo,
          date: end,
          type: "demanda",
          status: dem.status,
          link: `/demandas`,
          color: EVENT_COLORS.demanda,
          prioridade: dem.prioridade,
          overdue,
        });
        continue;
      }

      // Guardrail: só expande para eventos diários até N dias. Senão, usa um único evento (fim).
      if (shouldExpandRangeToDailyEvents(start, end, 31)) {
        const diasPeriodo = eachDayOfInterval({ start, end });
        diasPeriodo.forEach((dia, idx) => {
          const isPrimeiro = idx === 0;
          const isUltimo = idx === diasPeriodo.length - 1;
          const isUnico = diasPeriodo.length === 1;

          let tituloEvento = dem.titulo;
          if (!isUnico) {
            if (isPrimeiro) tituloEvento = `${dem.titulo} (início)`;
            else if (isUltimo) tituloEvento = `${dem.titulo} (fim)`;
          }

          allEvents.push({
            id: `dem-${dem.id}-${idx}`,
            entityId: `dem-${dem.id}`,
            title: tituloEvento,
            date: dia,
            type: "demanda",
            status: dem.status,
            link: `/demandas`,
            color: EVENT_COLORS.demanda,
            prioridade: dem.prioridade,
            overdue,
          });
        });
      } else {
        allEvents.push({
          id: `dem-${dem.id}`,
          entityId: `dem-${dem.id}`,
          title: `${dem.titulo} (fim)`,
          date: end,
          type: "demanda",
          status: dem.status,
          link: `/demandas`,
          color: EVENT_COLORS.demanda,
          prioridade: dem.prioridade,
          overdue,
        });
      }
    }

    // Condicionantes
    for (const cond of condicionantes) {
      const d = parseLocalDate(cond.prazo);
      if (!d) continue;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(cond.status);

      allEvents.push({
        id: `cond-${cond.id}`,
        entityId: `cond-${cond.id}`,
        title: `Cond.: ${truncate(cond.descricao, 45)}`,
        date: d,
        type: "condicionante",
        status: cond.status,
        link: `/condicionantes/pendentes`,
        color: EVENT_COLORS.condicionante,
        overdue,
      });
    }

    // Cronograma
    for (const item of cronogramaItens) {
      const d = parseLocalDate(item.dataFim);
      if (!d) continue;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(item.status);

      const tipoLabel = CRONOGRAMA_TIPO_LABEL[item.tipo] ?? "Etapa";

      allEvents.push({
        id: `cron-${item.id}`,
        entityId: `cron-${item.id}`,
        title: `${tipoLabel}: ${item.titulo}`,
        date: d,
        type: "cronograma",
        status: item.status,
        link: `/cronograma`,
        color: EVENT_COLORS.cronograma,
        prioridade: item.prioridade || undefined,
        cronogramaTipo: item.tipo,
        overdue,
      });
    }

    // Tarefas
    for (const tarefa of tarefas) {
      if (tarefa.visivelCalendarioGeral === false) continue;

      const tarefaDateStr = tarefa.dataLimite || tarefa.prazo || tarefa.dataFim;
      const d = parseLocalDate(tarefaDateStr);
      if (!d) continue;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(tarefa.status);

      allEvents.push({
        id: `tar-${tarefa.id}`,
        entityId: `tar-${tarefa.id}`,
        title: `Tarefa: ${tarefa.titulo}`,
        date: d,
        type: "tarefa",
        status: tarefa.status,
        link: `/gestao-equipe`,
        color: EVENT_COLORS.tarefa,
        prioridade: tarefa.prioridade,
        overdue,
      });
    }

    return allEvents;
  }, [licencas, demandas, condicionantes, cronogramaItens, tarefas]);

  const filteredEvents = React.useMemo(() => {
    if (filterType === "todos") return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  // Indexação por dia (Map) + ordenação interna para UX
  const eventsByDayKey = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filteredEvents) {
      const key = dayKey(e.date);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }

    const entries = Array.from(map.entries());
    for (const [k, arr] of entries) {
      arr.sort((a: CalendarEvent, b: CalendarEvent) => {
        const oa = a.overdue ? 1 : 0;
        const ob = b.overdue ? 1 : 0;
        if (oa !== ob) return ob - oa;

        const pa = a.prioridade ? (PRIORITY_RANK[a.prioridade] ?? 0) : 0;
        const pb = b.prioridade ? (PRIORITY_RANK[b.prioridade] ?? 0) : 0;
        if (pa !== pb) return pb - pa;

        const ta = EVENT_TYPE_RANK[a.type] ?? 0;
        const tb = EVENT_TYPE_RANK[b.type] ?? 0;
        if (ta !== tb) return tb - ta;

        return a.title.localeCompare(b.title, "pt-BR");
      });

      map.set(k, arr);
    }

    return map;
  }, [filteredEvents]);

  const getEventsForDay = React.useCallback(
    (day: Date) => {
      const key = dayKey(day);
      return eventsByDayKey.get(key) ?? [];
    },
    [eventsByDayKey]
  );

  // Calendário do mês
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // pt-BR: semana começando na segunda
  const firstDayIndex = (monthStart.getDay() + 6) % 7; // segunda=0 ... domingo=6
  const paddingDays = React.useMemo(() => Array(firstDayIndex).fill(null) as Array<null>, [firstDayIndex]);

  const selectedDayEvents = React.useMemo(() => (selectedDate ? getEventsForDay(selectedDate) : []), [selectedDate, getEventsForDay]);

  // Contagens do mês por entidade (não inflar demandas diárias)
  const eventCounts = React.useMemo(() => {
    const thisMonth = filteredEvents.filter((e) => isSameMonth(e.date, currentDate));
    const sets: Record<EventType, Set<string>> = {
      licenca: new Set<string>(),
      demanda: new Set<string>(),
      condicionante: new Set<string>(),
      cronograma: new Set<string>(),
      tarefa: new Set<string>(),
    };

    for (const e of thisMonth) sets[e.type].add(e.entityId);

    return {
      licencas: sets.licenca.size,
      demandas: sets.demanda.size,
      condicionantes: sets.condicionante.size,
      cronograma: sets.cronograma.size,
      tarefas: sets.tarefa.size,
      total: thisMonth.length, // total de eventos no grid (pode inflar com demandas diárias)
    };
  }, [filteredEvents, currentDate]);

  const countCards: readonly CountCard[] = React.useMemo(
    () => [
      {
        key: "licenca",
        filterKey: "licenca",
        label: "Licenças",
        icon: FileText,
        ringClass: "ring-2 ring-red-500",
        iconBgClass: "bg-red-100",
        iconTextClass: "text-red-600",
        testId: "filter-licencas",
      },
      {
        key: "demanda",
        filterKey: "demanda",
        label: "Demandas",
        icon: ClipboardList,
        ringClass: "ring-2 ring-blue-500",
        iconBgClass: "bg-blue-100",
        iconTextClass: "text-blue-600",
        testId: "filter-demandas",
      },
      {
        key: "condicionante",
        filterKey: "condicionante",
        label: "Condicionantes",
        icon: AlertTriangle,
        ringClass: "ring-2 ring-yellow-500",
        iconBgClass: "bg-yellow-100",
        iconTextClass: "text-yellow-600",
        testId: "filter-condicionantes",
      },
      {
        key: "cronograma",
        filterKey: "cronograma",
        label: "Cronograma",
        icon: Target,
        ringClass: "ring-2 ring-purple-500",
        iconBgClass: "bg-purple-100",
        iconTextClass: "text-purple-600",
        testId: "filter-cronograma",
      },
      {
        key: "tarefa",
        filterKey: "tarefa",
        label: "Tarefas",
        icon: CheckCircle,
        ringClass: "ring-2 ring-emerald-500",
        iconBgClass: "bg-emerald-100",
        iconTextClass: "text-emerald-600",
        testId: "filter-tarefas",
      },
      {
        key: "total",
        label: "Total do Mês",
        icon: Clock,
        ringClass: "",
        iconBgClass: "bg-gray-100",
        iconTextClass: "text-gray-600",
        testId: "card-total",
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="p-8 space-y-6">
        <Card className="border-red-500/40">
          <CardHeader>
            <CardTitle className="text-lg text-red-600 dark:text-red-400">Falha ao carregar dados do calendário</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Não foi possível consultar uma ou mais fontes. Verifique conexão, sessão ou permissões.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-green-600" />
            Calendário
          </h1>
          <p className="text-muted-foreground">Acompanhe vencimentos, entregas e compromissos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {countCards.map((card) => {
          const count =
            card.key === "licenca"
              ? eventCounts.licencas
              : card.key === "demanda"
              ? eventCounts.demandas
              : card.key === "condicionante"
              ? eventCounts.condicionantes
              : card.key === "cronograma"
              ? eventCounts.cronograma
              : card.key === "tarefa"
              ? eventCounts.tarefas
              : eventCounts.total;

          return (
            <CountCard
              key={card.key}
              card={card}
              count={count}
              filterType={filterType}
              onToggle={card.filterKey ? toggleFilter : undefined}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{monthTitle(currentDate)}</CardTitle>

              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={goPrevMonth} data-testid="button-prev-month" aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="sm" onClick={goToday} data-testid="button-today" aria-label="Ir para hoje">
                  Hoje
                </Button>

                <Button variant="outline" size="icon" onClick={goNextMonth} data-testid="button-next-month" aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {paddingDays.map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}

              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isSelected = Boolean(selectedDate && isSameDay(day, selectedDate));
                const hasEvents = dayEvents.length > 0;

                const ariaLabel = `Dia ${format(day, "dd/MM/yyyy")}. ${dayEvents.length} ${dayEvents.length === 1 ? "evento" : "eventos"}.`;

                // acessibilidade/UX: diferenciar visualmente dias passados com eventos atrasados
                const overdueCount = dayEvents.reduce((acc, e) => acc + (e.overdue ? 1 : 0), 0);
                const overdueIntensity = clamp(overdueCount, 0, 3); // 0..3

                return (
                  <button
                    key={dayKey(day)}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={`
                      aspect-square p-1 border rounded-lg cursor-pointer transition-all text-left
                      ${isToday(day) ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-100 dark:border-gray-800"}
                      ${isSelected ? "ring-2 ring-primary bg-primary/10" : ""}
                      ${hasEvents ? "hover:bg-muted" : "hover:bg-muted/50"}
                      focus:outline-none focus:ring-2 focus:ring-primary/60
                    `}
                    aria-label={ariaLabel}
                    data-testid={`day-${dayKey(day)}`}
                  >
                    <div className="flex flex-col h-full">
                      <span className={`text-sm ${isToday(day) ? "font-bold text-green-600" : ""}`}>
                        {format(day, "d")}
                      </span>

                      {hasEvents && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: event.color }}
                              title={event.title}
                            />
                          ))}

                          {dayEvents.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{dayEvents.length - 3}</span>
                          )}

                          {overdueIntensity > 0 && (
                            <span
                              className={`text-[10px] ml-auto ${
                                overdueIntensity >= 2 ? "text-red-600" : "text-red-500"
                              }`}
                              title={`${overdueCount} atrasado(s)`}
                            >
                              !
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              {(
                [
                  { type: "licenca", label: "Licenças" },
                  { type: "demanda", label: "Demandas" },
                  { type: "condicionante", label: "Condicionantes" },
                  { type: "cronograma", label: "Cronograma" },
                  { type: "tarefa", label: "Tarefas" },
                ] as const
              ).map((it) => (
                <div key={it.type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EVENT_COLORS[it.type] }} />
                  <span className="text-sm text-muted-foreground">{it.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {!selectedDate ? (
              <p className="text-muted-foreground text-center py-8">
                Clique em um dia do calendário para ver os eventos
              </p>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p className="text-muted-foreground">Nenhum evento neste dia</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(event.link)}
                    data-testid={`event-${event.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") navigate(event.link);
                    }}
                    aria-label={`${EVENT_TYPE_LABEL[event.type]}: ${event.title}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: event.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate">{event.title}</p>
                          {event.overdue && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              Atrasado
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {EVENT_TYPE_LABEL[event.type]}
                          </Badge>

                          {event.prioridade && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${PRIORITY_BADGE_CLASSES[event.prioridade] || ""}`}
                            >
                              {event.prioridade}
                            </Badge>
                          )}

                          {event.cronogramaTipo && (
                            <Badge variant="secondary" className="text-xs">
                              {event.cronogramaTipo}
                            </Badge>
                          )}
                        </div>

                        {event.status && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">Status: {event.status}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
