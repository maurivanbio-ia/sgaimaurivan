import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusChart from "@/components/charts/status-chart";
import ExpiryChart from "@/components/charts/expiry-chart";
import { CheckCircle, TriangleAlert, XCircle, Building, Plus, Clock, FileText, Package, Calendar } from "lucide-react";

export default function Dashboard() {
  const { data: licenseStats, isLoading: isLoadingLicenses } = useQuery<{ active: number; expiring: number; expired: number }>({
    queryKey: ["/api/stats/licenses"],
  });

  const { data: condicionanteStats, isLoading: isLoadingCondicionantes } = useQuery<{ pendentes: number; cumpridas: number; vencidas: number }>({
    queryKey: ["/api/stats/condicionantes"],
  });

  const { data: entregaStats, isLoading: isLoadingEntregas } = useQuery<{ pendentes: number; entregues: number; atrasadas: number }>({
    queryKey: ["/api/stats/entregas"],
  });

  const { data: agenda, isLoading: isLoadingAgenda } = useQuery<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number }>>({
    queryKey: ["/api/agenda/prazos"],
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
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Painel Geral</h2>
        <p className="text-muted-foreground mt-2">Visão geral do sistema de gestão ambiental</p>
      </div>

      {/* Enhanced KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
        {/* Licenças */}
        <Card className="shadow-sm">
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
        
        <Card className="shadow-sm">
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
        
        <Card className="shadow-sm">
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
        <Card className="shadow-sm">
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
        <Card className="shadow-sm">
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
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum prazo próximo
                </p>
              ) : (
                prazos.slice(0, 10).map((item, index) => (
                  <div key={index} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            item.tipo === 'Licença' ? 'bg-blue-100 text-blue-700' :
                            item.tipo === 'Condicionante' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {item.tipo}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            item.status === 'vencida' || item.status === 'vencido' || item.status === 'atrasada' 
                              ? 'bg-destructive/10 text-destructive' :
                            item.status === 'vencendo' || item.status === 'a_vencer' 
                              ? 'bg-warning/10 text-warning' :
                              'bg-muted text-muted-foreground'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {item.titulo}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.prazo).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </div>
                ))
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
    </div>
  );
}
