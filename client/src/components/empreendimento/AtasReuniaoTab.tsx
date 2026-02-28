import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, MapPin, Calendar, FileText } from "lucide-react";
import type { AtaReuniao } from "@shared/schema";

interface Props { empreendimentoId: number; }

export function AtasReuniaoTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AtaReuniao | null>(null);
  const [viewItem, setViewItem] = useState<AtaReuniao | null>(null);
  const [form, setForm] = useState({
    titulo: "", local: "", data: "", horario: "", participantes: "",
    pauta: "", deliberacoes: "", acoesDecididas: "", proximaReuniao: "",
  });

  const { data: items = [], isLoading } = useQuery<AtaReuniao[]>({
    queryKey: ["/api/atas-reuniao", empreendimentoId],
    queryFn: () => fetch(`/api/atas-reuniao?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? apiRequest("PUT", `/api/atas-reuniao/${editing.id}`, data)
              : apiRequest("POST", "/api/atas-reuniao", { ...data, empreendimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/atas-reuniao", empreendimentoId] });
      setOpen(false); setEditing(null);
      toast({ title: editing ? "Ata atualizada" : "Ata registrada" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/atas-reuniao/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/atas-reuniao", empreendimentoId] });
      toast({ title: "Ata removida" });
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ titulo: "", local: "", data: "", horario: "", participantes: "", pauta: "", deliberacoes: "", acoesDecididas: "", proximaReuniao: "" });
    setOpen(true);
  }

  function openEdit(item: AtaReuniao) {
    setEditing(item);
    setForm({
      titulo: item.titulo, local: item.local || "", data: item.data, horario: item.horario || "",
      participantes: item.participantes || "", pauta: item.pauta || "",
      deliberacoes: item.deliberacoes || "", acoesDecididas: item.acoesDecididas || "",
      proximaReuniao: item.proximaReuniao || "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Atas de Reunião</h3>
          <p className="text-sm text-muted-foreground">Registros de deliberações e ações decididas</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Ata
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhuma ata registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewItem(item)}>
                  <p className="font-medium">{item.titulo}</p>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    {item.data && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.data}{item.horario ? ` às ${item.horario}` : ""}</span>}
                    {item.local && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.local}</span>}
                    {item.participantes && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{item.participantes.split(",").length} participante(s)</span>}
                  </div>
                  {item.deliberacoes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 border-l-2 border-primary/30 pl-2">{item.deliberacoes}</p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setViewItem(item)}><FileText className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover ata?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewItem?.titulo}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground border-b pb-3">
                <div><span className="font-medium">Data:</span> {viewItem.data}{viewItem.horario ? ` às ${viewItem.horario}` : ""}</div>
                {viewItem.local && <div><span className="font-medium">Local:</span> {viewItem.local}</div>}
              </div>
              {viewItem.participantes && <div><p className="font-semibold mb-1">Participantes</p><p className="text-muted-foreground whitespace-pre-wrap">{viewItem.participantes}</p></div>}
              {viewItem.pauta && <div><p className="font-semibold mb-1">Pauta</p><p className="text-muted-foreground whitespace-pre-wrap">{viewItem.pauta}</p></div>}
              {viewItem.deliberacoes && <div><p className="font-semibold mb-1">Deliberações</p><p className="text-muted-foreground whitespace-pre-wrap">{viewItem.deliberacoes}</p></div>}
              {viewItem.acoesDecididas && <div><p className="font-semibold mb-1">Ações Decididas</p><p className="text-muted-foreground whitespace-pre-wrap">{viewItem.acoesDecididas}</p></div>}
              {viewItem.proximaReuniao && <div><p className="font-semibold mb-1">Próxima Reunião</p><p className="text-muted-foreground">{viewItem.proximaReuniao}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Ata" : "Nova Ata de Reunião"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Reunião de acompanhamento - março/2024" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1">
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Horário</Label>
                <Input type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Local</Label>
                <Input value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} placeholder="Local ou link da reunião" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Participantes</Label>
              <Input value={form.participantes} onChange={e => setForm(f => ({ ...f, participantes: e.target.value }))} placeholder="Nome1, Nome2, Nome3..." />
            </div>
            <div className="space-y-1">
              <Label>Pauta</Label>
              <Textarea value={form.pauta} onChange={e => setForm(f => ({ ...f, pauta: e.target.value }))} rows={3} placeholder="Tópicos discutidos..." />
            </div>
            <div className="space-y-1">
              <Label>Deliberações</Label>
              <Textarea value={form.deliberacoes} onChange={e => setForm(f => ({ ...f, deliberacoes: e.target.value }))} rows={3} placeholder="Decisões tomadas na reunião..." />
            </div>
            <div className="space-y-1">
              <Label>Ações Decididas</Label>
              <Textarea value={form.acoesDecididas} onChange={e => setForm(f => ({ ...f, acoesDecididas: e.target.value }))} rows={2} placeholder="Responsáveis e prazos..." />
            </div>
            <div className="space-y-1">
              <Label>Próxima Reunião</Label>
              <Input value={form.proximaReuniao} onChange={e => setForm(f => ({ ...f, proximaReuniao: e.target.value }))} placeholder="Data prevista para próxima reunião" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.titulo || !form.data || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
