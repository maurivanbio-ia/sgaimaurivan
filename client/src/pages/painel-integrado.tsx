import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Activity,
  DollarSign,
  Truck,
  CreditCard,
  Database,
  Shield,
  Lock,
  Unlock,
  Loader2
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
  
  
  // Demandas
  concluidas: "#10b981",
  emAndamento: "#3b82f6",
  atrasadas: "#ef4444",
};

function LicencasPanel({ empreendimentoId }: { empreendimentoId?: string }) {
  const { data: stats } = useQuery<LicenseStats>({
    queryKey: ["/api/stats/licenses", empreendimentoId],
    enabled: !!empreendimentoId,
  });

  const { data: monthlyData } = useQuery({
    queryKey: ["/api/stats/expiry-monthly", empreendimentoId],
    enabled: !!empreendimentoId,
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

  const monthlyChartData = Array.isArray(monthlyData) ? {
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


function FinanceiroPanel() {
  const { data: stats } = useQuery({
    queryKey: ["/api/financeiro/dashboard/stats"],
  });

  if (!stats) {
    return <div className="text-center py-8">Carregando dados financeiros...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats?.receitas?.toLocaleString('pt-BR') || '0'}</div>
            <p className="text-xs text-muted-foreground">Total no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats?.despesas?.toLocaleString('pt-BR') || '0'}</div>
            <p className="text-xs text-muted-foreground">Total no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {((stats?.receitas || 0) - (stats?.despesas || 0)).toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLancamentos || 0}</div>
            <p className="text-xs text-muted-foreground">Total de transações</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Financeiro</CardTitle>
          <CardDescription>Visão geral das finanças do projeto</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Dados financeiros carregando...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function FrotaPanel({ empreendimentoId }: { empreendimentoId?: string }) {
  const { data: stats } = useQuery({
    queryKey: ["/api/frota/dashboard/stats", empreendimentoId],
    enabled: !!empreendimentoId,
  });

  if (!stats) {
    return <div className="text-center py-8">Carregando dados da frota...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalVeiculos || 0}</div>
            <p className="text-xs text-muted-foreground">Cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.disponiveis || 0}</div>
            <p className="text-xs text-muted-foreground">Para uso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Uso</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.emUso || 0}</div>
            <p className="text-xs text-muted-foreground">Atualmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manutenção</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.manutencao || 0}</div>
            <p className="text-xs text-muted-foreground">Necessária</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestão de Frota</CardTitle>
          <CardDescription>Controle de veículos e manutenções</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Dados da frota carregando...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DemandasPanel({ empreendimentoId }: { empreendimentoId?: string }) {
  const { data: stats } = useQuery<DemandasStats>({
    queryKey: ["/api/demandas/dashboard/stats", empreendimentoId],
    enabled: !!empreendimentoId,
  });

  const { data: chartData } = useQuery({
    queryKey: ["/api/demandas/dashboard/charts", empreendimentoId],
    enabled: !!empreendimentoId,
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

interface EmpreendimentoDetailed {
  id: number;
  nome: string;
  cliente: string;
  localizacao: string;
  tipo: string;
  situacao: string;
  criadoEm: string;
}

interface UnlockStatus {
  unlocked: boolean;
  isCoordenador: boolean;
  cargo: string;
}

export default function PainelIntegradoPage() {
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<string>("");
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check unlock status
  const { data: unlockStatus, isLoading: isLoadingUnlock } = useQuery<UnlockStatus>({
    queryKey: ["/api/painel/unlock-status"],
  });

  const { data: empreendimentos } = useQuery({
    queryKey: ["/api/empreendimentos"],
  });

  // Fetch detailed information about selected empreendimento
  const { data: empreendimentoDetail } = useQuery<EmpreendimentoDetailed>({
    queryKey: ["/api/empreendimentos", selectedEmpreendimento],
    enabled: !!selectedEmpreendimento,
  });

  // Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      return apiRequest("POST", "/api/painel/unlock", { password });
    },
    onSuccess: () => {
      toast({
        title: "Painel desbloqueado",
        description: "Você agora tem acesso ao painel completo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/painel/unlock-status"] });
      setUnlockDialogOpen(false);
      setUnlockPassword("");
    },
    onError: () => {
      toast({
        title: "Senha incorreta",
        description: "A senha informada está incorreta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleUnlock = () => {
    if (unlockPassword.trim()) {
      unlockMutation.mutate(unlockPassword);
    }
  };

  // Auto-select first empreendimento if available and none selected
  if (Array.isArray(empreendimentos) && empreendimentos.length > 0 && !selectedEmpreendimento) {
    setSelectedEmpreendimento(empreendimentos[0].id.toString());
  }

  // Show loading state while checking unlock status
  if (isLoadingUnlock) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show locked overlay if user is not authorized
  if (!unlockStatus?.unlocked) {
    return (
      <div className="container mx-auto py-8 space-y-6" data-testid="page-painel-integrado-locked">
        <div className="flex flex-col items-center justify-center min-h-[500px] space-y-6">
          <div className="p-8 bg-muted/50 rounded-full">
            <Lock className="h-20 w-20 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Painel de Controle</h2>
            <p className="text-muted-foreground max-w-md">
              Este painel está disponível apenas para coordenadores e diretores.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setUnlockDialogOpen(true)}
            className="gap-2"
            data-testid="button-unlock-painel"
          >
            <Unlock className="h-4 w-4" />
            Clique para desbloquear
          </Button>
        </div>

        <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Desbloquear Painel
              </DialogTitle>
              <DialogDescription>
                Digite a senha de acesso para visualizar o painel de controle.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                type="password"
                placeholder="Senha de acesso"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                data-testid="input-unlock-password"
              />
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setUnlockDialogOpen(false);
                    setUnlockPassword("");
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleUnlock}
                  disabled={unlockMutation.isPending || !unlockPassword.trim()}
                  data-testid="button-confirm-unlock"
                >
                  {unlockMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Desbloquear"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

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

      {/* Empreendimento Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium min-w-fit">
              Empreendimento:
            </label>
            <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
              <SelectTrigger className="w-[300px]" data-testid="select-empreendimento">
                <SelectValue placeholder="Selecione um empreendimento" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(empreendimentos) && empreendimentos?.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.nome} - {emp.cliente}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Empreendimento Information Panel */}
      {empreendimentoDetail && (
        <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl text-primary mb-3">
                  📍 {empreendimentoDetail.nome}
                </CardTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="font-medium">{empreendimentoDetail.cliente}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Localização</p>
                      <p className="font-medium">{empreendimentoDetail.localizacao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium">{empreendimentoDetail.tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant={empreendimentoDetail.situacao === 'Ativo' ? 'default' : 'secondary'}>
                        {empreendimentoDetail.situacao}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right ml-6">
                <p className="text-sm text-muted-foreground">Projeto criado em:</p>
                <p className="font-semibold text-lg">
                  {new Date(empreendimentoDetail.criadoEm).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Integrated Dashboard with Tabs */}
      <Tabs defaultValue="licencas" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="licencas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Licenças
          </TabsTrigger>
          <TabsTrigger value="demandas" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Demandas
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="frota" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Frota
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="gestao-dados" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Gestão de Dados
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="licencas" className="mt-6">
          <LicencasPanel empreendimentoId={selectedEmpreendimento} />
        </TabsContent>


        <TabsContent value="demandas" className="mt-6">
          <DemandasPanel empreendimentoId={selectedEmpreendimento} />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receitas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ 285.450</div>
                  <p className="text-xs text-muted-foreground">Total no período</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ 187.320</div>
                  <p className="text-xs text-muted-foreground">Total no período</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">R$ 98.130</div>
                  <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
                  <CreditCard className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">47</div>
                  <p className="text-xs text-muted-foreground">Total de transações</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Evolução Financeira Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: "300px" }}>
                    <Line 
                      data={{
                        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'],
                        datasets: [
                          {
                            label: 'Receitas',
                            data: [45000, 52000, 48000, 61000, 55000, 67000, 59000, 63000, 68000],
                            backgroundColor: '#10b981',
                            borderColor: '#10b981',
                            borderWidth: 2,
                            fill: false,
                          },
                          {
                            label: 'Despesas',
                            data: [32000, 38000, 35000, 42000, 39000, 45000, 41000, 44000, 47000],
                            backgroundColor: '#ef4444',
                            borderColor: '#ef4444',
                            borderWidth: 2,
                            fill: false,
                          }
                        ]
                      }}
                      options={{ 
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return 'R$ ' + (Number(value)/1000).toFixed(0) + 'k';
                              }
                            }
                          }
                        }
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: "300px" }}>
                    <Pie 
                      data={{
                        labels: ['Equipamentos', 'Pessoal', 'Combustível', 'Manutenção', 'Licenças', 'Outros'],
                        datasets: [{
                          data: [45000, 62000, 28000, 35000, 15000, 18000],
                          backgroundColor: [
                            '#3b82f6',
                            '#8b5cf6',
                            '#f59e0b',
                            '#ef4444',
                            '#10b981',
                            '#6b7280'
                          ],
                        }]
                      }}
                      options={{ 
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'right' as const,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return context.label + ': R$ ' + value.toLocaleString('pt-BR') + ' (' + percentage + '%)';
                              }
                            }
                          }
                        }
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="frota" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Veículos</CardTitle>
                  <Truck className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">Cadastrados</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">5</div>
                  <p className="text-xs text-muted-foreground">Para uso</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Uso</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2</div>
                  <p className="text-xs text-muted-foreground">Atualmente</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Manutenção</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1</div>
                  <p className="text-xs text-muted-foreground">Necessária</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Status da Frota
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: "300px" }}>
                    <Pie 
                      data={{
                        labels: ['Disponíveis', 'Em Uso', 'Manutenção'],
                        datasets: [{
                          data: [5, 2, 1],
                          backgroundColor: [
                            '#10b981',
                            '#3b82f6',
                            '#f59e0b'
                          ],
                        }]
                      }}
                      options={{ 
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'bottom' as const,
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return context.label + ': ' + value + ' veículos (' + percentage + '%)';
                              }
                            }
                          }
                        }
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Quilometragem por Veículo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: "300px" }}>
                    <Bar 
                      data={{
                        labels: ['ABC-1234', 'DEF-5678', 'GHI-9012', 'JKL-3456', 'MNO-7890'],
                        datasets: [{
                          label: 'Quilometragem (km)',
                          data: [25000, 45000, 78000, 32000, 15000],
                          backgroundColor: '#3b82f6',
                        }]
                      }}
                      options={{ 
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return (Number(value)/1000).toFixed(0) + 'k km';
                              }
                            }
                          }
                        }
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Manutenções Realizadas (Últimos 6 Meses)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: "300px" }}>
                    <Line 
                      data={{
                        labels: ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'],
                        datasets: [
                          {
                            label: 'Manutenções Preventivas',
                            data: [3, 2, 4, 1, 3, 2],
                            backgroundColor: '#10b981',
                            borderColor: '#10b981',
                            borderWidth: 2,
                            fill: false,
                          },
                          {
                            label: 'Manutenções Corretivas',
                            data: [1, 3, 1, 2, 1, 1],
                            backgroundColor: '#f59e0b',
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            fill: false,
                          }
                        ]
                      }}
                      options={{ 
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            position: 'top' as const,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            stepSize: 1 as any,
                          }
                        }
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Custos de Combustível Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: "300px" }}>
                    <Bar 
                      data={{
                        labels: ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'],
                        datasets: [{
                          label: 'Custo (R$)',
                          data: [4500, 5200, 4800, 5600, 5900, 6100],
                          backgroundColor: '#8b5cf6',
                        }]
                      }}
                      options={{ 
                        maintainAspectRatio: false,
                        responsive: true,
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              callback: function(value) {
                                return 'R$ ' + (Number(value)/1000).toFixed(1) + 'k';
                              }
                            }
                          }
                        }
                      }} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="equipamentos" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Equipamentos</CardTitle>
                  <Wrench className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Uso</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Em Manutenção</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Equipamentos por Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Selecione um empreendimento para visualizar os dados
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Equipamentos por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Selecione um empreendimento para visualizar os dados
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Equipamentos */}
            <Card>
              <CardHeader>
                <CardTitle>Últimos Equipamentos Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Selecione um empreendimento para visualizar os equipamentos
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gestao-dados" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Arquivos</CardTitle>
                  <Database className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documentos</CardTitle>
                  <FileText className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Planilhas</CardTitle>
                  <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outros</CardTitle>
                  <Database className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Arquivos por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Selecione um empreendimento para visualizar os dados
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Armazenamento por Categoria (GB)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Selecione um empreendimento para visualizar os dados
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Arquivos */}
            <Card>
              <CardHeader>
                <CardTitle>Documentos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Selecione um empreendimento para visualizar os documentos
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seguranca" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Colaboradores</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documentos Válidos</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documentos Vencidos</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">% Conformidade</CardTitle>
                  <Shield className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs text-muted-foreground">Selecione um empreendimento</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Status de Documentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Selecione um empreendimento para visualizar os dados
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Documentos por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Selecione um empreendimento para visualizar os dados
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Colaboradores */}
            <Card>
              <CardHeader>
                <CardTitle>Colaboradores com Documentos a Vencer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  Selecione um empreendimento para visualizar os colaboradores
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}