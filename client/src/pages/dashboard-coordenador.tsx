import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, FolderKanban, TrendingDown, BarChart3, Bell,
  Calendar, Clock, CheckCircle2, AlertCircle, Activity,
  TrendingUp, Layers, Target, ChevronRight
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Legend, Tooltip, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";

interface User {
  id: number;
  email: string;
  role: string;
  cargo: string;
  unidade: string;
  nome?: string;
}

interface Projeto {
  id: number;
  nome: string;
  descricao: string | null;
  status: string;
  coordenadorId: number | null;
  empreendimentoId: number;
  orcamentoPrevisto: string | null;
}

interface Empreendimento {
  id: number;
  nome: string;
  cliente: string;
  unidade: string;
  status?: string;
  coordenadorId?: number;
}

interface Lancamento {
  id: number;
  tipo: string;
  valor: string;
  data: string;
  empreendimentoId: number;
  categoriaId: number;
}

interface CategoriaFinanceira {
  id: number;
  nome: string;
  tipo: string;
  cor: string;
}

interface Campanha {
  id: number;
  nome: string;
  empreendimentoId: number;
  periodoInicio: string;
  periodoFim: string;
  descricao: string | null;
}

const GRADIENT_CARDS = [
  'from-violet-600 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-rose-500',
];

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ef4444', '#eab308', '#3b82f6', '#ec4899'];

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getInitials(email: string): string {
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

function UrgencyBadge({ days }: { days: number }) {
  if (days < 0) return <Badge className="bg-gray-500 text-white text-[10px]">Encerrada</Badge>;
  if (days <= 30) return <Badge className="bg-red-600 text-white text-[10px] animate-pulse">🔴 {days}d</Badge>;
  if (days <= 60) return <Badge className="bg-orange-500 text-white text-[10px]">🟠 {days}d</Badge>;
  if (days <= 90) return <Badge className="bg-yellow-500 text-white text-[10px]">🟡 {days}d</Badge>;
  return <Badge className="bg-emerald-600 text-white text-[10px]">🟢 {days}d</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ativo: { label: 'Ativo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    em_andamento: { label: 'Em andamento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    concluido: { label: 'Concluído', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    suspenso: { label: 'Suspenso', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
    planejado: { label: 'Planejado', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  };
  const info = map[status] || { label: status, className: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.className}`}>{info.label}</span>;
}

function GradientCard({ title, value, sub, icon: Icon, gradient, trend }: {
  title: string; value: string | number; sub: string;
  icon: any; gradient: string; trend?: { value: string; up: boolean };
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/80 text-sm font-medium">{title}</span>
          <div className="bg-white/20 rounded-xl p-2">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="text-3xl font-extrabold tracking-tight mb-1">{value}</div>
        <div className="text-white/70 text-xs">{sub}</div>
        {trend && (
          <div className={`mt-2 text-xs font-semibold flex items-center gap-1 ${trend.up ? 'text-emerald-300' : 'text-rose-300'}`}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardCoordenador() {
  const [, navigate] = useLocation();
  const [selectedProjetoTab, setSelectedProjetoTab] = useState<string>('todos');

  const { data: user, isLoading: userLoading } = useQuery<User>({ queryKey: ['/api/auth/me'] });
  const { data: projetos = [], isLoading: projectsLoading } = useQuery<Projeto[]>({ queryKey: ['/api/projetos'] });
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({ queryKey: ['/api/empreendimentos'] });
  const { data: lancamentos = [], isLoading: lancamentosLoading } = useQuery<Lancamento[]>({ queryKey: ['/api/financeiro/lancamentos'] });
  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({ queryKey: ['/api/categorias-financeiras'] });
  const { data: allUsers = [] } = useQuery<User[]>({ queryKey: ['/api/team-members'] });
  const { data: campanhas = [], isLoading: campanhasLoading } = useQuery<Campanha[]>({ queryKey: ['/api/campanhas'] });

  const isLoading = userLoading || projectsLoading || lancamentosLoading || campanhasLoading;

  const empreendimentoMap = useMemo(() => new Map(empreendimentos.map(e => [e.id, e])), [empreendimentos]);
  const categoriaMap = useMemo(() => new Map(categorias.map(c => [c.id, c])), [categorias]);

  const myProjects = useMemo(() => projetos.filter(p => p.coordenadorId === user?.id), [projetos, user]);
  const myEmpreendimentos = useMemo(() => empreendimentos.filter(e => e.coordenadorId === user?.id), [empreendimentos, user]);
  const myProjectEmprIds = useMemo(() => new Set(myProjects.map(p => p.empreendimentoId)), [myProjects]);
  const myEmpreendimentoIds = useMemo(() => new Set(myEmpreendimentos.map(e => e.id)), [myEmpreendimentos]);
  const allMyEmprIds = useMemo(() => new Set([...Array.from(myProjectEmprIds), ...Array.from(myEmpreendimentoIds)]), [myProjectEmprIds, myEmpreendimentoIds]);

  const myDespesas = useMemo(() => lancamentos.filter(l => allMyEmprIds.has(l.empreendimentoId) && l.tipo === 'despesa'), [lancamentos, allMyEmprIds]);
  const myReceitas = useMemo(() => lancamentos.filter(l => allMyEmprIds.has(l.empreendimentoId) && l.tipo === 'receita'), [lancamentos, allMyEmprIds]);
  const totalGastos = useMemo(() => myDespesas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0), [myDespesas]);
  const totalReceitas = useMemo(() => myReceitas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0), [myReceitas]);

  const myCampanhas = useMemo(() => campanhas.filter(c => allMyEmprIds.has(c.empreendimentoId)), [campanhas, allMyEmprIds]);

  const campanhasComDias = useMemo(() =>
    myCampanhas.map(c => ({ ...c, dias: daysUntil(c.periodoFim), empreendimento: empreendimentoMap.get(c.empreendimentoId) }))
    .filter(c => c.dias >= 0)
    .sort((a, b) => a.dias - b.dias),
  [myCampanhas, empreendimentoMap]);

  const campanhas30 = campanhasComDias.filter(c => c.dias <= 30);
  const campanhas60 = campanhasComDias.filter(c => c.dias > 30 && c.dias <= 60);
  const campanhas90 = campanhasComDias.filter(c => c.dias > 60 && c.dias <= 90);

  const gastosPorProjeto = useMemo(() => myProjects.map(projeto => {
    const empreendimento = empreendimentoMap.get(projeto.empreendimentoId);
    const despesasProjeto = lancamentos.filter(l => l.empreendimentoId === projeto.empreendimentoId && l.tipo === 'despesa');
    const receitasProjeto = lancamentos.filter(l => l.empreendimentoId === projeto.empreendimentoId && l.tipo === 'receita');
    const totalDespesas = despesasProjeto.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
    const totalRec = receitasProjeto.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
    const orcamento = parseFloat(String(projeto.orcamentoPrevisto || 0)) || 0;
    const campanhasProjeto = myCampanhas.filter(c => c.empreendimentoId === projeto.empreendimentoId);
    const proximaCampanha = campanhasProjeto
      .map(c => ({ ...c, dias: daysUntil(c.periodoFim) }))
      .filter(c => c.dias >= 0)
      .sort((a, b) => a.dias - b.dias)[0];
    return {
      id: projeto.id,
      nome: projeto.nome,
      empreendimento: empreendimento?.nome || '-',
      empreendimentoId: projeto.empreendimentoId,
      totalGastos: totalDespesas,
      totalReceitas: totalRec,
      orcamento,
      percentualGasto: orcamento > 0 ? Math.min((totalDespesas / orcamento) * 100, 100) : 0,
      status: projeto.status,
      totalCampanhas: campanhasProjeto.length,
      proximaCampanha,
      saldo: totalRec - totalDespesas,
    };
  }), [myProjects, empreendimentoMap, lancamentos, myCampanhas]);

  const barChartData = gastosPorProjeto.map(p => ({
    nome: p.nome.length > 14 ? p.nome.substring(0, 14) + '…' : p.nome,
    Gastos: Math.round(p.totalGastos),
    Orçamento: Math.round(p.orcamento),
    Receitas: Math.round(p.totalReceitas),
  }));

  const gastosPorCategoria = useMemo(() => {
    const acc: Record<string, { nome: string; valor: number; cor: string }> = {};
    myDespesas.forEach(l => {
      const cat = categoriaMap.get(l.categoriaId);
      const nome = cat?.nome || 'Outros';
      const cor = cat?.cor || '#94a3b8';
      if (!acc[nome]) acc[nome] = { nome, valor: 0, cor };
      acc[nome].valor += parseFloat(l.valor) || 0;
    });
    return Object.values(acc).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [myDespesas, categoriaMap]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { mes: string; gastos: number; receitas: number }> = {};
    [...myDespesas, ...myReceitas].forEach(l => {
      const mes = l.data?.substring(0, 7) || '';
      if (!mes) return;
      if (!map[mes]) map[mes] = { mes, gastos: 0, receitas: 0 };
      if (l.tipo === 'despesa') map[mes].gastos += parseFloat(l.valor) || 0;
      else map[mes].receitas += parseFloat(l.valor) || 0;
    });
    return Object.values(map).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-8).map(d => ({
      ...d,
      mes: d.mes.split('-').reverse().slice(0, 2).join('/'),
      gastos: Math.round(d.gastos),
      receitas: Math.round(d.receitas),
    }));
  }, [myDespesas, myReceitas]);

  const coordenadoresIds = Array.from(new Set(projetos.filter(p => p.coordenadorId).map(p => p.coordenadorId!)));
  const comparativoCoordenadores = coordenadoresIds.map(coordId => {
    const coordUser = allUsers.find(u => u.id === coordId);
    const coordProjects = projetos.filter(p => p.coordenadorId === coordId);
    const coordEmprIds = new Set(coordProjects.map(p => p.empreendimentoId));
    const coordDespesas = lancamentos.filter(l => coordEmprIds.has(l.empreendimentoId) && l.tipo === 'despesa');
    const totalDespesas = coordDespesas.reduce((s, l) => s + (parseFloat(l.valor) || 0), 0);
    return {
      userId: coordId,
      nome: coordUser?.email?.split('@')[0] || `Coord #${coordId}`,
      email: coordUser?.email || '',
      totalProjetos: coordProjects.length,
      totalGastos: totalDespesas,
      isCurrentUser: coordId === user?.id
    };
  }).sort((a, b) => b.totalGastos - a.totalGastos);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (user?.cargo !== 'coordenador') {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">Este painel é exclusivo para coordenadores de projetos.</p>
            <p className="text-sm text-muted-foreground">Cargo atual: <Badge variant="outline">{user?.cargo || 'Não definido'}</Badge></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userName = user?.nome || user?.email?.split('@')[0] || 'Coordenador';
  const totalOrcamento = gastosPorProjeto.reduce((s, p) => s + p.orcamento, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-violet-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-violet-950/20 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ─── HERO ─── */}
        <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/5 rounded-full" />
          </div>
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/70 text-sm mb-1 uppercase tracking-widest font-medium">Meu Painel</p>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Olá, {userName}! 👋</h1>
              <p className="text-white/70 mt-1 text-sm">Acompanhe seus projetos, campanhas e metas em tempo real.</p>
            </div>
            <div className="flex items-center gap-3">
              {campanhas30.length > 0 && (
                <div className="bg-red-500/30 border border-red-400/40 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 animate-pulse" />
                  {campanhas30.length} campanha{campanhas30.length > 1 ? 's' : ''} em 30 dias
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── KPI CARDS ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GradientCard
            title="Meus Projetos"
            value={myProjects.length + myEmpreendimentos.length}
            sub="projetos / empreendimentos"
            icon={FolderKanban}
            gradient="from-violet-600 to-indigo-600"
          />
          <GradientCard
            title="Campanhas Ativas"
            value={campanhasComDias.length}
            sub={`${campanhas30.length} vencem em 30 dias`}
            icon={Calendar}
            gradient="from-cyan-500 to-blue-600"
          />
          <GradientCard
            title="Orçamento Total"
            value={totalOrcamento > 0 ? `R$ ${(totalOrcamento / 1000).toFixed(0)}k` : '—'}
            sub="previsto nos projetos"
            icon={Target}
            gradient="from-emerald-500 to-teal-600"
          />
          <GradientCard
            title="Total de Gastos"
            value={totalGastos > 0 ? `R$ ${(totalGastos / 1000).toFixed(0)}k` : '—'}
            sub={`${myDespesas.length} lançamentos`}
            icon={TrendingDown}
            gradient="from-orange-500 to-rose-500"
          />
        </div>

        {/* ─── ALERTAS DE CAMPANHAS ─── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Alertas de Campanhas</h2>
            <Badge variant="outline" className="ml-2">{campanhasComDias.length} próximas</Badge>
          </div>
          {campanhasComDias.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="font-medium">Nenhuma campanha vencendo nos próximos 90 dias</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 30 dias */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold text-sm mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Próximos 30 dias ({campanhas30.length})
                </div>
                {campanhas30.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 text-center">Nenhuma campanha</div>
                ) : campanhas30.map(c => (
                  <div key={c.id} className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/empreendimentos/${c.empreendimentoId}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.empreendimento?.nome}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">📅 Fim: {formatDate(c.periodoFim)}</p>
                      </div>
                      <UrgencyBadge days={c.dias} />
                    </div>
                  </div>
                ))}
              </div>
              {/* 31-60 dias */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold text-sm mb-2">
                  <Clock className="h-4 w-4" />
                  31 a 60 dias ({campanhas60.length})
                </div>
                {campanhas60.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 text-center">Nenhuma campanha</div>
                ) : campanhas60.map(c => (
                  <div key={c.id} className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/empreendimentos/${c.empreendimentoId}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.empreendimento?.nome}</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">📅 Fim: {formatDate(c.periodoFim)}</p>
                      </div>
                      <UrgencyBadge days={c.dias} />
                    </div>
                  </div>
                ))}
              </div>
              {/* 61-90 dias */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-semibold text-sm mb-2">
                  <Activity className="h-4 w-4" />
                  61 a 90 dias ({campanhas90.length})
                </div>
                {campanhas90.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 text-center">Nenhuma campanha</div>
                ) : campanhas90.map(c => (
                  <div key={c.id} className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/empreendimentos/${c.empreendimentoId}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.empreendimento?.nome}</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">📅 Fim: {formatDate(c.periodoFim)}</p>
                      </div>
                      <UrgencyBadge days={c.dias} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── ACOMPANHAMENTO POR PROJETO ─── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Acompanhamento por Projeto</h2>
          </div>
          <Tabs value={selectedProjetoTab} onValueChange={setSelectedProjetoTab}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="todos">Visão Geral</TabsTrigger>
              {gastosPorProjeto.map(p => (
                <TabsTrigger key={p.id} value={String(p.id)} className="max-w-[160px] truncate">
                  {p.nome}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Visão Geral */}
            <TabsContent value="todos">
              {gastosPorProjeto.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <FolderKanban className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>Nenhum projeto atribuído a você ainda.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gastosPorProjeto.map((p, idx) => (
                    <Card key={p.id} className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-sm bg-white dark:bg-gray-900"
                      onClick={() => navigate(`/empreendimentos/${p.empreendimentoId}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{p.nome}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.empreendimento}</p>
                          </div>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-gradient-to-br ${GRADIENT_CARDS[idx % GRADIENT_CARDS.length]}`}>
                            {(idx + 1).toString().padStart(2, '0')}
                          </div>
                        </div>
                        <StatusBadge status={p.status} />
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Orçamento utilizado</span>
                            <span className={`font-semibold ${p.percentualGasto >= 90 ? 'text-red-600' : p.percentualGasto >= 70 ? 'text-orange-500' : 'text-emerald-600'}`}>
                              {p.orcamento > 0 ? `${p.percentualGasto.toFixed(0)}%` : '—'}
                            </span>
                          </div>
                          <Progress value={p.percentualGasto} className="h-2" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">Gastos</p>
                            <p className="text-xs font-bold text-red-600">{formatCurrency(p.totalGastos)}</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                            <p className="text-[10px] text-muted-foreground">Campanhas</p>
                            <p className="text-xs font-bold text-violet-600 dark:text-violet-400">{p.totalCampanhas}</p>
                          </div>
                        </div>
                        {p.proximaCampanha && (
                          <div className="mt-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-2 py-1.5 flex items-center justify-between gap-1">
                            <p className="text-[10px] text-blue-700 dark:text-blue-400 font-medium truncate">
                              📅 {p.proximaCampanha.nome}
                            </p>
                            <UrgencyBadge days={p.proximaCampanha.dias} />
                          </div>
                        )}
                        <div className="mt-3 flex items-center text-xs text-muted-foreground hover:text-violet-600 transition-colors">
                          Ver detalhes <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Aba individual por projeto */}
            {gastosPorProjeto.map(p => (
              <TabsContent key={p.id} value={String(p.id)}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl p-4 text-white">
                      <p className="text-white/70 text-xs">Orçamento</p>
                      <p className="text-xl font-extrabold">{p.orcamento > 0 ? `R$ ${(p.orcamento / 1000).toFixed(0)}k` : '—'}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
                      <p className="text-white/70 text-xs">Gastos</p>
                      <p className="text-xl font-extrabold">{formatCurrency(p.totalGastos)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
                      <p className="text-white/70 text-xs">Receitas</p>
                      <p className="text-xl font-extrabold">{formatCurrency(p.totalReceitas)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white">
                      <p className="text-white/70 text-xs">Campanhas</p>
                      <p className="text-xl font-extrabold">{p.totalCampanhas}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Utilização do Orçamento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Utilizado</span>
                          <span className={`font-bold ${p.percentualGasto >= 90 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {p.orcamento > 0 ? `${p.percentualGasto.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <Progress value={p.percentualGasto} className="h-3 mb-4" />
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Saldo</p>
                            <p className={`font-bold ${p.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(p.saldo)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Status</p>
                            <StatusBadge status={p.status} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-violet-500" />
                          Campanhas do Projeto
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {myCampanhas.filter(c => c.empreendimentoId === p.empreendimentoId).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma campanha cadastrada</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {myCampanhas.filter(c => c.empreendimentoId === p.empreendimentoId)
                              .map(c => {
                                const dias = daysUntil(c.periodoFim);
                                return (
                                  <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold truncate">{c.nome}</p>
                                      <p className="text-[10px] text-muted-foreground">{formatDate(c.periodoInicio)} → {formatDate(c.periodoFim)}</p>
                                    </div>
                                    <UrgencyBadge days={dias} />
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate(`/empreendimentos/${p.empreendimentoId}`)}
                      className="flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 font-semibold hover:underline"
                    >
                      Abrir página completa do empreendimento <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ─── GRÁFICOS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Gastos vs Orçamento por Projeto
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Gastos" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Orçamento" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Receitas" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Nenhum dado financeiro disponível
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-sm">Gastos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {gastosPorCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={gastosPorCategoria} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      dataKey="valor" nameKey="nome" paddingAngle={3}>
                      {gastosPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor || CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Nenhuma despesa registrada
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── EVOLUÇÃO MENSAL ─── */}
        {monthlyData.length > 1 && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                Evolução Mensal – Gastos vs Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ left: 8, right: 8 }}>
                  <defs>
                    <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" fill="url(#colorGastos)" strokeWidth={2} />
                  <Area type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" fill="url(#colorReceitas)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ─── COMPARATIVO DE COORDENADORES ─── */}
        {comparativoCoordenadores.length > 0 && (
          <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Comparativo de Gastos por Coordenador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {comparativoCoordenadores.map((coord, idx) => (
                  <div key={coord.userId}
                    className={`flex items-center gap-4 p-3 rounded-xl ${coord.isCurrentUser ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <span className="text-base font-bold text-gray-400 w-7">#{idx + 1}</span>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className={coord.isCurrentUser ? 'bg-violet-600 text-white text-xs' : 'bg-gray-600 text-white text-xs'}>
                        {getInitials(coord.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {coord.nome}
                        {coord.isCurrentUser && <Badge className="ml-2 bg-violet-600 text-white text-[10px]">Você</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{coord.totalProjetos} projeto(s)</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-red-600">{formatCurrency(coord.totalGastos)}</span>
                      <p className="text-xs text-muted-foreground">gastos totais</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── TABELA DETALHADA ─── */}
        <Card className="border-0 shadow-sm bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm">Detalhamento dos Meus Projetos</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Orçamento</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">% Utilizado</TableHead>
                  <TableHead>Campanhas</TableHead>
                  <TableHead>Próx. Campanha</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastosPorProjeto.map(projeto => (
                  <TableRow key={projeto.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/empreendimentos/${projeto.empreendimentoId}`)}>
                    <TableCell className="font-medium">{projeto.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{projeto.empreendimento}</TableCell>
                    <TableCell className="text-right">{formatCurrency(projeto.orcamento)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatCurrency(projeto.totalGastos)}</TableCell>
                    <TableCell className={`text-right font-semibold ${projeto.percentualGasto >= 90 ? 'text-red-600' : projeto.percentualGasto >= 70 ? 'text-orange-500' : 'text-emerald-600'}`}>
                      {projeto.orcamento > 0 ? `${projeto.percentualGasto.toFixed(1)}%` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-violet-600 border-violet-300">{projeto.totalCampanhas}</Badge>
                    </TableCell>
                    <TableCell>
                      {projeto.proximaCampanha ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs truncate max-w-[120px]">{projeto.proximaCampanha.nome}</span>
                          <UrgencyBadge days={projeto.proximaCampanha.dias} />
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><StatusBadge status={projeto.status} /></TableCell>
                  </TableRow>
                ))}
                {gastosPorProjeto.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum projeto atribuído a você
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
