import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportButton } from "@/components/ExportButton";
import { RefreshButton } from "@/components/RefreshButton";
import LicenseCalendar from "@/components/LicenseCalendar";
import { 
  CheckCircle, TriangleAlert, XCircle, Building, Plus, FileText, Package, 
  TrendingUp, Users, Activity, Truck, Wrench, DollarSign, Briefcase
} from "lucide-react";

export default function Dashboard() {
  const [, navigate] = useLocation();

  // Main queries for all modules
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
    total: number;
    funcionando: number;
    manutencao: number;
    defeito: number;
    movimentacoesMes: number;
  }>({
    queryKey: ["/api/equipamentos/stats"],
  });

  // Demands queries 
  const { data: demandasStats, isLoading: isLoadingDemandas } = useQuery<{
    total: number;
    concluidas: number;
    emAndamento: number;
    atrasadas: number;
  }>({
    queryKey: ["/api/demandas/dashboard/stats"],
  });

  // Financial queries
  const { data: financeiroStats, isLoading: isLoadingFinanceiro } = useQuery<{
    receitas: number;
    despesas: number;
    saldoMensal: number;
    contasPendentes: number;
  }>({
    queryKey: ["/api/financeiro/dashboard/stats"],
  });

  // Fleet queries
  const { data: frotaStats, isLoading: isLoadingFrota } = useQuery<{
    totalVeiculos: number;
    disponiveis: number;
    emUso: number;
    manutencao: number;
  }>({
    queryKey: ["/api/frota/dashboard/stats"],
  });

  const isLoading = isLoadingLicenses || isLoadingCondicionantes || isLoadingEntregas || isLoadingAgenda || isLoadingEquipmentStats || isLoadingDemandas || isLoadingFinanceiro || isLoadingFrota;

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
  const equipamentos = equipmentStats || { total: 0, funcionando: 0, manutencao: 0, defeito: 0, movimentacoesMes: 0 };
  const demandas = demandasStats || { total: 0, concluidas: 0, emAndamento: 0, atrasadas: 0 };
  const financeiro = financeiroStats || { receitas: 0, despesas: 0, saldoMensal: 0, contasPendentes: 0 };
  const frota = frotaStats || { totalVeiculos: 0, disponiveis: 0, emUso: 0, manutencao: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-card-foreground">Dashboard Geral</h2>
          <p className="text-muted-foreground mt-2">Visão consolidada de todos os módulos do sistema</p>
        </div>
        <div className="flex gap-3">
          <RefreshButton variant="default" size="default" />
          <ExportButton entity="relatorio-completo" variant="outline" />
        </div>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        {/* Licenças Module */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/licencas/ativas")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Licenças
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Ativas</span>
                <span className="text-lg font-bold text-green-600">{licenses.active}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">A Vencer</span>
                <span className="text-lg font-bold text-yellow-600">{licenses.expiring}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Vencidas</span>
                <span className="text-lg font-bold text-red-600">{licenses.expired}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipamentos Module */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/equipamentos")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Total</span>
                <span className="text-lg font-bold text-blue-600">{equipamentos.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Funcionando</span>
                <span className="text-lg font-bold text-green-600">{equipamentos.funcionando}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Manutenção</span>
                <span className="text-lg font-bold text-yellow-600">{equipamentos.manutencao}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demandas Module */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/demandas")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Demandas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Total</span>
                <span className="text-lg font-bold text-purple-600">{demandas.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Concluídas</span>
                <span className="text-lg font-bold text-green-600">{demandas.concluidas}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Em Andamento</span>
                <span className="text-lg font-bold text-blue-600">{demandas.emAndamento}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financeiro Module */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/financeiro")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Receitas</span>
                <span className="text-lg font-bold text-green-600">R$ {financeiro.receitas.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Despesas</span>
                <span className="text-lg font-bold text-red-600">R$ {financeiro.despesas.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Saldo Mensal</span>
                <span className={`text-lg font-bold ${financeiro.saldoMensal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {financeiro.saldoMensal.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Frota Module */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/frota")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Frota
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Total Veículos</span>
                <span className="text-lg font-bold text-blue-600">{frota.totalVeiculos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Disponíveis</span>
                <span className="text-lg font-bold text-green-600">{frota.disponiveis}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Em Uso</span>
                <span className="text-lg font-bold text-yellow-600">{frota.emUso}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Condicionantes */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/condicionantes/pendentes")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Condicionantes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Pendentes</span>
                <span className="text-lg font-bold text-yellow-600">{condicionantes.pendentes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Cumpridas</span>
                <span className="text-lg font-bold text-green-600">{condicionantes.cumpridas}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Vencidas</span>
                <span className="text-lg font-bold text-red-600">{condicionantes.vencidas}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entregas */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/entregas/mes")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Entregas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Pendentes</span>
                <span className="text-lg font-bold text-yellow-600">{entregas.pendentes}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Entregues</span>
                <span className="text-lg font-bold text-green-600">{entregas.entregues}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Atrasadas</span>
                <span className="text-lg font-bold text-red-600">{entregas.atrasadas}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Painel Integrado - Card especial */}
        <Card className="shadow-sm cursor-pointer hover:shadow-md transition-shadow border-2 border-primary/20" onClick={() => navigate("/painel")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Painel Integrado
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Análise detalhada</p>
              <Badge variant="outline" className="text-xs">Ver todos os gráficos</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <LicenseCalendar />
        </div>
        
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/empreendimentos">
              <Button className="w-full justify-start" variant="outline">
                <Building className="mr-2 h-4 w-4" />
                Ver Empreendimentos
              </Button>
            </Link>
            <Link href="/empreendimentos/novo">
              <Button className="w-full justify-start" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Novo Empreendimento
              </Button>
            </Link>
            <Link href="/equipamentos/novo">
              <Button className="w-full justify-start" variant="outline">
                <Wrench className="mr-2 h-4 w-4" />
                Novo Equipamento
              </Button>
            </Link>
            <Link href="/painel">
              <Button className="w-full justify-start">
                <Activity className="mr-2 h-4 w-4" />
                Painel Completo
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}