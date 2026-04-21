import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Calendar, Clock, CheckCircle2,
  ListTodo, FolderKanban, Bell, ChevronRight, Search,
  Megaphone, ClipboardList, Activity, AlertCircle, PackageCheck,
  ShieldAlert, TrendingUp, TrendingDown, Minus
} from "lucide-react";

interface User { id: number; email: string; role: string; cargo: string; unidade: string; nome?: string }
interface Projeto { id: number; nome: string; status: string; coordenadorId: number | null; empreendimentoId: number }
interface Empreendimento { id: number; nome: string; cliente: string; unidade: string; coordenadorId?: number }
interface Campanha { id: number; nome: string; empreendimentoId: number; periodoInicio: string; periodoFim: string; descricao: string | null }
interface CronogramaItem {
  id: number; titulo: string; tipo: string; status: string; prioridade: string;
  dataInicio: string | null; dataFim: string | null; concluido: boolean;
  empreendimentoId: number | null; projetoId: number | null; responsavel: string | null; descricao: string | null;
}
interface Demanda {
  id: number; titulo: string; status: string; prioridade: string;
  dataEntrega: string | null; descricao: string | null;
  empreendimentoId: number | null; responsavelId: number | null;
}
interface Entregavel {
  id: number; titulo: string; tipo: string; prazo: string; status: string;
  responsavel: string | null; empreendimentoId: number | null; descricao: string | null;
}
interface Risco {
  id: number; titulo: string; nivelRisco: string; status: string; empreendimentoId: number;
}

type SourceType = 'campanha' | 'cronograma' | 'demanda' | 'entregavel';

interface AgendaItem {
  id: number; source: SourceType; titulo: string; tipo: string;
  empreendimentoId: number | null; empreendimentoNome: string;
  prazo: string; dias: number; status: string; descricao: string | null;
}

function daysUntil(d: string | null | undefined): number {
  if (!d) return 9999;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return d.split('-').reverse().join('/');
}

function urgencyLevel(dias: number): 'overdue' | 'urgent' | 'soon' | 'upcoming' | 'ok' {
  if (dias < 0) return 'overdue';
  if (dias <= 7) return 'urgent';
  if (dias <= 30) return 'soon';
  if (dias <= 90) return 'upcoming';
  return 'ok';
}

const urgencyConfig = {
  overdue:  { label: 'Vencido',     dot: 'bg-red-600',    badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',       border: 'border-l-red-500' },
  urgent:   { label: 'Esta semana', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400', border: 'border-l-orange-400' },
  soon:     { label: '30 dias',     dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400', border: 'border-l-yellow-400' },
  upcoming: { label: '90 dias',     dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',     border: 'border-l-blue-400' },
  ok:       { label: 'Ok',          dot: 'bg-emerald-400',badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', border: 'border-l-emerald-400' },
};

const sourceConfig: Record<SourceType, { icon: any; label: string; color: string }> = {
  campanha:   { icon: Megaphone,     label: 'Campanha',   color: 'text-violet-600 dark:text-violet-400' },
  cronograma: { icon: ClipboardList, label: 'Cronograma', color: 'text-blue-600 dark:text-blue-400' },
  demanda:    { icon: ListTodo,      label: 'Demanda',    color: 'text-emerald-600 dark:text-emerald-400' },
  entregavel: { icon: PackageCheck,  label: 'Entregável', color: 'text-orange-600 dark:text-orange-400' },
};

const tipoLabels: Record<string, string> = {
  campanha: 'Campanha', relatorio: 'Relatório', marco: 'Marco', etapa: 'Etapa',
  tarefa: 'Tarefa', aprovacao: 'Aprovação', reuniao: 'Reunião',
  documento: 'Documento', apresentacao: 'Apresentação', produto: 'Produto', plano: 'Plano',
};

type HealthLevel = 'critico' | 'atencao' | 'ok';

function calcHealth(emprId: number, agendaItems: AgendaItem[], riscos: Risco[]): HealthLevel {
  const myItems = agendaItems.filter(i => i.empreendimentoId === emprId);
  const overdue = myItems.filter(i => i.dias < 0).length;
  const urgent  = myItems.filter(i => i.dias >= 0 && i.dias <= 7).length;
  const critRisks = riscos.filter(r => r.empreendimentoId === emprId && r.nivelRisco === 'critico' && r.status !== 'encerrado' && r.status !== 'mitigado').length;
  const highRisks = riscos.filter(r => r.empreendimentoId === emprId && r.nivelRisco === 'alto'    && r.status !== 'encerrado' && r.status !== 'mitigado').length;
  if (overdue > 2 || critRisks > 0) return 'critico';
  if (overdue > 0 || urgent > 2 || highRisks > 0) return 'atencao';
  return 'ok';
}

const healthConfig: Record<HealthLevel, { label: string; icon: any; color: string; bg: string }> = {
  critico: { label: 'Crítico',  icon: TrendingDown, color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  atencao: { label: 'Atenção',  icon: Minus,        color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' },
  ok:      { label: 'No prazo', icon: TrendingUp,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
};

function DiasBadge({ dias }: { dias: number }) {
  const level = urgencyLevel(dias);
  const cfg = urgencyConfig[level];
  const text = dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Hoje' : `${dias}d`;
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{text}</span>;
}

function AgendaCard({ item, onClick }: { item: AgendaItem; onClick: () => void }) {
  const level = urgencyLevel(item.dias);
  const cfg = urgencyConfig[level];
  const src = sourceConfig[item.source];
  const Icon = src.icon;
  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border border-border/60 border-l-4 ${cfg.border} bg-white dark:bg-gray-900 hover:shadow-sm transition-shadow cursor-pointer`} onClick={onClick}>
      <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${src.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{item.titulo}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">{tipoLabels[item.tipo] || item.tipo}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.empreendimentoNome}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">📅 {formatDate(item.prazo)}</span>
          <DiasBadge dias={item.dias} />
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
    </div>
  );
}

function SectionGroup({ label, dot, count, items, onClick }: {
  label: string; dot: string; count: number; items: AgendaItem[]; onClick: (i: AgendaItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label} ({count})</span>
      </div>
      <div className="space-y-2">
        {items.map(item => <AgendaCard key={`${item.source}-${item.id}`} item={item} onClick={() => onClick(item)} />)}
      </div>
    </div>
  );
}

export default function DashboardCoordenador() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<SourceType | 'all'>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'overdue' | 'urgent' | 'soon' | 'upcoming'>('all');
  const [selectedProjeto, setSelectedProjeto] = useState<string>('todos');

  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ['/api/auth/me'] });
  const { data: projetos = [], isLoading: projectsLoading } = useQuery<Projeto[]>({ queryKey: ['/api/projetos'] });
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ['/api/empreendimentos'] });
  const { data: campanhas = [] } = useQuery<Campanha[]>({ queryKey: ['/api/campanhas'] });
  const { data: cronograma = [] } = useQuery<CronogramaItem[]>({ queryKey: ['/api/cronograma'] });
  const { data: demandas = [] } = useQuery<Demanda[]>({ queryKey: ['/api/minhas-demandas'] });
  const { data: entregaveis = [] } = useQuery<Entregavel[]>({ queryKey: ['/api/entregaveis'] });
  const { data: riscos = [] } = useQuery<Risco[]>({ queryKey: ['/api/riscos'] });

  const isLoading = userLoading || projectsLoading;

  const empreendimentoMap = useMemo(() => new Map(empreendimentos.map(e => [e.id, e])), [empreendimentos]);
  const myProjects = useMemo(() => projetos.filter(p => p.coordenadorId === user?.id), [projetos, user]);
  const myEmpreendimentos = useMemo(() => empreendimentos.filter(e => e.coordenadorId === user?.id), [empreendimentos, user]);
  const allMyEmprIds = useMemo(() => new Set([
    ...myProjects.map(p => p.empreendimentoId),
    ...myEmpreendimentos.map(e => e.id),
  ]), [myProjects, myEmpreendimentos]);

  const emprNome = (id: number | null) => id ? (empreendimentoMap.get(id)?.nome || `Projeto #${id}`) : '—';

  const agendaItems: AgendaItem[] = useMemo(() => {
    const items: AgendaItem[] = [];

    campanhas.filter(c => allMyEmprIds.has(c.empreendimentoId)).forEach(c => {
      const dias = daysUntil(c.periodoFim);
      if (dias > 180 || dias < -30) return;
      items.push({ id: c.id, source: 'campanha', titulo: c.nome, tipo: 'campanha', empreendimentoId: c.empreendimentoId, empreendimentoNome: emprNome(c.empreendimentoId), prazo: c.periodoFim, dias, status: 'ativo', descricao: c.descricao });
    });

    cronograma.filter(c => !c.concluido && c.status !== 'concluido' && c.dataFim && (c.empreendimentoId ? allMyEmprIds.has(c.empreendimentoId) : true)).forEach(c => {
      const dias = daysUntil(c.dataFim);
      if (dias > 180) return;
      items.push({ id: c.id, source: 'cronograma', titulo: c.titulo, tipo: c.tipo || 'etapa', empreendimentoId: c.empreendimentoId, empreendimentoNome: emprNome(c.empreendimentoId), prazo: c.dataFim!, dias, status: c.status, descricao: c.descricao });
    });

    demandas.filter(d => d.status !== 'concluida' && d.status !== 'cancelada' && d.dataEntrega).forEach(d => {
      const dias = daysUntil(d.dataEntrega);
      if (dias > 180) return;
      items.push({ id: d.id, source: 'demanda', titulo: d.titulo, tipo: 'tarefa', empreendimentoId: d.empreendimentoId, empreendimentoNome: emprNome(d.empreendimentoId), prazo: d.dataEntrega!, dias, status: d.status, descricao: d.descricao });
    });

    entregaveis.filter(e => e.status !== 'aprovado' && e.status !== 'cancelado' && (e.empreendimentoId ? allMyEmprIds.has(e.empreendimentoId) : true)).forEach(e => {
      const dias = daysUntil(e.prazo);
      if (dias > 180) return;
      items.push({ id: e.id, source: 'entregavel', titulo: e.titulo, tipo: e.tipo || 'documento', empreendimentoId: e.empreendimentoId, empreendimentoNome: emprNome(e.empreendimentoId), prazo: e.prazo, dias, status: e.status, descricao: e.descricao });
    });

    return items.sort((a, b) => a.dias - b.dias);
  }, [campanhas, cronograma, demandas, entregaveis, allMyEmprIds, empreendimentoMap]);

  const filtered = useMemo(() => {
    let res = agendaItems;
    if (filterSource !== 'all') res = res.filter(i => i.source === filterSource);
    if (filterUrgency !== 'all') res = res.filter(i => urgencyLevel(i.dias) === filterUrgency);
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(i => i.titulo.toLowerCase().includes(q) || i.empreendimentoNome.toLowerCase().includes(q));
    }
    if (selectedProjeto !== 'todos') {
      const emprId = parseInt(selectedProjeto);
      res = res.filter(i => i.empreendimentoId === emprId);
    }
    return res;
  }, [agendaItems, filterSource, filterUrgency, search, selectedProjeto]);

  const overdueItems  = agendaItems.filter(i => urgencyLevel(i.dias) === 'overdue');
  const urgentItems   = agendaItems.filter(i => urgencyLevel(i.dias) === 'urgent');
  const soonItems     = agendaItems.filter(i => urgencyLevel(i.dias) === 'soon');

  const projectHealthList = useMemo(() =>
    myProjects.map(p => {
      const health = calcHealth(p.empreendimentoId, agendaItems, riscos);
      const myItems = agendaItems.filter(i => i.empreendimentoId === p.empreendimentoId);
      const myRiscos = riscos.filter(r => r.empreendimentoId === p.empreendimentoId && r.status !== 'encerrado' && r.status !== 'mitigado');
      return {
        ...p,
        empreendimento: empreendimentoMap.get(p.empreendimentoId)?.nome || p.nome,
        health,
        overdueCount: myItems.filter(i => i.dias < 0).length,
        urgentCount: myItems.filter(i => i.dias >= 0 && i.dias <= 7).length,
        totalPendentes: myItems.length,
        riscoCritico: myRiscos.filter(r => r.nivelRisco === 'critico').length,
        riscoAlto: myRiscos.filter(r => r.nivelRisco === 'alto').length,
      };
    }),
  [myProjects, agendaItems, riscos, empreendimentoMap]);

  function handleItemClick(item: AgendaItem) {
    if (item.empreendimentoId) navigate(`/empreendimentos/${item.empreendimentoId}`);
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      </div>
    );
  }

  if (user?.cargo !== 'coordenador') {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground text-sm">Este painel é exclusivo para coordenadores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userName = user?.nome || user?.email?.split('@')[0] || 'Coordenador';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ─── CABEÇALHO ─── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meu Painel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Olá, {userName}. Acompanhe seus projetos e pendências.</p>
          </div>
          {overdueItems.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2 text-sm text-red-700 dark:text-red-400 font-semibold">
              <AlertCircle className="h-4 w-4" />
              {overdueItems.length} item{overdueItems.length > 1 ? 'ns' : ''} vencido{overdueItems.length > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* ─── RESUMO ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Projetos', value: myProjects.length + myEmpreendimentos.length, icon: FolderKanban, highlight: false },
            { label: 'Vencidos', value: overdueItems.length, icon: AlertCircle, highlight: overdueItems.length > 0 },
            { label: 'Esta semana', value: urgentItems.length, icon: Clock, highlight: urgentItems.length > 0 },
            { label: 'Próx. 30 dias', value: soonItems.length, icon: Calendar, highlight: false },
          ].map(s => (
            <Card key={s.label} className="border shadow-none bg-white dark:bg-gray-900">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`h-5 w-5 flex-shrink-0 ${s.highlight ? 'text-red-500' : 'text-muted-foreground'}`} />
                <div>
                  <p className={`text-xl font-bold leading-none ${s.highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ─── SAÚDE DOS PROJETOS ─── */}
        {projectHealthList.length > 0 && (
          <Card className="border-0 shadow-none bg-white dark:bg-gray-900 border border-border/60">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-500" />
                Saúde dos Projetos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projectHealthList.map(p => {
                  const hCfg = healthConfig[p.health];
                  const HIcon = hCfg.icon;
                  return (
                    <div
                      key={p.id}
                      className={`border rounded-xl p-3 cursor-pointer hover:shadow-sm transition-shadow ${hCfg.bg}`}
                      onClick={() => navigate(`/empreendimentos/${p.empreendimentoId}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{p.empreendimento}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.nome}</p>
                        </div>
                        <div className={`flex items-center gap-1 flex-shrink-0 text-xs font-bold ${hCfg.color}`}>
                          <HIcon className="h-3.5 w-3.5" />
                          {hCfg.label}
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {p.overdueCount > 0 && <span className="text-red-600 font-semibold">🔴 {p.overdueCount} vencidos</span>}
                        {p.urgentCount > 0 && <span className="text-orange-500 font-semibold">🟠 {p.urgentCount} esta semana</span>}
                        {p.riscoCritico > 0 && <span className="text-red-600 font-semibold flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" />{p.riscoCritico} risco crítico</span>}
                        {p.riscoAlto > 0 && <span className="text-orange-500 font-semibold flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" />{p.riscoAlto} risco alto</span>}
                        {p.overdueCount === 0 && p.urgentCount === 0 && p.riscoCritico === 0 && p.riscoAlto === 0 && (
                          <span className="text-emerald-600">✓ {p.totalPendentes} pendência{p.totalPendentes !== 1 ? 's' : ''} sob controle</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── FILTROS ─── */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar item..." className="pl-9 h-9 text-sm bg-white dark:bg-gray-900" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'campanha', 'cronograma', 'demanda', 'entregavel'] as const).map(s => (
              <button key={s} onClick={() => setFilterSource(s)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${filterSource === s ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent' : 'bg-white dark:bg-gray-900 text-muted-foreground border-border hover:border-gray-400'}`}>
                {s === 'all' ? 'Tudo' : s === 'campanha' ? 'Campanhas' : s === 'cronograma' ? 'Cronograma' : s === 'demanda' ? 'Demandas' : 'Entregáveis'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'overdue', 'urgent', 'soon', 'upcoming'] as const).map(u => (
              <button key={u} onClick={() => setFilterUrgency(u)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${filterUrgency === u ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent' : 'bg-white dark:bg-gray-900 text-muted-foreground border-border hover:border-gray-400'}`}>
                {u === 'all' ? 'Todas urgências' : u === 'overdue' ? '🔴 Vencidos' : u === 'urgent' ? '🟠 Semana' : u === 'soon' ? '🟡 30 dias' : '🔵 90 dias'}
              </button>
            ))}
          </div>
        </div>

        {/* ─── ABAS POR PROJETO ─── */}
        <Tabs value={selectedProjeto} onValueChange={setSelectedProjeto}>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
            <TabsTrigger value="todos" className="text-xs data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900">
              Todos os projetos
            </TabsTrigger>
            {myProjects.map(p => {
              const empr = empreendimentoMap.get(p.empreendimentoId);
              const count = agendaItems.filter(i => i.empreendimentoId === p.empreendimentoId).length;
              const health = projectHealthList.find(ph => ph.id === p.id)?.health || 'ok';
              const dot = health === 'critico' ? '🔴' : health === 'atencao' ? '🟡' : '🟢';
              const label = (empr?.nome || p.nome).length > 18 ? (empr?.nome || p.nome).slice(0, 18) + '…' : (empr?.nome || p.nome);
              return (
                <TabsTrigger key={p.id} value={String(p.empreendimentoId)} className="text-xs data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900">
                  {dot} {label}
                  {count > 0 && <span className="ml-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5">{count}</span>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {['todos', ...myProjects.map(p => String(p.empreendimentoId))].map(tabVal => (
            <TabsContent key={tabVal} value={tabVal} className="mt-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm">{search ? 'Nenhum item encontrado.' : 'Tudo em dia! Nenhum lembrete pendente.'}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <SectionGroup label="Vencidos" dot="bg-red-600" count={filtered.filter(i => urgencyLevel(i.dias) === 'overdue').length} items={filtered.filter(i => urgencyLevel(i.dias) === 'overdue')} onClick={handleItemClick} />
                  <SectionGroup label="Esta semana" dot="bg-orange-500" count={filtered.filter(i => urgencyLevel(i.dias) === 'urgent').length} items={filtered.filter(i => urgencyLevel(i.dias) === 'urgent')} onClick={handleItemClick} />
                  <SectionGroup label="Próximos 30 dias" dot="bg-yellow-400" count={filtered.filter(i => urgencyLevel(i.dias) === 'soon').length} items={filtered.filter(i => urgencyLevel(i.dias) === 'soon')} onClick={handleItemClick} />
                  <SectionGroup label="Próximos 90 dias" dot="bg-blue-400" count={filtered.filter(i => urgencyLevel(i.dias) === 'upcoming').length} items={filtered.filter(i => urgencyLevel(i.dias) === 'upcoming')} onClick={handleItemClick} />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

      </div>
    </div>
  );
}
