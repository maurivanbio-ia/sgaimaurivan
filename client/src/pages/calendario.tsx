import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
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

const eventColors: Record<EventType, string> = {
  licenca: "#ef4444",
  demanda: "#3b82f6",
  condicionante: "#f59e0b",
  cronograma: "#8b5cf6",
  tarefa: "#10b981",
};

const priorityColors: Record<string, string> = {
  urgente: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-yellow-100 text-yellow-800 border-yellow-200",
  baixa: "bg-green-100 text-green-800 border-green-200",
};

const priorityRank: Record<string, number> = {
  urgente: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

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
 * Trata "YYYY-MM-DD" como data local, colocando no meio-dia local para reduzir risco de “virar o dia”
 * em conversões de timezone/DST.
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
    default:
      return "Evento";
  }
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

export default function Calendario() {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<"todos" | EventType>("todos");

  // Fetch padronizado
  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error("Falha ao buscar dados");
    return res.json();
  }, []);

  const { data: licencas = [], isLoading: licencasLoading } = useQuery<Licenca[]>({
    queryKey: ["/api/licencas"],
    queryFn: () => fetcher("/api/licencas"),
    staleTime: 60_000,
  });

  const { data: demandas = [], isLoading: demandasLoading } = useQuery<Demanda[]>({
    queryKey: ["/api/demandas"],
    queryFn: () => fetcher("/api/demandas"),
    staleTime: 60_000,
  });

  const { data: condicionantes = [], isLoading: condicionantesLoading } = useQuery<Condicionante[]>({
    queryKey: ["/api/condicionantes"],
    queryFn: () => fetcher("/api/condicionantes"),
    staleTime: 60_000,
  });

  const { data: cronogramaItens = [], isLoading: cronogramaLoading } = useQuery<CronogramaItem[]>({
    queryKey: ["/api/cronograma"],
    queryFn: () => fetcher("/api/cronograma"),
    staleTime: 60_000,
  });

  const { data: tarefas = [], isLoading: tarefasLoading } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
    queryFn: () => fetcher("/api/tarefas"),
    staleTime: 60_000,
  });

  const isLoading = licencasLoading || demandasLoading || condicionantesLoading || cronogramaLoading || tarefasLoading;

  // Montagem dos eventos (com parsing robusto)
  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];
    const today = startOfDay(new Date());

    // Licenças
    licencas.forEach((lic) => {
      const d = parseLocalDate(lic.validade);
      if (!d) return;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(lic.status);
      allEvents.push({
        id: `lic-${lic.id}`,
        entityId: `lic-${lic.id}`,
        title: `Venc. Licença: ${lic.numero}`,
        date: d,
        type: "licenca",
        status: lic.status,
        link: `/empreendimentos/${lic.empreendimentoId}`,
        color: eventColors.licenca,
        overdue,
      });
    });

    // Demandas (mantendo estratégia atual: evento por dia, mas com parsing robusto)
    // Se quiser evitar explosão, comente o trecho do eachDayOfInterval e use um único evento.
    demandas.forEach((dem) => {
      const end = parseLocalDate(dem.dataEntrega);
      if (!end) return;

      const start = parseLocalDate(dem.dataInicio) ?? end;
      const overdue = isBefore(startOfDay(end), today) && !isDoneStatus(dem.status);

      if (start <= end) {
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
            color: eventColors.demanda,
            prioridade: dem.prioridade,
            overdue,
          });
        });
      } else {
        allEvents.push({
          id: `dem-${dem.id}`,
          entityId: `dem-${dem.id}`,
          title: dem.titulo,
          date: end,
          type: "demanda",
          status: dem.status,
          link: `/demandas`,
          color: eventColors.demanda,
          prioridade: dem.prioridade,
          overdue,
        });
      }
    });

    // Condicionantes
    condicionantes.forEach((cond) => {
      const d = parseLocalDate(cond.prazo);
      if (!d) return;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(cond.status);
      const desc = cond.descricao?.trim() || "Sem descrição";
      const title = desc.length > 45 ? `Cond.: ${desc.substring(0, 45)}...` : `Cond.: ${desc}`;

      allEvents.push({
        id: `cond-${cond.id}`,
        entityId: `cond-${cond.id}`,
        title,
        date: d,
        type: "condicionante",
        status: cond.status,
        link: `/condicionantes/pendentes`,
        color: eventColors.condicionante,
        overdue,
      });
    });

    // Cronograma
    cronogramaItens.forEach((item) => {
      const d = parseLocalDate(item.dataFim);
      if (!d) return;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(item.status);

      const tipoLabel =
        item.tipo === "campanha"
          ? "Campanha"
          : item.tipo === "relatorio"
          ? "Relatório"
          : item.tipo === "marco"
          ? "Marco"
          : "Etapa";

      allEvents.push({
        id: `cron-${item.id}`,
        entityId: `cron-${item.id}`,
        title: `${tipoLabel}: ${item.titulo}`,
        date: d,
        type: "cronograma",
        status: item.status,
        link: `/cronograma`,
        color: eventColors.cronograma,
        prioridade: item.prioridade || undefined,
        cronogramaTipo: item.tipo,
        overdue,
      });
    });

    // Tarefas (respeita visivelCalendarioGeral quando definido)
    tarefas.forEach((tarefa) => {
      if (tarefa.visivelCalendarioGeral === false) return;

      const tarefaDateStr = tarefa.dataLimite || tarefa.prazo || tarefa.dataFim;
      const d = parseLocalDate(tarefaDateStr);
      if (!d) return;

      const overdue = isBefore(startOfDay(d), today) && !isDoneStatus(tarefa.status);

      allEvents.push({
        id: `tar-${tarefa.id}`,
        entityId: `tar-${tarefa.id}`,
        title: `Tarefa: ${tarefa.titulo}`,
        date: d,
        type: "tarefa",
        status: tarefa.status,
        link: `/gestao-equipe`,
        color: eventColors.tarefa,
        prioridade: tarefa.prioridade,
        overdue,
      });
    });

    return allEvents;
  }, [licencas, demandas, condicionantes, cronogramaItens, tarefas]);

  // Filtro por tipo
  const filteredEvents = useMemo(() => {
    if (filterType === "todos") return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  // Indexação por dia para performance (Map)
  const eventsByDayKey = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filteredEvents) {
      const key = format(e.date, "yyyy-MM-dd");
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    // Ordena os eventos dentro de cada dia para melhor UX
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        // Atrasado primeiro
        const oa = a.overdue ? 1 : 0;
        const ob = b.overdue ? 1 : 0;
        if (oa !== ob) return ob - oa;

        // Prioridade (urgente > alta > media > baixa)
        const pa = a.prioridade ? priorityRank[a.prioridade] ?? 0 : 0;
        const pb = b.prioridade ? priorityRank[b.prioridade] ?? 0 : 0;
        if (pa !== pb) return pb - pa;

        // Tipo (licença/condicionante antes do resto)
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
      });
      map.set(k, arr);
    }

    return map;
  }, [filteredEvents]);

  const getEventsForDay = useCallback(
    (day: Date) => {
      const key = format(day, "yyyy-MM-dd");
      return eventsByDayKey.get(key) ?? [];
    },
    [eventsByDayKey]
  );

  // Dias do mês com semana iniciando na segunda (pt-BR)
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayIndex = (monthStart.getDay() + 6) % 7; // segunda=0 ... domingo=6
  const paddingDays = Array(firstDayIndex).fill(null);

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // Contagens do mês por entidade (não inflar por evento diário)
  const eventCounts = useMemo(() => {
    const thisMonth = filteredEvents.filter((e) => isSameMonth(e.date, currentDate));
    const sets: Record<EventType, Set<string>> = {
      licenca: new Set<string>(),
      demanda: new Set<string>(),
      condicionante: new Set<string>(),
      cronograma: new Set<string>(),
      tarefa: new Set<string>(),
    };

    for (const e of thisMonth) {
      sets[e.type].add(e.entityId);
    }

    return {
      licencas: sets.licenca.size,
      demandas: sets.demanda.size,
      condicionantes: sets.condicionante.size,
      cronograma: sets.cronograma.size,
      tarefas: sets.tarefa.size,
      total: thisMonth.length, // total de “eventos no calendário” (pode ser maior se demandas forem diárias)
    };
  }, [filteredEvents, currentDate]);

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  const goPrevMonth = () => {
    const newDate = subMonths(currentDate, 1);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  const goNextMonth = () => {
    const newDate = addMonths(currentDate, 1);
    setCurrentDate(newDate);
    setSelectedDate(null);
  };

  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
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
        <Card
          className={`cursor-pointer transition-all ${
            filterType === "licenca" ? "ring-2 ring-red-500" : ""
          }`}
          onClick={() => setFilterType(filterType === "licenca" ? "todos" : "licenca")}
          data-testid="filter-licencas"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eventCounts.licencas}</p>
              <p className="text-xs text-muted-foreground">Licenças</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterType === "demanda" ? "ring-2 ring-blue-500" : ""
          }`}
          onClick={() => setFilterType(filterType === "demanda" ? "todos" : "demanda")}
          data-testid="filter-demandas"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eventCounts.demandas}</p>
              <p className="text-xs text-muted-foreground">Demandas</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterType === "condicionante" ? "ring-2 ring-yellow-500" : ""
          }`}
          onClick={() =>
            setFilterType(filterType === "condicionante" ? "todos" : "condicionante")
          }
          data-testid="filter-condicionantes"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eventCounts.condicionantes}</p>
              <p className="text-xs text-muted-foreground">Condicionantes</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterType === "cronograma" ? "ring-2 ring-purple-500" : ""
          }`}
          onClick={() => setFilterType(filterType === "cronograma" ? "todos" : "cronograma")}
          data-testid="filter-cronograma"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-purple-100">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eventCounts.cronograma}</p>
              <p className="text-xs text-muted-foreground">Cronograma</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            filterType === "tarefa" ? "ring-2 ring-emerald-500" : ""
          }`}
          onClick={() => setFilterType(filterType === "tarefa" ? "todos" : "tarefa")}
          data-testid="filter-tarefas"
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-100">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eventCounts.tarefas}</p>
              <p className="text-xs text-muted-foreground">Tarefas</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-gray-100">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eventCounts.total}</p>
              <p className="text-xs text-muted-foreground">Total do Mês</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">
                {format(currentDate, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) =>
                  c.toUpperCase()
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goPrevMonth}
                  data-testid="button-prev-month"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToday}
                  data-testid="button-today"
                  aria-label="Ir para hoje"
                >
                  Hoje
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={goNextMonth}
                  data-testid="button-next-month"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}

              {paddingDays.map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}

              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasEvents = dayEvents.length > 0;

                const ariaLabel = `Dia ${format(day, "dd/MM/yyyy")}. ${dayEvents.length} ${
                  dayEvents.length === 1 ? "evento" : "eventos"
                }.`;

                return (
                  <button
                    key={day.toString()}
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
                    data-testid={`day-${format(day, "yyyy-MM-dd")}`}
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
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColors.licenca }} />
                <span className="text-sm text-muted-foreground">Licenças</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColors.demanda }} />
                <span className="text-sm text-muted-foreground">Demandas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColors.condicionante }} />
                <span className="text-sm text-muted-foreground">Condicionantes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColors.cronograma }} />
                <span className="text-sm text-muted-foreground">Cronograma</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColors.tarefa }} />
                <span className="text-sm text-muted-foreground">Tarefas</span>
              </div>
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
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: event.color }}
                      />
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
                            {getTipoLabel(event.type)}
                          </Badge>

                          {event.prioridade && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${priorityColors[event.prioridade] || ""}`}
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
