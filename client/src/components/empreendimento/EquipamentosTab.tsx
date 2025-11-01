import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Plus, Package, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export interface EquipamentosTabProps {
  empreendimentoId: number;
}

type Equipamento = {
  id: number;
  nome: string;
  tipo: string;
  status: string;
  localizacaoAtual: string;
  responsavel?: string;
  marca?: string;
  modelo?: string;
  numeroPatrimonio?: string;
  dataAquisicao?: string;
  ultimaManutencao?: string;
  proximaManutencao?: string;
  valorAquisicao?: number;
  observacoes?: string;
  empreendimentoId?: number;
};

export function EquipamentosTab({ empreendimentoId }: EquipamentosTabProps) {
  const { data: equipamentos = [], isLoading } = useQuery<Equipamento[]>({
    queryKey: ["/api/equipamentos", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/equipamentos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar equipamentos");
      return res.json();
    },
  });

  const equipamentosDisponiveis = equipamentos.filter((e) => e.status === "disponivel");
  const equipamentosEmUso = equipamentos.filter((e) => e.status === "em_uso");
  const equipamentosManutencao = equipamentos.filter((e) => e.status === "manutencao");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponivel":
        return "bg-green-100 text-green-800 border-green-200";
      case "em_uso":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "manutencao":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
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
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando equipamentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Equipamentos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Equipamentos alocados a este empreendimento
          </p>
        </div>
        <Link href="/equipamentos">
          <Button data-testid="button-manage-equipamentos">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar Equipamentos
          </Button>
        </Link>
      </div>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-equipamentos-total">{equipamentos.length}</p>
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
                <p className="text-2xl font-bold text-green-700" data-testid="stat-equipamentos-disponiveis">{equipamentosDisponiveis.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Uso</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-equipamentos-em-uso">{equipamentosEmUso.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Manutenção</p>
                <p className="text-2xl font-bold text-yellow-700" data-testid="stat-equipamentos-manutencao">{equipamentosManutencao.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {equipamentos.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Wrench className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum equipamento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Este empreendimento ainda não possui equipamentos alocados.
              </p>
              <Link href="/equipamentos">
                <Button data-testid="button-add-first-equipamento">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Equipamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {equipamentos.slice(0, 9).map((equipamento) => (
            <Card key={equipamento.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-equipamento-${equipamento.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {equipamento.nome}
                  </CardTitle>
                  <Badge variant="outline" className={`text-xs ml-2 border ${getStatusColor(equipamento.status)}`}>
                    {getStatusLabel(equipamento.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Tipo:</span> {equipamento.tipo}
                  </span>
                </div>

                {equipamento.marca && equipamento.modelo && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Marca/Modelo:</span> {equipamento.marca} {equipamento.modelo}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Localização:</span> {equipamento.localizacaoAtual}
                  </span>
                </div>

                {equipamento.responsavel && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Responsável:</span> {equipamento.responsavel}
                    </span>
                  </div>
                )}

                {equipamento.numeroPatrimonio && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Patrimônio:</span> {equipamento.numeroPatrimonio}
                    </span>
                  </div>
                )}

                {equipamento.proximaManutencao && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Próx. Manutenção:</span>{" "}
                      {new Date(equipamento.proximaManutencao).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {equipamentos.length > 9 && (
        <div className="text-center">
          <Link href="/equipamentos">
            <Button variant="outline" data-testid="button-view-all-equipamentos">
              Ver todos os {equipamentos.length} equipamentos
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
