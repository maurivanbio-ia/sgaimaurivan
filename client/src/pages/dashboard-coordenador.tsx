import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, FolderKanban, TrendingDown, BarChart3, RefreshCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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
  coordenadorId: number | null;
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

const FALLBACK_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function toNumberBR(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const raw = value.trim();
  if (!raw) return 0;

  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/[R$]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? toNumberBR(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num || 0);
}

function safeUserLabel(email?: string): string {
  if (!email) return "Usuário";
  const left = email.split("@")[0] || "Usuário";
  return left || "Usuário";
}

function getInitials(email?: string): string {
  const label = safeUserLabel(email);
  const letters = label.replace(/[^a-zA-Z0-9]/g, "");
  const two = (letters.slice(0, 2) || "US").toUpperCase();
  return two;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha ao carregar ${url}. Status ${res.status}. ${txt}`);
  }
  return res.json() as Promise<T>;
}

type MoneyTickMode = "auto" | "full";
function formatAxisMoney(value: number, mode: MoneyTickMode = "auto"): string {
  if (!Number.isFinite(value)) return "R$ 0";
  if (mode === "full") return formatCurrency(value);

  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0)} mil`;
  return `R$ ${value.toFixed(0)}`;
}

export default function DashboardCoordenador() {
  const [, navigate] = useLocation();

  const userQuery = useQuery<User>({
    queryKey: ["/api/auth/me"],
    queryFn: () => fetchJSON<User>("/api/auth/me"),
    staleTime: 60_000,
    retry: 2,
  });

  const projetosQuery = useQuery<Projeto[]>({
    queryKey: ["/api/projetos"],
    queryFn: () => fetchJSON<Projeto[]>("/api/projetos"),
    staleTime: 60_000,
    retry: 2,
    enabled: !!userQuery.data,
  });

  const empreendimentosQuery = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: () => fetchJSON<Empreendimento[]>("/api/empreendimentos"),
    staleTime: 60_000,
    retry: 2,
    enabled: !!userQuery.data,
  });

  const lancamentosQuery = useQuery<Lancamento[]>({
    queryKey: ["/api/financeiro/lancamentos"],
    queryFn: () => fetchJSON<Lancamento[]>("/api/financeiro/lancamentos"),
    staleTime: 30_000,
    retry: 2,
    enabled: !!userQuery.data,
  });

  const categoriasQuery = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    queryFn: () => fetchJSON<CategoriaFinanceira[]>("/api/categorias-financeiras"),
    staleTime: 5 * 60_000,
    retry: 2,
    enabled: !!userQuery.data,
  });

  const user = userQuery.data;
  const projetos = projetosQuery.data ?? [];
  const empreendimentos = empreendimentosQuery.data ?? [];
  const lancamentos = lancamentosQuery.data ?? [];
  const categorias = categoriasQuery.data ?? [];

  const isLoading =
    userQuery.isLoading ||
    projetosQuery.isLoading ||
    empreendimentosQuery.isLoading ||
    lancamentosQuery.isLoading ||
    categoriasQuery.isLoading;

  const hasError =
    userQuery.isError ||
    projetosQuery.isError ||
    empreendimentosQuery.isError ||
    lancamentosQuery.isError ||
    categoriasQuery.isError;

  const errorMessage =
    (userQuery.error as Error | undefined)?.message ||
    (projetosQuery.error as Error | undefined)?.message ||
    (empreendimentosQuery.error as Error | undefined)?.message ||
    (lancamentosQuery.error as Error | undefined)?.message ||
    (categoriasQuery.error as Error | undefined)?.message ||
    "";

  const canSeeComparativo = React.useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    const cargo = (user?.cargo || "").toLowerCase();
    return role === "admin" || cargo === "diretor" || cargo === "administrador";
  }, [user?.role, user?.cargo]);

  const {
    myProjects,
    myEmpreendimentos,
    allMyEmpreendimentoIds,
    empreendimentoMap,
    categoriaMap,
    despesasByEmpreendimentoId,
    totalDespesasByEmpreendimentoId,
    myDespesas,
    totalGastos,
    orcamentoByEmpreendimentoId,
    empreendimentosResumo,
    categoriaChartData,
    barChartDataEmpreendimentos,
  } = React.useMemo(() => {
    const empreendimentoMap = new Map<number, Empreendimento>();
    for (const e of empreendimentos) empreendimentoMap.set(e.id, e);

    const categoriaMap = new Map<number, CategoriaFinanceira>();
    for (const c of categorias) categoriaMap.set(c.id, c);

    const myProjects = user ? projetos.filter((p) => p.coordenadorId === user.id) : [];
    const myEmpreendimentos = user ? empreendimentos.filter((e) => e.coordenadorId === user.id) : [];

    const myProjectEmprIds = new Set<number>(myProjects.map((p) => p.empreendimentoId));
    const myEmpreendimentoIds = new Set<number>(myEmpreendimentos.map((e) => e.id));
    const allMyEmpreendimentoIds = new Set<number>([...myProjectEmprIds, ...myEmpreendimentoIds]);

    const despesasByEmpreendimentoId = new Map<number, Lancamento[]>();
    const totalDespesasByEmpreendimentoId = new Map<number, number>();

    const myDespesas: Lancamento[] = [];
    for (const l of lancamentos) {
      if (l.tipo !== "despesa") continue;
      if (!allMyEmpreendimentoIds.has(l.empreendimentoId)) continue;

      myDespesas.push(l);

      const arr = despesasByEmpreendimentoId.get(l.empreendimentoId) ?? [];
      arr.push(l);
      despesasByEmpreendimentoId.set(l.empreendimentoId, arr);

      const prev = totalDespesasByEmpreendimentoId.get(l.empreendimentoId) ?? 0;
      totalDespesasByEmpreendimentoId.set(l.empreendimentoId, prev + toNumberBR(l.valor));
    }

    const totalGastos = myDespesas.reduce((sum, l) => sum + toNumberBR(l.valor), 0);

    const orcamentoByEmpreendimentoId = new Map<number, number>();
    for (const p of myProjects) {
      const prev = orcamentoByEmpreendimentoId.get(p.empreendimentoId) ?? 0;
      orcamentoByEmpreendimentoId.set(p.empreendimentoId, prev + toNumberBR(p.orcamentoPrevisto));
    }

    const empreendimentosResumo = Array.from(allMyEmpreendimentoIds).map((empreendimentoId) => {
      const empreendimento = empreendimentoMap.get(empreendimentoId);
      const totalDespesas = totalDespesasByEmpreendimentoId.get(empreendimentoId) ?? 0;
      const orcamento = orcamentoByEmpreendimentoId.get(empreendimentoId) ?? 0;

      const percentualGasto = orcamento > 0 ? (totalDespesas / orcamento) * 100 : 0;

      return {
        empreendimentoId,
        empreendimentoNome: empreendimento?.nome || "Empreendimento",
        cliente: empreendimento?.cliente || "",
        unidade: empreendimento?.unidade || "",
        totalGastos: totalDespesas,
        orcamento,
        percentualGasto,
        projetosVinculados: myProjects.filter((p) => p.empreendimentoId === empreendimentoId).length,
      };
    });

    empreendimentosResumo.sort((a, b) => b.totalGastos - a.totalGastos);

    const gastosPorCategoriaAgg = new Map<
      string,
      { nome: string; valor: number; cor: string }
    >();

    for (const l of myDespesas) {
      const categoria = categoriaMap.get(l.categoriaId);
      const nome = categoria?.nome || "Outros";
      const cor = categoria?.cor || "#94a3b8";
      const prev = gastosPorCategoriaAgg.get(nome) ?? { nome, valor: 0, cor };
      prev.valor += toNumberBR(l.valor);
      prev.cor = cor || prev.cor;
      gastosPorCategoriaAgg.set(nome, prev);
    }

    const categoriaChartData = Array.from(gastosPorCategoriaAgg.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    const barChartDataEmpreendimentos = empreendimentosResumo.map((e) => ({
      nome: e.empreendimentoNome.length > 18 ? `${e.empreendimentoNome.slice(0, 18)}...` : e.empreendimentoNome,
      gastos: e.totalGastos,
      orcamento: e.orcamento,
    }));

    return {
      myProjects,
      myEmpreendimentos,
      allMyEmpreendimentoIds,
      empreendimentoMap,
      categoriaMap,
      despesasByEmpreendimentoId,
      totalDespesasByEmpreendimentoId,
      myDespesas,
      totalGastos,
      orcamentoByEmpreendimentoId,
      empreendimentosResumo,
      categoriaChartData,
      barChartDataEmpreendimentos,
    };
  }, [user, projetos, empreendimentos, lancamentos, categorias]);

  const allUsersQuery = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => fetchJSON<User[]>("/api/users"),
    staleTime: 5 * 60_000,
    retry: 2,
    enabled: !!user && canSeeComparativo,
  });

  const allUsers = allUsersQuery.data ?? [];

  const comparativoCoordenadores = React.useMemo(() => {
    if (!canSeeComparativo) return [];

    const coordIds = Array.from(
      new Set(
        projetos
          .filter((p) => p.coordenadorId != null)
          .map((p) => p.coordenadorId as number),
      ),
    );

    const coordProjectsById = new Map<number, Projeto[]>();
    for (const p of projetos) {
      if (!p.coordenadorId) continue;
      const arr = coordProjectsById.get(p.coordenadorId) ?? [];
      arr.push(p);
      coordProjectsById.set(p.coordenadorId, arr);
    }

    const totalDespesaByEmpIdGlobal = new Map<number, number>();
    for (const l of lancamentos) {
      if (l.tipo !== "despesa") continue;
      const prev = totalDespesaByEmpIdGlobal.get(l.empreendimentoId) ?? 0;
      totalDespesaByEmpIdGlobal.set(l.empreendimentoId, prev + toNumberBR(l.valor));
    }

    const result = coordIds.map((coordId) => {
      const coordUser = allUsers.find((u) => u.id === coordId);
      const coordProjects = coordProjectsById.get(coordId) ?? [];
      const coordEmpIds = new Set(coordProjects.map((p) => p.empreendimentoId));

      let totalGastos = 0;
      for (const empId of coordEmpIds) {
        totalGastos += totalDespesaByEmpIdGlobal.get(empId) ?? 0;
      }

      return {
        userId: coordId,
        nome: safeUserLabel(coordUser?.email),
        email: coordUser?.email ?? "",
        totalProjetos: coordProjects.length,
        totalGastos,
        isCurrentUser: coordId === user?.id,
      };
    });

    result.sort((a, b) => b.totalGastos - a.totalGastos);
    return result;
  }, [canSeeComparativo, projetos, lancamentos, allUsers, user?.id]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="loading-state">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-10 w-10 text-yellow-500 mt-1" />
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Falha ao carregar o painel</h2>
                <p className="text-sm text-muted-foreground">
                  Ocorreu um erro ao buscar os dados. Você pode tentar novamente agora.
                </p>
                {errorMessage ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{errorMessage}</p>
                ) : null}
                <div className="pt-2">
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                    onClick={() => {
                      userQuery.refetch();
                      projetosQuery.refetch();
                      empreendimentosQuery.refetch();
                      lancamentosQuery.refetch();
                      categoriasQuery.refetch();
                      if (canSeeComparativo) allUsersQuery.refetch();
                    }}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Recarregar
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || (user.cargo || "").toLowerCase() !== "coordenador") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">Este painel é exclusivo para coordenadores de projetos.</p>
            <p className="text-sm text-muted-foreground">
              Seu cargo atual. <Badge variant="outline">{user?.cargo || "Não definido"}</Badge>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6"
      data-testid="dashboard-coordenador"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
          <h1 className="text-3xl font-bold mb-2" data-testid="welcome-message">
            Bem vindo, {safeUserLabel(user.email)}.
          </h1>
          <p className="text-white/80">Painel do Coordenador. Acompanhamento financeiro por empreendimento.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-testid="card-total-projetos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sob sua coordenação</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myProjects.length} projeto(s)</div>
              <p className="text-xs text-muted-foreground">{allMyEmpreendimentoIds.size} empreendimento(s) vinculado(s)</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-gastos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de gastos</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalGastos)}</div>
              <p className="text-xs text-muted-foreground">despesas nos empreendimentos sob sua coordenação</p>
            </CardContent>
          </Card>

          <Card data-testid="card-lancamentos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myDespesas.length}</div>
              <p className="text-xs text-muted-foreground">despesas registradas no seu escopo</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="gastos-por-empreendimento-chart">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Gastos por empreendimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartDataEmpreendimentos.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={barChartDataEmpreendimentos} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v: number) => formatAxisMoney(v, "auto")} />
                    <YAxis type="category" dataKey="nome" width={140} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="gastos" name="Gastos" fill="#ef4444" />
                    <Bar dataKey="orcamento" name="Orçamento" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">Nenhum empreendimento atribuído</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="gastos-por-categoria-chart">
            <CardHeader>
              <CardTitle>Gastos por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoriaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={categoriaChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="valor"
                      nameKey="nome"
                      label={({ nome }: { nome: string }) =>
                        `${nome.length > 12 ? nome.substring(0, 12) + "..." : nome}`
                      }
                    >
                      {categoriaChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">Nenhuma despesa registrada</div>
              )}
            </CardContent>
          </Card>
        </div>

        {canSeeComparativo ? (
          <Card data-testid="comparativo-coordenadores">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparativo de gastos por coordenador
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allUsersQuery.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {comparativoCoordenadores.map((coord, idx) => (
                    <div
                      key={coord.userId}
                      className={`flex items-center gap-4 p-3 rounded-lg ${
                        coord.isCurrentUser
                          ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                          : "bg-gray-50 dark:bg-gray-800"
                      }`}
                      data-testid={`comparativo-item-${idx}`}
                    >
                      <span className="text-lg font-bold text-gray-500 w-8">#{idx + 1}</span>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={coord.isCurrentUser ? "bg-blue-600 text-white" : "bg-gray-600 text-white"}>
                          {getInitials(coord.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {coord.nome}
                          {coord.isCurrentUser ? <Badge className="ml-2 bg-blue-500">Você</Badge> : null}
                        </p>
                        <p className="text-sm text-muted-foreground">{coord.totalProjetos} projeto(s)</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-red-600">{formatCurrency(coord.totalGastos)}</span>
                        <p className="text-xs text-muted-foreground">gastos totais</p>
                      </div>
                    </div>
                  ))}
                  {comparativoCoordenadores.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhum coordenador com projetos atribuídos</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card data-testid="empreendimentos-table-card">
          <CardHeader>
            <CardTitle>Detalhamento dos empreendimentos do seu escopo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Projetos</TableHead>
                  <TableHead className="text-right">Orçamento total</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">% utilizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empreendimentosResumo.map((row) => (
                  <TableRow
                    key={row.empreendimentoId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/empreendimentos/${row.empreendimentoId}`)}
                    data-testid={`empreendimento-row-${row.empreendimentoId}`}
                  >
                    <TableCell className="font-medium">{row.empreendimentoNome}</TableCell>
                    <TableCell className="text-right">{row.projetosVinculados}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.orcamento)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatCurrency(row.totalGastos)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.percentualGasto > 100
                          ? "text-red-600"
                          : row.percentualGasto > 80
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {row.orcamento > 0 ? `${row.percentualGasto.toFixed(1)}%` : "Sem orçamento"}
                    </TableCell>
                  </TableRow>
                ))}
                {empreendimentosResumo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum empreendimento atribuído a você
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card data-testid="projects-table-card">
          <CardHeader>
            <CardTitle>Projetos sob sua coordenação</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="text-right">Orçamento do projeto</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myProjects.map((p) => {
                  const emp = empreendimentoMap.get(p.empreendimentoId);
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/empreendimentos/${p.empreendimentoId}`)}
                      data-testid={`project-row-${p.id}`}
                    >
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{emp?.nome || "Empreendimento"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(toNumberBR(p.orcamentoPrevisto))}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(p.status || "")
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {myProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum projeto atribuído a você
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3">
              Observação. As despesas estão registradas no nível de empreendimento. O detalhamento de gastos por projeto exige que cada lançamento possua referência direta ao projeto.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
