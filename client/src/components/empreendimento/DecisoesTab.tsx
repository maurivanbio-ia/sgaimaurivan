import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import type { Decisao } from "@shared/schema";

interface Props { empreendimentoId: number }

const statusConfig: Record<string, { label: string; color: string }> = {
  aprovada:  { label: 'Aprovada',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  revisao:   { label: 'Em Revisão',color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
};

function formatDate(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const emptyForm = {
  titulo: '', descricao: '', decisaoTomada: '', decididoPor: '',
  dataDecisao: new Date().toISOString().split('T')[0],
  racional: '', alternativasConsideradas: '', impacto: '', status: 'aprovada',
};

export function DecisoesTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Decisao | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery<Decisao[]>({
    queryKey: ['/api/decisoes', empreendimentoId],
    queryFn: () => fetch(`/api/decisoes?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? apiRequest('PUT', `/api/decisoes/${editing.id}`, data)
              : apiRequest('POST', '/api/decisoes', { ...data, empreendimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decisoes', empreendimentoId] });
      setOpen(false); setEditing(null);
      toast({ title: editing ? 'Decisão atualizada' : 'Decisão registrada' });
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/decisoes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/decisoes', empreendimentoId] });
      toast({ title: 'Decisão removida' });
    },
  });

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  function openNew() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(item: Decisao) {
    setEditing(item);
    setForm({
      titulo: item.titulo, descricao: item.descricao || '', decisaoTomada: item.decisaoTomada,
      decididoPor: item.decididoPor || '', dataDecisao: item.dataDecisao,
      racional: item.racional || '', alternativasConsideradas: item.alternativasConsideradas || '',
      impacto: item.impacto || '', status: item.status,
    });
    setOpen(true);
  }

  const sorted = [...items].sort((a, b) => b.dataDecisao.localeCompare(a.dataDecisao));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" /> Registro de Decisões
          <span className="text-sm font-normal text-muted-foreground">({items.length} registros)</span>
        </h2>
        <Button size="sm" onClick={openNew} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Nova Decisão
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl">
          Nenhuma decisão registrada. Clique em "Nova Decisão" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(item => {
            const isOpen = expanded === item.id;
            const st = statusConfig[item.status] || statusConfig.aprovada;
            return (
              <div key={item.id} className="border rounded-xl bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{item.titulo}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                      <span>📅 {formatDate(item.dataDecisao)}</span>
                      {item.decididoPor && <span>👤 {item.decididoPor}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(item); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); if (confirm('Remover decisão?')) deleteMutation.mutate(item.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 border-t bg-muted/20 space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground text-xs">Decisão Tomada</span>
                      <p className="mt-0.5 font-medium">{item.decisaoTomada}</p>
                    </div>
                    {item.descricao && <div><span className="font-medium text-muted-foreground text-xs">Contexto</span><p className="mt-0.5">{item.descricao}</p></div>}
                    {item.racional && <div><span className="font-medium text-muted-foreground text-xs">Racional</span><p className="mt-0.5">{item.racional}</p></div>}
                    {item.alternativasConsideradas && <div><span className="font-medium text-muted-foreground text-xs">Alternativas Consideradas</span><p className="mt-0.5">{item.alternativasConsideradas}</p></div>}
                    {item.impacto && <div><span className="font-medium text-muted-foreground text-xs">Impacto Esperado</span><p className="mt-0.5">{item.impacto}</p></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Decisão' : 'Nova Decisão'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Alteração de fornecedor de equipamentos" />
            </div>
            <div>
              <Label>Contexto / Situação</Label>
              <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Decisão Tomada *</Label>
              <Textarea value={form.decisaoTomada} onChange={e => set('decisaoTomada', e.target.value)} rows={2} placeholder="Descreva claramente o que foi decidido..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Decidido por</Label>
                <Input value={form.decididoPor} onChange={e => set('decididoPor', e.target.value)} />
              </div>
              <div>
                <Label>Data da Decisão *</Label>
                <Input type="date" value={form.dataDecisao} onChange={e => set('dataDecisao', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Racional</Label>
              <Textarea value={form.racional} onChange={e => set('racional', e.target.value)} rows={2} placeholder="Por que esta decisão foi tomada?" />
            </div>
            <div>
              <Label>Alternativas Consideradas</Label>
              <Textarea value={form.alternativasConsideradas} onChange={e => set('alternativasConsideradas', e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Impacto Esperado</Label>
              <Input value={form.impacto} onChange={e => set('impacto', e.target.value)} placeholder="Ex.: Redução de 15% nos custos de equipamento" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || !form.decisaoTomada || !form.dataDecisao || saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
