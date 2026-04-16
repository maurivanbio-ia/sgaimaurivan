import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, FolderKanban, TrendingDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip, PieChart, Pie, Cell } from "recharts";

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
  orcamentoPrevisto: string | null;
}

interface Empreendimento {
  id: number;
  nome: string;
  cliente: string;
  unidade: string;
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

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

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

  const { data: lancamentos = [], isLoading: lancamentosLoading } = useQuery<Lancamento[]>({
    queryKey: ['/api/financeiro/lancamentos'],
  });

  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({
    queryKey: ['/api/categorias-financeiras'],
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/team-members'],
  });

  const isLoading = userLoading || projectsLoading || lancamentosLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="loading-state">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (user?.cargo !== 'coordenador') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">
              Este painel é exclusivo para coordenadores de projetos.
            </p>
            <p className="text-sm text-muted-foreground">
              Seu cargo atual: <Badge variant="outline">{user?.cargo || 'Não definido'}</Badge>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myProjects = projetos.filter(p => p.coordenadorId === user?.id);
  const myEmpreendimentos = empreendimentos.filter(e => (e as any).coordenadorId === user?.id);
  const empreendimentoMap = new Map(empreendimentos.map(e => [e.id, e]));
  const categoriaMap = new Map(categorias.map(c => [c.id, c]));
  const myProjectEmprIds = new Set(myProjects.map(p => p.empreendimentoId));
  const myEmpreendimentoIds = new Set(myEmpreendimentos.map(e => e.id));
  const allMyEmprIds = new Set([...Array.from(myProjectEmprIds), ...Array.from(myEmpreendimentoIds)]);
  
  // Filtra despesas: mostra dos projetos OU empreendimentos onde o usuário é coordenador
  const myDespesas = lancamentos.filter(l => allMyEmprIds.has(l.empreendimentoId) && l.tipo === 'despesa');
  
  const totalGastos = myDespesas.reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);

  // Gastos por projeto: mostra apenas projetos onde o usuário é coordenador
  const gastosPorProjeto = myProjects.map(projeto => {
    const empreendimento = empreendimentoMap.get(projeto.empreendimentoId);
    const despesasProjeto = lancamentos.filter(l => 
      l.empreendimentoId === projeto.empreendimentoId && l.tipo === 'despesa'
    );
    const totalDespesas = despesasProjeto.reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);
    const orcamento = parseFloat(String(projeto.orcamentoPrevisto || 0)) || 0;
    
    return {
      id: projeto.id,
      nome: projeto.nome,
      empreendimento: empreendimento?.nome || '-',
      empreendimentoId: projeto.empreendimentoId,
      totalGastos: totalDespesas,
      orcamento,
      percentualGasto: orcamento > 0 ? (totalDespesas / orcamento) * 100 : 0,
      status: projeto.status
    };
  });

  const gastosPorCategoria = myDespesas.reduce((acc, l) => {
    const categoria = categoriaMap.get(l.categoriaId);
    const nome = categoria?.nome || 'Outros';
    const cor = categoria?.cor || '#94a3b8';
    if (!acc[nome]) {
      acc[nome] = { nome, valor: 0, cor };
    }
    acc[nome].valor += parseFloat(l.valor) || 0;
    return acc;
  }, {} as Record<string, { nome: string; valor: number; cor: string }>);

  const categoriaChartData = Object.values(gastosPorCategoria)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8);

  const coordenadoresIds = Array.from(new Set(projetos.filter(p => p.coordenadorId).map(p => p.coordenadorId!)));
  
  const comparativoCoordenadores = coordenadoresIds.map(coordId => {
    const coordUser = allUsers.find(u => u.id === coordId);
    const coordProjects = projetos.filter(p => p.coordenadorId === coordId);
    const coordEmprIds = new Set(coordProjects.map(p => p.empreendimentoId));
    const coordDespesas = lancamentos.filter(l => 
      coordEmprIds.has(l.empreendimentoId) && l.tipo === 'despesa'
    );
    const totalDespesas = coordDespesas.reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0);
    
    return {
      userId: coordId,
      nome: coordUser?.email?.split('@')[0] || `Coord #${coordId}`,
      email: coordUser?.email || '',
      totalProjetos: coordProjects.length,
      totalGastos: totalDespesas,
      isCurrentUser: coordId === user?.id
    };
  }).sort((a, b) => b.totalGastos - a.totalGastos);

  const barChartData = gastosPorProjeto.map(p => ({
    nome: p.nome.length > 15 ? p.nome.substring(0, 15) + '...' : p.nome,
    gastos: p.totalGastos,
    orcamento: p.orcamento
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" data-testid="dashboard-coordenador">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
          <h1 className="text-3xl font-bold mb-2" data-testid="welcome-message">
            Bem-vindo, {user?.email.split('@')[0]}!
          </h1>
          <p className="text-white/80">Painel do Coordenador - Acompanhamento de Gastos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-testid="card-total-projetos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meus Projetos</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myProjects.length + myEmpreendimentos.length}</div>
              <p className="text-xs text-muted-foreground">projetos/empreendimentos sob sua coordenação</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-gastos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Gastos</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalGastos)}</div>
              <p className="text-xs text-muted-foreground">despesas nos seus projetos</p>
            </CardContent>
          </Card>

          <Card data-testid="card-lancamentos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myDespesas.length}</div>
              <p className="text-xs text-muted-foreground">despesas registradas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="gastos-por-projeto-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Gastos por Empreendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v: number) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" width={100} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="gastos" name="Gastos" fill="#ef4444" />
                    <Bar dataKey="orcamento" name="Orçamento" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhum projeto atribuído
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="gastos-por-categoria-chart">
            <CardHeader>
              <CardTitle>Gastos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoriaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoriaChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="valor"
                      nameKey="nome"
                      label={({ nome, valor }: { nome: string; valor: number }) => 
                        `${nome.length > 10 ? nome.substring(0, 10) + '...' : nome}`
                      }
                    >
                      {categoriaChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhuma despesa registrada
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="comparativo-coordenadores">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Comparativo de Gastos por Coordenador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comparativoCoordenadores.map((coord, idx) => (
                <div 
                  key={coord.userId} 
                  className={`flex items-center gap-4 p-3 rounded-lg ${coord.isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800'}`}
                  data-testid={`comparativo-item-${idx}`}
                >
                  <span className="text-lg font-bold text-gray-500 w-8">
                    #{idx + 1}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={coord.isCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'}>
                      {getInitials(coord.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">
                      {coord.nome}
                      {coord.isCurrentUser && <Badge className="ml-2 bg-blue-500">Você</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">{coord.totalProjetos} projeto(s)</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-red-600">
                      {formatCurrency(coord.totalGastos)}
                    </span>
                    <p className="text-xs text-muted-foreground">gastos totais</p>
                  </div>
                </div>
              ))}
              {comparativoCoordenadores.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Nenhum coordenador com projetos atribuídos</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="projects-table-card">
          <CardHeader>
            <CardTitle>Detalhamento dos Meus Projetos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Orçamento</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">% Utilizado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastosPorProjeto.map((projeto) => (
                  <TableRow 
                    key={projeto.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/empreendimentos/${projeto.empreendimentoId}`)}
                    data-testid={`project-row-${projeto.id}`}
                  >
                    <TableCell className="font-medium">{projeto.nome}</TableCell>
                    <TableCell>{projeto.empreendimento}</TableCell>
                    <TableCell className="text-right">{formatCurrency(projeto.orcamento)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {formatCurrency(projeto.totalGastos)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${projeto.percentualGasto > 100 ? 'text-red-600' : projeto.percentualGasto > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {projeto.orcamento > 0 ? `${projeto.percentualGasto.toFixed(1)}%` : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(projeto.status || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {gastosPorProjeto.length === 0 && (
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
