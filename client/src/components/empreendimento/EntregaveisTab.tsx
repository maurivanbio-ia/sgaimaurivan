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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, PackageCheck, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import type { Entregavel } from "@shared/schema";

interface Props { empreendimentoId: number }

const tipoLabels: Record<string, string> = {
  relatorio: 'Relatório', documento: 'Documento', apresentacao: 'Apresentação',
  produto: 'Produto', plano: 'Plano', outros: 'Outros',
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pendente:    { label: 'Pendente',     color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: Clock },
  em_andamento:{ label: 'Em andamento', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', icon: Loader2 },
  entregue:    { label: 'Entregue',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', icon: PackageCheck },
  aprovado:    { label: 'Aprovado',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2 },
  atrasado:    { label: 'Atrasado',     color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: AlertCircle },
};

function daysUntil(d: string | null): number {
  if (!d) return 9999;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / (1000*60*60*24));
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return d.split('-').reverse().join('/');
}

const emptyForm = {
  titulo: '', tipo: 'documento', descricao: '', prazo: '', responsavel: '',
  status: 'pendente', observacoes: '', arquivoUrl: '',
};

export function EntregaveisTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entregavel | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery<Entregavel[]>({
    queryKey: ['/api/entregaveis', empreendimentoId],
    queryFn: () => fetch(`/api/entregaveis?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? apiRequest('PUT', `/api/entregaveis/${editing.id}`, data)
              : apiRequest('POST', '/api/entregaveis', { ...data, empreendimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entregaveis', empreendimentoId] });
      setOpen(false); setEditing(null);
      toast({ title: editing ? 'Entregável atualizado' : 'Entregável registrado' });
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/entregaveis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entregaveis', empreendimentoId] });
      toast({ title: 'Entregável removido' });
    },
  });

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }
  function openNew() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(item: Entregavel) {
    setEditing(item);
    setForm({
      titulo: item.titulo, tipo: item.tipo, descricao: item.descricao || '',
      prazo: item.prazo, responsavel: item.responsavel || '', status: item.status,
      observacoes: item.observacoes || '', arquivoUrl: item.arquivoUrl || '',
    });
    setOpen(true);
  }

  const sorted = [...items].sort((a, b) => a.prazo.localeCompare(b.prazo));
  const entregues = items.filter(i => i.status === 'aprovado' || i.status === 'entregue').length;
  const percent = items.length > 0 ? Math.round((entregues / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-violet-500" /> Checklist de Entregáveis
          </h2>
          <span className="text-sm text-muted-foreground">{entregues}/{items.length} concluídos</span>
        </div>
        <Button size="sm" onClick={openNew} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Novo Entregável
        </Button>
      </div>

      {items.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progresso geral</span>
            <span className="font-semibold">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
          <div className="flex gap-4 mt-3 flex-wrap">
            {Object.entries(statusConfig).map(([k, v]) => {
              const count = items.filter(i => i.status === k).length;
              if (count === 0) return null;
              return (
                <span key={k} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${v.color}`}>
                  {v.label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl">
          Nenhum entregável cadastrado. Clique em "Novo Entregável" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(item => {
            const dias = daysUntil(item.prazo);
            const st = statusConfig[item.status] || statusConfig.pendente;
            const Icon = st.icon;
            const isDone = item.status === 'aprovado' || item.status === 'entregue';
            return (
              <div key={item.id} className={`flex items-center gap-3 p-3.5 border rounded-xl bg-white dark:bg-gray-900 ${isDone ? 'opacity-60' : ''}`}>
                <Icon className={`h-4 w-4 flex-shrink-0 ${isDone ? 'text-emerald-500' : dias < 0 ? 'text-red-500' : dias <= 7 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>{item.titulo}</span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tipoLabels[item.tipo] || item.tipo}</span>
                  </div>
                  <div className="flex gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
                    <span>📅 {formatDate(item.prazo)}</span>
                    {!isDone && dias !== 9999 && (
                      <span className={dias < 0 ? 'text-red-600 font-semibold' : dias <= 7 ? 'text-orange-500 font-semibold' : ''}>
                        {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Hoje' : `${dias}d restantes`}
                      </span>
                    )}
                    {item.responsavel && <span>👤 {item.responsavel}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm('Remover?')) deleteMutation.mutate(item.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Entregável' : 'Novo Entregável'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Relatório de Impacto Ambiental (RIA)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo *</Label>
                <Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={e => set('responsavel', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={2} />
            </div>
            <div>
              <Label>Link do arquivo</Label>
              <Input value={form.arquivoUrl} onChange={e => set('arquivoUrl', e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || !form.prazo || saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
