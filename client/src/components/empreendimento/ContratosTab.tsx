import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Calendar, ExternalLink, CheckCircle, AlertCircle, Clock, Download } from "lucide-react";
import { Link } from "wouter";
import { formatDate } from "@/lib/date-utils";

export interface ContratosTabProps {
  empreendimentoId: number;
}

type Contrato = {
  id: number;
  numero: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  situacao: string;
  valorTotal: string;
  arquivoPdfId?: number | null;
  observacoes?: string | null;
  aditivos?: Aditivo[];
  pagamentos?: Pagamento[];
};

type Aditivo = {
  id: number;
  descricao: string;
  valorAdicional: string | null;
  vigenciaNovaFim: string | null;
  dataAssinatura: string;
};

type Pagamento = {
  id: number;
  descricao: string;
  valorPrevisto: string;
  dataPrevista: string;
  valorPago: string | null;
  dataPagamento: string | null;
  status: string;
};

const SITUACAO_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  vigente: { label: "Vigente", color: "bg-green-100 text-green-800", icon: CheckCircle },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800", icon: AlertCircle },
  suspenso: { label: "Suspenso", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  encerrado: { label: "Encerrado", color: "bg-gray-100 text-gray-800", icon: FileText },
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

export function ContratosTab({ empreendimentoId }: ContratosTabProps) {
  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"],
  });

  const contratosVigentes = contratos.filter(c => c.situacao === 'vigente');
  const contratosVencidos = contratos.filter(c => c.situacao === 'vencido');
  const valorTotalContratos = contratos.reduce((sum, c) => sum + Number(c.valorTotal || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando contratos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contratos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} vinculado{contratos.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Link href="/contratos">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Gerenciar Contratos
          </Button>
        </Link>
      </div>

      {/* Aviso informativo */}
      <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Gestão de Contratos
              </p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                O cadastro e edição de contratos é feito no módulo principal de <strong>Contratos</strong>.
                Aqui você visualiza os contratos vinculados a este empreendimento.
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
              <FileText className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{contratos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vigentes</p>
                <p className="text-2xl font-bold text-green-700">{contratosVigentes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-700">{contratosVencidos.length}</p>
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
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(valorTotalContratos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {contratos.length > 0 ? (
        <div className="space-y-4">
          {contratos.map((contrato) => {
            const situacaoConfig = SITUACAO_CONFIG[contrato.situacao] || SITUACAO_CONFIG.vigente;
            const SituacaoIcon = situacaoConfig.icon;
            const totalAditivos = contrato.aditivos?.length || 0;
            const totalPagamentos = contrato.pagamentos?.length || 0;
            const pagamentosPendentes = contrato.pagamentos?.filter(p => p.status === 'pendente').length || 0;
            
            return (
              <Card key={contrato.id} className="hover:shadow-md transition-shadow" data-testid={`card-contrato-${contrato.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold" data-testid={`text-contrato-numero-${contrato.id}`}>
                          Contrato {contrato.numero}
                        </h4>
                        <Badge className={situacaoConfig.color}>
                          <SituacaoIcon className="h-3 w-3 mr-1" />
                          {situacaoConfig.label}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {contrato.objeto}
                      </p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Início
                          </p>
                          <p className="font-medium">{formatDate(contrato.vigenciaInicio)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Término
                          </p>
                          <p className="font-medium">{formatDate(contrato.vigenciaFim)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Valor
                          </p>
                          <p className="font-medium text-green-600">{formatCurrency(contrato.valorTotal)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Aditivos / Pagamentos</p>
                          <p className="font-medium">
                            {totalAditivos} / {totalPagamentos}
                            {pagamentosPendentes > 0 && (
                              <span className="text-yellow-600 ml-1">({pagamentosPendentes} pendentes)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhum contrato vinculado
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui contratos cadastrados.
              O cadastro de contratos é feito no módulo principal de Contratos.
            </p>
            <Link href="/contratos">
              <Button variant="default" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ir para Contratos
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
