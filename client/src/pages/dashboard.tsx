import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import StatusChart from "@/components/charts/status-chart";
import ExpiryChart from "@/components/charts/expiry-chart";
import { ExportButton } from "@/components/ExportButton";
import { RefreshButton } from "@/components/RefreshButton";
import LicenseCalendar from "@/components/LicenseCalendar";
import { 
  CheckCircle, TriangleAlert, XCircle, Building, Plus, Clock, FileText, Package, Calendar, 
  CheckCircle2, AlertTriangle, ShieldCheck, Truck, Activity, Wrench, TrendingUp, 
  BarChart3, PieChart, Users, MapPin, Filter, Download
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line
} from 'recharts';

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<string>("licencas");
  const [equipmentFilters, setEquipmentFilters] = useState({
    periodo: '30',
    empreendimento: undefined,
    tipoEquipamento: undefined,
    status: undefined,
    colaborador: undefined
  });
  
  const { data: licenseStats, isLoading: isLoadingLicenses } = useQuery<{ active: number; expiring: number; expired: number }>({
    queryKey: ["/api/stats/licenses"],
  });

  const { data: condicionanteStats, isLoading: isLoadingCondicionantes } = useQuery<{ pendentes: number; cumpridas: number; vencidas: number }>({
    queryKey: ["/api/stats/condicionantes"],
  });

  const { data: entregaStats, isLoading: isLoadingEntregas } = useQuery<{ pendentes: number; entregues: number; atrasadas: number }>({
    queryKey: ["/api/stats/entregas"],
  });

  const { data: agenda, isLoading: isLoadingAgenda } = useQuery<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }>>({
    queryKey: ["/api/agenda/prazos"],
  });

  // Equipment queries
  const { data: equipmentStats, isLoading: isLoadingEquipmentStats } = useQuery<{
    totalEquipamentos: number;
    emUso: number;
    emManutencao: number;
    pendenciasVencidas: number;
    movimentacoesMes: number;
  }>({
    queryKey: ["/api/equipamentos/dashboard/stats", equipmentFilters],
    enabled: activeView === "equipamentos"
  });

  const { data: equipmentCharts, isLoading: isLoadingEquipmentCharts } = useQuery<{
    statusDistribution: { name: string; value: number; color: string }[];
    equipmentByType: { tipo: string; quantidade: number }[];
    monthlyMovements: { mes: string; retiradas: number; devolucoes: number; manutencoes: number }[];
    projectDistribution: { projeto: string; ativo: number; manutencao: number; inativo: number }[];
    topUsers: { usuario: string; movimentacoes: number }[];
  }>({
    queryKey: ["/api/equipamentos/dashboard/charts", equipmentFilters],
    enabled: activeView === "equipamentos"
  });

  const isLoading = isLoadingLicenses || isLoadingCondicionantes || isLoadingEntregas || isLoadingAgenda;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando estatísticas...</div>
      </div>
    );
  }

  const licenses = licenseStats || { active: 0, expiring: 0, expired: 0 };
  const condicionantes = condicionanteStats || { pendentes: 0, cumpridas: 0, vencidas: 0 };
  const entregas = entregaStats || { pendentes: 0, entregues: 0, atrasadas: 0 };
  const prazos = agenda || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-card-foreground">Painel Geral</h2>
          <p className="text-muted-foreground mt-2">Visão geral do sistema de gestão ambiental</p>
        </div>
        <div className="flex gap-3">
          <RefreshButton variant="default" size="default" />
          <ExportButton entity="relatorio-completo" variant="outline" />
        </div>
      </div>

      {/* View Selector Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="licencas" data-testid="tab-licencas">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Licenças
          </TabsTrigger>
          <TabsTrigger value="equipamentos" data-testid="tab-equipamentos">
            <Package className="h-4 w-4 mr-2" />
            Equipamentos
          </TabsTrigger>
        </TabsList>

        {/* Licenses View */}
        <TabsContent value="licencas" className="space-y-8">
          {/* License Calendar Section */}
          <div>
            <LicenseCalendar />
          </div>

      {/* Enhanced KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {/* Licenças */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/licencas/ativas")}>
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
        </TabsContent>

        {/* Equipment View */}
        <TabsContent value="equipamentos" className="space-y-8">
          {/* Equipment Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros de Equipamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Período</label>
                  <Select value={equipmentFilters.periodo} onValueChange={(value) => setEquipmentFilters({...equipmentFilters, periodo: value})}>
                    <SelectTrigger data-testid="equipment-filter-periodo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Empreendimento</label>
                  <Select value={equipmentFilters.empreendimento} onValueChange={(value) => setEquipmentFilters({...equipmentFilters, empreendimento: value})}>
                    <SelectTrigger data-testid="equipment-filter-empreendimento">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="1">UHE Belo Monte</SelectItem>
                      <SelectItem value="2">Parque Solar A</SelectItem>
                      <SelectItem value="3">Linha 500kV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo</label>
                  <Select value={equipmentFilters.tipoEquipamento} onValueChange={(value) => setEquipmentFilters({...equipmentFilters, tipoEquipamento: value})}>
                    <SelectTrigger data-testid="equipment-filter-tipo">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="GPS">GPS</SelectItem>
                      <SelectItem value="Notebook">Notebook</SelectItem>
                      <SelectItem value="Rádio">Rádio</SelectItem>
                      <SelectItem value="Drone">Drone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={equipmentFilters.status} onValueChange={(value) => setEquipmentFilters({...equipmentFilters, status: value})}>
                    <SelectTrigger data-testid="equipment-filter-status">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Colaborador</label>
                  <Input 
                    placeholder="Nome do colaborador"
                    value={equipmentFilters.colaborador || ''}
                    onChange={(e) => setEquipmentFilters({...equipmentFilters, colaborador: e.target.value})}
                    data-testid="equipment-filter-colaborador"
                  />
                </div>

                <div className="flex items-end">
                  <Button 
                    onClick={() => setEquipmentFilters({ periodo: '30', empreendimento: undefined, tipoEquipamento: undefined, status: undefined, colaborador: undefined })}
                    variant="outline"
                    className="w-full"
                    data-testid="equipment-button-clear-filters"
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipment KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card data-testid="equipment-card-total">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Equipamentos
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{equipmentStats?.totalEquipamentos || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Cadastrados no sistema
                </p>
              </CardContent>
            </Card>

            <Card data-testid="equipment-card-em-uso">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Em Uso
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{equipmentStats?.emUso || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Atualmente alocados
                </p>
              </CardContent>
            </Card>

            <Card data-testid="equipment-card-manutencao">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Em Manutenção
                </CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{equipmentStats?.emManutencao || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Aguardando reparo
                </p>
              </CardContent>
            </Card>

            <Card data-testid="equipment-card-pendencias">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Devoluções Atrasadas
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{equipmentStats?.pendenciasVencidas || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Há mais de 7 dias
                </p>
              </CardContent>
            </Card>

            <Card data-testid="equipment-card-movimentacoes">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Movimentações do Mês
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{equipmentStats?.movimentacoesMes || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Total no período
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Equipment Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card data-testid="equipment-chart-status">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Status dos Equipamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={equipmentCharts?.statusDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(equipmentCharts?.statusDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-4">
                  {(equipmentCharts?.statusDistribution || []).map((item, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.name}: {item.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Equipment by Type */}
            <Card data-testid="equipment-chart-types">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Equipamentos por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={equipmentCharts?.equipmentByType || []} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="tipo" type="category" width={80} />
                    <RechartsTooltip />
                    <Bar dataKey="quantidade" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Movements */}
            <Card data-testid="equipment-chart-movements" className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Movimentações Mensais</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={equipmentCharts?.monthlyMovements || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="retiradas" stroke="#3b82f6" name="Retiradas" />
                    <Line type="monotone" dataKey="devolucoes" stroke="#10b981" name="Devoluções" />
                    <Line type="monotone" dataKey="manutencoes" stroke="#f59e0b" name="Manutenções" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
