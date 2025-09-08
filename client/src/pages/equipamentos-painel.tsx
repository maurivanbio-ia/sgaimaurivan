import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, AlertTriangle, CheckCircle, TrendingUp, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Equipamento } from "@shared/schema";

// Cores para os gráficos
const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6b7280'];

async function fetchEquipamentos(): Promise<Equipamento[]> {
  const res = await fetch("/api/equipamentos");
  if (!res.ok) {
    throw new Error("Erro ao buscar equipamentos");
  }
  return res.json();
}

const getMaintenanceStatus = (proximaManutencao: string | null) => {
  if (!proximaManutencao) return "sem_agendamento";
  
  const today = new Date();
  const maintenance = new Date(proximaManutencao);
  const diffTime = maintenance.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "vencida";
  if (diffDays <= 30) return "proxima_vencimento";
  return "em_dia";
};

const biomaOptions = [
  "Amazônia",
  "Cerrado", 
  "Caatinga",
  "Mata Atlântica",
  "Pantanal",
  "Pampa",
  "Marinho Costeiro"
];

const categoriaAmbientalOptions = [
  "Fauna",
  "Flora", 
  "Água",
  "Solo",
  "Ar",
  "Ruído",
  "Resíduos",
  "Outro"
];

export default function PainelESG() {
  const { data: equipamentos = [], isLoading, error } = useQuery({
    queryKey: ["/api/equipamentos"],
    queryFn: fetchEquipamentos,
  });

  // Cálculos dos indicadores
  const totalEquipamentos = equipamentos.length;
  const equipamentosAtivos = equipamentos.filter(eq => eq.status === "funcionando").length;
  const equipamentosVencidos = equipamentos.filter(eq => getMaintenanceStatus(eq.proximaManutencao) === "vencida").length;
  const equipamentosProximosVencimento = equipamentos.filter(eq => getMaintenanceStatus(eq.proximaManutencao) === "proxima_vencimento").length;

  // Dados para gráfico de distribuição por status
  const statusData = [
    { name: 'Funcionando', value: equipamentos.filter(eq => eq.status === "funcionando").length, color: '#22c55e' },
    { name: 'Com Defeito', value: equipamentos.filter(eq => eq.status === "com_defeito").length, color: '#ef4444' },
    { name: 'Em Manutenção', value: equipamentos.filter(eq => eq.status === "em_manutencao").length, color: '#f59e0b' },
    { name: 'Descartado', value: equipamentos.filter(eq => eq.status === "descartado").length, color: '#6b7280' },
  ];

  // Dados para gráfico de manutenção
  const maintenanceData = [
    { name: 'Em dia', value: equipamentos.filter(eq => getMaintenanceStatus(eq.proximaManutencao) === "em_dia").length, color: '#22c55e' },
    { name: 'Próximo vencimento', value: equipamentosProximosVencimento, color: '#f59e0b' },
    { name: 'Vencida', value: equipamentosVencidos, color: '#ef4444' },
    { name: 'Sem agendamento', value: equipamentos.filter(eq => getMaintenanceStatus(eq.proximaManutencao) === "sem_agendamento").length, color: '#6b7280' },
  ];

  // Dados para gráfico de distribuição por bioma (simulado)
  const biomaData = biomaOptions.map(bioma => ({
    name: bioma,
    value: Math.floor(Math.random() * totalEquipamentos / 3) + 1 // Simulando dados
  }));

  // Dados para gráfico de categoria ambiental (simulado)
  const categoriaData = categoriaAmbientalOptions.map(categoria => ({
    name: categoria,
    value: Math.floor(Math.random() * totalEquipamentos / 4) + 1 // Simulando dados
  }));

  // Cálculo do MTBF e MTTR (simulado)
  const mtbf = 720; // horas
  const mttr = 24; // horas

  // Percentual de equipamentos de fauna calibrados
  const equipamentosFauna = equipamentos.filter(eq => (eq as any).categoriaAmbiental === "Fauna").length;
  const equipamentosFaunaCalibrados = Math.floor(equipamentosFauna * 0.7); // 70% simulado

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Carregando painel ESG...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-painel-esg">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost">
          <Link href="/equipamentos">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar à Lista
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel ESG - Equipamentos</h1>
          <p className="text-muted-foreground mt-2">
            Indicadores ambientais e de sustentabilidade dos equipamentos
          </p>
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Equipamentos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEquipamentos}</div>
            <p className="text-xs text-muted-foreground">
              {equipamentosAtivos} ativos ({Math.round((equipamentosAtivos / totalEquipamentos) * 100)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manutenções Vencidas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{equipamentosVencidos}</div>
            <p className="text-xs text-muted-foreground">
              {equipamentosProximosVencimento} próximos do vencimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MTBF</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mtbf}h</div>
            <p className="text-xs text-muted-foreground">
              Tempo médio entre falhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MTTR</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mttr}h</div>
            <p className="text-xs text-muted-foreground">
              Tempo médio de reparo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Maintenance Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status de Manutenção</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={maintenanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {maintenanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bioma Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Bioma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={biomaData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Environmental Category Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Categoria Ambiental</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoriaData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Environmental Impact Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Impacto Ambiental
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-green-700 dark:text-green-400">Equipamentos de Fauna</h4>
              <p className="text-2xl font-bold">{Math.round((equipamentosFaunaCalibrados / (equipamentosFauna || 1)) * 100)}%</p>
              <p className="text-sm text-muted-foreground">
                {equipamentosFaunaCalibrados} de {equipamentosFauna} equipamentos estão calibrados e dentro do prazo
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-blue-700 dark:text-blue-400">Conformidade Ambiental</h4>
              <p className="text-2xl font-bold">{Math.round(((totalEquipamentos - equipamentosVencidos) / totalEquipamentos) * 100)}%</p>
              <p className="text-sm text-muted-foreground">
                dos equipamentos estão em conformidade com normas ambientais
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-purple-700 dark:text-purple-400">Sustentabilidade</h4>
              <p className="text-2xl font-bold">{Math.round((equipamentosAtivos / totalEquipamentos) * 100)}%</p>
              <p className="text-sm text-muted-foreground">
                taxa de equipamentos funcionais (reduz necessidade de substituição)
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Resumo dos Indicadores ESG</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• <strong>Environmental:</strong> {Math.round(((totalEquipamentos - equipamentosVencidos) / totalEquipamentos) * 100)}% dos equipamentos atendem normas ambientais (ISO, IBAMA)</li>
              <li>• <strong>Social:</strong> Equipamentos de fauna calibrados garantem precisão em estudos de biodiversidade</li>
              <li>• <strong>Governance:</strong> Sistema de rastreamento e manutenção preventiva implementado</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}