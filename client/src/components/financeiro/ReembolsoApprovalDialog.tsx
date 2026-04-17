import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, DollarSign, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { UseMutationResult } from "@tanstack/react-query";

interface ReembolsoApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedReembolso: any | null;
  reembolsoObservacao: string;
  setReembolsoObservacao: (v: string) => void;
  pagamentoInfo: { formaPagamento: string; dataPagamento: string };
  setPagamentoInfo: (fn: (p: { formaPagamento: string; dataPagamento: string }) => { formaPagamento: string; dataPagamento: string }) => void;
  aprovarFinanceiroMutation: UseMutationResult<any, any, any, any>;
  rejeitarFinanceiroMutation: UseMutationResult<any, any, any, any>;
  aprovarDiretorMutation: UseMutationResult<any, any, any, any>;
  rejeitarDiretorMutation: UseMutationResult<any, any, any, any>;
  pagarMutation: UseMutationResult<any, any, any, any>;
}

export function ReembolsoApprovalDialog({
  open,
  onOpenChange,
  selectedReembolso,
  reembolsoObservacao,
  setReembolsoObservacao,
  pagamentoInfo,
  setPagamentoInfo,
  aprovarFinanceiroMutation,
  rejeitarFinanceiroMutation,
  aprovarDiretorMutation,
  rejeitarDiretorMutation,
  pagarMutation,
}: ReembolsoApprovalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selectedReembolso?.status === 'pendente_financeiro' && 'Análise Financeira'}
            {selectedReembolso?.status === 'pendente_diretor' && 'Análise do Diretor'}
            {selectedReembolso?.status === 'aprovado_diretor' && 'Registrar Pagamento'}
          </DialogTitle>
        </DialogHeader>

        {selectedReembolso && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Solicitante</Label>
                <p className="font-medium">{selectedReembolso.solicitanteNome || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Categoria</Label>
                <Badge variant="outline" className="capitalize mt-1">{selectedReembolso.categoria}</Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Valor</Label>
                <p className="font-bold text-lg">R$ {Number(selectedReembolso.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Data do Gasto</Label>
                <p>{selectedReembolso.dataGasto ? format(new Date(selectedReembolso.dataGasto), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Descrição</Label>
              <p className="bg-muted p-3 rounded mt-1">{selectedReembolso.descricao}</p>
            </div>

            {selectedReembolso.observacoes && (
              <div>
                <Label className="text-muted-foreground">Observações do Solicitante</Label>
                <p className="bg-muted p-3 rounded mt-1">{selectedReembolso.observacoes}</p>
              </div>
            )}

            {selectedReembolso.comprovanteUrl && (
              <div>
                <Label className="text-muted-foreground">Comprovante</Label>
                <a href={selectedReembolso.comprovanteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block mt-1">Ver Comprovante</a>
              </div>
            )}

            {selectedReembolso.status === 'pendente_financeiro' && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea value={reembolsoObservacao} onChange={e => setReembolsoObservacao(e.target.value)}
                    placeholder="Adicione observações para o diretor..."
                    data-testid="input-reembolso-observacao-financeiro" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline"
                    onClick={() => rejeitarFinanceiroMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                    disabled={rejeitarFinanceiroMutation.isPending}
                    data-testid="button-rejeitar-financeiro">
                    {rejeitarFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Rejeitar
                  </Button>
                  <Button
                    onClick={() => aprovarFinanceiroMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                    disabled={aprovarFinanceiroMutation.isPending}
                    data-testid="button-aprovar-financeiro">
                    {aprovarFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Aprovar e Enviar para Diretor
                  </Button>
                </div>
              </div>
            )}

            {selectedReembolso.status === 'pendente_diretor' && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea value={reembolsoObservacao} onChange={e => setReembolsoObservacao(e.target.value)}
                    placeholder="Adicione observações finais..."
                    data-testid="input-reembolso-observacao-diretor" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline"
                    onClick={() => rejeitarDiretorMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                    disabled={rejeitarDiretorMutation.isPending}
                    data-testid="button-rejeitar-diretor">
                    {rejeitarDiretorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Rejeitar
                  </Button>
                  <Button
                    onClick={() => aprovarDiretorMutation.mutate({ id: selectedReembolso.id, observacao: reembolsoObservacao })}
                    disabled={aprovarDiretorMutation.isPending}
                    data-testid="button-aprovar-diretor">
                    {aprovarDiretorMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Aprovar para Pagamento
                  </Button>
                </div>
              </div>
            )}

            {selectedReembolso.status === 'aprovado_diretor' && (
              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={pagamentoInfo.formaPagamento}
                      onValueChange={v => setPagamentoInfo(p => ({ ...p, formaPagamento: v }))}>
                      <SelectTrigger data-testid="select-forma-pagamento">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data do Pagamento</Label>
                    <Input type="date" value={pagamentoInfo.dataPagamento}
                      onChange={e => setPagamentoInfo(p => ({ ...p, dataPagamento: e.target.value }))}
                      data-testid="input-data-pagamento" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => pagarMutation.mutate({ id: selectedReembolso.id, ...pagamentoInfo })}
                    disabled={pagarMutation.isPending || !pagamentoInfo.formaPagamento || !pagamentoInfo.dataPagamento}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-confirmar-pagamento">
                    {pagarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
                    Confirmar Pagamento
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
