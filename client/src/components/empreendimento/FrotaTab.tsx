import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Car, CheckCircle, AlertCircle, Wrench } from "lucide-react";
import { Link } from "wouter";

export interface FrotaTabProps {
  empreendimentoId: number;
}

type Veiculo = {
  id: number;
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  tipo: string;
  combustivel: string;
  status: string;
  responsavel?: string;
  kmAtual?: number;
  ultimaRevisao?: string;
  proximaRevisao?: string;
  seguroVencimento?: string;
  ipvaVencimento?: string;
  observacoes?: string;
  empreendimentoId?: number;
};

export function FrotaTab({ empreendimentoId }: FrotaTabProps) {
  const { data: veiculos = [], isLoading } = useQuery<Veiculo[]>({
    queryKey: ["/api/frota", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/frota?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar veículos");
      return res.json();
    },
  });

  const veiculosDisponiveis = veiculos.filter((v) => v.status === "disponivel");
  const veiculosEmUso = veiculos.filter((v) => v.status === "em_uso");
  const veiculosManutencao = veiculos.filter((v) => v.status === "manutencao");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponivel":
        return "bg-green-100 text-green-800 border-green-200";
      case "em_uso":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "manutencao":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "inativo":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "disponivel":
        return "Disponível";
      case "em_uso":
        return "Em Uso";
      case "manutencao":
        return "Manutenção";
      case "inativo":
        return "Inativo";
      default:
        return status;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo.toLowerCase()) {
      case "caminhonete":
      case "pickup":
        return <Truck className="h-4 w-4" />;
      default:
        return <Car className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando veículos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Frota</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Veículos alocados a este empreendimento
          </p>
        </div>
        <Link href="/frota">
          <Button data-testid="button-manage-frota">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar Frota
          </Button>
        </Link>
      </div>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-frota-total">{veiculos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Disponível</p>
                <p className="text-2xl font-bold text-green-700" data-testid="stat-frota-disponiveis">{veiculosDisponiveis.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Uso</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-frota-em-uso">{veiculosEmUso.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Manutenção</p>
                <p className="text-2xl font-bold text-yellow-700" data-testid="stat-frota-manutencao">{veiculosManutencao.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {veiculos.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum veículo encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Este empreendimento ainda não possui veículos alocados.
              </p>
              <Link href="/frota">
                <Button data-testid="button-add-first-veiculo">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Veículo
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {veiculos.slice(0, 9).map((veiculo) => (
            <Card key={veiculo.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-veiculo-${veiculo.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight flex items-center gap-2">
                    {getTipoIcon(veiculo.tipo)}
                    {veiculo.placa}
                  </CardTitle>
                  <Badge variant="outline" className={`text-xs ml-2 border ${getStatusColor(veiculo.status)}`}>
                    {getStatusLabel(veiculo.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Modelo:</span> {veiculo.marca} {veiculo.modelo}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Ano:</span> {veiculo.ano}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {veiculo.tipo}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Combustível:</span> {veiculo.combustivel}
                  </span>
                </div>

                {veiculo.responsavel && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Responsável:</span> {veiculo.responsavel}
                    </span>
                  </div>
                )}

                {veiculo.kmAtual && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">KM Atual:</span> {veiculo.kmAtual.toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}

                {veiculo.proximaRevisao && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Próx. Revisão:</span>{" "}
                      {new Date(veiculo.proximaRevisao).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {veiculos.length > 9 && (
        <div className="text-center">
          <Link href="/frota">
            <Button variant="outline" data-testid="button-view-all-veiculos">
              Ver todos os {veiculos.length} veículos
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
