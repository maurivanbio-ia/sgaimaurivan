import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusChart from "@/components/charts/status-chart";
import ExpiryChart from "@/components/charts/expiry-chart";
import { ExportButton } from "@/components/ExportButton";
import LicenseCalendar from "@/components/LicenseCalendar";
import MapComponent from "@/components/MapComponent";
import { CheckCircle, TriangleAlert, XCircle, Building, Plus, Clock, FileText, Package, Calendar, CheckCircle2, AlertTriangle, ShieldCheck, Truck, MapPin, Eye, Users, Briefcase, ListTodo, Filter } from "lucide-react";
import type { Empreendimento } from "@shared/schema";
import forestBg from "@assets/stock_images/green_forest_nature__4c74bc3e.jpg";

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
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<string>("todos");
  
  // Buscar empreendimentos primeiro
  const { data: empreendimentos } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
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

  return (
    <div className="min-h-screen relative">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${forestBg})`,
          zIndex: 0,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/65 to-black/75 backdrop-blur-[1px]" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex-1">
          <h2 className="text-4xl font-bold text-white drop-shadow-lg">Painel Geral</h2>
          <p className="text-white/90 mt-2 text-lg font-medium drop-shadow">Visão geral do sistema de gestão ambiental</p>
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
          <ExportButton entity="relatorio-completo" variant="default" />
        </div>
      </div>

      {/* License Calendar Section */}
      <div className="mb-8">
        <LicenseCalendar />
      </div>

      {/* Enhanced KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {/* Licenças */}
        <Card className="shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-gray-900/90 border-2 border-white/30 cursor-pointer hover:shadow-xl hover:scale-105 transition-all" onClick={() => navigate("/licencas/ativas")}>
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
        
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/licencas/vencer")}>
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
        
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/licencas/vencidas")}>
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
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/condicionantes/pendentes")}>
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
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/entregas/mes")}>
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
      </div>

      {/* Recursos e Gestão - Nova Seção */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
          <Briefcase className="mr-2 h-5 w-5" />
          Recursos e Gestão
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Frota */}
          <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/frota")}>
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
          <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/equipamentos")}>
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
          <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/rh")}>
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
          <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/demandas")}>
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
          <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/contratos")}>
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

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-4">Status das Licenças</h3>
                <div className="h-48">
                  <StatusChart stats={licenses} />
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
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
            <Card className="shadow-sm">
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

            <Card className="shadow-sm">
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
        <Card className="shadow-sm">
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
          <Card className="shadow-sm">
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
          <Card className="shadow-sm">
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
                {empreendimentos.slice(0, 5).map((emp) => (
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
                             emp.tipo === 'termoeletrica' ? 'Termelétrica' :
                             emp.tipo === 'linha_transmissao' ? 'Linha de Transmissão' :
                             emp.tipo === 'mina' ? 'Mineração' :
                             emp.tipo === 'pchs' ? 'PCH' : 'Outro'}
                          </Badge>
                          <Badge 
                            variant="outline"
                            className={`text-xs border ${
                              emp.status === 'ativo' ? 'bg-green-100 text-green-800 border-green-200' :
                              emp.status === 'em_planejamento' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              emp.status === 'em_execucao' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                              emp.status === 'concluido' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                              'bg-red-100 text-red-800 border-red-200'
                            }`}
                          >
                            {emp.status === 'ativo' ? 'Ativo' :
                             emp.status === 'em_planejamento' ? 'Em Planejamento' :
                             emp.status === 'em_execucao' ? 'Em Execução' :
                             emp.status === 'concluido' ? 'Concluído' : 'Inativo'}
                          </Badge>
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
                {empreendimentos.length > 5 && (
                  <div className="text-center pt-2">
                    <Link href="/empreendimentos">
                      <Button variant="outline" size="sm" className="w-full">
                        Ver todos os {empreendimentos.length} empreendimentos
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
