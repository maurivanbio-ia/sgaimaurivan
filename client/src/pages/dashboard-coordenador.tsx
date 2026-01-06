import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, TrendingUp, Wallet, DollarSign, FolderKanban, Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

interface User {
  id: number;
  email: string;
  role: string;
  cargo: string;
  unidade: string;
}

interface Projeto {
  id: number;
  nome: string;
  descricao: string | null;
  status: string;
  coordenadorId: number | null;
  empreendimentoId: number;
  valorContratado: string | null;
  valorRecebido: string | null;
  orcamentoPrevisto: string | null;
  metaReducaoGastos: string | null;
  bmmServicos: string | null;
  ndReembolsaveis: string | null;
}

interface Empreendimento {
  id: number;
  nome: string;
  cliente: string;
}

interface CoordinatorRanking {
  userId: number;
  email: string;
  totalProjetos: number;
  valorContratado: number;
  valorRecebido: number;
  eficiencia: number;
}

interface Lancamento {
  id: number;
  tipo: string;
  valor: string;
  data: string;
  bmmServicos: string | null;
  ndReembolsaveis: string | null;
  empreendimentoId: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function getBadgeInfo(efficiency: number) {
  if (efficiency >= 95) return { name: 'Ouro', color: 'bg-yellow-500', icon: Trophy, nextThreshold: 100, progress: 100 };
  if (efficiency >= 85) return { name: 'Prata', color: 'bg-gray-400', icon: Medal, nextThreshold: 95, progress: ((efficiency - 85) / 10) * 100 };
  if (efficiency >= 75) return { name: 'Bronze', color: 'bg-orange-600', icon: Award, nextThreshold: 85, progress: ((efficiency - 75) / 10) * 100 };
  return { name: 'Iniciante', color: 'bg-slate-500', icon: Target, nextThreshold: 75, progress: (efficiency / 75) * 100 };
}

function getEfficiencyColor(efficiency: number): string {
  if (efficiency >= 80) return 'text-green-600 dark:text-green-400';
  if (efficiency >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0);
}

function getInitials(email: string): string {
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

export default function DashboardCoordenador() {
  const [, navigate] = useLocation();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: projetos = [], isLoading: projectsLoading } = useQuery<Projeto[]>({
    queryKey: ['/api/projetos'],
  });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ['/api/empreendimentos'],
  });

  const { data: ranking = [], isLoading: rankingLoading } = useQuery<CoordinatorRanking[]>({
    queryKey: ['/api/coordenadores/ranking'],
  });

  const { data: lancamentos = [], isLoading: lancamentosLoading } = useQuery<Lancamento[]>({
    queryKey: ['/api/financeiro/lancamentos'],
  });

  const myProjects = projetos.filter(p => p.coordenadorId === user?.id);
  
  const totalContratado = myProjects.reduce((sum, p) => sum + (parseFloat(String(p.valorContratado || 0)) || 0), 0);
  const totalRecebido = myProjects.reduce((sum, p) => sum + (parseFloat(String(p.valorRecebido || 0)) || 0), 0);
  const eficienciaGeral = totalContratado > 0 ? (totalRecebido / totalContratado) * 100 : 0;
  
  const badgeInfo = getBadgeInfo(eficienciaGeral);
  const BadgeIcon = badgeInfo.icon;

  const statusCounts = myProjects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value
  }));

  const empreendimentoMap = new Map(empreendimentos.map(e => [e.id, e]));
  const myProjectEmprIds = new Set(myProjects.map(p => p.empreendimentoId));
  const myLancamentos = lancamentos.filter(l => myProjectEmprIds.has(l.empreendimentoId));

  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      year: date.getFullYear(),
      monthNum: date.getMonth()
    };
  }).reverse();

  const expenseTrend = last12Months.map(({ month, year, monthNum }) => {
    const monthLancamentos = myLancamentos.filter(l => {
      const d = new Date(l.data);
      return d.getMonth() === monthNum && d.getFullYear() === year && l.tipo === 'despesa';
    });
    
    const bmmTotal = monthLancamentos
      .filter(l => l.bmmServicos)
      .reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);
    
    const ndTotal = monthLancamentos
      .filter(l => l.ndReembolsaveis)
      .reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);

    return { month, 'BMM-Serviços': bmmTotal, 'ND-Reembolsáveis': ndTotal };
  });

  const myRankPosition = ranking.findIndex(r => r.userId === user?.id) + 1;
  const top5 = ranking.slice(0, 5);

  const isLoading = userLoading || projectsLoading || rankingLoading || lancamentosLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="loading-state">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" data-testid="dashboard-coordenador">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl">
          <h1 className="text-3xl font-bold mb-2" data-testid="welcome-message">
            Bem-vindo, {user?.email.split('@')[0]}!
          </h1>
          <p className="text-white/80">Painel de Gamificação do Coordenador</p>
          
          <div className="flex items-center gap-4 mt-4">
            <div className={`p-3 rounded-full ${badgeInfo.color}`}>
              <BadgeIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <Badge className={`${badgeInfo.color} text-white text-lg px-3 py-1`} data-testid="badge-level">
                Nível {badgeInfo.name}
              </Badge>
              {badgeInfo.name !== 'Ouro' && (
                <div className="mt-2">
                  <p className="text-sm text-white/70">Próximo nível: {badgeInfo.nextThreshold}% de eficiência</p>
                  <Progress value={badgeInfo.progress} className="h-2 mt-1 bg-white/20" data-testid="progress-next-badge" />
                </div>
              )}
            </div>
            {myRankPosition > 0 && (
              <div className="ml-auto text-right">
                <p className="text-white/70 text-sm">Sua posição no ranking</p>
                <p className="text-4xl font-bold" data-testid="rank-position">#{myRankPosition}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card data-testid="card-total-projetos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projetos</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myProjects.length}</div>
              <p className="text-xs text-muted-foreground">projetos sob sua coordenação</p>
            </CardContent>
          </Card>

          <Card data-testid="card-valor-contratado">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Contratado</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalContratado)}</div>
              <p className="text-xs text-muted-foreground">valor total dos contratos</p>
            </CardContent>
          </Card>

          <Card data-testid="card-valor-recebido">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Recebido</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalRecebido)}</div>
              <p className="text-xs text-muted-foreground">valor efetivamente recebido</p>
            </CardContent>
          </Card>

          <Card data-testid="card-eficiencia">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eficiência Geral</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getEfficiencyColor(eficienciaGeral)}`}>
                {eficienciaGeral.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">recebido vs contratado</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="ranking-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Coordenadores (Top 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {top5.map((coord, idx) => (
                  <div 
                    key={coord.userId} 
                    className={`flex items-center gap-4 p-3 rounded-lg ${coord.userId === user?.id ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800'}`}
                    data-testid={`ranking-item-${idx}`}
                  >
                    <span className={`text-2xl font-bold ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                      #{idx + 1}
                    </span>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-green-600 text-white">
                        {getInitials(coord.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{coord.email.split('@')[0]}</p>
                      <p className="text-sm text-muted-foreground">{coord.totalProjetos} projetos</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${getEfficiencyColor(coord.eficiencia)}`}>
                        {coord.eficiencia.toFixed(1)}%
                      </span>
                      <Badge className={getBadgeInfo(coord.eficiencia).color + ' text-white ml-2'}>
                        {getBadgeInfo(coord.eficiencia).name}
                      </Badge>
                    </div>
                  </div>
                ))}
                {top5.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">Nenhum coordenador com projetos atribuídos</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="status-chart-card">
            <CardHeader>
              <CardTitle>Projetos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhum projeto atribuído
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="expense-trend-card">
          <CardHeader>
            <CardTitle>Tendência de Despesas (Últimos 12 Meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={expenseTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v: number) => `R$ ${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="BMM-Serviços" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="ND-Reembolsáveis" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="projects-table-card">
          <CardHeader>
            <CardTitle>Meus Projetos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Valor Contratado</TableHead>
                  <TableHead className="text-right">Valor Recebido</TableHead>
                  <TableHead className="text-right">Eficiência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myProjects.map((projeto) => {
                  const contratado = parseFloat(String(projeto.valorContratado || 0)) || 0;
                  const recebido = parseFloat(String(projeto.valorRecebido || 0)) || 0;
                  const efficiency = contratado > 0 ? (recebido / contratado) * 100 : 0;
                  const empreendimento = empreendimentoMap.get(projeto.empreendimentoId);
                  
                  return (
                    <TableRow 
                      key={projeto.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/empreendimentos/${projeto.empreendimentoId}`)}
                      data-testid={`project-row-${projeto.id}`}
                    >
                      <TableCell className="font-medium">{projeto.nome}</TableCell>
                      <TableCell>{empreendimento?.nome || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(contratado)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(recebido)}</TableCell>
                      <TableCell className={`text-right font-semibold ${getEfficiencyColor(efficiency)}`}>
                        {efficiency.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(projeto.status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {myProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
