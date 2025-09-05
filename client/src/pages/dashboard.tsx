import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StatusChart from "@/components/charts/status-chart";
import ExpiryChart from "@/components/charts/expiry-chart";
import { CheckCircle, TriangleAlert, XCircle, Building, Plus } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/stats/licenses"],
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando estatísticas...</div>
      </div>
    );
  }

  const licenseStats = stats || { active: 0, expiring: 0, expired: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Painel Geral</h2>
        <p className="text-muted-foreground mt-2">Visão geral do status das licenças ambientais</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-success/10 rounded-md">
                <CheckCircle className="text-success text-xl h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Licenças Ativas</p>
                <p className="text-2xl font-bold text-success" data-testid="stat-active">
                  {licenseStats.active}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-warning/10 rounded-md">
                <TriangleAlert className="text-warning text-xl h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">A Vencer (90 dias)</p>
                <p className="text-2xl font-bold text-warning" data-testid="stat-expiring">
                  {licenseStats.expiring}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-destructive/10 rounded-md">
                <XCircle className="text-destructive text-xl h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Licenças Vencidas</p>
                <p className="text-2xl font-bold text-destructive" data-testid="stat-expired">
                  {licenseStats.expired}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Status das Licenças</h3>
            <div className="h-64">
              <StatusChart stats={licenseStats} />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Vencimentos por Mês</h3>
            <div className="h-64">
              <ExpiryChart />
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
