import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, ClipboardList, BookOpen } from "lucide-react";
import type { Minuta, ParecerTecnico, PlanoTrab } from "@shared/schema";

interface Props { empreendimentoId: number; }

const STATUS_BADGE: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  revisao: "bg-yellow-100 text-yellow-800",
  aprovada: "bg-green-100 text-green-800",
  enviada: "bg-blue-100 text-blue-800",
  em_elaboracao: "bg-yellow-100 text-yellow-800",
  concluido: "bg-green-100 text-green-800",
  aprovado: "bg-blue-100 text-blue-800",
  elaboracao: "bg-gray-100 text-gray-700",
  em_execucao: "bg-blue-100 text-blue-800",
  suspenso: "bg-red-100 text-red-800",
};

// ─── MINUTAS ──────────────────────────────────────────────────────────────────
function MinutasSection({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Minuta | null>(null);
  const [form, setForm] = useState({ titulo: "", tipo: "relatorio", descricao: "", versao: "1.0", conteudo: "", status: "rascunho", responsavel: "" });

  const { data: items = [] } = useQuery<Minuta[]>({
    queryKey: ["/api/minutas", empreendimentoId],
    queryFn: () => fetch(`/api/minutas?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? apiRequest("PUT", `/api/minutas/${editing.id}`, data) : apiRequest("POST", "/api/minutas", { ...data, empreendimentoId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/minutas", empreendimentoId] }); setOpen(false); setEditing(null); toast({ title: "Minuta salva" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/minutas/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/minutas", empreendimentoId] }); toast({ title: "Minuta removida" }); },
  });

  function openNew() { setEditing(null); setForm({ titulo: "", tipo: "relatorio", descricao: "", versao: "1.0", conteudo: "", status: "rascunho", responsavel: "" }); setOpen(true); }
  function openEdit(item: Minuta) { setEditing(item); setForm({ titulo: item.titulo, tipo: item.tipo || "relatorio", descricao: item.descricao || "", versao: item.versao || "1.0", conteudo: item.conteudo || "", status: item.status || "rascunho", responsavel: item.responsavel || "" }); setOpen(true); }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} minuta(s) registrada(s)</p>
        <Button onClick={openNew} size="sm" variant="outline" className="gap-1"><Plus className="h-3 w-3" />Nova Minuta</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhuma minuta registrada</p></div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-medium text-sm">{item.titulo}</span><Badge variant="outline" className="text-xs">{item.tipo}</Badge><Badge className={`text-xs ${STATUS_BADGE[item.status || "rascunho"]}`}>{item.status}</Badge></div>
                {item.responsavel && <p className="text-xs text-muted-foreground mt-0.5">Resp.: {item.responsavel} · v{item.versao}</p>}
                {item.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Minuta" : "Nova Minuta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["relatorio", "oficio", "parecer", "contrato", "outro"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["rascunho","Rascunho"],["revisao","Em Revisão"],["aprovada","Aprovada"],["enviada","Enviada"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Versão</Label><Input value={form.versao} onChange={e => setForm(f => ({ ...f, versao: e.target.value }))} placeholder="1.0" /></div>
              <div className="space-y-1"><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} /></div>
            <div className="space-y-1"><Label>Conteúdo / Observações</Label><Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} rows={4} /></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PARECERES TÉCNICOS ───────────────────────────────────────────────────────
function PareceresSection({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ParecerTecnico | null>(null);
  const [form, setForm] = useState({ titulo: "", numero: "", tipo: "tecnico", autor: "", orgaoDestino: "", conclusao: "", recomendacoes: "", status: "em_elaboracao" });

  const { data: items = [] } = useQuery<ParecerTecnico[]>({
    queryKey: ["/api/pareceres-tecnicos", empreendimentoId],
    queryFn: () => fetch(`/api/pareceres-tecnicos?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? apiRequest("PUT", `/api/pareceres-tecnicos/${editing.id}`, data) : apiRequest("POST", "/api/pareceres-tecnicos", { ...data, empreendimentoId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pareceres-tecnicos", empreendimentoId] }); setOpen(false); setEditing(null); toast({ title: "Parecer salvo" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pareceres-tecnicos/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/pareceres-tecnicos", empreendimentoId] }); toast({ title: "Parecer removido" }); },
  });

  function openNew() { setEditing(null); setForm({ titulo: "", numero: "", tipo: "tecnico", autor: "", orgaoDestino: "", conclusao: "", recomendacoes: "", status: "em_elaboracao" }); setOpen(true); }
  function openEdit(item: ParecerTecnico) { setEditing(item); setForm({ titulo: item.titulo, numero: item.numero || "", tipo: item.tipo || "tecnico", autor: item.autor || "", orgaoDestino: item.orgaoDestino || "", conclusao: item.conclusao || "", recomendacoes: item.recomendacoes || "", status: item.status || "em_elaboracao" }); setOpen(true); }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} parecer(es) registrado(s)</p>
        <Button onClick={openNew} size="sm" variant="outline" className="gap-1"><Plus className="h-3 w-3" />Novo Parecer</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground"><ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum parecer registrado</p></div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{item.titulo}</span><Badge variant="outline" className="text-xs">{item.tipo}</Badge><Badge className={`text-xs ${STATUS_BADGE[item.status || "em_elaboracao"]}`}>{item.status?.replace("_", " ")}</Badge></div>
                {item.autor && <p className="text-xs text-muted-foreground mt-0.5">Autor: {item.autor}{item.orgaoDestino ? ` · Destino: ${item.orgaoDestino}` : ""}</p>}
                {item.conclusao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 border-l-2 border-primary/30 pl-2">{item.conclusao}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Parecer" : "Novo Parecer Técnico"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Número</Label><Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["tecnico","juridico","financeiro","ambiental"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Autor</Label><Input value={form.autor} onChange={e => setForm(f => ({ ...f, autor: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Órgão Destino</Label><Input value={form.orgaoDestino} onChange={e => setForm(f => ({ ...f, orgaoDestino: e.target.value }))} /></div>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[["em_elaboracao","Em Elaboração"],["concluido","Concluído"],["aprovado","Aprovado"],["enviado","Enviado"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Conclusão</Label><Textarea value={form.conclusao} onChange={e => setForm(f => ({ ...f, conclusao: e.target.value }))} rows={3} /></div>
            <div className="space-y-1"><Label>Recomendações</Label><Textarea value={form.recomendacoes} onChange={e => setForm(f => ({ ...f, recomendacoes: e.target.value }))} rows={2} /></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PLANOS DE TRABALHO ───────────────────────────────────────────────────────
function PlanosSection({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanoTrab | null>(null);
  const [form, setForm] = useState({ titulo: "", objetivo: "", metodologia: "", dataInicio: "", dataFim: "", status: "elaboracao", responsavel: "", observacoes: "" });

  const { data: items = [] } = useQuery<PlanoTrab[]>({
    queryKey: ["/api/planos-trabalho", empreendimentoId],
    queryFn: () => fetch(`/api/planos-trabalho?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editing ? apiRequest("PUT", `/api/planos-trabalho/${editing.id}`, data) : apiRequest("POST", "/api/planos-trabalho", { ...data, empreendimentoId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/planos-trabalho", empreendimentoId] }); setOpen(false); setEditing(null); toast({ title: "Plano salvo" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/planos-trabalho/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/planos-trabalho", empreendimentoId] }); toast({ title: "Plano removido" }); },
  });

  function openNew() { setEditing(null); setForm({ titulo: "", objetivo: "", metodologia: "", dataInicio: "", dataFim: "", status: "elaboracao", responsavel: "", observacoes: "" }); setOpen(true); }
  function openEdit(item: PlanoTrab) { setEditing(item); setForm({ titulo: item.titulo, objetivo: item.objetivo || "", metodologia: item.metodologia || "", dataInicio: item.dataInicio || "", dataFim: item.dataFim || "", status: item.status || "elaboracao", responsavel: item.responsavel || "", observacoes: item.observacoes || "" }); setOpen(true); }

  const STATUS_LABELS: Record<string, string> = { elaboracao: "Em Elaboração", aprovado: "Aprovado", em_execucao: "Em Execução", concluido: "Concluído", suspenso: "Suspenso" };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} plano(s) registrado(s)</p>
        <Button onClick={openNew} size="sm" variant="outline" className="gap-1"><Plus className="h-3 w-3" />Novo Plano</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground"><BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Nenhum plano de trabalho registrado</p></div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{item.titulo}</span><Badge className={`text-xs ${STATUS_BADGE[item.status || "elaboracao"]}`}>{STATUS_LABELS[item.status || "elaboracao"]}</Badge></div>
                {item.responsavel && <p className="text-xs text-muted-foreground mt-0.5">Resp.: {item.responsavel}</p>}
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {item.dataInicio && <span>Início: {item.dataInicio}</span>}
                  {item.dataFim && <span>Fim: {item.dataFim}</span>}
                </div>
                {item.objetivo && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.objetivo}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Plano" : "Novo Plano de Trabalho"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Data Início</Label><Input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Data Fim</Label><Input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Objetivo</Label><Textarea value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} rows={3} /></div>
            <div className="space-y-1"><Label>Metodologia</Label><Textarea value={form.metodologia} onChange={e => setForm(f => ({ ...f, metodologia: e.target.value }))} rows={2} /></div>
            <div className="space-y-1"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function DocumentosTecnicosTab({ empreendimentoId }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Documentos Técnicos</h3>
        <p className="text-sm text-muted-foreground">Minutas, pareceres técnicos e planos de trabalho do projeto</p>
      </div>
      <Tabs defaultValue="minutas">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="minutas" className="text-xs">📄 Minutas</TabsTrigger>
          <TabsTrigger value="pareceres" className="text-xs">📋 Pareceres</TabsTrigger>
          <TabsTrigger value="planos" className="text-xs">📘 Planos</TabsTrigger>
        </TabsList>
        <TabsContent value="minutas" className="mt-4"><MinutasSection empreendimentoId={empreendimentoId} /></TabsContent>
        <TabsContent value="pareceres" className="mt-4"><PareceresSection empreendimentoId={empreendimentoId} /></TabsContent>
        <TabsContent value="planos" className="mt-4"><PlanosSection empreendimentoId={empreendimentoId} /></TabsContent>
      </Tabs>
    </div>
  );
}
