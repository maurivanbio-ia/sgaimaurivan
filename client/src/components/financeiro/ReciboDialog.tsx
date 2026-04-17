import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileCheck, Link2, Loader2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

interface ReciboDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reciboForm: any;
  setReciboForm: (fn: (f: any) => any) => void;
  createReciboMutation: UseMutationResult<any, any, any, any>;
}

export function ReciboDialog({ open, onOpenChange, reciboForm, setReciboForm, createReciboMutation }: ReciboDialogProps) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setReciboForm((f: any) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-violet-600" />
            Emitir Recibo
          </DialogTitle>
          <DialogDescription>
            Gerar recibo vinculado ao lançamento financeiro selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {reciboForm.lancamentoId && (
            <div className="bg-violet-50 border border-violet-200 rounded-md p-3 flex items-center gap-2 text-sm text-violet-800">
              <Link2 className="h-4 w-4 shrink-0" />
              <span>Vinculado ao lançamento #{reciboForm.lancamentoId}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Número do Recibo</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Ex: REC-001" value={reciboForm.numero} onChange={set("numero")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor (R$)</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm"
                type="number" step="0.01" value={reciboForm.valor} onChange={set("valor")} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm"
              value={reciboForm.descricao} onChange={set("descricao")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Pagador</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm"
                value={reciboForm.pagador} onChange={set("pagador")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Recebedor</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm"
                value={reciboForm.recebedor} onChange={set("recebedor")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data de Pagamento</label>
              <input className="w-full border rounded-md px-3 py-2 text-sm"
                type="date" value={reciboForm.dataPagamento} onChange={set("dataPagamento")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Método de Pagamento</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm"
                value={reciboForm.metodoPagamento} onChange={set("metodoPagamento")}>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência Bancária</option>
                <option value="boleto">Boleto</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Categoria</label>
            <input className="w-full border rounded-md px-3 py-2 text-sm"
              value={reciboForm.categoria} onChange={set("categoria")} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Observações</label>
            <textarea className="w-full border rounded-md px-3 py-2 text-sm" rows={2}
              value={reciboForm.observacoes} onChange={set("observacoes")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => createReciboMutation.mutate({
                lancamentoId: reciboForm.lancamentoId,
                empreendimentoId: reciboForm.empreendimentoId,
                numero: reciboForm.numero,
                descricao: reciboForm.descricao,
                valor: reciboForm.valor,
                pagador: reciboForm.pagador,
                recebedor: reciboForm.recebedor,
                dataPagamento: reciboForm.dataPagamento,
                metodoPagamento: reciboForm.metodoPagamento,
                categoria: reciboForm.categoria,
                observacoes: reciboForm.observacoes,
                unidade: reciboForm.unidade,
              })}
              disabled={createReciboMutation.isPending || !reciboForm.descricao || !reciboForm.valor}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {createReciboMutation.isPending
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Emitindo...</>
                : <><FileCheck className="mr-2 h-4 w-4" />Emitir Recibo</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
