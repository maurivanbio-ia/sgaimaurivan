import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import StatusChart from "@/components/charts/status-chart";
import ExpiryChart from "@/components/charts/expiry-chart";
import { ExportButton } from "@/components/ExportButton";
import { PlatformReportPDF } from "@/components/PlatformReportPDF";
import MapComponent from "@/components/MapComponent";
import {
  CheckCircle,
  TriangleAlert,
  XCircle,
  Building,
  Plus,
  Clock,
  FileText,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Truck,
  MapPin,
  Eye,
  Users,
  Briefcase,
  ListTodo,
  Filter,
  Map,
  CalendarDays,
  RefreshCcw,
} from "lucide-react";
import type { Empreendimento } from "@shared/schema";

/* =========================
   Tipos e utilitários
   ========================= */

type EmpFilter = "todos" | `${number}`;

type AgendaItemTipo = "Licença" | "Condicionante" | "Entrega" | string;
type AgendaItemStatus =
  | "vencida"
  | "vencido"
  | "atrasada"
  | "vencendo"
  | "a_vencer"
  | "pendente"
  | "cumprida"
  | "entregue"
  | "ativa"
  | string;

type AgendaItem = {
  tipo: AgendaItemTipo;
  titulo: string;
  prazo: string;
  status: AgendaItemStatus;
  id: number;
  empreendimento?: string;
  empreendimentoId?: number;
  orgaoEmissor?: string;
};

type MonthlyExpiryPoint = {
  month: string;
  expiring: number;
  expired: number;
};

type CalendarEvent = {
  date: string;
  tipo: AgendaItemTipo;
  titulo: string;
  status: AgendaItemStatus;
  id: number;
  empreendimentoId?: number;
};

interface DashboardStats {
  licenses: { active: number; expiring: number; expired: number };
  condicionantes: { pendentes: number; cumpridas: number; vencidas: number };
  entregas: { pendentes: number; entregues: number; atrasadas: number };
  agenda: AgendaItem[];
  monthlyExpiry: MonthlyExpiryPoint[];
  calendar: CalendarEvent[];
  frota?: { total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number };
  equipamentos?: { total: number; disponiveis: number; emUso: number; manutencao: number };
  rh?: { total: number; ativos: number; afastados: number };
  demandas?: { total: number; pendentes: number; emAndamento: number; concluidas: number };
  contratos?: { total: number; ativos: number; valorTotal: number };
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha ao carregar ${url}. Status ${res.status}. ${txt}`);
  }
  return res.json() as Promise<T>;
}

function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

function diffDaysFromToday(prazo: Date, today = new Date()): number {
  const msDia = 1000 * 60 * 60 * 24;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const prazoStart = new Date(prazo.getFullYear(), prazo.getMonth(), prazo.getDate());
  return Math.ceil((prazoStart.getTime() - todayStart.getTime()) / msDia);
}

function getUrgencyInfo(diffDays: number) {
  if (diffDays < 0) {
    return {
      urgency: "vencido" as const,
      containerClass: "bg-red-50 border-red-200",
      titleClass: "text-red-900",
      daysLabel: "Vencido",
      chipClass: "text-red-600",
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      tooltip: "Prazo vencido.",
    };
  }
  if (diffDays <= 7) {
    return {
      urgency: "critico" as const,
      containerClass: "bg-orange-50 border-orange-200",
      titleClass: "text-orange-900",
      daysLabel: `${diffDays} dia${diffDays !== 1 ? "s" : ""}`,
      chipClass: "text-orange-600",
      icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
      tooltip: "Atenção. Prazo crítico.",
    };
  }
  if (diffDays <= 30) {
    return {
      urgency: "alerta" as const,
      containerClass: "bg-yellow-50 border-yellow-200",
      titleClass: "text-yellow-900",
      daysLabel: `${diffDays} dias`,
      chipClass: "text-yellow-600",
      icon: <Clock className="h-5 w-5 text-yellow-500" />,
      tooltip: "Prazo próximo.",
    };
  }
  return {
    urgency: "normal" as const,
    containerClass: "bg-green-50 border-green-200",
    titleClass: "text-green-900",
    daysLabel: `${diffDays} dias`,
    chipClass: "text-green-600",
    icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    tooltip: "Prazo dentro do normal.",
  };
}

function getTipoMeta(tipo: AgendaItemTipo) {
  if (tipo === "Licença") {
    return {
      icon: <ShieldCheck className="h-5 w-5 text-blue-600" />,
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (tipo === "Condicionante") {
    return {
      icon: <CheckCircle2 className="h-5 w-5 text-purple-600" />,
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    };
  }
  if (tipo === "Entrega") {
    return {
      icon: <Truck className="h-5 w-5 text-emerald-600" />,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  return {
    icon: <FileText className="h-5 w-5 text-gray-600" />,
    badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
  };
}

function normalizeStatusLabel(status: AgendaItemStatus) {
  if (status === "a_vencer") return "vencendo";
  return status;
}

function getStatusBadgeClass(status: AgendaItemStatus) {
  const s = normalizeStatusLabel(status);
  if (s === "vencida" || s === "vencido" || s === "atrasada") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (s === "vencendo" || s === "pendente") {
    return "bg-orange-100 text-orange-800 border-orange-200";
  }
  if (s === "cumprida" || s === "entregue" || s === "ativa") {
    return "bg-green-100 text-green-800 border-green-200";
  }
  return "bg-gray-100 text-gray-800 border-gray-200";
}

function empreendimentoTipoLabel(tipo?: string) {
  if (tipo === "hidreletrica") return "Hidrelétrica";
  if (tipo === "parque_eolico") return "Parque Eólico";
  if (tipo === "usina_solar") return "Usina Solar";
  if (tipo === "termoeletrica") return "Termelétrica";
  if (tipo === "linha_transmissao") return "Linha de Transmissão";
  if (tipo === "mina") return "Mineração";
  if (tipo === "pchs") return "PCH";
  return "Outro";
}

function empreendimentoStatusLabel(status?: string) {
  if (status === "ativo") return "Ativo";
  if (status === "em_planejamento") return "Em Planejamento";
  if (status === "em_execucao") return "Em Execução";
  if (status === "concluido") return "Concluído";
  return "Inativo";
}

function empreendimentoStatusBadgeClass(status?: string) {
  if (status === "ativo") return "bg-green-100 text-green-800 border-green-200";
  if (status === "em_planejamento") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "em_execucao") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (status === "concluido") return "bg-gray-100 text-gray-800 border-gray-200";
  return "bg-red-100 text-red-800 border-red-200";
}

/* =========================
   Componentes auxiliares
   ========================= */

type KpiCardProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  valueClassName?: string;
  iconWrapClassName?: string;
  onClick?: () => void;
  testId?: string;
  subtitle?: string;
};

function KpiCard(props: KpiCardProps) {
  return (
    <Card
      className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all"
      onClick={props.onClick}
      data-testid={props.testId}
    >
      <CardContent className="p-4">
        <div className="flex items-center">
          <div className={`p-2 rounded-md ${props.iconWrapClassName ?? "bg-muted/10"}`}>{props.icon}</div>
          <div className="ml-3">
            <p className="text-xs font-medium text-muted-foreground">{props.title}</p>
            <p className={`text-xl font-bold ${props.valueClassName ?? ""}`}>{props.value}</p>
            {props.subtitle ? <p className="text-xs text-muted-foreground">{props.subtitle}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-[280px]" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-44" />
              <Skeleton className="h-44" />
            </div>
          </div>
          <Skeleton className="h-96" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[460px]" />
          <Skeleton className="h-[460px]" />
        </div>

        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

function ErrorState(props: { message?: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6 flex items-center justify-center">
      <Card className="max-w-xl w-full">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-10 w-10 text-yellow-500 mt-1" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Falha ao carregar o painel</h2>
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro ao buscar os dados. Você pode tentar novamente agora.
              </p>
              {props.message ? <p className="text-xs text-muted-foreground whitespace-pre-wrap">{props.message}</p> : null}
              <div className="pt-2">
                <Button onClick={props.onRetry} className="gap-2">
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

/* =========================
   Dashboard
   ========================= */

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<EmpFilter>("todos");

  const empreendimentosQuery = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: () => fetchJSON<Empreendimento[]>("/api/empreendimentos"),
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const empreendimentoId = selectedEmpreendimento === "todos" ? undefined : Number(selectedEmpreendimento);

  const dashboardQuery = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", { empreendimentoId: empreendimentoId ?? null }],
    queryFn: async () => {
      const url = empreendimentoId ? `/api/dashboard/stats?empreendimentoId=${empreendimentoId}` : "/api/dashboard/stats";
      return fetchJSON<DashboardStats>(url);
    },
    staleTime: 30_000,
    retry: 2,
    enabled: empreendimentosQuery.isSuccess,
  });

  const isLoading = empreendimentosQuery.isLoading || dashboardQuery.isLoading;
  const hasError = empreendimentosQuery.isError || dashboardQuery.isError;

  const errorMessage =
    (empreendimentosQuery.error as Error | undefined)?.message ||
    (dashboardQuery.error as Error | undefined)?.message ||
    "";

  const empreendimentos = empreendimentosQuery.data ?? [];
  const stats = dashboardQuery.data;

  const visibleEmpreendimentos = React.useMemo(() => {
    if (!empreendimentos.length) return [];
    if (selectedEmpreendimento === "todos") return empreendimentos;
    const id = Number(selectedEmpreendimento);
    return empreendimentos.filter((e) => e.id === id);
  }, [empreendimentos, selectedEmpreendimento]);

  const licenses = stats?.licenses ?? { active: 0, expiring: 0, expired: 0 };
  const condicionantes = stats?.condicionantes ?? { pendentes: 0, cumpridas: 0, vencidas: 0 };
  const entregas = stats?.entregas ?? { pendentes: 0, entregues: 0, atrasadas: 0 };
  const prazos = stats?.agenda ?? [];
  const frota = stats?.frota ?? { total: 0, disponiveis: 0, emUso: 0, manutencao: 0, alugados: 0 };
  const equipamentos = stats?.equipamentos ?? { total: 0, disponiveis: 0, emUso: 0, manutencao: 0 };
  const rh = stats?.rh ?? { total: 0, ativos: 0, afastados: 0 };
  const demandas = stats?.demandas ?? { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0 };
  const contratos = stats?.contratos ?? { total: 0, ativos: 0, valorTotal: 0 };

  const topPrazos = React.useMemo(() => prazos.slice(0, 10), [prazos]);

  if (isLoading) return <DashboardSkeleton />;

  if (hasError) {
    return (
      <ErrorState
        message={errorMessage}
        onRetry={() => {
          empreendimentosQuery.refetch();
          dashboardQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <TooltipProvider>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex-1">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Painel Geral</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg font-medium">
                Visão geral do sistema de gestão ambiental
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedEmpreendimento} onValueChange={(v) => setSelectedEmpreendimento(v as EmpFilter)}>
                  <SelectTrigger className="w-[280px]" data-testid="select-empreendimento-filter">
                    <SelectValue placeholder="Filtrar por empreendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">📊 Todos os Empreendimentos</SelectItem>
                    {empreendimentos.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id) as `${number}`}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <PlatformReportPDF buttonVariant="default" buttonSize="default" />
              <ExportButton entity="relatorio-completo" variant="default" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            <KpiCard
              title="Licenças Ativas"
              value={licenses.active}
              iconWrapClassName="bg-success/10"
              icon={<CheckCircle className="text-success h-5 w-5" />}
              valueClassName="text-success"
              onClick={() => navigate("/licencas/ativas")}
              testId="kpi-licencas-ativas"
            />

            <KpiCard
              title="A Vencer"
              value={licenses.expiring}
              iconWrapClassName="bg-warning/10"
              icon={<TriangleAlert className="text-warning h-5 w-5" />}
              valueClassName="text-warning"
              onClick={() => navigate("/licencas/vencer")}
              testId="kpi-licencas-a-vencer"
            />

            <KpiCard
              title="Vencidas"
              value={licenses.expired}
              iconWrapClassName="bg-destructive/10"
              icon={<XCircle className="text-destructive h-5 w-5" />}
              valueClassName="text-destructive"
              onClick={() => navigate("/licencas/vencidas")}
              testId="kpi-licencas-vencidas"
            />

            <KpiCard
              title="Cond. Pendentes"
              value={condicionantes.pendentes}
              iconWrapClassName="bg-blue-500/10"
              icon={<FileText className="text-blue-500 h-5 w-5" />}
              valueClassName="text-blue-500"
              onClick={() => navigate("/condicionantes/pendentes")}
              testId="kpi-condicionantes-pendentes"
            />

            <KpiCard
              title="Entregas do Mês"
              value={entregas.pendentes}
              iconWrapClassName="bg-purple-500/10"
              icon={<Package className="text-purple-500 h-5 w-5" />}
              valueClassName="text-purple-500"
              onClick={() => navigate("/entregas/mes")}
              testId="kpi-entregas-mes"
            />
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
              <Briefcase className="mr-2 h-5 w-5" />
              Recursos e Gestão
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <KpiCard
                title="Veículos"
                value={frota.total}
                iconWrapClassName="bg-cyan-500/10"
                icon={<Truck className="text-cyan-500 h-5 w-5" />}
                valueClassName="text-cyan-500"
                subtitle={`${frota.disponiveis} disp. • ${frota.alugados} alug.`}
                onClick={() => navigate("/frota")}
                testId="kpi-frota"
              />

              <KpiCard
                title="Equipamentos"
                value={equipamentos.total}
                iconWrapClassName="bg-indigo-500/10"
                icon={<Package className="text-indigo-500 h-5 w-5" />}
                valueClassName="text-indigo-500"
                subtitle={`${equipamentos.disponiveis} disponíveis`}
                onClick={() => navigate("/equipamentos")}
                testId="kpi-equipamentos"
              />

              <KpiCard
                title="Colaboradores"
                value={rh.total}
                iconWrapClassName="bg-emerald-500/10"
                icon={<Users className="text-emerald-500 h-5 w-5" />}
                valueClassName="text-emerald-500"
                subtitle={`${rh.ativos} ativos`}
                onClick={() => navigate("/rh")}
                testId="kpi-rh"
              />

              <KpiCard
                title="Demandas"
                value={demandas.total}
                iconWrapClassName="bg-orange-500/10"
                icon={<ListTodo className="text-orange-500 h-5 w-5" />}
                valueClassName="text-orange-500"
                subtitle={`${demandas.pendentes} pendentes`}
                onClick={() => navigate("/demandas")}
                testId="kpi-demandas"
              />

              <KpiCard
                title="Contratos"
                value={contratos.total}
                iconWrapClassName="bg-pink-500/10"
                icon={<FileText className="text-pink-500 h-5 w-5" />}
                valueClassName="text-pink-500"
                subtitle={`${contratos.ativos} ativos`}
                onClick={() => navigate("/contratos")}
                testId="kpi-contratos"
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
              <Eye className="mr-2 h-5 w-5" />
              Acesso Rápido
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card
                className="shadow-2xl backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-200/50 dark:border-green-700/50 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all"
                onClick={() => navigate("/mapa")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/20 rounded-xl">
                        <Map className="text-green-600 dark:text-green-400 h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">Mapa de Empreendimentos</p>
                        <p className="text-sm text-muted-foreground">Visualize a localização geográfica</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400" data-testid="stat-empreendimentos-total">
                        {visibleEmpreendimentos.length}
                      </p>
                      <p className="text-xs text-muted-foreground">empreendimentos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className="shadow-2xl backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-200/50 dark:border-blue-700/50 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all"
                onClick={() => navigate("/calendario")}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/20 rounded-xl">
                        <CalendarDays className="text-blue-600 dark:text-blue-400 h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">Calendário Integrado</p>
                        <p className="text-sm text-muted-foreground">Licenças. condicionantes. entregas. demandas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="stat-prazos-proximos">
                        {prazos.length}
                      </p>
                      <p className="text-xs text-muted-foreground">próximos eventos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-card-foreground mb-4">Status das Licenças</h3>
                    <div className="h-48">
                      <StatusChart stats={licenses} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-card-foreground mb-4">Vencimentos por Mês</h3>
                    <div className="h-48">
                      <ExpiryChart data={stats?.monthlyExpiry ?? []} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      Condicionantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pendentes</span>
                        <span className="text-sm font-medium">{condicionantes.pendentes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cumpridas</span>
                        <span className="text-sm font-medium text-success">{condicionantes.cumpridas}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Vencidas</span>
                        <span className="text-sm font-medium text-destructive">{condicionantes.vencidas}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      Entregas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pendentes</span>
                        <span className="text-sm font-medium">{entregas.pendentes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Entregues</span>
                        <span className="text-sm font-medium text-success">{entregas.entregues}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Atrasadas</span>
                        <span className="text-sm font-medium text-destructive">{entregas.atrasadas}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Agenda de Prazos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {topPrazos.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Nenhum prazo próximo</p>
                    </div>
                  ) : (
                    topPrazos.map((item) => {
                      const prazoDate = parseLocalDate(item.prazo);
                      const dDays = diffDaysFromToday(prazoDate);
                      const urgency = getUrgencyInfo(dDays);
                      const tipoMeta = getTipoMeta(item.tipo);
                      const statusLabel = normalizeStatusLabel(item.status);
                      const statusClass = getStatusBadgeClass(item.status);

                      return (
                        <div
                          key={`${item.tipo}-${item.id}`}
                          className={`border-l-4 rounded-lg p-4 hover:shadow-md transition-all duration-200 ${urgency.containerClass}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="cursor-help">{tipoMeta.icon}</div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <div className="text-sm space-y-1">
                                        <div className="font-semibold">{item.tipo}</div>
                                        {item.empreendimento ? (
                                          <div className="text-muted-foreground">
                                            <span className="font-medium">Empreendimento:</span> {item.empreendimento}
                                          </div>
                                        ) : null}
                                        {item.orgaoEmissor ? (
                                          <div className="text-muted-foreground">
                                            <span className="font-medium">Órgão:</span> {item.orgaoEmissor}
                                          </div>
                                        ) : null}
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Prazo:</span> {prazoDate.toLocaleDateString("pt-BR")}
                                        </div>
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Status:</span> {String(statusLabel)}
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>

                                  <Badge variant="outline" className={`text-xs font-medium ${tipoMeta.badgeClass}`}>
                                    {item.tipo}
                                  </Badge>
                                </div>

                                <Badge className={`text-xs font-medium border ${statusClass}`}>
                                  {String(statusLabel)}
                                </Badge>
                              </div>

                              <h4 className={`text-sm font-semibold ${urgency.titleClass} mb-1 line-clamp-2`}>
                                {item.titulo}
                              </h4>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>{prazoDate.toLocaleDateString("pt-BR")}</span>
                                </div>
                                <div className={`flex items-center gap-1 font-medium ${urgency.chipClass}`}>
                                  <Clock className="h-3 w-3" />
                                  <span>{urgency.daysLabel}</span>
                                </div>
                              </div>
                            </div>

                            <div className="ml-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">{urgency.icon}</div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-sm">{urgency.tooltip}</div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {visibleEmpreendimentos.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    <MapPin className="mr-2 h-5 w-5" />
                    Mapa de Empreendimentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <MapComponent empreendimentos={visibleEmpreendimentos} className="h-[400px]" />
                </CardContent>
              </Card>

              <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center">
                      <Building className="mr-2 h-5 w-5" />
                      Empreendimentos Ativos
                    </span>
                    <Link href="/empreendimentos">
                      <Button variant="ghost" size="sm" data-testid="button-view-all-projects">
                        Ver Todos
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {visibleEmpreendimentos.slice(0, 5).map((emp) => (
                      <div
                        key={emp.id}
                        className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/empreendimentos/${emp.id}`)}
                        data-testid={`card-empreendimento-${emp.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-card-foreground mb-1">{emp.nome}</h4>

                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {empreendimentoTipoLabel((emp as any).tipo)}
                              </Badge>

                              <Badge
                                variant="outline"
                                className={`text-xs border ${empreendimentoStatusBadgeClass((emp as any).status)}`}
                              >
                                {empreendimentoStatusLabel((emp as any).status)}
                              </Badge>
                            </div>

                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p>
                                <span className="font-medium">Cliente:</span> {emp.cliente}
                              </p>
                              {(emp as any).municipio && (emp as any).uf ? (
                                <p>
                                  <span className="font-medium">Local:</span> {(emp as any).municipio}/{(emp as any).uf}
                                </p>
                              ) : null}
                              {(emp as any).responsavelInterno ? (
                                <p>
                                  <span className="font-medium">Gestor:</span> {(emp as any).responsavelInterno}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/empreendimentos/${emp.id}`);
                            }}
                            data-testid={`button-view-details-${emp.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {visibleEmpreendimentos.length > 5 ? (
                      <div className="text-center pt-2">
                        <Link href="/empreendimentos">
                          <Button variant="outline" size="sm" className="w-full">
                            Ver todos os {visibleEmpreendimentos.length} empreendimentos
                          </Button>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Ações Rápidas</h3>
              <div className="flex flex-wrap gap-4">
                <Link href="/empreendimentos">
                  <Button className="font-medium" data-testid="button-view-projects">
                    <Building className="mr-2 h-4 w-4" />
                    Ver Empreendimentos
                  </Button>
                </Link>

                <Link href="/empreendimentos/novo">
                  <Button variant="outline" className="font-medium" data-testid="button-new-project">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Empreendimento
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
}
