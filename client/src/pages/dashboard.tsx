import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import StatusChart from "@/components/charts/status-chart";
import ExpiryChart from "@/components/charts/expiry-chart";
import { ExportButton } from "@/components/ExportButton";
import { PlatformReportPDF } from "@/components/PlatformReportPDF";
import MapComponent from "@/components/MapComponent";
import { CheckCircle, TriangleAlert, XCircle, Building, Plus, Clock, FileText, Package, Calendar, CheckCircle2, AlertTriangle, ShieldCheck, Truck, MapPin, Eye, Users, Briefcase, ListTodo, Filter, Map, CalendarDays } from "lucide-react";
import type { Empreendimento } from "@shared/schema";

interface AutorizacaoVencida {
  id: number;
  numero: string;
  titulo: string;
  tipo: string;
  orgaoEmissor?: string | null;
  dataValidade?: string | null;
  status: string;
  empreendimentoId?: number | null;
}

interface CondicionanteAlerta {
  id: number;
  titulo?: string | null;
  descricao: string;
  codigo?: string | null;
  categoria?: string | null;
  status: string;
  prazo: string;
  progresso: number;
  responsavelNome?: string | null;
  licencaId: number;
  licencaNumero: string;
  empreendimentoNome: string;
  empreendimentoId?: number | null;
}

interface DashboardStats {
  licenses: { active: number; expiring: number; expired: number };
  condicionantes: { pendentes: number; cumpridas: number; vencidas: number };
  entregas: { pendentes: number; entregues: number; atrasadas: number };
  agenda: Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }>;
  monthlyExpiry: any[];
  calendar: any[];
  frota?: { total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number };
  equipamentos?: { total: number; disponiveis: number; emUso: number; manutencao: number };
  rh?: { total: number; ativos: number; afastados: number };
  demandas?: { total: number; pendentes: number; emAndamento: number; concluidas: number };
  contratos?: { total: number; ativos: number; valorTotal: number };
  autorizacoesVencidas?: AutorizacaoVencida[];
  condicionantesAlerta?: CondicionanteAlerta[];
}

const STATUS_OPTIONS = [
  { value: "ativo",         label: "Ativo",          cls: "bg-green-100 text-green-800 border-green-200" },
  { value: "em_planejamento", label: "Em Planejamento", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "em_execucao",   label: "Em Execução",     cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "concluido",     label: "Concluído",       cls: "bg-gray-100 text-gray-800 border-gray-200" },
  { value: "inativo",       label: "Inativo",         cls: "bg-red-100 text-red-800 border-red-200" },
  { value: "cancelado",     label: "Cancelado",       cls: "bg-orange-100 text-orange-800 border-orange-200" },
];

function getStatusConfig(status: string | null | undefined) {
  if (!status) return { value: "", label: "Sem status", cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return STATUS_OPTIONS.find(s => s.value === status.toLowerCase()) ?? { value: status, label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<string>("todos");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Buscar empreendimentos primeiro
  const { data: empreendimentos } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/empreendimentos/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      toast({ title: "Status atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  // Use consolidated endpoint instead of multiple separate requests
  const { data: dashboardStats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", { empreendimentoId: selectedEmpreendimento }],
    queryFn: async () => {
      const url = selectedEmpreendimento === "todos" 
        ? "/api/dashboard/stats" 
        : `/api/dashboard/stats?empreendimentoId=${selectedEmpreendimento}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return res.json();
    },
  });

  const licenses = dashboardStats?.licenses || { active: 0, expiring: 0, expired: 0 };
  const condicionantes = dashboardStats?.condicionantes || { pendentes: 0, cumpridas: 0, vencidas: 0 };
  const entregas = dashboardStats?.entregas || { pendentes: 0, entregues: 0, atrasadas: 0 };
  const prazos = dashboardStats?.agenda || [];
  const frota = dashboardStats?.frota || { total: 0, disponiveis: 0, emUso: 0, manutencao: 0, alugados: 0 };
  const equipamentos = dashboardStats?.equipamentos || { total: 0, disponiveis: 0, emUso: 0, manutencao: 0 };
  const rh = dashboardStats?.rh || { total: 0, ativos: 0, afastados: 0 };
  const demandas = dashboardStats?.demandas || { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0 };
  const contratos = dashboardStats?.contratos || { total: 0, ativos: 0, valorTotal: 0 };
  const autorizacoesVencidas = dashboardStats?.autorizacoesVencidas || [];
  const condicionantesAlerta = dashboardStats?.condicionantesAlerta || [];
  const condicionantesVencidas = condicionantesAlerta.filter(c => c.status === 'vencida');
  const condicionantesEmAndamento = condicionantesAlerta.filter(c => c.status === 'em_andamento');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex-1">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white">Painel Geral</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg font-medium">Visão geral do sistema de gestão ambiental</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
              <SelectTrigger className="w-[280px]" data-testid="select-empreendimento-filter">
                <SelectValue placeholder="Filtrar por empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">📊 Todos os Empreendimentos</SelectItem>
                {empreendimentos?.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
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

      {/* Enhanced KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {/* Licenças */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/licencas/ativas")}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-success/10 rounded-md">
                <CheckCircle className="text-success h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-muted-foreground">Licenças Ativas</p>
                <p className="text-xl font-bold text-success" data-testid="stat-active">
                  {licenses.active}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/licencas/vencer")}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-warning/10 rounded-md">
                <TriangleAlert className="text-warning h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-muted-foreground">A Vencer</p>
                <p className="text-xl font-bold text-warning" data-testid="stat-expiring">
                  {licenses.expiring}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/licencas/vencidas")}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-destructive/10 rounded-md">
                <XCircle className="text-destructive h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-muted-foreground">Vencidas</p>
                <p className="text-xl font-bold text-destructive" data-testid="stat-expired">
                  {licenses.expired}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Condicionantes */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/condicionantes/pendentes")}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/10 rounded-md">
                <FileText className="text-blue-500 h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-muted-foreground">Cond. Pendentes</p>
                <p className="text-xl font-bold text-blue-500" data-testid="stat-condicionantes-pendentes">
                  {condicionantes.pendentes}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entregas */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/entregas/mes")}>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500/10 rounded-md">
                <Package className="text-purple-500 h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-muted-foreground">Entregas do Mês</p>
                <p className="text-xl font-bold text-purple-500" data-testid="stat-entregas-mes">
                  {entregas.pendentes}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Autorizações Vencidas */}
        <Card
          className={`shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 cursor-pointer hover:shadow-xl hover:scale-105 transition-all ${
            autorizacoesVencidas.length > 0
              ? "border-orange-300 dark:border-orange-700 ring-1 ring-orange-300 dark:ring-orange-700"
              : "border-white/40"
          }`}
          onClick={() => {
            const el = document.getElementById("secao-autorizacoes-vencidas");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-500/10 rounded-md">
                <AlertTriangle className="text-orange-500 h-5 w-5" />
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-muted-foreground">Autorizações Vencidas</p>
                <p className="text-xl font-bold text-orange-500" data-testid="stat-autorizacoes-vencidas">
                  {autorizacoesVencidas.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Autorizações Vencidas — Seção de Detalhe */}
      {autorizacoesVencidas.length > 0 && (
        <div className="mb-6" id="secao-autorizacoes-vencidas">
          <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Autorizações com Documentos Vencidos
            <span className="ml-1 text-xs font-normal bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-full px-2 py-0.5">
              {autorizacoesVencidas.length} {autorizacoesVencidas.length === 1 ? "item" : "itens"}
            </span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {autorizacoesVencidas.map((aut) => {
              const emp = empreendimentos?.find(e => e.id === aut.empreendimentoId);
              const hoje = new Date().toISOString().split('T')[0];
              const diasVencido = aut.dataValidade
                ? Math.floor((new Date(hoje).getTime() - new Date(aut.dataValidade).getTime()) / 86400000)
                : null;
              return (
                <Card
                  key={aut.id}
                  className="border-l-4 border-l-orange-500 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => emp && navigate(`/empreendimentos/${emp.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded px-1.5 py-0.5">
                            {aut.tipo}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono truncate">{aut.numero}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{aut.titulo}</p>
                        {emp && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">📍 {emp.nome}</p>
                        )}
                        {aut.orgaoEmissor && (
                          <p className="text-xs text-muted-foreground truncate">🏛 {aut.orgaoEmissor}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {aut.dataValidade ? (
                          <>
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                              {aut.dataValidade.split('-').reverse().join('/')}
                            </p>
                            {diasVencido !== null && diasVencido > 0 && (
                              <p className="text-xs text-destructive font-semibold">
                                {diasVencido}d vencida
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem validade</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Condicionantes em Alerta (Vencidas + Em Andamento) */}
      {(condicionantesVencidas.length > 0 || condicionantesEmAndamento.length > 0) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Condicionantes em Atenção
            {condicionantesVencidas.length > 0 && (
              <span className="text-xs font-normal bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5">
                {condicionantesVencidas.length} vencida{condicionantesVencidas.length !== 1 ? "s" : ""}
              </span>
            )}
            {condicionantesEmAndamento.length > 0 && (
              <span className="text-xs font-normal bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded-full px-2 py-0.5">
                {condicionantesEmAndamento.length} em andamento
              </span>
            )}
          </h3>

          {/* Vencidas */}
          {condicionantesVencidas.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> Vencidas
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {condicionantesVencidas.map((cond) => {
                  const hoje = new Date().toISOString().split('T')[0];
                  const diasVencido = cond.prazo
                    ? Math.floor((new Date(hoje).getTime() - new Date(cond.prazo).getTime()) / 86400000)
                    : null;
                  return (
                    <Card
                      key={cond.id}
                      className="border-l-4 border-l-destructive bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-800 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => cond.empreendimentoId && navigate(`/empreendimentos/${cond.empreendimentoId}`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {cond.codigo && (
                                <span className="text-xs font-semibold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded px-1.5 py-0.5">
                                  {cond.codigo}
                                </span>
                              )}
                              {cond.categoria && (
                                <span className="text-xs text-muted-foreground">{cond.categoria}</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {cond.titulo || cond.descricao.substring(0, 60)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              📋 {cond.licencaNumero} · 📍 {cond.empreendimentoNome}
                            </p>
                            {cond.responsavelNome && (
                              <p className="text-xs text-muted-foreground">👤 {cond.responsavelNome}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-destructive font-medium">
                              {cond.prazo.split('-').reverse().join('/')}
                            </p>
                            {diasVencido !== null && diasVencido > 0 && (
                              <p className="text-xs text-destructive font-bold">{diasVencido}d atraso</p>
                            )}
                            {cond.progresso > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">{cond.progresso}%</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Em Andamento */}
          {condicionantesEmAndamento.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Em Andamento
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {condicionantesEmAndamento.map((cond) => (
                  <Card
                    key={cond.id}
                    className="border-l-4 border-l-yellow-500 bg-yellow-50/60 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => cond.empreendimentoId && navigate(`/empreendimentos/${cond.empreendimentoId}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {cond.codigo && (
                              <span className="text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded px-1.5 py-0.5">
                                {cond.codigo}
                              </span>
                            )}
                            {cond.categoria && (
                              <span className="text-xs text-muted-foreground">{cond.categoria}</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {cond.titulo || cond.descricao.substring(0, 60)}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            📋 {cond.licencaNumero} · 📍 {cond.empreendimentoNome}
                          </p>
                          {cond.responsavelNome && (
                            <p className="text-xs text-muted-foreground">👤 {cond.responsavelNome}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                            {cond.prazo.split('-').reverse().join('/')}
                          </p>
                          {cond.progresso > 0 && (
                            <div className="mt-1">
                              <div className="w-16 h-1.5 bg-yellow-200 dark:bg-yellow-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-yellow-500 rounded-full"
                                  style={{ width: `${cond.progresso}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{cond.progresso}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recursos e Gestão - Nova Seção */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
          <Briefcase className="mr-2 h-5 w-5" />
          Recursos e Gestão
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Frota */}
          <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/frota")}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-cyan-500/10 rounded-md">
                  <Truck className="text-cyan-500 h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-muted-foreground">Veículos</p>
                  <p className="text-xl font-bold text-cyan-500" data-testid="stat-frota-total">
                    {frota.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {frota.disponiveis} disp. • {frota.alugados} alug.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipamentos */}
          <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/equipamentos")}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-indigo-500/10 rounded-md">
                  <Package className="text-indigo-500 h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-muted-foreground">Equipamentos</p>
                  <p className="text-xl font-bold text-indigo-500" data-testid="stat-equipamentos-total">
                    {equipamentos.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {equipamentos.disponiveis} disponíveis
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RH */}
          <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/rh")}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-emerald-500/10 rounded-md">
                  <Users className="text-emerald-500 h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-muted-foreground">Colaboradores</p>
                  <p className="text-xl font-bold text-emerald-500" data-testid="stat-rh-total">
                    {rh.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rh.ativos} ativos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demandas */}
          <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/demandas")}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-500/10 rounded-md">
                  <ListTodo className="text-orange-500 h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-muted-foreground">Demandas</p>
                  <p className="text-xl font-bold text-orange-500" data-testid="stat-demandas-total">
                    {demandas.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {demandas.pendentes} pendentes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contratos */}
          <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/contratos")}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-pink-500/10 rounded-md">
                  <FileText className="text-pink-500 h-5 w-5" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-muted-foreground">Contratos</p>
                  <p className="text-xl font-bold text-pink-500" data-testid="stat-contratos-total">
                    {contratos.total}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {contratos.ativos} ativos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Acesso Rápido - Mapa e Calendário */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
          <Eye className="mr-2 h-5 w-5" />
          Acesso Rápido
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-2xl backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-200/50 dark:border-green-700/50 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all" onClick={() => navigate("/mapa")}>
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
                    {empreendimentos?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">empreendimentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xl backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-200/50 dark:border-blue-700/50 cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all" onClick={() => navigate("/calendario")}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <CalendarDays className="text-blue-600 dark:text-blue-400 h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">Calendário Integrado</p>
                    <p className="text-sm text-muted-foreground">Licenças, condicionantes, entregas e demandas</p>
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Charts Section */}
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
                  <ExpiryChart />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats */}
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

        {/* Agenda Section */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Agenda de Prazos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {prazos.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum prazo próximo
                  </p>
                </div>
              ) : (
                prazos.slice(0, 10).map((item, index) => {
                  const prazoDate = new Date(item.prazo);
                  const today = new Date();
                  const diffTime = prazoDate.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  const getUrgencyInfo = () => {
                    if (diffDays < 0) {
                      return { urgency: 'vencido', color: 'bg-red-50 border-red-200', textColor: 'text-red-900', days: 'Vencido' };
                    } else if (diffDays <= 7) {
                      return { urgency: 'critico', color: 'bg-orange-50 border-orange-200', textColor: 'text-orange-900', days: `${diffDays} dia${diffDays !== 1 ? 's' : ''}` };
                    } else if (diffDays <= 30) {
                      return { urgency: 'alerta', color: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-900', days: `${diffDays} dias` };
                    } else {
                      return { urgency: 'normal', color: 'bg-green-50 border-green-200', textColor: 'text-green-900', days: `${diffDays} dias` };
                    }
                  };
                  
                  const urgencyInfo = getUrgencyInfo();
                  
                  const getItemIcon = () => {
                    switch (item.tipo) {
                      case 'Licença':
                        return <ShieldCheck className="h-5 w-5 text-blue-600" />;
                      case 'Condicionante':
                        return <CheckCircle2 className="h-5 w-5 text-purple-600" />;
                      case 'Entrega':
                        return <Truck className="h-5 w-5 text-emerald-600" />;
                      default:
                        return <FileText className="h-5 w-5 text-gray-600" />;
                    }
                  };
                  
                  const getStatusColor = () => {
                    if (item.status === 'vencida' || item.status === 'vencido' || item.status === 'atrasada') {
                      return 'bg-red-100 text-red-800 border-red-200';
                    } else if (item.status === 'vencendo' || item.status === 'a_vencer' || item.status === 'pendente') {
                      return 'bg-orange-100 text-orange-800 border-orange-200';
                    } else if (item.status === 'cumprida' || item.status === 'entregue' || item.status === 'ativa') {
                      return 'bg-green-100 text-green-800 border-green-200';
                    } else {
                      return 'bg-gray-100 text-gray-800 border-gray-200';
                    }
                  };
                  
                  return (
                    <TooltipProvider key={index}>
                      <div className={`border-l-4 rounded-lg p-4 hover:shadow-md transition-all duration-200 ${urgencyInfo.color}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      {getItemIcon()}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="text-sm">
                                      <div className="font-semibold mb-1">{item.tipo}</div>
                                      {item.empreendimento && (
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Empreendimento:</span> {item.empreendimento}
                                        </div>
                                      )}
                                      {item.orgaoEmissor && (
                                        <div className="text-muted-foreground">
                                          <span className="font-medium">Órgão:</span> {item.orgaoEmissor}
                                        </div>
                                      )}
                                      <div className="text-muted-foreground">
                                        <span className="font-medium">Prazo:</span> {prazoDate.toLocaleDateString('pt-BR')}
                                      </div>
                                      <div className="text-muted-foreground">
                                        <span className="font-medium">Status:</span> {item.status === 'a_vencer' ? 'vencendo' : item.status}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <Badge variant="outline" className={`text-xs font-medium ${
                                  item.tipo === 'Licença' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  item.tipo === 'Condicionante' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {item.tipo}
                                </Badge>
                              </div>
                              <Badge className={`text-xs font-medium border ${getStatusColor()}`}>
                                {item.status === 'a_vencer' ? 'vencendo' : item.status}
                              </Badge>
                            </div>
                            
                            <h4 className={`text-sm font-semibold ${urgencyInfo.textColor} mb-1 line-clamp-2`}>
                              {item.titulo}
                            </h4>
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{prazoDate.toLocaleDateString('pt-BR')}</span>
                              </div>
                              <div className={`flex items-center gap-1 font-medium ${
                                urgencyInfo.urgency === 'vencido' ? 'text-red-600' :
                                urgencyInfo.urgency === 'critico' ? 'text-orange-600' :
                                urgencyInfo.urgency === 'alerta' ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                <Clock className="h-3 w-3" />
                                <span>{urgencyInfo.days}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-3">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  {urgencyInfo.urgency === 'vencido' && (
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                  )}
                                  {urgencyInfo.urgency === 'critico' && (
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                  )}
                                  {urgencyInfo.urgency === 'alerta' && (
                                    <Clock className="h-5 w-5 text-yellow-500" />
                                  )}
                                  {urgencyInfo.urgency === 'normal' && (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  {urgencyInfo.urgency === 'vencido' && 'Prazo vencido!'}
                                  {urgencyInfo.urgency === 'critico' && 'Atenção: Prazo crítico'}
                                  {urgencyInfo.urgency === 'alerta' && 'Prazo próximo'}
                                  {urgencyInfo.urgency === 'normal' && 'Prazo dentro do normal'}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </TooltipProvider>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa e Lista de Empreendimentos */}
      {empreendimentos && empreendimentos.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Mapa de Empreendimentos */}
          <Card className="shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border-2 border-white/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <MapPin className="mr-2 h-5 w-5" />
                Mapa de Empreendimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <MapComponent empreendimentos={empreendimentos} className="h-[400px]" />
            </CardContent>
          </Card>

          {/* Lista de Empreendimentos */}
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
                {empreendimentos
                  .filter(e => !["inativo", "concluido", "cancelado"].includes(e.status || ""))
                  .slice(0, 5)
                  .map((emp) => (
                  <div 
                    key={emp.id} 
                    className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/empreendimentos/${emp.id}`)}
                    data-testid={`card-empreendimento-${emp.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm text-card-foreground mb-1">
                          {emp.nome}
                        </h4>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {emp.tipo === 'hidreletrica' ? 'Hidrelétrica' :
                             emp.tipo === 'parque_eolico' ? 'Parque Eólico' :
                             emp.tipo === 'usina_solar' ? 'Usina Solar' :
                             emp.tipo === 'termoeletrica' ? 'Termelétrica' :
                             emp.tipo === 'linha_transmissao' ? 'Linha de Transmissão' :
                             emp.tipo === 'mina' ? 'Mineração' :
                             emp.tipo === 'pchs' ? 'PCH' : 'Outro'}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Badge
                                variant="outline"
                                className={`text-xs border cursor-pointer hover:opacity-80 transition-opacity ${getStatusConfig(emp.status).cls}`}
                                title="Clique para alterar o status"
                              >
                                {getStatusConfig(emp.status).label}
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent onClick={e => e.stopPropagation()}>
                              {STATUS_OPTIONS.map(opt => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  className={opt.value === emp.status ? "font-semibold" : ""}
                                  onClick={() => statusMutation.mutate({ id: emp.id, status: opt.value })}
                                >
                                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${opt.cls.split(" ")[0]}`} />
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p><span className="font-medium">Cliente:</span> {emp.cliente}</p>
                          {emp.municipio && emp.uf && (
                            <p><span className="font-medium">Local:</span> {emp.municipio}/{emp.uf}</p>
                          )}
                          <p><span className="font-medium">Gestor:</span> {emp.responsavelInterno}</p>
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
                {empreendimentos.filter(e => !["inativo", "concluido", "cancelado"].includes(e.status || "")).length > 5 && (
                  <div className="text-center pt-2">
                    <Link href="/empreendimentos">
                      <Button variant="outline" size="sm" className="w-full">
                        Ver todos os {empreendimentos.filter(e => !["inativo", "concluido", "cancelado"].includes(e.status || "")).length} empreendimentos ativos
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
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
    </div>
  );
}
