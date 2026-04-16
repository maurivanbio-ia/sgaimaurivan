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
import {
  ShieldCheck, AlertTriangle, Calendar, FileText, Download, Pencil, Trash2,
  Eye, ExternalLink, Loader2, Info, FileSearch
} from "lucide-react";

interface Props { empreendimentoId: number; }

interface DatasetDoc {
  id: number;
  nome: string;
  titulo?: string | null;
  descricao?: string | null;
  tipo: string;
  tamanho: number;
  url: string;
  objectPath?: string | null;
  tipoDocumental?: string | null;
  numeroDocumento?: string | null;
  orgaoEmissor?: string | null;
  prazoAtendimento?: string | null;
  dataValidade?: string | null;
  statusDocumental?: string | null;
  dataEmissao?: string | null;
  resumoIA?: string | null;
  exigencias?: string | null;
  criadoEm: string;
  dataUpload: string;
}

const TIPO_INFO: Record<string, { label: string; icon: string; color: string }> = {
  licenca:        { label: "Licença Ambiental", icon: "📋", color: "bg-green-100 text-green-800 border-green-200" },
  notificacao:    { label: "Notificação",        icon: "📢", color: "bg-red-100 text-red-800 border-red-200" },
  documento_legal:{ label: "Documento Legal",    icon: "⚖️", color: "bg-purple-100 text-purple-800 border-purple-200" },
  auto_infracao:  { label: "Auto de Infração",   icon: "🚨", color: "bg-orange-100 text-orange-800 border-orange-200" },
};

const STATUS_DOC: Record<string, { label: string; color: string }> = {
  recebido:       { label: "Recebido",       color: "bg-blue-100 text-blue-800" },
  em_analise:     { label: "Em Análise",     color: "bg-yellow-100 text-yellow-800" },
  em_atendimento: { label: "Em Atendimento", color: "bg-orange-100 text-orange-800" },
  respondido:     { label: "Respondido",     color: "bg-teal-100 text-teal-800" },
  concluido:      { label: "Concluído",      color: "bg-green-100 text-green-800" },
  vencido:        { label: "Vencido",        color: "bg-red-100 text-red-800" },
};

function isExpiringSoon(date?: string | null) {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(date?: string | null) {
  if (!date) return false;
  return new Date(date) < new Date();
}

function diasRestantes(date?: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(d?: string | null) {
  if (!d) return null;
  try {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  } catch { return d; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AutorizacoesTab({ empreendimentoId }: Props) {
  const { toast } = useToast();
  const [editingDoc, setEditingDoc] = useState<DatasetDoc | null>(null);
  const [detailDoc, setDetailDoc] = useState<DatasetDoc | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data: docs = [], isLoading } = useQuery<DatasetDoc[]>({
    queryKey: ["/api/datasets/autorizacoes-emp", empreendimentoId],
    queryFn: () =>
      fetch(`/api/datasets/autorizacoes-emp?empreendimentoId=${empreendimentoId}`, {
        credentials: "include",
      }).then(r => r.json()),
  });

  const editMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/datasets/${editingDoc!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets/autorizacoes-emp", empreendimentoId] });
      setEditingDoc(null);
      toast({ title: "Documento atualizado com sucesso" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/datasets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets/autorizacoes-emp", empreendimentoId] });
      toast({ title: "Documento removido" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  function openEdit(doc: DatasetDoc) {
    setEditingDoc(doc);
    setEditForm({
      titulo: doc.titulo || "",
      numeroDocumento: doc.numeroDocumento || "",
      orgaoEmissor: doc.orgaoEmissor || "",
      tipoDocumental: doc.tipoDocumental || "",
      dataEmissao: doc.dataEmissao || "",
      dataValidade: doc.dataValidade || "",
      prazoAtendimento: doc.prazoAtendimento || "",
      statusDocumental: doc.statusDocumental || "recebido",
      descricao: doc.descricao || "",
      exigencias: doc.exigencias || "",
    });
  }

  function handleDownload(doc: DatasetDoc) {
    const link = document.createElement("a");
    link.href = doc.url;
    link.download = doc.nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Data efetiva de vencimento: preferir dataValidade, fallback para prazoAtendimento
  function dataVencimento(doc: DatasetDoc): string | null | undefined {
    return doc.dataValidade || doc.prazoAtendimento;
  }

  // KPIs — usar statusDocumental='vencido' como override manual
  const vencidos = docs.filter(d => d.statusDocumental === 'vencido' || isExpired(dataVencimento(d))).length;
  const aVencer = docs.filter(d => d.statusDocumental !== 'vencido' && !isExpired(dataVencimento(d)) && isExpiringSoon(dataVencimento(d))).length;
  const vigentes = docs.length - vencidos - aVencer;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Autorizações Ambientais</h3>
          <p className="text-sm text-muted-foreground">
            Documentos de Licença, Notificação e Documentos Legais cadastrados em Gestão de Dados
          </p>
        </div>
      </div>

      {/* Aviso orientativo */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Os documentos aparecem aqui automaticamente a partir do módulo{" "}
          <strong>Gestão de Dados</strong> quando cadastrados com tipo{" "}
          <em>Licença Ambiental</em>, <em>Notificação</em>, <em>Documento Legal</em> ou <em>Auto de Infração</em>.
        </span>
      </div>

      {docs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 text-center bg-green-50">
            <p className="text-2xl font-bold text-green-700">{vigentes}</p>
            <p className="text-xs text-green-600">No prazo / Sem prazo</p>
          </div>
          <div className="border rounded-lg p-3 text-center bg-yellow-50">
            <p className="text-2xl font-bold text-yellow-700">{aVencer}</p>
            <p className="text-xs text-yellow-600">A Vencer (30d)</p>
          </div>
          <div className="border rounded-lg p-3 text-center bg-red-50">
            <p className="text-2xl font-bold text-red-700">{vencidos}</p>
            <p className="text-xs text-red-600">Vencidos</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando documentos...</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum documento encontrado</p>
          <p className="text-sm mt-1">
            Cadastre documentos em <strong>Gestão de Dados</strong> com o tipo adequado e eles aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => {
            const tipoInfo = TIPO_INFO[doc.tipoDocumental || ""] || { label: doc.tipoDocumental || "Documento", icon: "📄", color: "bg-gray-100 text-gray-800 border-gray-200" };
            const statusInfo = STATUS_DOC[doc.statusDocumental || ""] || null;
            const dvenc = dataVencimento(doc);
            const dias = diasRestantes(dvenc);
            const expired = doc.statusDocumental === 'vencido' || isExpired(dvenc);
            const expiringSoon = !expired && isExpiringSoon(dvenc);

            const borderClass = expired
              ? "border-red-300 bg-red-50/30"
              : expiringSoon
              ? "border-orange-300 bg-orange-50/20"
              : "";

            return (
              <div
                key={doc.id}
                className={`border rounded-lg p-4 flex items-start gap-4 bg-card ${borderClass}`}
              >
                {/* Ícone do tipo */}
                <div className="text-2xl mt-0.5 flex-shrink-0">{tipoInfo.icon}</div>

                {/* Conteúdo principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-xs ${tipoInfo.color}`}
                    >
                      {tipoInfo.label}
                    </Badge>
                    {doc.numeroDocumento && (
                      <span className="text-sm font-semibold">Nº {doc.numeroDocumento}</span>
                    )}
                    {statusInfo && (
                      <Badge className={`text-xs ${statusInfo.color}`}>
                        {statusInfo.label}
                      </Badge>
                    )}
                    {expired && dias !== null && (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> Vencido há {Math.abs(dias)} dia{Math.abs(dias) !== 1 ? "s" : ""}
                      </span>
                    )}
                    {expiringSoon && dias !== null && (
                      <span className="text-xs text-orange-600 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" /> Vence em {dias} dia{dias !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <p className="text-sm font-medium mt-1 truncate">
                    {doc.titulo || doc.nome}
                  </p>

                  {/* Órgão emissor */}
                  {doc.orgaoEmissor && (
                    <p className="text-xs text-muted-foreground">{doc.orgaoEmissor}</p>
                  )}

                  {/* Datas */}
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    {doc.dataEmissao && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Emissão: {formatDate(doc.dataEmissao)}
                      </span>
                    )}
                    {doc.dataValidade && (
                      <span className={`flex items-center gap-1 ${expired ? "text-red-600 font-medium" : expiringSoon ? "text-orange-600 font-medium" : ""}`}>
                        <Calendar className="h-3 w-3" /> Validade: {formatDate(doc.dataValidade)}
                      </span>
                    )}
                    {doc.prazoAtendimento && (
                      <span className={`flex items-center gap-1 ${!doc.dataValidade && expired ? "text-red-600 font-medium" : !doc.dataValidade && expiringSoon ? "text-orange-600 font-medium" : ""}`}>
                        <Calendar className="h-3 w-3" /> Prazo: {formatDate(doc.prazoAtendimento)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {formatBytes(doc.tamanho)}
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Visualizar detalhes"
                    onClick={() => setDetailDoc(doc)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Baixar documento"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Editar metadados"
                    onClick={() => openEdit(doc)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title="Excluir documento"
                    onClick={() => {
                      if (confirm(`Excluir "${doc.titulo || doc.nome}"? Esta ação não pode ser desfeita.`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={!!detailDoc} onOpenChange={v => !v && setDetailDoc(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{TIPO_INFO[detailDoc.tipoDocumental || ""]?.icon || "📄"}</span>
                  {detailDoc.titulo || detailDoc.nome}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailDoc.tipoDocumental && (
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium">{TIPO_INFO[detailDoc.tipoDocumental]?.label || detailDoc.tipoDocumental}</p>
                    </div>
                  )}
                  {detailDoc.numeroDocumento && (
                    <div>
                      <p className="text-xs text-muted-foreground">Número</p>
                      <p className="font-medium">{detailDoc.numeroDocumento}</p>
                    </div>
                  )}
                  {detailDoc.orgaoEmissor && (
                    <div>
                      <p className="text-xs text-muted-foreground">Órgão Emissor</p>
                      <p className="font-medium">{detailDoc.orgaoEmissor}</p>
                    </div>
                  )}
                  {detailDoc.statusDocumental && (
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge className={`text-xs ${STATUS_DOC[detailDoc.statusDocumental]?.color || ""}`}>
                        {STATUS_DOC[detailDoc.statusDocumental]?.label || detailDoc.statusDocumental}
                      </Badge>
                    </div>
                  )}
                  {detailDoc.dataEmissao && (
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Emissão</p>
                      <p className="font-medium">{formatDate(detailDoc.dataEmissao)}</p>
                    </div>
                  )}
                  {detailDoc.dataValidade && (
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Validade</p>
                      <p className={`font-medium ${isExpired(detailDoc.dataValidade) ? "text-red-600" : isExpiringSoon(detailDoc.dataValidade) ? "text-orange-600" : ""}`}>
                        {formatDate(detailDoc.dataValidade)}
                      </p>
                    </div>
                  )}
                  {detailDoc.prazoAtendimento && (
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo de Atendimento</p>
                      <p className={`font-medium ${!detailDoc.dataValidade && isExpired(detailDoc.prazoAtendimento) ? "text-red-600" : !detailDoc.dataValidade && isExpiringSoon(detailDoc.prazoAtendimento) ? "text-orange-600" : ""}`}>
                        {formatDate(detailDoc.prazoAtendimento)}
                      </p>
                    </div>
                  )}
                </div>

                {detailDoc.descricao && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm">{detailDoc.descricao}</p>
                  </div>
                )}

                {detailDoc.resumoIA && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                      <FileSearch className="h-3 w-3" /> Resumo IA
                    </p>
                    <p className="text-xs text-blue-800 whitespace-pre-wrap">{detailDoc.resumoIA.substring(0, 500)}{detailDoc.resumoIA.length > 500 ? "..." : ""}</p>
                  </div>
                )}

                {detailDoc.exigencias && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <p className="text-xs font-medium text-orange-700 mb-1">Exigências extraídas</p>
                    <p className="text-xs text-orange-800 whitespace-pre-wrap">{detailDoc.exigencias.substring(0, 400)}{detailDoc.exigencias.length > 400 ? "..." : ""}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => handleDownload(detailDoc)}
                  >
                    <Download className="h-4 w-4" /> Baixar Documento
                  </Button>
                  {detailDoc.url && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => window.open(detailDoc.url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={!!editingDoc} onOpenChange={v => !v && setEditingDoc(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Metadados do Documento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input
                value={editForm.titulo}
                onChange={e => setEditForm((f: any) => ({ ...f, titulo: e.target.value }))}
                placeholder="Título do documento"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo Documental</Label>
                <Select
                  value={editForm.tipoDocumental}
                  onValueChange={v => setEditForm((f: any) => ({ ...f, tipoDocumental: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="licenca">📋 Licença Ambiental</SelectItem>
                    <SelectItem value="notificacao">📢 Notificação</SelectItem>
                    <SelectItem value="documento_legal">⚖️ Documento Legal</SelectItem>
                    <SelectItem value="auto_infracao">🚨 Auto de Infração</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Número do Documento</Label>
                <Input
                  value={editForm.numeroDocumento}
                  onChange={e => setEditForm((f: any) => ({ ...f, numeroDocumento: e.target.value }))}
                  placeholder="Ex: 001/2024"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Órgão Emissor</Label>
              <Input
                value={editForm.orgaoEmissor}
                onChange={e => setEditForm((f: any) => ({ ...f, orgaoEmissor: e.target.value }))}
                placeholder="Ex: INEMA, IBAMA, ANA"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de Emissão</Label>
                <Input
                  type="date"
                  value={editForm.dataEmissao}
                  onChange={e => setEditForm((f: any) => ({ ...f, dataEmissao: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-orange-700 font-semibold">Data de Validade ★</Label>
                <Input
                  type="date"
                  value={editForm.dataValidade}
                  onChange={e => setEditForm((f: any) => ({ ...f, dataValidade: e.target.value }))}
                  className="border-orange-200 focus:border-orange-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prazo de Atendimento</Label>
                <Input
                  type="date"
                  value={editForm.prazoAtendimento}
                  onChange={e => setEditForm((f: any) => ({ ...f, prazoAtendimento: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={editForm.statusDocumental}
                  onValueChange={v => setEditForm((f: any) => ({ ...f, statusDocumental: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                    <SelectItem value="respondido">Respondido</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={editForm.descricao}
                onChange={e => setEditForm((f: any) => ({ ...f, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>Exigências</Label>
              <Textarea
                value={editForm.exigencias}
                onChange={e => setEditForm((f: any) => ({ ...f, exigencias: e.target.value }))}
                rows={3}
                placeholder="Liste as exigências do documento..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancelar</Button>
              <Button
                onClick={() => editMutation.mutate(editForm)}
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                ) : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
