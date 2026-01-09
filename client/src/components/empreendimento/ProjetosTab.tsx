import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FolderKanban, DollarSign, TrendingUp, Calendar, Target, ExternalLink, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { formatDate } from "@/lib/date-utils";
import type { Projeto } from "@shared/schema";

export interface ProjetosTabProps {
  empreendimentoId: number;
}

const statusOptions = [
  { value: "em_planejamento", label: "Em Planejamento", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "pausado", label: "Pausado", color: "bg-gray-100 text-gray-800 border-gray-200" },
];

const getStatusColor = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.color || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusLabel = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.label || status;
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

const calcularEficiencia = (valorContratado: string | null, valorRecebido: string | null) => {
  const contratado = Number(valorContratado || 0);
  const recebido = Number(valorRecebido || 0);
  if (contratado === 0) return 0;
  return Math.round((recebido / contratado) * 100);
};

export function ProjetosTab({ empreendimentoId }: ProjetosTabProps) {
  const { data: projetos = [], isLoading } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/projetos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar projetos");
      return res.json();
    },
  });

  const projetosEmAndamento = projetos.filter(p => p.status === 'em_andamento');
  const projetosConcluidos = projetos.filter(p => p.status === 'concluido');
  const projetosPlanejamento = projetos.filter(p => p.status === 'em_planejamento');

  const valorTotalContratado = projetos.reduce((sum, p) => sum + Number(p.valorContratado || 0), 0);
  const valorTotalRecebido = projetos.reduce((sum, p) => sum + Number(p.valorRecebido || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Projetos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} vinculado{projetos.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Link href="/projetos">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Gerenciar Projetos
          </Button>
        </Link>
      </div>

      {/* Aviso informativo */}
      <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FolderKanban className="h-5 w-5 text-purple-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-purple-900 dark:text-purple-100">
                Gestão de Projetos
              </p>
              <p className="text-purple-700 dark:text-purple-300 mt-1">
                O cadastro e edição de projetos é feito no módulo principal de <strong>Projetos</strong>.
                Aqui você visualiza os projetos vinculados a este empreendimento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{projetos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-yellow-700">{projetosEmAndamento.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-700">{projetosConcluidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(valorTotalContratado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {projetos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projetos.map((projeto) => {
            const eficiencia = calcularEficiencia(projeto.valorContratado, projeto.valorRecebido);
            
            return (
              <Card key={projeto.id} className="hover:shadow-md transition-shadow" data-testid={`card-projeto-${projeto.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate" data-testid={`text-projeto-nome-${projeto.id}`}>
                        {projeto.nome}
                      </h4>
                      {projeto.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {projeto.descricao}
                        </p>
                      )}
                    </div>
                    <Badge className={`${getStatusColor(projeto.status)} ml-2`}>
                      {getStatusLabel(projeto.status)}
                    </Badge>
                  </div>

                  {/* Valores financeiros */}
                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Contratado
                      </p>
                      <p className="font-medium">{formatCurrency(projeto.valorContratado)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Recebido
                      </p>
                      <p className="font-medium text-green-600">{formatCurrency(projeto.valorRecebido)}</p>
                    </div>
                  </div>

                  {/* Progresso de eficiência */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Eficiência</span>
                      <span className="font-medium">{eficiencia}%</span>
                    </div>
                    <Progress value={eficiencia} className="h-2" />
                  </div>

                  {/* Datas */}
                  {(projeto.inicioPrevisto || projeto.fimPrevisto) && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                      {projeto.inicioPrevisto && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Início: {formatDate(projeto.inicioPrevisto)}</span>
                        </div>
                      )}
                      {projeto.fimPrevisto && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>Fim: {formatDate(projeto.fimPrevisto)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhum projeto vinculado
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui projetos cadastrados.
              O cadastro de projetos é feito no módulo principal de Projetos.
            </p>
            <Link href="/projetos">
              <Button variant="default" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ir para Projetos
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
