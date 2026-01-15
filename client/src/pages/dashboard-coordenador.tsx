// src/pages/DashboardCoordenador.tsx
// Correções e integrações aplicadas.
// 1. Regra de acesso mais robusta (aceita "coordenador", "coordenador(a)", variações, e também admin/diretor).
// 2. Integração com filtro de empreendimento via querystring (?empreendimentoId=) e propagação automática para navegação.
// 3. Queries mais resilientes com fallback de endpoints (evita “quebrar” se um endpoint mudou).
// 4. Sanitização de dados numéricos para evitar NaN/Infinity em gráficos (recharts pode travar em alguns cenários).
// 5. Estados de carregamento, erro e empty-states consistentes, com botão de recarregar.
// 6. Navegação para empreendimentos preserva empreendimentoId na URL.

import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FolderKanban, TrendingDown, BarChart3, RefreshCcw, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/* =========================
   Tipos
   ========================= */

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

/* =========================
   Constantes e utilitários
   ========================= */

const FALLBACK_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];

function toNumberBR(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const raw = value.trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/\s/g, "").replace(/[R$]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? toNumberBR(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(num) ? num : 0);
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

function safeUserLabel(email?: string): string {
  if (!email) return "Usuário";
  const left = email.split("@")[0] || "Usuário";
  return left || "Usuário";
}

function getInitials(email?: string): string {
  const label = safeUserLabel(email);
  const letters = label.replace(/[^a-zA-Z0-9]/g, "");
  return (letters.slice(0, 2) || "US").toUpperCase();
}

function normalizeText(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function isCoordinatorUser(user?: User | null): boolean {
  if (!user) return false;
  const role = normalizeText(user.role);
  const cargo = normalizeText(user.cargo);

  // Aceita variações: "coordenador", "coordenador(a)", "coord", "coordenacao", etc.
  const looksCoordinator =
    cargo.includes("coordenador") || cargo.includes("coordenacao") || cargo.includes("coord") || role.includes("coordenador");

  // Se quiser permitir admin/diretor também acessarem, mantém true para esses perfis.
  const isPrivileged = role === "admin" || cargo.includes("diretor") || cargo.includes("administrador");

  return looksCoordinator || isPrivileged;
}

function canSeeComparativo(user?: User | null): boolean {
  if (!user) return false;
  const role = normalizeText(user.role);
  const cargo = normalizeText(user.cargo);
  return role === "admin" || cargo.includes("diretor") || cargo.includes("administrador");
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha ao carregar ${url}. Status ${res.status}. ${txt}`);
  }
  return res.json() as Promise<T>;
}

async function fetchJSONWithFallback<T>(urls: string[]): Promise<T> {
  let lastErr: unknown = null;
  for (const u of urls) {
    try {
      return await fetchJSON<T>(u);
    } catch (e) {
      lastErr = e;
      const msg = (e as Error)?.message || "";
      // Se não for 404, ou se for erro de autenticação, não fica tentando outros.
      if (!msg.includes("Status 404") && !msg.includes("Status 400")) throw e;
    }
  }
  throw (lastErr as Error) || new Error("Falha ao carregar recurso.");
}

function readEmpreendimentoIdFromUrl(): number | null {
  try {
    const u = new URL(window.location.href);
    const v = u.searchParams.get("empreendimentoId");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function withEmpParam(path: string, empreendimentoId?: number | null) {
  if (!empreendimentoId) return path;
  const url = new URL(path, "http://local");
  url.searchParams.set("empreendimentoId", String(empreendimentoId));
  return url.pathname + url.search;
}

function safeFinite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/* =========================
   Componente
   ========================= */

export default function DashboardCoordenador() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const initialEmpId = readEmpreendimentoIdFromUrl();
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(initialEmpId);

  const userQuery = useQuery<User>({
    queryKey: ["/api/auth/me"],
    queryFn: () => fetchJSON<User>("/api/auth/me"),
    staleTime: 60_000,
    retry: 1,
  });

  const user = userQuery.data;

  const projetosQuery = useQuery<Projeto[]>({
    queryKey: ["/api/projetos"],
    queryFn: () => fetchJSONWithFallback<Projeto[]>(["/api/projetos", "/api/projects"]),
    staleTime: 60_000,
    retry: 1,
    enabled: !!user,
  });

  const empreendimentosQuery = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: () => fetchJSONWithFallback<Empreendimento[]>(["/api/empreendimentos", "/api/enterprises"]),
    staleTime: 60_000,
    retry: 1,
    enabled: !!user,
  });

  const lancamentosQuery = useQuery<Lancamento[]>({
    queryKey: ["/api/financeiro/lancamentos"],
    queryFn: () =>
      fetchJSONWithFallback<Lancamento[]>([
        "/api/financeiro/lancamentos",
        "/api/financeiro/transactions",
        "/api/finance/lancamentos",
      ]),
    staleTime: 30_000,
    retry: 1,
    enabled: !!user,
  });

  const categoriasQuery = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    queryFn: () =>
      fetchJSONWithFallback<CategoriaFinanceira[]>([
        "/api/categorias-financeiras",
        "/api/financeiro/categorias",
        "/api/finance/categories",
      ]),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !!user,
  });

  const allUsersQuery = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => fetchJSONWithFallback<User[]>(["/api/users", "/api/usuarios"]),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !!user && canSeeComparativo(user),
  });

  const isLoading =
    userQuery.isLoading ||
    projetosQuery.isLoading ||
    empreendimentosQuery.isLoading;

  const hasError =
    userQuery.isError ||
    projetosQuery.isError ||
    empreendimentosQuery.isError;

  const errorMessage =
    (userQuery.error as Error | undefined)?.message ||
    (projetosQuery.error as Error | undefined)?.message ||
    (empreendimentosQuery.error as Error | undefined)?.message ||
    "";

  const projetos = projetosQuery.data ?? [];
  const empreendimentos = empreendimentosQuery.data ?? [];
  const lancamentos = lancamentosQuery.data ?? [];
  const categorias = categoriasQuery.data ?? [];
  const allUsers = allUsersQuery.data ?? [];

  // Se o empreendimento selecionado não existe mais, volta para null.
  React.useEffect(() => {
    if (selectedEmpId && empreendimentos.length > 0) {
      const exists = empreendimentos.some((e) => e.id === selectedEmpId);
      if (!exists) setSelectedEmpId(null);
    }
  }, [selectedEmpId, empreendimentos]);

  const allowAccess = isCoordinatorUser(user);

  const derived = useMemo(() => {
    const empreendimentoMap = new Map<number, Empreendimento>();
    for (const e of empreendimentos) empreendimentoMap.set(e.id, e);

    const categoriaMap = new Map<number, CategoriaFinanceira>();
    for (const c of categorias) categoriaMap.set(c.id, c);

    // Projetos sob coordenação do usuário
    const myProjects = user ? projetos.filter((p) => p.coordenadorId === user.id) : [];

    // Empreendimentos onde ele é coordenador direto (campo em empreendimento)
    const myEmpreendimentos = user ? empreendimentos.filter((e) => e.coordenadorId === user.id) : [];

    // Universo de empreendimentos do escopo, união de ambos.
    const myProjectEmpIds = new Set<number>(myProjects.map((p) => p.empreendimentoId));
    const myEmpIds = new Set<number>(myEmpreendimentos.map((e) => e.id));
    const allMyEmpreendimentoIds = new Set<number>([...myProjectEmpIds, ...myEmpIds]);

    // Se existe filtro selecionado, reduz o escopo para aquele empreendimento.
    const scopedEmpreendimentoIds =
      selectedEmpId && allMyEmpreendimentoIds.has(selectedEmpId) ? new Set<number>([selectedEmpId]) : allMyEmpreendimentoIds;

    const myDespesas: Lancamento[] = [];
    const totalDespesasByEmpreendimentoId = new Map<number, number>();

    for (const l of lancamentos) {
      if (normalizeText(l.tipo) !== "despesa") continue;
      if (!scopedEmpreendimentoIds.has(l.empreendimentoId)) continue;

      myDespesas.push(l);

      const prev = totalDespesasByEmpreendimentoId.get(l.empreendimentoId) ?? 0;
      totalDespesasByEmpreendimentoId.set(l.empreendimentoId, prev + toNumberBR(l.valor));
    }

    const totalGastos = myDespesas.reduce((sum, l) => sum + toNumberBR(l.valor), 0);

    const orcamentoByEmpreendimentoId = new Map<number, number>();
    for (const p of myProjects) {
      if (!scopedEmpreendimentoIds.has(p.empreendimentoId)) continue;
      const prev = orcamentoByEmpreendimentoId.get(p.empreendimentoId) ?? 0;
      orcamentoByEmpreendimentoId.set(p.empreendimentoId, prev + toNumberBR(p.orcamentoPrevisto));
    }

    const empreendimentosResumo = Array.from(scopedEmpreendimentoIds).map((empreendimentoId) => {
      const empreendimento = empreendimentoMap.get(empreendimentoId);
      const totalDespesas = totalDespesasByEmpreendimentoId.get(empreendimentoId) ?? 0;
      const orcamento = orcamentoByEmpreendimentoId.get(empreendimentoId) ?? 0;
      const percentualGasto = orcamento > 0 ? (totalDespesas / orcamento) * 100 : 0;

      return {
        empreendimentoId,
        empreendimentoNome: empreendimento?.nome || "Empreendimento",
        cliente: empreendimento?.cliente || "",
        unidade: empreendimento?.unidade || "",
        totalGastos: safeFinite(totalDespesas),
        orcamento: safeFinite(orcamento),
        percentualGasto: safeFinite(percentualGasto),
        projetosVinculados: myProjects.filter((p) => p.empreendimentoId === empreendimentoId).length,
      };
    });

    empreendimentosResumo.sort((a, b) => b.totalGastos - a.totalGastos);

    const gastosPorCategoriaAgg = new Map<string, { nome: string; valor: number; cor: string }>();
    for (const l of myDespesas) {
      const categoria = categoriaMap.get(l.categoriaId);
      const nome = categoria?.nome || "Outros";
      const cor = categoria?.cor || "#94a3b8";

      const prev = gastosPorCategoriaAgg.get(nome) ?? { nome, valor: 0, cor };
      prev.valor = safeFinite(prev.valor + toNumberBR(l.valor));
      prev.cor = cor || prev.cor;
      gastosPorCategoriaAgg.set(nome, prev);
    }

    const categoriaChartData = Array.from(gastosPorCategoriaAgg.values())
      .filter((x) => Number.isFinite(x.valor) && x.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    const barChartDataEmpreendimentos = empreendimentosResumo.map((e) => ({
      nome: e.empreendimentoNome.length > 18 ? `${e.empreendimentoNome.slice(0, 18)}...` : e.empreendimentoNome,
      gastos: safeFinite(e.totalGastos),
      orcamento: safeFinite(e.orcamento),
    }));

    const myProjectsScoped =
      selectedEmpId && allMyEmpreendimentoIds.has(selectedEmpId)
        ? myProjects.filter((p) => p.empreendimentoId === selectedEmpId)
        : myProjects;

    return {
      empreendimentoMap,
      myProjects: myProjectsScoped,
      allMyEmpreendimentoIds,
      totalGastos: safeFinite(totalGastos),
      myDespesas,
      empreendimentosResumo,
      categoriaChartData,
      barChartDataEmpreendimentos,
    };
  }, [user, projetos, empreendimentos, lancamentos, categorias, selectedEmpId]);

  const comparativoCoordenadores = useMemo(() => {
    if (!user || !canSeeComparativo(user)) return [];

    const coordIds = Array.from(
      new Set(projetos.filter((p) => p.coordenadorId != null).map((p) => p.coordenadorId as number)),
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
      if (normalizeText(l.tipo) !== "despesa") continue;
      const prev = totalDespesaByEmpIdGlobal.get(l.empreendimentoId) ?? 0;
      totalDespesaByEmpIdGlobal.set(l.empreendimentoId, prev + toNumberBR(l.valor));
    }

    const result = coordIds.map((coordId) => {
      const coordUser = allUsers.find((u) => u.id === coordId);
      const coordProjects = coordProjectsById.get(coordId) ?? [];
      const coordEmpIds = new Set(coordProjects.map((p) => p.empreendimentoId));

      let totalGastos = 0;
      for (const empId of coordEmpIds) totalGastos += totalDespesaByEmpIdGlobal.get(empId) ?? 0;

      return {
        userId: coordId,
        nome: safeUserLabel(coordUser?.email),
        email: coordUser?.email ?? "",
        totalProjetos: coordProjects.length,
        totalGastos: safeFinite(totalGastos),
        isCurrentUser: coordId === user.id,
      };
    });

    result.sort((a, b) => b.totalGastos - a.totalGastos);
    return result;
  }, [user, projetos, lancamentos, allUsers]);

  const availableEmpFilterOptions = useMemo(() => {
    if (!user) return [];
    const myEmpIds = Array.from(derived.allMyEmpreendimentoIds);
    const list = empreendimentos.filter((e) => myEmpIds.includes(e.id));
    list.sort((a, b) => a.nome.localeCompare(b.nome));
    return list;
  }, [user, empreendimentos, derived.allMyEmpreendimentoIds]);

  function hardRefetchAll() {
    userQuery.refetch();
    projetosQuery.refetch();
    empreendimentosQuery.refetch();
    lancamentosQuery.refetch();
    categoriasQuery.refetch();
    if (user && canSeeComparativo(user)) allUsersQuery.refetch();

    // Opcional, mas ajuda quando o problema é cache corrompido.
    queryClient.invalidateQueries();
  }

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
                <p className="text-sm text-muted-foreground">Ocorreu um erro ao buscar os dados. Você pode tentar novamente.</p>
                {errorMessage ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{errorMessage}</p> : null}
                <div className="pt-2">
                  <Button onClick={hardRefetchAll} className="gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Recarregar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || !allowAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">Este painel é destinado a coordenadores. Administradores e diretores também podem acessar.</p>
            <p className="text-sm text-muted-foreground">
              Seu cargo. <Badge variant="outline">{user?.cargo || "Não definido"}</Badge>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const empScopeCount = derived.allMyEmpreendimentoIds.size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6" data-testid="dashboard-coordenador">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="welcome-message">
                Bem vindo, {safeUserLabel(user.email)}.
              </h1>
              <p className="text-white/80">Painel do Coordenador. Acompanhamento financeiro por empreendimento.</p>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-white/90" />
              <Select
                value={selectedEmpId ? String(selectedEmpId) : "todos"}
                onValueChange={(v) => {
                  const newVal = v === "todos" ? null : Number(v);
                  setSelectedEmpId(Number.isFinite(newVal as number) ? (newVal as number) : null);

                  // Atualiza a URL sem quebrar o router do wouter.
                  const next = withEmpParam("/dashboard-coordenador", newVal);
                  navigate(next);
                }}
              >
                <SelectTrigger className="w-[320px] bg-white/10 text-white border-white/20">
                  <SelectValue placeholder="Filtrar empreendimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos do meu escopo</SelectItem>
                  {availableEmpFilterOptions.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="secondary" className="gap-2" onClick={hardRefetchAll}>
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card data-testid="card-total-projetos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sob sua coordenação</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{derived.myProjects.length} projeto(s)</div>
              <p className="text-xs text-muted-foreground">{empScopeCount} empreendimento(s) no escopo</p>
            </CardContent>
          </Card>

          <Card data-testid="card-total-gastos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de gastos</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(derived.totalGastos)}</div>
              <p className="text-xs text-muted-foreground">despesas nos empreendimentos do seu escopo</p>
            </CardContent>
          </Card>

          <Card data-testid="card-lancamentos">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{derived.myDespesas.length}</div>
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
              {derived.barChartDataEmpreendimentos.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={derived.barChartDataEmpreendimentos} layout="vertical" margin={{ left: 20 }}>
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
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  Nenhum empreendimento no escopo. Verifique se existem projetos atribuídos ao seu usuário.
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="gastos-por-categoria-chart">
            <CardHeader>
              <CardTitle>Gastos por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {derived.categoriaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={derived.categoriaChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="valor"
                      nameKey="nome"
                      label={(p: any) => {
                        const nome = String(p?.nome ?? "");
                        return `${nome.length > 12 ? nome.substring(0, 12) + "..." : nome}`;
                      }}
                    >
                      {derived.categoriaChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor || FALLBACK_COLORS[index % FALLBACK_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">Nenhuma despesa registrada no escopo atual</div>
              )}
            </CardContent>
          </Card>
        </div>

        {canSeeComparativo(user) ? (
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
                {derived.empreendimentosResumo.map((row) => (
                  <TableRow
                    key={row.empreendimentoId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(withEmpParam(`/empreendimentos/${row.empreendimentoId}`, selectedEmpId ?? row.empreendimentoId))}
                    data-testid={`empreendimento-row-${row.empreendimentoId}`}
                  >
                    <TableCell className="font-medium">{row.empreendimentoNome}</TableCell>
                    <TableCell className="text-right">{row.projetosVinculados}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.orcamento)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatCurrency(row.totalGastos)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.orcamento > 0 && row.percentualGasto > 100
                          ? "text-red-600"
                          : row.orcamento > 0 && row.percentualGasto > 80
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {row.orcamento > 0 ? `${row.percentualGasto.toFixed(1)}%` : "Sem orçamento"}
                    </TableCell>
                  </TableRow>
                ))}
                {derived.empreendimentosResumo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum empreendimento atribuído ao seu usuário. Verifique o campo coordenadorId em projetos ou empreendimentos.
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
                {derived.myProjects.map((p) => {
                  const emp = derived.empreendimentoMap.get(p.empreendimentoId);
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(withEmpParam(`/empreendimentos/${p.empreendimentoId}`, selectedEmpId ?? p.empreendimentoId))}
                      data-testid={`project-row-${p.id}`}
                    >
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{emp?.nome || "Empreendimento"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(toNumberBR(p.orcamentoPrevisto))}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(p.status || "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {derived.myProjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum projeto atribuído a você no filtro atual
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
