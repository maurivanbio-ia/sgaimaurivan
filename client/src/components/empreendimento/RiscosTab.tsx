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
import { Plus, Pencil, Trash2, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import type { Risco } from "@shared/schema";

interface Props { empreendimentoId: number }

const probabilidadeConfig: Record<string, { label: string; color: string }> = {
  baixa:     { label: 'Baixa',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  media:     { label: 'Média',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  alta:      { label: 'Alta',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  muito_alta:{ label: 'Muito Alta',color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};
const impactoConfig: Record<string, { label: string; color: string }> = {
  baixo:  { label: 'Baixo',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  medio:  { label: 'Médio',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  alto:   { label: 'Alto',   color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  critico:{ label: 'Crítico',color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};
const nivelConfig: Record<string, { label: string; dot: string }> = {
  baixo:  { label: 'Baixo',  dot: 'bg-emerald-500' },
  medio:  { label: 'Médio',  dot: 'bg-yellow-400' },
  alto:   { label: 'Alto',   dot: 'bg-orange-500' },
  critico:{ label: 'Crítico',dot: 'bg-red-600' },
};
const statusConfig: Record<string, { label: string; color: string }> = {
  identificado:{ label: 'Identificado', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  monitorando: { label: 'Monitorando',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  mitigado:    { label: 'Mitigado',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  aceito:      { label: 'Aceito',       color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  encerrado:   { label: 'Encerrado',    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
};
const categoriaLabels: Record<string, string> = {
  tecnico: 'Técnico', ambiental: 'Ambiental', legal: 'Legal',
  financeiro: 'Financeiro', social: 'Social', outro: 'Outro',
};

function calcNivel(prob: string, imp: string): string {
  const pScore: Record<string, number> = { baixa: 1, media: 2, alta: 3, muito_alta: 4 };
  const iScore: Record<string, number> = { baixo: 1, medio: 2, alto: 3, critico: 4 };
  const score = (pScore[prob] || 2) * (iScore[imp] || 2);
  if (score <= 2) return 'baixo';
  if (score <= 6) return 'medio';
  if (score <= 9) return 'alto';
  return 'critico';
}

const emptyForm = {
  titulo: '', descricao: '', categoria: 'tecnico', probabilidade: 'media', impacto: 'medio',
  nivelRisco: 'medio', status: 'identificado', planoMitigacao: '', planoContingencia: '',
  responsavel: '', prazo: '',
};

export function RiscosTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Risco | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items = [], isLoading } = useQuery<Risco[]>({
    queryKey: ['/api/riscos', empreendimentoId],
    queryFn: () => fetch(`/api/riscos?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? apiRequest('PUT', `/api/riscos/${editing.id}`, data)
              : apiRequest('POST', '/api/riscos', { ...data, empreendimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riscos', empreendimentoId] });
      setOpen(false); setEditing(null);
      toast({ title: editing ? 'Risco atualizado' : 'Risco registrado' });
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/riscos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riscos', empreendimentoId] });
      toast({ title: 'Risco removido' });
    },
  });

  function set(field: string, value: string) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'probabilidade' || field === 'impacto') {
        updated.nivelRisco = calcNivel(
          field === 'probabilidade' ? value : prev.probabilidade,
          field === 'impacto' ? value : prev.impacto,
        );
      }
      return updated;
    });
  }

  function openNew() {
    setEditing(null); setForm(emptyForm); setOpen(true);
  }
  function openEdit(item: Risco) {
    setEditing(item);
    setForm({
      titulo: item.titulo, descricao: item.descricao || '', categoria: item.categoria,
      probabilidade: item.probabilidade, impacto: item.impacto, nivelRisco: item.nivelRisco,
      status: item.status, planoMitigacao: item.planoMitigacao || '',
      planoContingencia: item.planoContingencia || '', responsavel: item.responsavel || '',
      prazo: item.prazo || '',
    });
    setOpen(true);
  }

  const criticos = items.filter(i => i.nivelRisco === 'critico').length;
  const altos = items.filter(i => i.nivelRisco === 'alto').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" /> Registro de Riscos
          </h2>
          {criticos > 0 && <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">{criticos} crítico{criticos > 1 ? 's' : ''}</Badge>}
          {altos > 0 && <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">{altos} alto{altos > 1 ? 's' : ''}</Badge>}
        </div>
        <Button size="sm" onClick={openNew} className="flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Novo Risco
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border border-dashed rounded-xl">
          Nenhum risco registrado. Clique em "Novo Risco" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const nivel = nivelConfig[item.nivelRisco] || nivelConfig.medio;
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} className="border rounded-xl bg-white dark:bg-gray-900 overflow-hidden">
                <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${nivel.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{item.titulo}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{categoriaLabels[item.categoria] || item.categoria}</span>
                    </div>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${probabilidadeConfig[item.probabilidade]?.color}`}>
                        P: {probabilidadeConfig[item.probabilidade]?.label}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${impactoConfig[item.impacto]?.color}`}>
                        I: {impactoConfig[item.impacto]?.label}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusConfig[item.status]?.color}`}>
                        {statusConfig[item.status]?.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(item); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); if (confirm('Remover risco?')) deleteMutation.mutate(item.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 border-t bg-muted/20 space-y-3 text-sm">
                    {item.descricao && <div><span className="font-medium text-muted-foreground text-xs">Descrição</span><p className="mt-0.5">{item.descricao}</p></div>}
                    {item.planoMitigacao && <div><span className="font-medium text-muted-foreground text-xs">Plano de Mitigação</span><p className="mt-0.5">{item.planoMitigacao}</p></div>}
                    {item.planoContingencia && <div><span className="font-medium text-muted-foreground text-xs">Plano de Contingência</span><p className="mt-0.5">{item.planoContingencia}</p></div>}
                    <div className="flex gap-6 flex-wrap">
                      {item.responsavel && <div><span className="font-medium text-muted-foreground text-xs">Responsável</span><p className="mt-0.5">{item.responsavel}</p></div>}
                      {item.prazo && <div><span className="font-medium text-muted-foreground text-xs">Prazo</span><p className="mt-0.5">{item.prazo.split('-').reverse().join('/')}</p></div>}
                    </div>
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
            <DialogTitle>{editing ? 'Editar Risco' : 'Novo Risco'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex.: Atraso na emissão da licença" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => set('descricao', e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => set('categoria', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoriaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
              <div>
                <Label>Probabilidade</Label>
                <Select value={form.probabilidade} onValueChange={v => set('probabilidade', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(probabilidadeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impacto</Label>
                <Select value={form.impacto} onValueChange={v => set('impacto', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(impactoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
              <span className={`w-3 h-3 rounded-full ${nivelConfig[form.nivelRisco]?.dot || 'bg-gray-400'}`} />
              <span className="text-muted-foreground">Nível calculado:</span>
              <span className="font-semibold">{nivelConfig[form.nivelRisco]?.label || form.nivelRisco}</span>
            </div>
            <div>
              <Label>Plano de Mitigação</Label>
              <Textarea value={form.planoMitigacao} onChange={e => set('planoMitigacao', e.target.value)} rows={2} placeholder="Ações para reduzir a probabilidade ou impacto do risco..." />
            </div>
            <div>
              <Label>Plano de Contingência</Label>
              <Textarea value={form.planoContingencia} onChange={e => set('planoContingencia', e.target.value)} rows={2} placeholder="Ações caso o risco se materialize..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={e => set('responsavel', e.target.value)} />
              </div>
              <div>
                <Label>Prazo de revisão</Label>
                <Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
