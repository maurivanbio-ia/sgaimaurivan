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
import { Plus, Pencil, Trash2, ShieldCheck, AlertTriangle, Calendar } from "lucide-react";
import type { Autorizacao } from "@shared/schema";

interface Props { empreendimentoId: number; }

const STATUS_COLORS: Record<string, string> = {
  vigente: "bg-green-100 text-green-800",
  vencida: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-800",
  em_renovacao: "bg-yellow-100 text-yellow-800",
};

const TIPOS = ["LP", "LI", "LO", "ASV", "LAC", "AO", "Outorga", "Portaria", "Declaração", "Outro"];

function isExpiringSoon(dataValidade?: string | null): boolean {
  if (!dataValidade) return false;
  const diff = new Date(dataValidade).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(dataValidade?: string | null): boolean {
  if (!dataValidade) return false;
  return new Date(dataValidade) < new Date();
}

export function AutorizacoesTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Autorizacao | null>(null);
  const [form, setForm] = useState({
    tipo: "LP", numero: "", titulo: "", orgaoEmissor: "", descricao: "",
    dataEmissao: "", dataValidade: "", status: "vigente", observacoes: "",
  });

  const { data: items = [], isLoading } = useQuery<Autorizacao[]>({
    queryKey: ["/api/autorizacoes", empreendimentoId],
    queryFn: () => fetch(`/api/autorizacoes?empreendimentoId=${empreendimentoId}`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? apiRequest("PUT", `/api/autorizacoes/${editing.id}`, data)
              : apiRequest("POST", "/api/autorizacoes", { ...data, empreendimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autorizacoes", empreendimentoId] });
      setOpen(false); setEditing(null);
      toast({ title: editing ? "Autorização atualizada" : "Autorização registrada" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/autorizacoes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autorizacoes", empreendimentoId] });
      toast({ title: "Autorização removida" });
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ tipo: "LP", numero: "", titulo: "", orgaoEmissor: "", descricao: "", dataEmissao: "", dataValidade: "", status: "vigente", observacoes: "" });
    setOpen(true);
  }

  function openEdit(item: Autorizacao) {
    setEditing(item);
    setForm({
      tipo: item.tipo, numero: item.numero, titulo: item.titulo,
      orgaoEmissor: item.orgaoEmissor || "", descricao: item.descricao || "",
      dataEmissao: item.dataEmissao || "", dataValidade: item.dataValidade || "",
      status: item.status || "vigente", observacoes: item.observacoes || "",
    });
    setOpen(true);
  }

  const vigentes = items.filter(i => i.status === "vigente").length;
  const vencidas = items.filter(i => i.status === "vencida" || isExpired(i.dataValidade)).length;
  const aVencer = items.filter(i => isExpiringSoon(i.dataValidade)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Autorizações Ambientais</h3>
          <p className="text-sm text-muted-foreground">Outorgas, portarias e autorizações complementares</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Autorização
        </Button>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 text-center bg-green-50">
            <p className="text-2xl font-bold text-green-700">{vigentes}</p>
            <p className="text-xs text-green-600">Vigentes</p>
          </div>
          <div className="border rounded-lg p-3 text-center bg-yellow-50">
            <p className="text-2xl font-bold text-yellow-700">{aVencer}</p>
            <p className="text-xs text-yellow-600">A Vencer (30d)</p>
          </div>
          <div className="border rounded-lg p-3 text-center bg-red-50">
            <p className="text-2xl font-bold text-red-700">{vencidas}</p>
            <p className="text-xs text-red-600">Vencidas</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>Nenhuma autorização registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className={`border rounded-lg p-4 flex items-start justify-between gap-4 bg-card ${isExpiringSoon(item.dataValidade) ? 'border-yellow-400' : ''} ${isExpired(item.dataValidade) && item.status === 'vigente' ? 'border-red-400' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{item.tipo}</Badge>
                  <span className="font-medium text-sm">{item.numero}</span>
                  <Badge className={STATUS_COLORS[item.status || "vigente"]}>{item.status}</Badge>
                  {isExpiringSoon(item.dataValidade) && (
                    <Badge className="bg-yellow-100 text-yellow-800 gap-1"><AlertTriangle className="h-3 w-3" />A vencer</Badge>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">{item.titulo}</p>
                {item.orgaoEmissor && <p className="text-xs text-muted-foreground">{item.orgaoEmissor}</p>}
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  {item.dataEmissao && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Emissão: {item.dataEmissao}</span>}
                  {item.dataValidade && <span className={`flex items-center gap-1 ${isExpired(item.dataValidade) ? 'text-red-600 font-medium' : ''}`}><Calendar className="h-3 w-3" />Validade: {item.dataValidade}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover autorização?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Autorização" : "Nova Autorização"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Número *</Label>
                <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="Ex: 001/2024" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Objeto da autorização" />
            </div>
            <div className="space-y-1">
              <Label>Órgão Emissor</Label>
              <Input value={form.orgaoEmissor} onChange={e => setForm(f => ({ ...f, orgaoEmissor: e.target.value }))} placeholder="Ex: INEMA, IBAMA, ANA" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="em_renovacao">Em Renovação</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Emissão</Label>
                <Input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input type="date" value={form.dataValidade} onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.tipo || !form.numero || !form.titulo || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
