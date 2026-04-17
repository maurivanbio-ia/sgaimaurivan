import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReembolsosTabContentProps {
  reembolsosFinanceiro: any[];
  reembolsosDiretor: any[];
  reembolsosAprovados: any[];
  loadingReembolsosFinanceiro: boolean;
  loadingReembolsosDiretor: boolean;
  loadingReembolsosAprovados: boolean;
  onSelectReembolso: (r: any) => void;
}

function ReembolsoTable({ rows, loading, emptyText, actionLabel, actionVariant, testIdPrefix, onSelect }: {
  rows: any[];
  loading: boolean;
  emptyText: string;
  actionLabel: string;
  actionVariant: "outline" | "default";
  testIdPrefix: string;
  onSelect: (r: any) => void;
}) {
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <p className="text-center text-muted-foreground py-4">{emptyText}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3">Solicitante</th>
            <th className="text-left p-3">Categoria</th>
            <th className="text-left p-3">Descrição</th>
            <th className="text-right p-3">Valor</th>
            <th className="text-left p-3">Data</th>
            <th className="text-left p-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b hover:bg-muted/30">
              <td className="p-3">{r.solicitanteNome || 'N/A'}</td>
              <td className="p-3"><Badge variant="outline" className="capitalize">{r.categoria}</Badge></td>
              <td className="p-3 max-w-[200px] truncate">{r.descricao}</td>
              <td className="p-3 text-right font-medium">
                R$ {Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-3">{r.dataGasto ? format(new Date(r.dataGasto), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</td>
              <td className="p-3">
                <Button
                  size="sm"
                  variant={actionVariant}
                  className={actionVariant === "default" ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => onSelect(r)}
                  data-testid={`${testIdPrefix}-${r.id}`}
                >
                  {actionLabel}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReembolsosTabContent({
  reembolsosFinanceiro,
  reembolsosDiretor,
  reembolsosAprovados,
  loadingReembolsosFinanceiro,
  loadingReembolsosDiretor,
  loadingReembolsosAprovados,
  onSelectReembolso,
}: ReembolsosTabContentProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Pendente Aprovação Financeiro ({reembolsosFinanceiro.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReembolsoTable
            rows={reembolsosFinanceiro}
            loading={loadingReembolsosFinanceiro}
            emptyText="Nenhum reembolso pendente de aprovação financeira"
            actionLabel="Analisar"
            actionVariant="outline"
            testIdPrefix="button-view-reembolso-financeiro"
            onSelect={onSelectReembolso}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Pendente Aprovação Diretor ({reembolsosDiretor.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReembolsoTable
            rows={reembolsosDiretor}
            loading={loadingReembolsosDiretor}
            emptyText="Nenhum reembolso pendente de aprovação do diretor"
            actionLabel="Analisar"
            actionVariant="outline"
            testIdPrefix="button-view-reembolso-diretor"
            onSelect={onSelectReembolso}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Aprovados — Aguardando Pagamento ({reembolsosAprovados.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReembolsoTable
            rows={reembolsosAprovados}
            loading={loadingReembolsosAprovados}
            emptyText="Nenhum reembolso aguardando pagamento"
            actionLabel="Pagar"
            actionVariant="default"
            testIdPrefix="button-pay-reembolso"
            onSelect={onSelectReembolso}
          />
        </CardContent>
      </Card>
    </div>
  );
}
