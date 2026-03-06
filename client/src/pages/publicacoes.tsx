import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ScrollText, Plus, Search, ExternalLink, BookOpen, Filter,
  Edit, Trash2, Download, Eye, Calendar, Users, Tag, ChevronRight, X,
  FileText, Globe, FlaskConical, Layers, TrendingUp
} from "lucide-react";
import type { Publicacao } from "@shared/schema";
import { insertPublicacaoSchema } from "@shared/schema";

const TIPOS = [
  { value: "artigo", label: "Artigo Científico" },
  { value: "capitulo", label: "Capítulo de Livro" },
  { value: "livro", label: "Livro" },
  { value: "relatorio_tecnico", label: "Relatório Técnico" },
  { value: "congresso", label: "Trabalho em Congresso" },
  { value: "dissertacao", label: "Dissertação / Tese" },
  { value: "nota_tecnica", label: "Nota Técnica" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  publicado:    { label: "Publicado",    color: "bg-emerald-100 text-emerald-800" },
  aceito:       { label: "Aceito",       color: "bg-blue-100 text-blue-800" },
  em_revisao:   { label: "Em Revisão",   color: "bg-yellow-100 text-yellow-800" },
  submetido:    { label: "Submetido",    color: "bg-violet-100 text-violet-800" },
  em_preparo:   { label: "Em Preparo",   color: "bg-gray-100 text-gray-700" },
};

const AREAS = [
  "Biodiversidade", "Fauna", "Flora", "Herpetofauna", "Ictiofauna",
  "Ornitologia", "Mastozoologia", "Invertebrados",
  "Qualidade da Água", "Solo", "Ruído e Vibração",
  "Licenciamento Ambiental", "Gestão Ambiental",
  "Recuperação de Áreas Degradadas", "Clima e Meteorologia",
  "Geoprocessamento / SIG", "Educação Ambiental", "Outro",
];

const formSchema = insertPublicacaoSchema.extend({
  anoPublicacao: z.coerce.number().min(1900).max(2099).optional().nullable(),
  empreendimentoId: z.coerce.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

function PublicacaoCard({ pub, onEdit, onDelete, onView }: {
  pub: Publicacao;
  onEdit: (p: Publicacao) => void;
  onDelete: (id: number) => void;
  onView: (p: Publicacao) => void;
}) {
  const tipo = TIPOS.find(t => t.value === pub.tipo)?.label ?? pub.tipo;
  const status = STATUS_CONFIG[pub.status] ?? { label: pub.status, color: "bg-gray-100 text-gray-700" };
  const autoresArr = pub.autores.split(";").map(a => a.trim()).filter(Boolean);

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className={`text-xs font-medium ${status.color}`}>{status.label}</Badge>
              <Badge variant="outline" className="text-xs">{tipo}</Badge>
              {pub.areaTematica && <Badge variant="outline" className="text-xs text-violet-700 border-violet-200">{pub.areaTematica}</Badge>}
              {pub.anoPublicacao && <Badge variant="outline" className="text-xs">{pub.anoPublicacao}</Badge>}
            </div>
            <h3
              className="font-semibold text-sm leading-snug cursor-pointer hover:text-emerald-700 transition-colors line-clamp-2"
              onClick={() => onView(pub)}
            >
              {pub.titulo}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <Users className="w-3 h-3 shrink-0" />
              <span className="line-clamp-1">{autoresArr.join("; ")}</span>
            </p>
            {pub.revista && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 italic">
                <BookOpen className="w-3 h-3 shrink-0" />
                {pub.revista}
                {pub.volume && `, v.${pub.volume}`}
                {pub.numero && `, n.${pub.numero}`}
                {pub.paginas && `, p.${pub.paginas}`}
              </p>
            )}
            {pub.doi && (
              <a
                href={`https://doi.org/${pub.doi}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-1"
                onClick={e => e.stopPropagation()}
              >
                <Globe className="w-3 h-3" />
                DOI: {pub.doi}
              </a>
            )}
            {pub.palavrasChave && (
              <div className="flex flex-wrap gap-1 mt-2">
                {pub.palavrasChave.split(";").map(k => k.trim()).filter(Boolean).slice(0, 5).map(kw => (
                  <span key={kw} className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onView(pub)} title="Ver detalhes">
              <Eye className="w-3.5 h-3.5" />
            </Button>
            {pub.url && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(pub.url!, "_blank")} title="Acessar publicação">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(pub)} title="Editar">
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => onDelete(pub.id)} title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicacaoForm({
  open, onClose, editItem, empreendimentos
}: {
  open: boolean;
  onClose: () => void;
  editItem: Publicacao | null;
  empreendimentos: { id: number; nome: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      autores: "",
      revista: "",
      anoPublicacao: new Date().getFullYear(),
      volume: "",
      numero: "",
      paginas: "",
      doi: "",
      resumo: "",
      palavrasChave: "",
      url: "",
      tipo: "artigo",
      status: "publicado",
      areaTematica: "",
      empreendimentoId: null,
      dataSubmissao: "",
      dataPublicacao: "",
      criadoPor: "",
    },
  });

  const isEdit = !!editItem;

  useEffect(() => {
    if (editItem) {
      form.reset({
        titulo: editItem.titulo,
        autores: editItem.autores,
        revista: editItem.revista ?? "",
        anoPublicacao: editItem.anoPublicacao ?? new Date().getFullYear(),
        volume: editItem.volume ?? "",
        numero: editItem.numero ?? "",
        paginas: editItem.paginas ?? "",
        doi: editItem.doi ?? "",
        resumo: editItem.resumo ?? "",
        palavrasChave: editItem.palavrasChave ?? "",
        url: editItem.url ?? "",
        tipo: editItem.tipo,
        status: editItem.status,
        areaTematica: editItem.areaTematica ?? "",
        empreendimentoId: editItem.empreendimentoId ?? null,
        dataSubmissao: editItem.dataSubmissao ?? "",
        dataPublicacao: editItem.dataPublicacao ?? "",
        criadoPor: editItem.criadoPor ?? "",
      });
    } else {
      form.reset({
        titulo: "", autores: "", revista: "", anoPublicacao: new Date().getFullYear(),
        volume: "", numero: "", paginas: "", doi: "", resumo: "",
        palavrasChave: "", url: "", tipo: "artigo", status: "publicado",
        areaTematica: "", empreendimentoId: null, dataSubmissao: "", dataPublicacao: "", criadoPor: "",
      });
    }
  }, [editItem, open]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? apiRequest("PUT", `/api/publicacoes/${editItem!.id}`, data)
        : apiRequest("POST", "/api/publicacoes", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/publicacoes"] });
      toast({ title: isEdit ? "Publicação atualizada" : "Publicação cadastrada com sucesso" });
      onClose();
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-600" />
            {isEdit ? "Editar Publicação" : "Nova Publicação Científica"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input {...field} placeholder="Título completo do artigo" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="autores" render={({ field }) => (
              <FormItem>
                <FormLabel>Autores * <span className="text-xs text-muted-foreground">(separados por ponto e vírgula)</span></FormLabel>
                <FormControl><Input {...field} placeholder="Silva, J.A.; Souza, M.B.; Ecobrasil Consultoria Ambiental" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([v, s]) => (
                        <SelectItem key={v} value={v}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="revista" render={({ field }) => (
                <FormItem>
                  <FormLabel>Revista / Periódico / Evento</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="Ex: Revista Brasileira de Ornitologia" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="anoPublicacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano de Publicação</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ""} placeholder="2024" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="volume" render={({ field }) => (
                <FormItem>
                  <FormLabel>Volume</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="12" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="numero" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="3" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="paginas" render={({ field }) => (
                <FormItem>
                  <FormLabel>Páginas</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="45-58" /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="doi" render={({ field }) => (
                <FormItem>
                  <FormLabel>DOI</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="10.1234/exemplo.2024.001" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL / Link de acesso</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ""} placeholder="https://..." /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="areaTematica" render={({ field }) => (
                <FormItem>
                  <FormLabel>Área Temática</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="empreendimentoId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Empreendimento vinculado</FormLabel>
                  <Select value={field.value?.toString() ?? "none"} onValueChange={v => field.onChange(v === "none" ? null : Number(v))}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {empreendimentos.map(e => <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="palavrasChave" render={({ field }) => (
              <FormItem>
                <FormLabel>Palavras-chave <span className="text-xs text-muted-foreground">(separadas por ponto e vírgula)</span></FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="biodiversidade; aves; monitoramento; Cerrado" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="resumo" render={({ field }) => (
              <FormItem>
                <FormLabel>Resumo / Abstract</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ""} rows={4} placeholder="Resumo do trabalho..." /></FormControl>
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="dataSubmissao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Submissão</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="dataPublicacao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Publicação</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="criadoPor" render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável pelo cadastro</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="Nome do colaborador que cadastrou" /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {mutation.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar publicação"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ pub, onClose, onEdit }: { pub: Publicacao | null; onClose: () => void; onEdit: (p: Publicacao) => void }) {
  if (!pub) return null;
  const tipo = TIPOS.find(t => t.value === pub.tipo)?.label ?? pub.tipo;
  const status = STATUS_CONFIG[pub.status] ?? { label: pub.status, color: "bg-gray-100 text-gray-700" };
  const autoresArr = pub.autores.split(";").map(a => a.trim()).filter(Boolean);
  const palavras = (pub.palavrasChave || "").split(";").map(k => k.trim()).filter(Boolean);

  return (
    <Dialog open={!!pub} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 pr-8 leading-snug">{pub.titulo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={`${status.color}`}>{status.label}</Badge>
            <Badge variant="outline">{tipo}</Badge>
            {pub.areaTematica && <Badge variant="outline" className="text-violet-700 border-violet-200">{pub.areaTematica}</Badge>}
            {pub.anoPublicacao && <Badge variant="outline">{pub.anoPublicacao}</Badge>}
          </div>

          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Autores</p>
            <div className="space-y-0.5">
              {autoresArr.map((a, i) => <p key={i} className="text-sm">{a}</p>)}
            </div>
          </div>

          {pub.revista && (
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Publicado em</p>
              <p className="text-sm italic font-medium">{pub.revista}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[pub.volume && `v.${pub.volume}`, pub.numero && `n.${pub.numero}`, pub.paginas && `p.${pub.paginas}`].filter(Boolean).join(", ")}
              </p>
            </div>
          )}

          {pub.resumo && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Resumo</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{pub.resumo}</p>
            </div>
          )}

          {palavras.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Palavras-chave</p>
              <div className="flex flex-wrap gap-1.5">
                {palavras.map(k => (
                  <span key={k} className="bg-emerald-50 text-emerald-800 text-xs px-2 py-0.5 rounded-full border border-emerald-200">{k}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {pub.doi && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">DOI</p>
                <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                  <Globe className="w-3 h-3" />{pub.doi}
                </a>
              </div>
            )}
            {pub.url && (
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Link</p>
                <a href={pub.url} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />Acessar publicação
                </a>
              </div>
            )}
          </div>

          {(pub.dataSubmissao || pub.dataPublicacao || pub.criadoPor) && (
            <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              {pub.dataSubmissao && <div><span className="font-medium block">Submetido em</span>{pub.dataSubmissao}</div>}
              {pub.dataPublicacao && <div><span className="font-medium block">Publicado em</span>{pub.dataPublicacao}</div>}
              {pub.criadoPor && <div><span className="font-medium block">Cadastrado por</span>{pub.criadoPor}</div>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={() => { onClose(); onEdit(pub); }} className="bg-emerald-600 hover:bg-emerald-700">
            <Edit className="w-4 h-4 mr-1" /> Editar
          </Button>
          {pub.url && (
            <Button onClick={() => window.open(pub.url!, "_blank")} variant="outline">
              <ExternalLink className="w-4 h-4 mr-1" /> Abrir link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Publicacoes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterArea, setFilterArea] = useState("todas");
  const [filterAno, setFilterAno] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Publicacao | null>(null);
  const [viewItem, setViewItem] = useState<Publicacao | null>(null);

  const { data: pubs = [], isLoading } = useQuery<Publicacao[]>({ queryKey: ["/api/publicacoes"] });
  const { data: empreendimentos = [] } = useQuery<{ id: number; nome: string }[]>({ queryKey: ["/api/empreendimentos"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/publicacoes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/publicacoes"] });
      toast({ title: "Publicação removida" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const anos = useMemo(() => {
    const set = new Set(pubs.map(p => p.anoPublicacao).filter(Boolean));
    return Array.from(set).sort((a, b) => (b ?? 0) - (a ?? 0));
  }, [pubs]);

  const filtered = useMemo(() => pubs.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.titulo.toLowerCase().includes(q) || p.autores.toLowerCase().includes(q) ||
      (p.revista ?? "").toLowerCase().includes(q) || (p.palavrasChave ?? "").toLowerCase().includes(q) ||
      (p.doi ?? "").toLowerCase().includes(q);
    const matchTipo = filterTipo === "todos" || p.tipo === filterTipo;
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const matchArea = filterArea === "todas" || p.areaTematica === filterArea;
    const matchAno = filterAno === "todos" || p.anoPublicacao?.toString() === filterAno;
    return matchSearch && matchTipo && matchStatus && matchArea && matchAno;
  }), [pubs, search, filterTipo, filterStatus, filterArea, filterAno]);

  const stats = useMemo(() => ({
    total: pubs.length,
    publicados: pubs.filter(p => p.status === "publicado").length,
    emRevisao: pubs.filter(p => p.status === "em_revisao").length,
    areas: new Set(pubs.map(p => p.areaTematica).filter(Boolean)).size,
    periodos: anos.length > 0 ? `${Math.min(...anos.filter(Boolean) as number[])}–${Math.max(...anos.filter(Boolean) as number[])}` : "—",
  }), [pubs, anos]);

  const handleEdit = (p: Publicacao) => { setEditItem(p); setModalOpen(true); };
  const handleDelete = (id: number) => {
    if (confirm("Deseja remover esta publicação?")) deleteMutation.mutate(id);
  };
  const handleNew = () => { setEditItem(null); setModalOpen(true); };

  const hasFilters = filterTipo !== "todos" || filterStatus !== "todos" || filterArea !== "todas" || filterAno !== "todos" || search;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-emerald-600" />
            <h1 className="text-2xl font-bold">Publicações Científicas</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Artigos, capítulos e trabalhos com afiliação Ecobrasil Consultoria Ambiental
          </p>
        </div>
        <Button onClick={handleNew} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Nova Publicação
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total de publicações", value: stats.total, icon: ScrollText, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Publicadas", value: stats.publicados, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Em revisão / Submetidas", value: stats.emRevisao, icon: FileText, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Áreas temáticas", value: stats.areas, icon: Tag, color: "text-violet-600", bg: "bg-violet-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por título, autor, revista, palavra-chave, DOI..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([v, s]) => <SelectItem key={v} value={v}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as áreas</SelectItem>
                {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAno} onValueChange={setFilterAno}>
              <SelectTrigger className="w-full sm:w-28"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {anos.map(a => <SelectItem key={a} value={a!.toString()}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={() => { setSearch(""); setFilterTipo("todos"); setFilterStatus("todos"); setFilterArea("todas"); setFilterAno("todos"); }}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <ScrollText className="w-6 h-6 animate-pulse mr-2" /> Carregando publicações...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-dashed border-muted rounded-xl">
          <ScrollText className="w-12 h-12 text-muted-foreground/30" />
          <p className="font-medium text-muted-foreground">
            {hasFilters ? "Nenhuma publicação encontrada com esses filtros" : "Nenhuma publicação cadastrada"}
          </p>
          {!hasFilters && (
            <Button onClick={handleNew} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Cadastrar primeira publicação
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Exibindo <strong>{filtered.length}</strong> de <strong>{pubs.length}</strong> publicações
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map(pub => (
              <PublicacaoCard key={pub.id} pub={pub} onEdit={handleEdit} onDelete={handleDelete} onView={setViewItem} />
            ))}
          </div>
        </>
      )}

      <PublicacaoForm
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        editItem={editItem}
        empreendimentos={empreendimentos}
      />

      <DetailDialog pub={viewItem} onClose={() => setViewItem(null)} onEdit={p => { setViewItem(null); handleEdit(p); }} />
    </div>
  );
}
