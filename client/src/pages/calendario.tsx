import { useState, useMemo, useCallback, useEffect, useRef, useDeferredValue } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

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
  Search,
  X,
  List,
  LayoutGrid,
  RefreshCcw,
  Filter,
  Slash,
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
  addDays,
  isAfter,
  max as dfMax,
  min as dfMin,
  differenceInCalendarDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

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
type ViewMode = "month" | "agenda";
type AgendaRange = "hoje" | "7d" | "30d";

interface CalendarEvent {
  id: string;
  entityId: string;
  title: string;
  date: Date;
  type: EventType;
  status: string;
  link: string;
  prioridade?: string;
  cronogramaTipo?: string;
  overdue?: boolean;

  empreendimentoId?: number;
  empreendimentoNome?: string;
  licencaNumero?: string;

  rangeStart?: Date | null;
  rangeEnd?: Date | null;

  searchText: string;
}

/* =========================
   Constantes
   ========================= */

const LS_KEY = "calendario:pref:v3";

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

const EVENT_DOT_CLASS: Record<EventType, string> = {
  licenca: "bg-red-500",
  demanda: "bg-blue-500",
  condicionante: "bg-amber-500",
  cronograma: "bg-purple-500",
  tarefa: "bg-emerald-500",
};

const PRIORITY_CLASS: Record<string, string> = {
  urgente: "border-red-300 text-red-700 bg-red-50 dark:border-red-900/40 dark:text-red-200 dark:bg-red-900/20",
  alta: "border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-900/40 dark:text-orange-200 dark:bg-orange-900/20",
  media: "border-yellow-300 text-yellow-800 bg-yellow-50 dark:border-yellow-900/40 dark:text-yellow-200 dark:bg-yellow-900/20",
  baixa: "border-emerald-300 text-emerald-800 bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-200 dark:bg-emerald-900/20",
};

const PRIORITY_RANK: Record<string, number> = {
  urgente: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

type StoredPrefs = {
  viewMode: ViewMode;
  filterType: "todos" | EventType;
  agendaRange: AgendaRange;
  onlyOverdue: boolean;
};

function readPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { viewMode: "month", filterType: "todos", agendaRange: "7d", onlyOverdue: false };

    const p = JSON.parse(raw) as Partial<StoredPrefs>;
    const filterType =
      p.filterType === "licenca" ||
      p.filterType === "demanda" ||
      p.filterType === "condicionante" ||
      p.filterType === "cronograma" ||
      p.filterType === "tarefa"
        ? p.filterType
        : "todos";

    const agendaRange = p.agendaRange === "hoje" || p.agendaRange === "30d" ? p.agendaRange : "7d";
    const viewMode = p.viewMode === "agenda" ? "agenda" : "month";
    const onlyOverdue = Boolean(p.onlyOverdue);

    return { viewMode, filterType, agendaRange, onlyOverdue };
  } catch {
    return { viewMode: "month", filterType: "todos", agendaRange: "7d", onlyOverdue: false };
  }
}

function writePrefs(prefs: StoredPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    void 0;
  }
}

function safeParseISO(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

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

function getTipoLabel(type: EventType) {
  switch (type) {
    case "licenca":
      return "Licença";
    case "demanda":
      return "Demanda";
    case "condicionante":
      return "Condicionante";
    case "cronograma":
      return "Cronograma";
    case "tarefa":
      return "Tarefa";
  }
}

function isDoneStatus(status?: string) {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s.includes("conclu") || s.includes("final") || s.includes("encerr") || s === "done" || s === "ok";
}

function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function daysToLabel(target: Date, now: Date, done?: boolean) {
  if (done) return "Concluído";
  const a = startOfDay(now);
  const b = startOfDay(target);
  const diff = differenceInCalendarDays(b, a);

  if (diff === 0) return "Vence hoje";
  if (diff === 1) return "Vence amanhã";
  if (diff > 1) return `Vence em ${diff} dias`;
  return `Atrasado há ${Math.abs(diff)} dias`;
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  const oa = a.overdue ? 1 : 0;
  const ob = b.overdue ? 1 : 0;
  if (oa !== ob) return ob - oa;

  const pa = a.prioridade ? PRIORITY_RANK[a.prioridade] ?? 0 : 0;
  const pb = b.prioridade ? PRIORITY_RANK[b.prioridade] ?? 0 : 0;
  if (pa !== pb) return pb - pa;

  const typeRank: Record<EventType, number> = {
    licenca: 5,
    condicionante: 4,
    demanda: 3,
    cronograma: 2,
    tarefa: 1,
  };
  const ta = typeRank[a.type] ?? 0;
  const tb = typeRank[b.type] ?? 0;
  if (ta !== tb) return tb - ta;

  return a.title.localeCompare(b.title, "pt-BR");
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const as = startOfDay(aStart).getTime();
  const ae = startOfDay(aEnd).getTime();
  const bs = startOfDay(bStart).getTime();
  const be = startOfDay(bEnd).getTime();
  return as <= be && bs <= ae;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);

  if (res.status === 204 || res.status === 404) return ([] as unknown) as T;

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Falha ao buscar dados (${res.status}).`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    if (!txt) return ([] as unknown) as T;
    throw new Error("Resposta inesperada. Conteúdo não JSON.");
  }

  return (await res.json()) as T;
}

/* =========================
   Componente
   ========================= */

export default function Calendario() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [prefs, setPrefs] = useState<StoredPrefs>(() => readPrefs());

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const debouncedSearch = useMemo(() => normalizeText(deferredSearch), [deferredSearch]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    writePrefs(prefs);
  }, [prefs]);

  const setViewMode = useCallback((viewMode: ViewMode) => setPrefs((p) => ({ ...p, viewMode })), []);
  const setFilterType = useCallback((filterType: "todos" | EventType) => setPrefs((p) => ({ ...p, filterType })), []);
  const setAgendaRange = useCallback((agendaRange: AgendaRange) => setPrefs((p) => ({ ...p, agendaRange })), []);
  const setOnlyOverdue = useCallback((onlyOverdue: boolean) => setPrefs((p) => ({ ...p, onlyOverdue })), []);

  const results = useQueries({
    queries: [
      { queryKey: ["/api/licencas"], queryFn: () => fetcher<Licenca[]>("/api/licencas"), staleTime: 60_000, retry: 2 },
      { queryKey: ["/api/demandas"], queryFn: () => fetcher<Demanda[]>("/api/demandas"), staleTime: 60_000, retry: 2 },
      { queryKey: ["/api/condicionantes"], queryFn: () => fetcher<Condicionante[]>("/api/condicionantes"), staleTime: 60_000, retry: 2 },
      { queryKey: ["/api/cronograma"], queryFn: () => fetcher<CronogramaItem[]>("/api/cronograma"), staleTime: 60_000, retry: 2 },
      { queryKey: ["/api/tarefas"], queryFn: () => fetcher<Tarefa[]>("/api/tarefas"), staleTime: 60_000, retry: 2 },
    ],
  });

  const [licencasQ, demandasQ, condicionantesQ, cronogramaQ, tarefasQ] = results;

  const anyLoading = results.some((r) => r.isLoading);
  const anyFetching = results.some((r) => r.isFetching);

  const errorSources = useMemo(() => {
    const errs: Array<{ name: string; message: string; refetch: () => void }> = [];

    if (licencasQ.isError) errs.push({ name: "Licenças", message: (licencasQ.error as any)?.message || "Erro", refetch: licencasQ.refetch });
    if (demandasQ.isError) errs.push({ name: "Demandas", message: (demandasQ.error as any)?.message || "Erro", refetch: demandasQ.refetch });
    if (condicionantesQ.isError) errs.push({ name: "Condicionantes", message: (condicionantesQ.error as any)?.message || "Erro", refetch: condicionantesQ.refetch });
    if (cronogramaQ.isError) errs.push({ name: "Cronograma", message: (cronogramaQ.error as any)?.message || "Erro", refetch: cronogramaQ.refetch });
    if (tarefasQ.isError) errs.push({ name: "Tarefas", message: (tarefasQ.error as any)?.message || "Erro", refetch: tarefasQ.refetch });

    return errs;
  }, [licencasQ.isError, demandasQ.isError, condicionantesQ.isError, cronogramaQ.isError, tarefasQ.isError, licencasQ.error, demandasQ.error, condicionantesQ.error, cronogramaQ.error, tarefasQ.error, licencasQ.refetch, demandasQ.refetch, condicionantesQ.refetch, cronogramaQ.refetch, tarefasQ.refetch]);

  const refetchAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["/api/licencas"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/condicionantes"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
  }, [queryClient]);

  const resetFilters = useCallback(() => {
    setPrefs((p) => ({ ...p, filterType: "todos", onlyOverdue: false }));
    setSearch("");
    setSelectedDate(null);
  }, []);

  const goPrevMonth = useCallback(() => {
    setCurrentDate((d) => subMonths(d, 1));
    setSelectedDate(null);
  }, []);

  const goNextMonth = useCallback(() => {
    setCurrentDate((d) => addMonths(d, 1));
    setSelectedDate(null);
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }, []);

  /* =========================
     Construção dos eventos
     ========================= */

  const events = useMemo<CalendarEvent[]>(() => {
    const all: CalendarEvent[] = [];
    const today = startOfDay(new Date());

    const licencas = (licencasQ.data ?? []) as Licenca[];
    const demandas = (demandasQ.data ?? []) as Demanda[];
    const condicionantes = (condicionantesQ.data ?? []) as Condicionante[];
    const cronograma = (cronogramaQ.data ?? []) as CronogramaItem[];
    const tarefas = (tarefasQ.data ?? []) as Tarefa[];

    for (const lic of licencas) {
      const d = parseLocalDate(lic.validade);
      if (!d) continue;

      const done = isDoneStatus(lic.status);
      const overdue = isBefore(startOfDay(d), today) && !done;

      const title = `Venc. Licença: ${lic.numero}`;
      const searchText = normalizeText(`${title} ${lic.numero} ${lic.tipo} ${lic.empreendimentoNome} ${lic.status}`);

      all.push({
        id: `lic-${lic.id}`,
        entityId: `lic-${lic.id}`,
        title,
        date: d,
        type: "licenca",
        status: lic.status,
        link: `/empreendimentos/${lic.empreendimentoId}`,
        overdue,
        empreendimentoId: lic.empreendimentoId,
        empreendimentoNome: lic.empreendimentoNome,
        searchText,
      });
    }

    for (const dem of demandas) {
      const end = parseLocalDate(dem.dataEntrega);
      if (!end) continue;

      const start = parseLocalDate(dem.dataInicio) ?? end;

      const done = isDoneStatus(dem.status);
      const overdue = isBefore(startOfDay(end), today) && !done;

      const title = dem.titulo;
      const pri = normalizeText(dem.prioridade || "");
      const searchText = normalizeText(`${title} ${dem.empreendimentoNome} ${dem.status} ${dem.prioridade}`);

      all.push({
        id: `dem-${dem.id}`,
        entityId: `dem-${dem.id}`,
        title,
        date: end,
        type: "demanda",
        status: dem.status,
        link: `/demandas`,
        prioridade: pri || undefined,
        overdue,
        empreendimentoId: dem.empreendimentoId,
        empreendimentoNome: dem.empreendimentoNome,
        rangeStart: start,
        rangeEnd: end,
        searchText,
      });
    }

    for (const cond of condicionantes) {
      const d = parseLocalDate(cond.prazo);
      if (!d) continue;

      const done = isDoneStatus(cond.status);
      const overdue = isBefore(startOfDay(d), today) && !done;

      const desc = cond.descricao?.trim() || "Sem descrição";
      const title = desc.length > 52 ? `Cond.: ${desc.substring(0, 52)}...` : `Cond.: ${desc}`;
      const searchText = normalizeText(`${title} ${desc} ${cond.licencaNumero} ${cond.status}`);

      all.push({
        id: `cond-${cond.id}`,
        entityId: `cond-${cond.id}`,
        title,
        date: d,
        type: "condicionante",
        status: cond.status,
        link: `/condicionantes/pendentes`,
        overdue,
        licencaNumero: cond.licencaNumero,
        searchText,
      });
    }

    for (const item of cronograma) {
      const end = parseLocalDate(item.dataFim);
      if (!end) continue;

      const start = parseLocalDate(item.dataInicio) ?? end;

      const done = isDoneStatus(item.status);
      const overdue = isBefore(startOfDay(end), today) && !done;

      const tipoLabel =
        item.tipo === "campanha" ? "Campanha" : item.tipo === "relatorio" ? "Relatório" : item.tipo === "marco" ? "Marco" : "Etapa";

      const title = `${tipoLabel}: ${item.titulo}`;
      const pri = item.prioridade ? normalizeText(item.prioridade) : "";
      const searchText = normalizeText(`${title} ${item.tipo} ${item.status} ${item.responsavel || ""} ${item.prioridade || ""}`);

      all.push({
        id: `cron-${item.id}`,
        entityId: `cron-${item.id}`,
        title,
        date: end,
        type: "cronograma",
        status: item.status,
        link: `/cronograma`,
        prioridade: pri || undefined,
        cronogramaTipo: item.tipo,
        overdue,
        empreendimentoId: item.empreendimentoId,
        rangeStart: start,
        rangeEnd: end,
        searchText,
      });
    }

    for (const tarefa of tarefas) {
      if (tarefa.visivelCalendarioGeral === false) continue;

      const dateStr = tarefa.dataLimite || tarefa.prazo || tarefa.dataFim;
      const d = parseLocalDate(dateStr);
      if (!d) continue;

      const done = isDoneStatus(tarefa.status);
      const overdue = isBefore(startOfDay(d), today) && !done;

      const title = `Tarefa: ${tarefa.titulo}`;
      const pri = normalizeText(tarefa.prioridade || "");
      const searchText = normalizeText(`${title} ${tarefa.status} ${tarefa.prioridade} ${tarefa.descricao || ""}`);

      all.push({
        id: `tar-${tarefa.id}`,
        entityId: `tar-${tarefa.id}`,
        title,
        date: d,
        type: "tarefa",
        status: tarefa.status,
        link: `/gestao-equipe`,
        prioridade: pri || undefined,
        overdue,
        searchText,
      });
    }

    return all;
  }, [licencasQ.data, demandasQ.data, condicionantesQ.data, cronogramaQ.data, tarefasQ.data]);

  /* =========================
     Filtros e busca
     ========================= */

  const filteredEvents = useMemo(() => {
    let list = events;

    if (prefs.filterType !== "todos") list = list.filter((e) => e.type === prefs.filterType);
    if (prefs.onlyOverdue) list = list.filter((e) => Boolean(e.overdue) && !isDoneStatus(e.status));
    if (debouncedSearch) list = list.filter((e) => e.searchText.includes(debouncedSearch));

    return list;
  }, [events, prefs.filterType, prefs.onlyOverdue, debouncedSearch]);

  /* =========================
     Datas do mês atual
     ========================= */

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const daysInMonth = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  const firstDayIndex = useMemo(() => (monthStart.getDay() + 6) % 7, [monthStart]);
  const paddingDays = useMemo(() => Array.from({ length: firstDayIndex }), [firstDayIndex]);

  /* =========================
     Indexação por dia
     ========================= */

  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const start = startOfDay(monthStart);
    const end = startOfDay(monthEnd);

    for (const e of filteredEvents) {
      const rs = e.rangeStart ? startOfDay(e.rangeStart) : null;
      const re = e.rangeEnd ? startOfDay(e.rangeEnd) : null;

      if (rs && re && (e.type === "demanda" || e.type === "cronograma")) {
        const from = dfMax([rs, start]);
        const to = dfMin([re, end]);

        if (isAfter(from, to)) continue;

        const days = eachDayOfInterval({ start: from, end: to });
        for (const d of days) {
          const key = format(d, "yyyy-MM-dd");
          const arr = map.get(key);
          if (arr) arr.push(e);
          else map.set(key, [e]);
        }
        continue;
      }

      const d = startOfDay(e.date);
      if (isBefore(d, start) || isAfter(d, end)) continue;

      const key = format(d, "yyyy-MM-dd");
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }

    for (const [k, arr] of map.entries()) {
      const dedup = new Map<string, CalendarEvent>();
      for (const it of arr) dedup.set(it.entityId, it);
      map.set(k, Array.from(dedup.values()).sort(sortEvents));
    }

    return map;
  }, [filteredEvents, monthStart, monthEnd]);

  const getEventsForDay = useCallback(
    (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      return eventsByDayKey.get(key) ?? [];
    },
    [eventsByDayKey]
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDay(selectedDate);
  }, [selectedDate, getEventsForDay]);

  /* =========================
     KPI e contagens
     ========================= */

  const monthKPIs = useMemo(() => {
    const monthStartDay = startOfDay(startOfMonth(currentDate));
    const monthEndDay = startOfDay(endOfMonth(currentDate));

    const thisMonth = filteredEvents.filter((e) => {
      if (e.rangeStart && e.rangeEnd && (e.type === "demanda" || e.type === "cronograma")) {
        return rangesOverlap(e.rangeStart, e.rangeEnd, monthStartDay, monthEndDay);
      }
      return isSameMonth(e.date, currentDate);
    });

    const today = startOfDay(new Date());
    const in7 = addDays(today, 7);

    const sets: Record<EventType, Set<string>> = {
      licenca: new Set(),
      demanda: new Set(),
      condicionante: new Set(),
      cronograma: new Set(),
      tarefa: new Set(),
    };

    let overdueCount = 0;
    let due7Count = 0;

    for (const e of thisMonth) {
      sets[e.type].add(e.entityId);

      const dueDate = startOfDay(e.date);
      const done = isDoneStatus(e.status);

      if (!done && isBefore(dueDate, today)) overdueCount += 1;
      if (!done && (isSameDay(dueDate, today) || (isAfter(dueDate, today) && !isAfter(dueDate, in7)))) due7Count += 1;
    }

    const totalEntities = Object.values(sets).reduce((acc, s) => acc + s.size, 0);

    return {
      licencas: sets.licenca.size,
      demandas: sets.demanda.size,
      condicionantes: sets.condicionante.size,
      cronograma: sets.cronograma.size,
      tarefas: sets.tarefa.size,
      totalEntities,
      overdueCount,
      due7Count,
    };
  }, [filteredEvents, currentDate]);

  /* =========================
     Agenda view
     ========================= */

  const agendaWindow = useMemo(() => {
    const today = startOfDay(new Date());
    if (prefs.agendaRange === "hoje") return { start: today, end: today };
    if (prefs.agendaRange === "30d") return { start: today, end: addDays(today, 30) };
    return { start: today, end: addDays(today, 7) };
  }, [prefs.agendaRange]);

  const agendaItems = useMemo(() => {
    const { start, end } = agendaWindow;

    const list: CalendarEvent[] = [];
    for (const e of filteredEvents) {
      const due = startOfDay(e.date);
      if (isBefore(due, start) || isAfter(due, end)) continue;
      list.push(e);
    }

    list.sort((a, b) => {
      const da = startOfDay(a.date).getTime();
      const db = startOfDay(b.date).getTime();
      if (da !== db) return da - db;
      return sortEvents(a, b);
    });

    const dedup = new Map<string, CalendarEvent>();
    for (const it of list) if (!dedup.has(it.entityId)) dedup.set(it.entityId, it);

    return Array.from(dedup.values());
  }, [filteredEvents, agendaWindow]);

  /* =========================
     Atalhos de teclado
     ========================= */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        (target as any)?.isContentEditable;

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if ((e.key === "t" || e.key === "T") && !isTyping) {
        e.preventDefault();
        goToday();
        return;
      }

      if (e.key === "Escape") {
        if (search) {
          e.preventDefault();
          setSearch("");
          return;
        }
        if (selectedDate) {
          e.preventDefault();
          setSelectedDate(null);
        }
        return;
      }

      if (!isTyping && prefs.viewMode === "month") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goPrevMonth();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          goNextMonth();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goToday, goPrevMonth, goNextMonth, prefs.viewMode, search, selectedDate]);

  /* =========================
     Loading inicial
     ========================= */

  if (anyLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[620px] w-full" />
      </div>
    );
  }

  /* =========================
     Render
     ========================= */

  const hasActiveFilters = prefs.filterType !== "todos" || prefs.onlyOverdue || Boolean(search);

  const clearSearch = () => setSearch("");

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="h-8 w-8 text-green-600" />
              Calendário
            </h1>
            <p className="text-muted-foreground">
              Acompanhe vencimentos, entregas e compromissos.
              <span className="ml-2 text-xs opacity-75">
                Atalhos. <span className="inline-flex items-center gap-1"><Slash className="h-3 w-3" /> buscar</span>. T hoje. Esc limpar.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={prefs.viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="gap-2"
              aria-label="Visualização mensal"
            >
              <LayoutGrid className="h-4 w-4" />
              Mês
            </Button>

            <Button
              variant={prefs.viewMode === "agenda" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("agenda")}
              className="gap-2"
              aria-label="Visualização em agenda"
            >
              <List className="h-4 w-4" />
              Agenda
            </Button>

            <Button
              variant={prefs.onlyOverdue ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyOverdue(!prefs.onlyOverdue)}
              className="gap-2"
              aria-label="Filtrar somente atrasados"
            >
              <Filter className="h-4 w-4" />
              {prefs.onlyOverdue ? "Somente atrasados" : "Atrasados"}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="gap-2"
                aria-label="Limpar filtros"
              >
                <X className="h-4 w-4" />
                Limpar
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={refetchAll}
              className="gap-2"
              aria-label="Atualizar dados"
              disabled={anyFetching}
            >
              <RefreshCcw className={`h-4 w-4 ${anyFetching ? "animate-spin" : ""}`} />
              {anyFetching ? "Atualizando" : "Atualizar"}
            </Button>
          </div>
        </div>

        {errorSources.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-900/40 bg-yellow-50/70 dark:bg-yellow-900/10">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-300 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-yellow-900 dark:text-yellow-100">Alguns dados não puderam ser carregados</div>
                  <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                    {errorSources.map((e) => (
                      <div key={e.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <span className="font-medium">{e.name}:</span> {e.message}
                        </div>
                        <Button variant="outline" size="sm" onClick={e.refetch} className="gap-2 w-fit">
                          <RefreshCcw className="h-4 w-4" />
                          Tentar novamente
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, empreendimento, número, status"
              className="pl-9 pr-9"
              aria-label="Buscar eventos"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={prefs.filterType === "todos" ? "default" : "outline"} onClick={() => setFilterType("todos")}>
              Todos
            </Button>

            <Button size="sm" variant={prefs.filterType === "licenca" ? "default" : "outline"} onClick={() => setFilterType(prefs.filterType === "licenca" ? "todos" : "licenca")} className="gap-2">
              <FileText className="h-4 w-4" />
              Licenças
            </Button>

            <Button size="sm" variant={prefs.filterType === "demanda" ? "default" : "outline"} onClick={() => setFilterType(prefs.filterType === "demanda" ? "todos" : "demanda")} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Demandas
            </Button>

            <Button size="sm" variant={prefs.filterType === "condicionante" ? "default" : "outline"} onClick={() => setFilterType(prefs.filterType === "condicionante" ? "todos" : "condicionante")} className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Condicionantes
            </Button>

            <Button size="sm" variant={prefs.filterType === "cronograma" ? "default" : "outline"} onClick={() => setFilterType(prefs.filterType === "cronograma" ? "todos" : "cronograma")} className="gap-2">
              <Target className="h-4 w-4" />
              Cronograma
            </Button>

            <Button size="sm" variant={prefs.filterType === "tarefa" ? "default" : "outline"} onClick={() => setFilterType(prefs.filterType === "tarefa" ? "todos" : "tarefa")} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Tarefas
            </Button>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="gap-1">
              <Filter className="h-3 w-3" />
              Filtros ativos
            </Badge>
            {prefs.filterType !== "todos" && <Badge variant="outline">Tipo: {getTipoLabel(prefs.filterType as EventType)}</Badge>}
            {prefs.onlyOverdue && <Badge variant="outline">Somente atrasados</Badge>}
            {debouncedSearch && <Badge variant="outline">Busca: {deferredSearch}</Badge>}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <KpiCard icon={FileText} label="Licenças" value={monthKPIs.licencas} iconWrapClass="bg-red-100 dark:bg-red-900/20" iconClass="text-red-600 dark:text-red-300" />
          <KpiCard icon={ClipboardList} label="Demandas" value={monthKPIs.demandas} iconWrapClass="bg-blue-100 dark:bg-blue-900/20" iconClass="text-blue-600 dark:text-blue-300" />
          <KpiCard icon={AlertTriangle} label="Condicionantes" value={monthKPIs.condicionantes} iconWrapClass="bg-amber-100 dark:bg-amber-900/20" iconClass="text-amber-700 dark:text-amber-300" />
          <KpiCard icon={Target} label="Cronograma" value={monthKPIs.cronograma} iconWrapClass="bg-purple-100 dark:bg-purple-900/20" iconClass="text-purple-700 dark:text-purple-300" />
          <KpiCard icon={CheckCircle} label="Tarefas" value={monthKPIs.tarefas} iconWrapClass="bg-emerald-100 dark:bg-emerald-900/20" iconClass="text-emerald-700 dark:text-emerald-300" />
          <KpiCard icon={Clock} label="Atrasados" value={monthKPIs.overdueCount} iconWrapClass="bg-red-100 dark:bg-red-900/20" iconClass="text-red-700 dark:text-red-300" />
          <KpiCard icon={CalendarIcon} label="Próximos 7 dias" value={monthKPIs.due7Count} iconWrapClass="bg-amber-100 dark:bg-amber-900/20" iconClass="text-amber-700 dark:text-amber-300" />
          <KpiCard icon={Clock} label="Total" value={monthKPIs.totalEntities} iconWrapClass="bg-gray-100 dark:bg-gray-800" iconClass="text-gray-600 dark:text-gray-300" />
        </div>
      </div>

      {prefs.viewMode === "agenda" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-xl flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Agenda
                </CardTitle>

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant={prefs.agendaRange === "hoje" ? "default" : "outline"} onClick={() => setAgendaRange("hoje")}>
                    Hoje
                  </Button>
                  <Button size="sm" variant={prefs.agendaRange === "7d" ? "default" : "outline"} onClick={() => setAgendaRange("7d")}>
                    7 dias
                  </Button>
                  <Button size="sm" variant={prefs.agendaRange === "30d" ? "default" : "outline"} onClick={() => setAgendaRange("30d")}>
                    30 dias
                  </Button>
                </div>
              </div>

              <div className="text-sm text-muted-foreground mt-2">
                Período: {format(agendaWindow.start, "dd/MM/yyyy")} até {format(agendaWindow.end, "dd/MM/yyyy")}
              </div>
            </CardHeader>

            <CardContent>
              {agendaItems.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-60" />
                  <div className="text-muted-foreground">Nenhum evento no período selecionado</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendaItems.map((event) => (
                    <AgendaRow key={event.entityId} event={event} onOpen={() => navigate(event.link)} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Atalhos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/demandas")}>
                Abrir Demandas
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/condicionantes/pendentes")}>
                Abrir Condicionantes
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/cronograma")}>
                Abrir Cronograma
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/gestao-equipe")}>
                Abrir Gestão de Equipe
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={goToday}>
                Ir para Hoje
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                </CardTitle>

                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={goPrevMonth} aria-label="Mês anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <Button variant="outline" size="sm" onClick={goToday} aria-label="Ir para hoje">
                    Hoje
                  </Button>

                  <Button variant="outline" size="icon" onClick={goNextMonth} aria-label="Próximo mês">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {anyFetching && <div className="text-xs text-muted-foreground mt-2">Atualizando dados em segundo plano</div>}
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
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                  const hasEvents = dayEvents.length > 0;

                  const countsByType = dayEvents.reduce<Record<EventType, number>>(
                    (acc, e) => {
                      acc[e.type] += 1;
                      return acc;
                    },
                    { licenca: 0, demanda: 0, condicionante: 0, cronograma: 0, tarefa: 0 }
                  );

                  const overdueHere = dayEvents.some((e) => e.overdue);

                  const ariaLabel = `Dia ${format(day, "dd/MM/yyyy")}. ${dayEvents.length} ${dayEvents.length === 1 ? "evento" : "eventos"}. Licenças ${countsByType.licenca}. Demandas ${countsByType.demanda}. Condicionantes ${countsByType.condicionante}. Cronograma ${countsByType.cronograma}. Tarefas ${countsByType.tarefa}.${overdueHere ? " Há itens atrasados." : ""}`;

                  return (
                    <button
                      key={format(day, "yyyy-MM-dd")}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={`
                        aspect-square p-1 border rounded-lg cursor-pointer transition-all text-left
                        ${isToday(day) ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-100 dark:border-gray-800"}
                        ${isSelected ? "ring-2 ring-primary bg-primary/10" : ""}
                        ${hasEvents ? "hover:bg-muted" : "hover:bg-muted/50"}
                        ${overdueHere ? "bg-red-50/50 dark:bg-red-900/10" : ""}
                        focus:outline-none focus:ring-2 focus:ring-primary/60
                      `}
                      aria-label={ariaLabel}
                    >
                      <div className="flex flex-col h-full">
                        <span className={`text-sm ${isToday(day) ? "font-bold text-green-600" : ""}`}>{format(day, "d")}</span>

                        {hasEvents && (
                          <div className="flex flex-wrap gap-0.5 mt-1" aria-hidden="true">
                            {dayEvents.slice(0, 4).map((event) => (
                              <div key={event.entityId} className={`w-2 h-2 rounded-full ${EVENT_DOT_CLASS[event.type]}`} title={event.title} />
                            ))}
                            {dayEvents.length > 4 && <span className="text-xs text-muted-foreground">+{dayEvents.length - 4}</span>}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
                {(["licenca", "demanda", "condicionante", "cronograma", "tarefa"] as EventType[]).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${EVENT_DOT_CLASS[t]}`} />
                    <span className="text-sm text-muted-foreground">{getTipoLabel(t)}</span>
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
                <p className="text-muted-foreground text-center py-8">Clique em um dia do calendário para ver os eventos</p>
              ) : selectedDayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-muted-foreground">Nenhum evento neste dia</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {selectedDayEvents.map((event) => (
                    <SideEventCard key={event.entityId} event={event} onOpen={() => navigate(event.link)} />
                  ))}
                </div>
              )}

              {selectedDate && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setViewMode("agenda")}>
                    Abrir em Agenda
                  </Button>

                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/demandas")}>
                    Abrir Demandas
                  </Button>

                  <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/condicionantes/pendentes")}>
                    Abrir Condicionantes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* =========================
   Subcomponentes
   ========================= */

function KpiCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  iconWrapClass: string;
  iconClass: string;
}) {
  const Icon = props.icon;
  return (
    <Card className="lg:col-span-1">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-full ${props.iconWrapClass}`}>
          <Icon className={`h-5 w-5 ${props.iconClass}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{props.value}</p>
          <p className="text-xs text-muted-foreground">{props.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AgendaRow({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const now = new Date();
  const done = isDoneStatus(event.status);
  const dueText = daysToLabel(event.date, now, done);

  return (
    <div
      className="p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${EVENT_DOT_CLASS[event.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium text-sm truncate">{event.title}</div>

                <Badge variant="outline" className="text-xs">
                  {getTipoLabel(event.type)}
                </Badge>

                {event.prioridade && (
                  <Badge variant="outline" className={`text-xs ${PRIORITY_CLASS[event.prioridade] || ""}`}>
                    {event.prioridade}
                  </Badge>
                )}

                {event.overdue && (
                  <Badge
                    variant="outline"
                    className="text-xs border-red-300 text-red-700 bg-red-50 dark:border-red-900/40 dark:text-red-200 dark:bg-red-900/20"
                  >
                    Atrasado
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground mt-1">
                Data: {format(event.date, "dd/MM/yyyy")} . {dueText}
              </div>

              {event.empreendimentoNome && <div className="text-xs text-muted-foreground mt-1 truncate">Empreendimento: {event.empreendimentoNome}</div>}
              {event.licencaNumero && <div className="text-xs text-muted-foreground mt-1 truncate">Licença: {event.licencaNumero}</div>}
              {event.status && <div className="text-xs text-muted-foreground mt-1 truncate">Status: {event.status}</div>}
            </div>

            <div className="text-xs text-muted-foreground whitespace-nowrap">{format(event.date, "EEE", { locale: ptBR })}</div>
          </div>

          {event.rangeStart && event.rangeEnd && (event.type === "demanda" || event.type === "cronograma") && (
            <div className="text-xs text-muted-foreground mt-2">
              Intervalo: {format(event.rangeStart, "dd/MM/yyyy")} até {format(event.rangeEnd, "dd/MM/yyyy")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SideEventCard({ event, onOpen }: { event: CalendarEvent; onOpen: () => void }) {
  const now = new Date();
  const done = isDoneStatus(event.status);
  const dueText = daysToLabel(event.date, now, done);

  return (
    <div
      className="p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${EVENT_DOT_CLASS[event.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{event.title}</p>
              <div className="text-xs text-muted-foreground mt-1">{dueText}</div>
            </div>

            {event.overdue && (
              <Badge
                variant="outline"
                className="text-xs border-red-300 text-red-700 bg-red-50 dark:border-red-900/40 dark:text-red-200 dark:bg-red-900/20"
              >
                Atrasado
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {getTipoLabel(event.type)}
            </Badge>

            {event.prioridade && (
              <Badge variant="outline" className={`text-xs ${PRIORITY_CLASS[event.prioridade] || ""}`}>
                {event.prioridade}
              </Badge>
            )}

            {event.cronogramaTipo && (
              <Badge variant="secondary" className="text-xs">
                {event.cronogramaTipo}
              </Badge>
            )}
          </div>

          {event.empreendimentoNome && <p className="text-xs text-muted-foreground mt-2 truncate">Empreendimento: {event.empreendimentoNome}</p>}
          {event.licencaNumero && <p className="text-xs text-muted-foreground mt-1 truncate">Licença: {event.licencaNumero}</p>}
          {event.status && <p className="text-xs text-muted-foreground mt-1 truncate">Status: {event.status}</p>}

          {event.rangeStart && event.rangeEnd && (event.type === "demanda" || event.type === "cronograma") && (
            <p className="text-xs text-muted-foreground mt-2">
              Intervalo: {format(event.rangeStart, "dd/MM/yyyy")} até {format(event.rangeEnd, "dd/MM/yyyy")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
