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
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, Calendar } from "lucide-react";
import type { AditivoContrato } from "@shared/schema";

interface Props { empreendimentoId: number; }

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  encerrado: "bg-gray-100 text-gray-800",
  cancelado: "bg-red-100 text-red-800",
};

const TIPO_LABELS: Record<string, string> = {
  aditivo: "Aditivo",
  apostila: "Apostila",
  rerratificacao: "Rerratificação",
};

export function AditivosTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AditivoContrato | null>(null);
  const [form, setForm] = useState({
    numero: "", titulo: "", descricao: "", tipo: "aditivo",
    valor: "", dataAssinatura: "", dataVigenciaInicio: "", dataVigenciaFim: "",
    status: "ativo", arquivo: "",
  });

  const { data: items = [], isLoading } = useQuery<AditivoContrato[]>({
    queryKey: ["/api/aditivos-contratos", empreendimentoId],
    queryFn: () => fetch(`/api/aditivos-contratos?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) return apiRequest("PUT", `/api/aditivos-contratos/${editing.id}`, data);
      return apiRequest("POST", "/api/aditivos-contratos", { ...data, empreendimentoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aditivos-contratos", empreendimentoId] });
      setOpen(false);
      setEditing(null);
      toast({ title: editing ? "Aditivo atualizado" : "Aditivo registrado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/aditivos-contratos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/aditivos-contratos", empreendimentoId] });
      toast({ title: "Aditivo removido" });
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ numero: "", titulo: "", descricao: "", tipo: "aditivo", valor: "", dataAssinatura: "", dataVigenciaInicio: "", dataVigenciaFim: "", status: "ativo", arquivo: "" });
    setOpen(true);
  }

  function openEdit(item: AditivoContrato) {
    setEditing(item);
    setForm({
      numero: item.numero, titulo: item.titulo, descricao: item.descricao || "",
      tipo: item.tipo || "aditivo", valor: item.valor || "", dataAssinatura: item.dataAssinatura || "",
      dataVigenciaInicio: item.dataVigenciaInicio || "", dataVigenciaFim: item.dataVigenciaFim || "",
      status: item.status || "ativo", arquivo: item.arquivo || "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Aditivos e Apostilas</h3>
          <p className="text-sm text-muted-foreground">Modificações e complementos contratuais</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Novo Aditivo
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum aditivo registrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 flex items-start justify-between gap-4 bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{item.numero}</span>
                  <Badge variant="outline">{TIPO_LABELS[item.tipo || "aditivo"] || item.tipo}</Badge>
                  <Badge className={STATUS_COLORS[item.status || "ativo"]}>{item.status}</Badge>
                </div>
                <p className="text-sm font-medium mt-1">{item.titulo}</p>
                {item.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  {item.dataAssinatura && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Assinado: {item.dataAssinatura}</span>}
                  {item.valor && <span>Valor: R$ {item.valor}</span>}
                  {item.dataVigenciaFim && <span>Vigência até: {item.dataVigenciaFim}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover aditivo?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Aditivo" : "Novo Aditivo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número *</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ex: 001/2024" />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aditivo">Aditivo</SelectItem>
                    <SelectItem value="apostila">Apostila</SelectItem>
                    <SelectItem value="rerratificacao">Rerratificação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Objeto do aditivo" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Data Assinatura</Label>
                <Input type="date" value={form.dataAssinatura} onChange={e => setForm(f => ({ ...f, dataAssinatura: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Vigência Início</Label>
                <Input type="date" value={form.dataVigenciaInicio} onChange={e => setForm(f => ({ ...f, dataVigenciaInicio: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Vigência Fim</Label>
                <Input type="date" value={form.dataVigenciaFim} onChange={e => setForm(f => ({ ...f, dataVigenciaFim: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.numero || !form.titulo || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
