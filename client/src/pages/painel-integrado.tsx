import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  PieChart, 
  Calendar,
  Users,
  Building,
  Wrench,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity
} from "lucide-react";
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface LicenseStats {
  active: number;
  expiring: number;
  expired: number;
}

interface EquipmentStats {
  total: number;
  disponivel: number;
  retirado: number;
  manutencao: number;
  porCategoria: Array<{ categoria: string; count: number }>;
  porStatus: Array<{ status: string; count: number }>;
}

interface DemandasStats {
  total: number;
  concluidas: number;
  emAndamento: number;
  atrasadas: number;
  porSetor: Array<{ setor: string; count: number }>;
}

// Status colors for different modules
const statusColors = {
  // Licenças
  active: "#10b981",
  expiring: "#f59e0b", 
  expired: "#ef4444",
  
  // Equipamentos
  disponivel: "#10b981",
  retirado: "#3b82f6",
  manutencao: "#f59e0b",
  
  // Demandas
  concluidas: "#10b981",
  emAndamento: "#3b82f6",
  atrasadas: "#ef4444",
};

function LicencasPanel() {
  const { data: stats } = useQuery<LicenseStats>({
    queryKey: ["/api/stats/licenses"],
  });

  const { data: monthlyData } = useQuery({
    queryKey: ["/api/stats/expiry-monthly"],
  });

  if (!stats) {
    return <div className="text-center py-8">Carregando dados de licenças...</div>;
  }

  // Preparar dados para gráficos
  const statusData = {
    labels: ["Ativas", "Vencendo", "Vencidas"],
    datasets: [{
      data: [stats.active, stats.expiring, stats.expired],
      backgroundColor: [statusColors.active, statusColors.expiring, statusColors.expired],
    }]
  };

  const monthlyChartData = monthlyData ? {
    labels: monthlyData.map((item: any) => item.month),
    datasets: [{
      label: "Licenças Vencendo",
      data: monthlyData.map((item: any) => item.count),
      backgroundColor: statusColors.expiring,
      borderColor: statusColors.expiring,
      borderWidth: 2,
    }]
  } : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Licenças Ativas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Em conformidade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximas ao Vencimento</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiring}</div>
            <p className="text-xs text-muted-foreground">≤ 90 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Status das Licenças
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: "300px" }}>
              <Pie data={statusData} options={{ maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        {monthlyChartData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Vencimentos por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: "300px" }}>
                <Bar data={monthlyChartData} options={{ maintainAspectRatio: false }} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EquipamentosPanel() {
  const { data: stats } = useQuery<EquipmentStats>({
    queryKey: ["/api/equipamentos/dashboard/stats"],
  });

  const { data: chartData } = useQuery({
    queryKey: ["/api/equipamentos/dashboard/charts"],
  });

  if (!stats) {
    return <div className="text-center py-8">Carregando dados de equipamentos...</div>;
  }

  // Preparar dados para gráficos
  const statusData = {
    labels: ["Disponível", "Retirado", "Manutenção"],
    datasets: [{
      data: [stats.disponivel, stats.retirado, stats.manutencao],
      backgroundColor: [statusColors.disponivel, statusColors.retirado, statusColors.manutencao],
    }]
  };

  const categoriaData = stats.porCategoria ? {
    labels: stats.porCategoria.map(item => item.categoria),
    datasets: [{
      label: "Quantidade",
      data: stats.porCategoria.map(item => item.count),
      backgroundColor: "#3b82f6",
    }]
  } : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Equipamentos</CardTitle>
            <Wrench className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Patrimônios cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disponivel}</div>
            <p className="text-xs text-muted-foreground">Prontos para uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Campo</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.retirado}</div>
            <p className="text-xs text-muted-foreground">Em uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Manutenção</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.manutencao}</div>
            <p className="text-xs text-muted-foreground">Necessita reparo</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Status dos Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: "300px" }}>
              <Pie data={statusData} options={{ maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        {categoriaData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Equipamentos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: "300px" }}>
                <Bar data={categoriaData} options={{ maintainAspectRatio: false }} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DemandasPanel() {
  const { data: stats } = useQuery<DemandasStats>({
    queryKey: ["/api/demandas/dashboard/stats"],
  });

  const { data: chartData } = useQuery({
    queryKey: ["/api/demandas/dashboard/charts"],
  });

  if (!stats) {
    return <div className="text-center py-8">Carregando dados de demandas...</div>;
  }

  // Preparar dados para gráficos
  const statusData = {
    labels: ["Concluídas", "Em Andamento", "Atrasadas"],
    datasets: [{
      data: [stats.concluidas, stats.emAndamento, stats.atrasadas],
      backgroundColor: [statusColors.concluidas, statusColors.emAndamento, statusColors.atrasadas],
    }]
  };

  const setorData = stats.porSetor ? {
    labels: stats.porSetor.slice(0, 6).map(item => item.setor),
    datasets: [{
      label: "Demandas",
      data: stats.porSetor.slice(0, 6).map(item => item.count),
      backgroundColor: "#8b5cf6",
    }]
  } : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Demandas</CardTitle>
            <FileText className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Todas as demandas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.concluidas}</div>
            <p className="text-xs text-muted-foreground">Finalizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emAndamento}</div>
            <p className="text-xs text-muted-foreground">Ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.atrasadas}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Status das Demandas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: "300px" }}>
              <Pie data={statusData} options={{ maintainAspectRatio: false }} />
            </div>
          </CardContent>
        </Card>

        {setorData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Demandas por Setor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ height: "300px" }}>
                <Bar data={setorData} options={{ maintainAspectRatio: false }} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function PainelIntegradoPage() {
  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-painel-integrado">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Painel de Controle
        </h1>
        <p className="text-muted-foreground mt-2">
          Visão consolidada dos indicadores principais da plataforma
        </p>
      </div>

      {/* Integrated Dashboard with Tabs */}
      <Tabs defaultValue="licencas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="licencas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Licenças
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="demandas" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Demandas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="licencas" className="mt-6">
          <LicencasPanel />
        </TabsContent>

        <TabsContent value="equipamentos" className="mt-6">
          <EquipamentosPanel />
        </TabsContent>

        <TabsContent value="demandas" className="mt-6">
          <DemandasPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}