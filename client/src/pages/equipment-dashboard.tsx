import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  Activity, 
  Package, 
  Wrench, 
  AlertCircle, 
  TrendingUp, 
  Download,
  Filter,
  Calendar as CalendarIcon,
  BarChart3,
  PieChart as PieChartIcon,
  Users,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Status colors for charts
const STATUS_COLORS = {
  ativo: '#10b981',
  inativo: '#6b7280',
  em_manutencao: '#f59e0b',
  obsoleto: '#ef4444',
  em_avaliacao: '#8b5cf6'
};

const EQUIPMENT_TYPES_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

interface FilterState {
  periodo: string;
  dataInicio?: Date;
  dataFim?: Date;
  empreendimento?: string;
  tipoEquipamento?: string;
  status?: string;
  colaborador?: string;
}

interface DashboardStats {
  totalEquipamentos: number;
  emUso: number;
  emManutencao: number;
  pendenciasVencidas: number;
  movimentacoesMes: number;
}

interface ChartData {
  statusDistribution: { name: string; value: number; color: string }[];
  equipmentByType: { tipo: string; quantidade: number }[];
  monthlyMovements: { mes: string; retiradas: number; devolucoes: number; manutencoes: number }[];
  projectDistribution: { projeto: string; ativo: number; manutencao: number; inativo: number }[];
  damageReturns: { mes: string; funcionando: number; defeito: number; danificado: number }[];
  topUsers: { usuario: string; movimentacoes: number }[];
}

export default function EquipmentDashboard() {
  const [filters, setFilters] = useState<FilterState>({
    periodo: '30'
  });

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/equipamentos/dashboard/stats', filters],
    enabled: true
  });

  // Fetch chart data
  const { data: chartData, isLoading: chartLoading } = useQuery<ChartData>({
    queryKey: ['/api/equipamentos/dashboard/charts', filters],
    enabled: true
  });

  // Mock data for development
  const mockStats: DashboardStats = {
    totalEquipamentos: 156,
    emUso: 89,
    emManutencao: 12,
    pendenciasVencidas: 5,
    movimentacoesMes: 47
  };

  const mockChartData: ChartData = {
    statusDistribution: [
      { name: 'Ativo', value: 120, color: STATUS_COLORS.ativo },
      { name: 'Em Manutenção', value: 12, color: STATUS_COLORS.em_manutencao },
      { name: 'Inativo', value: 15, color: STATUS_COLORS.inativo },
      { name: 'Obsoleto', value: 9, color: STATUS_COLORS.obsoleto }
    ],
    equipmentByType: [
      { tipo: 'GPS', quantidade: 45 },
      { tipo: 'Notebook', quantidade: 32 },
      { tipo: 'Rádio', quantidade: 28 },
      { tipo: 'Drone', quantidade: 18 },
      { tipo: 'Tablet', quantidade: 15 },
      { tipo: 'Câmera', quantidade: 12 }
    ],
    monthlyMovements: [
      { mes: 'Jan', retiradas: 25, devolucoes: 22, manutencoes: 5 },
      { mes: 'Fev', retiradas: 32, devolucoes: 28, manutencoes: 8 },
      { mes: 'Mar', retiradas: 28, devolucoes: 30, manutencoes: 4 },
      { mes: 'Abr', retiradas: 35, devolucoes: 32, manutencoes: 7 },
      { mes: 'Mai', retiradas: 40, devolucoes: 38, manutencoes: 9 },
      { mes: 'Jun', retiradas: 38, devolucoes: 35, manutencoes: 6 }
    ],
    projectDistribution: [
      { projeto: 'UHE Belo Monte', ativo: 25, manutencao: 3, inativo: 2 },
      { projeto: 'Parque Solar A', ativo: 18, manutencao: 2, inativo: 1 },
      { projeto: 'Linha 500kV', ativo: 22, manutencao: 4, inativo: 0 },
      { projeto: 'Subestação Norte', ativo: 15, manutencao: 1, inativo: 3 }
    ],
    damageReturns: [
      { mes: 'Jan', funcionando: 18, defeito: 3, danificado: 1 },
      { mes: 'Fev', funcionando: 24, defeito: 3, danificado: 1 },
      { mes: 'Mar', funcionando: 26, defeito: 3, danificado: 1 },
      { mes: 'Abr', funcionando: 28, defeito: 4, danificado: 0 },
      { mes: 'Mai', funcionando: 34, defeito: 3, danificado: 1 },
      { mes: 'Jun', funcionando: 32, defeito: 2, danificado: 1 }
    ],
    topUsers: [
      { usuario: 'João Silva', movimentacoes: 28 },
      { usuario: 'Maria Santos', movimentacoes: 24 },
      { usuario: 'Pedro Costa', movimentacoes: 19 },
      { usuario: 'Ana Lima', movimentacoes: 16 },
      { usuario: 'Carlos Oliveira', movimentacoes: 14 }
    ]
  };

  const displayStats = stats || mockStats;
  const displayChartData = chartData || mockChartData;

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportPNG = () => {
    // Simple PNG export using html2canvas would go here
    alert('Funcionalidade de exportação PNG será implementada em breve');
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipment-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Painel de Equipamentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Dashboards e análises de equipamentos e movimentações
          </p>
        </div>
        
        {/* Export buttons */}
        <div className="flex gap-2">
          <Button onClick={handleExportPNG} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PNG
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={filters.periodo} onValueChange={(value) => setFilters({...filters, periodo: value})}>
                <SelectTrigger data-testid="filter-periodo">
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
              <Select value={filters.empreendimento} onValueChange={(value) => setFilters({...filters, empreendimento: value})}>
                <SelectTrigger data-testid="filter-empreendimento">
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
              <Select value={filters.tipoEquipamento} onValueChange={(value) => setFilters({...filters, tipoEquipamento: value})}>
                <SelectTrigger data-testid="filter-tipo">
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
              <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                <SelectTrigger data-testid="filter-status">
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
                value={filters.colaborador || ''}
                onChange={(e) => setFilters({...filters, colaborador: e.target.value})}
                data-testid="filter-colaborador"
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => setFilters({ periodo: '30', empreendimento: undefined, tipoEquipamento: undefined, status: undefined, colaborador: undefined })}
                variant="outline"
                className="w-full"
                data-testid="button-clear-filters"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card data-testid="card-total-equipamentos">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Equipamentos
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.totalEquipamentos}</div>
            <p className="text-xs text-muted-foreground">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-em-uso">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Em Uso
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{displayStats.emUso}</div>
            <p className="text-xs text-muted-foreground">
              Atualmente alocados
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-em-manutencao">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Em Manutenção
            </CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{displayStats.emManutencao}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando reparo
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-pendencias-vencidas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Devoluções Atrasadas
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{displayStats.pendenciasVencidas}</div>
            <p className="text-xs text-muted-foreground">
              Há mais de 7 dias
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-movimentacoes-mes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Movimentações do Mês
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{displayStats.movimentacoesMes}</div>
            <p className="text-xs text-muted-foreground">
              Total no período
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card data-testid="chart-status-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Status dos Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={displayChartData.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {displayChartData.statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-4">
              {displayChartData.statusDistribution.map((item, index) => (
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

        {/* Equipment by Type Bar Chart */}
        <Card data-testid="chart-equipment-by-type">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Equipamentos por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={displayChartData.equipmentByType} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="tipo" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Movements Line Chart */}
        <Card data-testid="chart-monthly-movements" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Movimentações Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayChartData.monthlyMovements}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="retiradas" stroke="#3b82f6" name="Retiradas" />
                <Line type="monotone" dataKey="devolucoes" stroke="#10b981" name="Devoluções" />
                <Line type="monotone" dataKey="manutencoes" stroke="#f59e0b" name="Manutenções" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Distribution */}
        <Card data-testid="chart-project-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Distribuição por Empreendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={displayChartData.projectDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="projeto" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ativo" stackId="a" fill="#10b981" name="Ativo" />
                <Bar dataKey="manutencao" stackId="a" fill="#f59e0b" name="Manutenção" />
                <Bar dataKey="inativo" stackId="a" fill="#6b7280" name="Inativo" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card data-testid="chart-top-users">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ranking de Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={displayChartData.topUsers} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="usuario" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="movimentacoes" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}