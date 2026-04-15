import { useState, useRef } from "react";
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
import {
  Plus, Pencil, Trash2, ShieldCheck, AlertTriangle, Calendar,
  Upload, FileText, FileImage, Download, X, Paperclip, Loader2,
  Sparkles, CheckCircle2, Info
} from "lucide-react";
import type { Autorizacao } from "@shared/schema";

interface Props { empreendimentoId: number; }

type DocMeta = { nome: string; caminho: string; mimeType: string; tamanhoBytes: number; uploadedAt: string };

const STATUS_COLORS: Record<string, string> = {
  vigente: "bg-green-100 text-green-800",
  vencida: "bg-red-100 text-red-800",
  cancelada: "bg-gray-100 text-gray-800",
  em_renovacao: "bg-yellow-100 text-yellow-800",
  a_vencer: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  vigente: "Vigente",
  vencida: "Vencida",
  cancelada: "Cancelada",
  em_renovacao: "Em Renovação",
  a_vencer: "A Vencer (30d)",
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

function getEffectiveStatus(item: Autorizacao): string {
  if (item.status === "cancelada") return "cancelada";
  if (item.status === "em_renovacao") return "em_renovacao";
  if (!item.dataValidade) return item.status || "vigente";
  if (isExpired(item.dataValidade)) return "vencida";
  if (isExpiringSoon(item.dataValidade)) return "a_vencer";
  return "vigente";
}

function diasRestantes(dataValidade?: string | null): number | null {
  if (!dataValidade) return null;
  return Math.ceil((new Date(dataValidade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-red-500" />;
}

const EMPTY_FORM = {
  tipo: "Outro", numero: "", titulo: "", orgaoEmissor: "", descricao: "",
  dataEmissao: "", dataValidade: "", status: "vigente", observacoes: "",
};

export function AutorizacoesTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Autorizacao | null>(null);
  const [docsModal, setDocsModal] = useState<Autorizacao | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFields, setAiFields] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

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
      setOpen(false); setEditing(null); setAiFields([]);
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

  const deleteDocMutation = useMutation({
    mutationFn: async ({ autorizacaoId, idx }: { autorizacaoId: number; idx: number }) => {
      const res = await apiRequest("DELETE", `/api/autorizacoes/${autorizacaoId}/documentos/${idx}`);
      return res.json() as Promise<Autorizacao>;
    },
    onSuccess: (data: Autorizacao) => {
      queryClient.invalidateQueries({ queryKey: ["/api/autorizacoes", empreendimentoId] });
      setDocsModal(data);
      toast({ title: "Documento removido" });
    },
  });

  function openNew() {
    setEditing(null);
    setAiFields([]);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(item: Autorizacao) {
    setEditing(item);
    setAiFields([]);
    setForm({
      tipo: item.tipo, numero: item.numero, titulo: item.titulo,
      orgaoEmissor: item.orgaoEmissor || "", descricao: item.descricao || "",
      dataEmissao: item.dataEmissao || "", dataValidade: item.dataValidade || "",
      status: item.status || "vigente", observacoes: item.observacoes || "",
    });
    setOpen(true);
  }

  // ── Reconhecimento IA ────────────────────────────────────────────────────
  async function handleAiRecognize(file: File) {
    setAiLoading(true);
    setAiFields([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/autorizacoes/ai-reconhecer", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro no reconhecimento");
      }
      const data = await res.json();

      const filled: string[] = [];
      const update: Partial<typeof form> = {};

      if (data.tipo && TIPOS.includes(data.tipo)) { update.tipo = data.tipo; filled.push("tipo"); }
      if (data.numero) { update.numero = data.numero; filled.push("número"); }
      if (data.titulo) { update.titulo = data.titulo; filled.push("título"); }
      if (data.orgaoEmissor) { update.orgaoEmissor = data.orgaoEmissor; filled.push("órgão emissor"); }
      if (data.dataEmissao) { update.dataEmissao = data.dataEmissao; filled.push("data de emissão"); }
      if (data.dataValidade) { update.dataValidade = data.dataValidade; filled.push("validade"); }
      if (data.descricao) { update.descricao = data.descricao; filled.push("descrição"); }
      if (data.observacoes) { update.observacoes = data.observacoes; filled.push("observações"); }

      setForm(f => ({ ...f, ...update }));
      setAiFields(filled);

      if (filled.length > 0) {
        toast({ title: `IA preencheu ${filled.length} campo(s)`, description: filled.join(", ") });
      } else {
        toast({ title: "Documento processado", description: "Não foi possível extrair campos automaticamente. Preencha manualmente.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro no reconhecimento", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = "";
    }
  }

  async function handleUpload(autorizacaoId: number, file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/autorizacoes/${autorizacaoId}/documentos`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro no upload");
      }
      const updated: Autorizacao = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/autorizacoes", empreendimentoId] });
      setDocsModal(updated);
      toast({ title: "Documento enviado com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && docsModal) handleUpload(docsModal.id, file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && docsModal) handleUpload(docsModal.id, file);
  }

  const vigentes = items.filter(i => getEffectiveStatus(i) === "vigente").length;
  const vencidas = items.filter(i => getEffectiveStatus(i) === "vencida").length;
  const aVencer = items.filter(i => getEffectiveStatus(i) === "a_vencer").length;

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
          {items.map(item => {
            const docs: DocMeta[] = (item.documentos as any) || [];
            const efectivo = getEffectiveStatus(item);
            const dias = diasRestantes(item.dataValidade);
            const borderClass = efectivo === "vencida" ? "border-red-300 bg-red-50/30" : efectivo === "a_vencer" ? "border-orange-300 bg-orange-50/30" : "";
            return (
              <div key={item.id} className={`border rounded-lg p-4 flex items-start justify-between gap-4 bg-card ${borderClass}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{item.tipo}</Badge>
                    <span className="font-medium text-sm">{item.numero}</span>
                    <Badge className={STATUS_COLORS[efectivo]}>
                      {efectivo === "a_vencer" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {STATUS_LABELS[efectivo] || efectivo}
                    </Badge>
                    {dias !== null && dias < 0 && (
                      <span className="text-xs text-red-600 font-medium">Vencida há {Math.abs(dias)} dia{Math.abs(dias) !== 1 ? "s" : ""}</span>
                    )}
                    {dias !== null && dias >= 0 && dias <= 30 && (
                      <span className="text-xs text-orange-600 font-medium">Vence em {dias} dia{dias !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-1">{item.titulo}</p>
                  {item.orgaoEmissor && <p className="text-xs text-muted-foreground">{item.orgaoEmissor}</p>}
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {item.dataEmissao && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Emissão: {item.dataEmissao}</span>}
                    {item.dataValidade && (
                      <span className={`flex items-center gap-1 ${dias !== null && dias < 0 ? "text-red-600 font-medium" : dias !== null && dias <= 30 ? "text-orange-600 font-medium" : ""}`}>
                        <Calendar className="h-3 w-3" />Validade: {item.dataValidade}
                      </span>
                    )}
                  </div>
                  {docs.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3" />
                      <span>{docs.length} documento{docs.length > 1 ? "s" : ""}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" title="Documentos" onClick={() => setDocsModal(item)}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Remover autorização?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAiFields([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Autorização" : "Nova Autorização"}</DialogTitle>
          </DialogHeader>

          {/* ── Banner IA ─────────────────────────────────────────────────── */}
          <div className="border border-dashed border-[#00599C]/40 rounded-xl bg-[#00599C]/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#00599C]" />
              <span className="text-sm font-semibold text-[#00599C]">Reconhecimento por IA</span>
              <span className="text-xs text-muted-foreground ml-auto">PDF, imagem ou TXT</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie o documento da autorização e a IA extrai automaticamente os campos abaixo.
            </p>
            <div
              className="border-2 border-dashed border-[#00599C]/30 rounded-lg p-3 text-center cursor-pointer hover:border-[#00599C]/60 hover:bg-[#00599C]/5 transition-colors"
              onClick={() => !aiLoading && aiFileInputRef.current?.click()}
            >
              {aiLoading ? (
                <div className="flex flex-col items-center gap-1 text-[#00599C]">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <p className="text-xs font-medium">Analisando documento com IA...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Sparkles className="h-6 w-6 text-[#00599C]/60" />
                  <p className="text-xs font-medium">Clique para selecionar o documento</p>
                </div>
              )}
              <input
                ref={aiFileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAiRecognize(file);
                }}
              />
            </div>

            {/* Campos preenchidos pela IA */}
            {aiFields.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {aiFields.map(f => (
                  <span key={f} className="inline-flex items-center gap-0.5 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> {f}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger className={aiFields.includes("tipo") ? "border-green-400 bg-green-50/50" : ""}><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Número *</Label>
                <Input
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  placeholder="Ex: 001/2024"
                  className={aiFields.includes("número") ? "border-green-400 bg-green-50/50" : ""}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Objeto da autorização"
                className={aiFields.includes("título") ? "border-green-400 bg-green-50/50" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label>Órgão Emissor</Label>
              <Input
                value={form.orgaoEmissor}
                onChange={e => setForm(f => ({ ...f, orgaoEmissor: e.target.value }))}
                placeholder="Ex: INEMA, IBAMA, ANA"
                className={aiFields.includes("órgão emissor") ? "border-green-400 bg-green-50/50" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                rows={2}
                className={aiFields.includes("descrição") ? "border-green-400 bg-green-50/50" : ""}
              />
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
                <Input
                  type="date"
                  value={form.dataEmissao}
                  onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))}
                  className={aiFields.includes("data de emissão") ? "border-green-400 bg-green-50/50" : ""}
                />
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={form.dataValidade}
                  onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))}
                  className={aiFields.includes("validade") ? "border-green-400 bg-green-50/50" : ""}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                className={aiFields.includes("observações") ? "border-green-400 bg-green-50/50" : ""}
              />
            </div>

            {aiFields.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <Info className="h-3 w-3 flex-shrink-0" />
                Campos com borda verde foram preenchidos pela IA. Revise antes de salvar.
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => { setOpen(false); setAiFields([]); }}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.tipo || !form.numero || !form.titulo || saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Documentos */}
      <Dialog open={!!docsModal} onOpenChange={(open) => !open && setDocsModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Documentos — {docsModal?.numero}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Enviando arquivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="text-sm font-medium">Clique ou arraste arquivos aqui</p>
                  <p className="text-xs">PDF, DOC, DOCX, XLS, JPG, PNG — até 30 MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif,.txt,.zip,.rar"
                onChange={handleFileChange}
              />
            </div>

            {docsModal && ((docsModal.documentos as any) || []).length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Documentos anexados</p>
                {((docsModal.documentos as any) as DocMeta[]).map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                    <FileIcon mimeType={doc.mimeType} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(doc.tamanhoBytes)} · {new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" title="Baixar" asChild>
                        <a href={`/api/autorizacoes/${docsModal.id}/documentos/${idx}/download`} download={doc.nome} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="text-destructive" title="Remover"
                        disabled={deleteDocMutation.isPending}
                        onClick={() => {
                          if (confirm(`Remover "${doc.nome}"?`)) {
                            deleteDocMutation.mutate({ autorizacaoId: docsModal.id, idx });
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-2">Nenhum documento anexado ainda.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
