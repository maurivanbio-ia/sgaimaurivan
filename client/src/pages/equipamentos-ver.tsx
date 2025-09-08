import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, QrCode, Shield, History, CheckCircle2, AlertCircle } from "lucide-react";
import type { Equipamento } from "@shared/schema";

const statusColors = {
  funcionando: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100",
  com_defeito: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100",
  em_manutencao: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100",
  descartado: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
};

const statusLabels = {
  funcionando: "Funcionando",
  com_defeito: "Com Defeito",
  em_manutencao: "Em Manutenção",
  descartado: "Descartado"
};

const localizacaoLabels = {
  escritorio: "Escritório",
  cliente: "Cliente",
  colaborador: "Colaborador"
};

// Função para calcular status da manutenção/calibração
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

const maintenanceStatusColors = {
  em_dia: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  proxima_vencimento: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  vencida: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  sem_agendamento: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
};

const maintenanceStatusLabels = {
  em_dia: "Em dia",
  proxima_vencimento: "Próxima ao vencimento",
  vencida: "Vencida",
  sem_agendamento: "Sem agendamento"
};

// Dados simulados para histórico e ESG
const historicoDados = [
  {
    data: "2024-08-15",
    tipo: "Calibração",
    descricao: "Calibração anual realizada no laboratório credenciado",
    responsavel: "João Silva",
    status: "Concluída"
  },
  {
    data: "2024-06-20",
    tipo: "Manutenção",
    descricao: "Limpeza e verificação de sensores",
    responsavel: "Maria Santos", 
    status: "Concluída"
  },
  {
    data: "2024-05-10",
    tipo: "Uso em Campo",
    descricao: "Campanha de monitoramento de fauna - Projeto Belo Monte",
    responsavel: "Carlos Oliveira",
    status: "Realizada"
  }
];

async function fetchEquipamento(id: string): Promise<Equipamento> {
  const res = await fetch(`/api/equipamentos/${id}`);
  if (!res.ok) {
    throw new Error("Equipamento não encontrado");
  }
  return res.json();
}

export default function VerEquipamento() {
  const [match, params] = useRoute("/equipamentos/:id");
  const id = params?.id;

  const { data: equipamento, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/equipamentos", id],
    queryFn: () => fetchEquipamento(id!),
    enabled: !!id,
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return "-";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  if (!match || !id) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Equipamento não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/equipamentos">Voltar à lista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Carregando equipamento...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-6 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !equipamento) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar equipamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-600">{(error as Error)?.message || "Erro desconhecido"}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                Tentar novamente
              </Button>
              <Button asChild>
                <Link href="/equipamentos">Voltar à lista</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maintenanceStatus = getMaintenanceStatus(equipamento.proximaManutencao);
  const isDadosSensiveis = (equipamento as any).categoriaAmbiental === "Fauna" || (equipamento as any).dadosSensiveis;
  const atendeNormas = Math.random() > 0.3; // 70% chance - simulado

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-ver-equipamento">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/equipamentos">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{equipamento.numeroPatrimonio}</h1>
              {isDadosSensiveis && (
                <Badge variant="secondary" className="text-xs">
                  🔒 Dados Sensíveis
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">{equipamento.marca} {equipamento.modelo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[equipamento.status as keyof typeof statusColors]}>
            {statusLabels[equipamento.status as keyof typeof statusLabels]}
          </Badge>
          <Badge className={maintenanceStatusColors[maintenanceStatus]}>
            {maintenanceStatusLabels[maintenanceStatus]}
          </Badge>
          <Button asChild variant="outline">
            <Link href={`/equipamentos/${equipamento.id}/qr`}>
              <QrCode className="h-4 w-4 mr-2" />
              QR Code
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/equipamentos/${equipamento.id}/editar`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="ambiental">Ambiental</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="esg">ESG</TabsTrigger>
        </TabsList>
        
        <TabsContent value="geral" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Nome</span>
                  <div className="font-medium">{equipamento.nome}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Tipo de Equipamento</span>
                  <div className="font-medium">{equipamento.tipoEquipamento}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Marca</span>
                  <div className="font-medium">{equipamento.marca}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Modelo</span>
                  <div className="font-medium">{equipamento.modelo}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div>
                    <Badge className={statusColors[equipamento.status as keyof typeof statusColors]}>
                      {statusLabels[equipamento.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location and Ownership */}
            <Card>
              <CardHeader>
                <CardTitle>Localização e Responsabilidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Localização Atual</span>
                  <div className="font-medium">
                    {localizacaoLabels[equipamento.localizacaoAtual as keyof typeof localizacaoLabels]}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Localização Padrão</span>
                  <div className="font-medium">
                    {localizacaoLabels[equipamento.localizacaoPadrao as keyof typeof localizacaoLabels]}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Responsável Atual</span>
                  <div className="font-medium">{equipamento.responsavelAtual || "-"}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Quantidade Total</span>
                  <div className="font-medium">{equipamento.quantidadeTotal || "-"}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Quantidade Disponível</span>
                  <div className="font-medium">{equipamento.quantidadeDisponivel || "-"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Financeiras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Data de Aquisição</span>
                  <div className="font-medium">{formatDate(equipamento.dataAquisicao)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Valor de Aquisição</span>
                  <div className="font-medium">{formatCurrency(equipamento.valorAquisicao)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Vida Útil Estimada</span>
                  <div className="font-medium">{equipamento.vidaUtilEstimada ? `${equipamento.vidaUtilEstimada} anos` : "-"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Information */}
            <Card>
              <CardHeader>
                <CardTitle>Manutenção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Status da Manutenção</span>
                  <div>
                    <Badge className={maintenanceStatusColors[maintenanceStatus]}>
                      {maintenanceStatusLabels[maintenanceStatus]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Próxima Manutenção</span>
                  <div className="font-medium">{formatDate(equipamento.proximaManutencao)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Frequência de Manutenção</span>
                  <div className="font-medium">
                    {equipamento.frequenciaManutencao ? equipamento.frequenciaManutencao.charAt(0).toUpperCase() + equipamento.frequenciaManutencao.slice(1) : "-"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Observations */}
          {equipamento.observacoesGerais && (
            <Card>
              <CardHeader>
                <CardTitle>Observações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {equipamento.observacoesGerais}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ambiental" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Ambientais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Bioma</span>
                  <div className="font-medium">{(equipamento as any).bioma || "Cerrado"}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Categoria Ambiental</span>
                  <div className="font-medium">{(equipamento as any).categoriaAmbiental || "Fauna"}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Empreendimento Associado</span>
                  <div className="font-medium">Projeto Belo Monte</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Dados Sensíveis</span>
                  <div className="flex items-center gap-2">
                    {isDadosSensiveis ? (
                      <>
                        <Shield className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-700 dark:text-amber-400">Sim - Contém dados de fauna ameaçada</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-700 dark:text-green-400">Não sensíveis</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status de Calibração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Data da Última Calibração</span>
                  <div className="font-medium">15/08/2024</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Próxima Calibração</span>
                  <div className="font-medium">{formatDate(equipamento.proximaManutencao)}</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Certificação</span>
                  <div className="font-medium">ISO 17025 - Laboratório Credenciado</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Precisão</span>
                  <div className="font-medium">±0.1% (dentro da especificação)</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico Ambiental
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {historicoDados.map((item, index) => (
                  <div key={index} className="border-l-2 border-muted pl-4 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{item.tipo}</h4>
                      <span className="text-sm text-muted-foreground">{new Date(item.data).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.descricao}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Responsável: {item.responsavel}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                    {index < historicoDados.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="esg" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Conformidade ESG
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Atende Normas Ambientais</span>
                  <div className="flex items-center gap-2">
                    {atendeNormas ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-700 dark:text-green-400">Sim - ISO 14001, IBAMA</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-700 dark:text-red-400">Não conforme</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Certificações</span>
                  <div className="font-medium">ISO 17025, INMETRO</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Impacto Ambiental</span>
                  <div className="font-medium">Baixo - Equipamento de monitoramento</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Indicadores de Sustentabilidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Vida Útil Restante</span>
                  <div className="font-medium">
                    {equipamento.vidaUtilEstimada ? `${equipamento.vidaUtilEstimada - 1} anos` : "3 anos"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Taxa de Utilização</span>
                  <div className="font-medium">85% (ótima)</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Eficiência Energética</span>
                  <div className="font-medium">A+ (baixo consumo)</div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Contribuição para Biodiversidade</span>
                  <div className="font-medium">Alta - Monitoramento de espécies</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo ESG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <h4 className="font-medium text-green-700 dark:text-green-400">Environmental</h4>
                  <div className="text-2xl font-bold mt-2">9.2/10</div>
                  <p className="text-sm text-muted-foreground">Conformidade ambiental</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400">Social</h4>
                  <div className="text-2xl font-bold mt-2">8.7/10</div>
                  <p className="text-sm text-muted-foreground">Impacto social positivo</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <h4 className="font-medium text-purple-700 dark:text-purple-400">Governance</h4>
                  <div className="text-2xl font-bold mt-2">9.0/10</div>
                  <p className="text-sm text-muted-foreground">Governança e controle</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}