import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  CalendarDays,
  Target
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
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
  dataLimite: string;
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

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "licenca" | "demanda" | "condicionante" | "cronograma" | "tarefa";
  status: string;
  link: string;
  color: string;
  prioridade?: string;
  cronogramaTipo?: string;
}

const eventColors = {
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

export default function Calendario() {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>("todos");

  const { data: licencas = [], isLoading: licencasLoading } = useQuery<Licenca[]>({
    queryKey: ['/api/licencas'],
  });

  const { data: demandas = [], isLoading: demandasLoading } = useQuery<Demanda[]>({
    queryKey: ['/api/demandas'],
  });

  const { data: condicionantes = [], isLoading: condicionantesLoading } = useQuery<Condicionante[]>({
    queryKey: ['/api/condicionantes'],
  });

  const { data: cronogramaItens = [], isLoading: cronogramaLoading } = useQuery<CronogramaItem[]>({
    queryKey: ['/api/cronograma'],
    queryFn: async () => {
      const res = await fetch('/api/cronograma', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch cronograma');
      return res.json();
    },
  });

  const { data: tarefas = [], isLoading: tarefasLoading } = useQuery<Tarefa[]>({
    queryKey: ['/api/tarefas'],
  });

  const isLoading = licencasLoading || demandasLoading || condicionantesLoading || cronogramaLoading || tarefasLoading;

  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    licencas.forEach(lic => {
      if (lic.validade) {
        allEvents.push({
          id: `lic-${lic.id}`,
          title: `Venc. Licença: ${lic.numero}`,
          date: parseISO(lic.validade),
          type: "licenca",
          status: lic.status,
          link: `/empreendimentos/${lic.empreendimentoId}`,
          color: eventColors.licenca,
        });
      }
    });

    demandas.forEach(dem => {
      if (dem.dataLimite) {
        allEvents.push({
          id: `dem-${dem.id}`,
          title: dem.titulo,
          date: parseISO(dem.dataLimite),
          type: "demanda",
          status: dem.status,
          link: `/demandas`,
          color: eventColors.demanda,
          prioridade: dem.prioridade,
        });
      }
    });

    condicionantes.forEach(cond => {
      if (cond.prazo) {
        allEvents.push({
          id: `cond-${cond.id}`,
          title: `Cond.: ${cond.descricao?.substring(0, 30)}...`,
          date: parseISO(cond.prazo),
          type: "condicionante",
          status: cond.status,
          link: `/condicionantes/pendentes`,
          color: eventColors.condicionante,
        });
      }
    });

    cronogramaItens.forEach(item => {
      if (item.dataFim) {
        const tipoLabel = item.tipo === "campanha" ? "Campanha" : 
                          item.tipo === "relatorio" ? "Relatório" : 
                          item.tipo === "marco" ? "Marco" : "Etapa";
        allEvents.push({
          id: `cron-${item.id}`,
          title: `${tipoLabel}: ${item.titulo}`,
          date: parseISO(item.dataFim),
          type: "cronograma",
          status: item.status,
          link: `/cronograma`,
          color: eventColors.cronograma,
          prioridade: item.prioridade || undefined,
          cronogramaTipo: item.tipo,
        });
      }
    });

    tarefas.forEach(tarefa => {
      // Usa dataLimite, prazo ou dataFim (o que estiver disponível)
      const tarefaDate = tarefa.dataLimite || tarefa.prazo || tarefa.dataFim;
      if (tarefaDate) {
        allEvents.push({
          id: `tar-${tarefa.id}`,
          title: `Tarefa: ${tarefa.titulo}`,
          date: parseISO(tarefaDate),
          type: "tarefa",
          status: tarefa.status,
          link: `/gestao-equipe`,
          color: eventColors.tarefa,
          prioridade: tarefa.prioridade,
        });
      }
    });

    return allEvents;
  }, [licencas, demandas, condicionantes, cronogramaItens, tarefas]);

  const filteredEvents = useMemo(() => {
    if (filterType === "todos") return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const paddingDays = Array(firstDayOfWeek).fill(null);

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, day));
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const eventCounts = useMemo(() => {
    const thisMonth = filteredEvents.filter(e => isSameMonth(e.date, currentDate));
    return {
      licencas: thisMonth.filter(e => e.type === "licenca").length,
      demandas: thisMonth.filter(e => e.type === "demanda").length,
      condicionantes: thisMonth.filter(e => e.type === "condicionante").length,
      cronograma: thisMonth.filter(e => e.type === "cronograma").length,
      tarefas: thisMonth.filter(e => e.type === "tarefa").length,
      total: thisMonth.length,
    };
  }, [filteredEvents, currentDate]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
          <p className="text-muted-foreground">
            Acompanhe vencimentos, entregas e compromissos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${filterType === "licenca" ? 'ring-2 ring-red-500' : ''}`}
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
          className={`cursor-pointer transition-all ${filterType === "demanda" ? 'ring-2 ring-blue-500' : ''}`}
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
          className={`cursor-pointer transition-all ${filterType === "condicionante" ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => setFilterType(filterType === "condicionante" ? "todos" : "condicionante")}
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
          className={`cursor-pointer transition-all ${filterType === "cronograma" ? 'ring-2 ring-purple-500' : ''}`}
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
          className={`cursor-pointer transition-all ${filterType === "tarefa" ? 'ring-2 ring-emerald-500' : ''}`}
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
                {format(currentDate, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  data-testid="button-today"
                >
                  Hoje
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {paddingDays.map((_, i) => (
                <div key={`pad-${i}`} className="aspect-square" />
              ))}
              {daysInMonth.map(day => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasEvents = dayEvents.length > 0;
                
                return (
                  <div
                    key={day.toString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      aspect-square p-1 border rounded-lg cursor-pointer transition-all
                      ${isToday(day) ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-100 dark:border-gray-800'}
                      ${isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}
                      ${hasEvents ? 'hover:bg-muted' : 'hover:bg-muted/50'}
                    `}
                    data-testid={`day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <div className="flex flex-col h-full">
                      <span className={`text-sm ${isToday(day) ? 'font-bold text-green-600' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {hasEvents && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {dayEvents.slice(0, 3).map(event => (
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
                  </div>
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColors.tarefa }} />
                <span className="text-sm text-muted-foreground">Tarefas</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate 
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : "Selecione um dia"
              }
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
                {selectedDayEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(event.link)}
                    data-testid={`event-${event.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {event.type === "licenca" ? "Licença" : 
                             event.type === "demanda" ? "Demanda" : 
                             event.type === "condicionante" ? "Condicionante" :
                             event.type === "tarefa" ? "Tarefa" : "Cronograma"}
                          </Badge>
                          {event.prioridade && (
                            <Badge variant="outline" className={`text-xs ${priorityColors[event.prioridade] || ''}`}>
                              {event.prioridade}
                            </Badge>
                          )}
                        </div>
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
