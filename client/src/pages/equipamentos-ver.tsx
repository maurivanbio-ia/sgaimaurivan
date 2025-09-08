import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, QrCode } from "lucide-react";
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
            <h1 className="text-3xl font-bold">{equipamento.numeroPatrimonio}</h1>
            <p className="text-muted-foreground mt-1">{equipamento.marca} {equipamento.modelo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[equipamento.status as keyof typeof statusColors]}>
            {statusLabels[equipamento.status as keyof typeof statusLabels]}
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

      {/* Equipment Details */}
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
    </div>
  );
}