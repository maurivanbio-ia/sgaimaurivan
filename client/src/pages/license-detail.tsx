import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date-utils";
import {
  ArrowLeft, Shield, AlertTriangle, CheckCircle2, Clock, XCircle,
  Plus, Pencil, Trash2, FileText, Eye, Link2, Flag, CalendarDays,
  History, BarChart3, Search, Filter, Download, ChevronRight,
  CheckCheck, TrendingDown, AlertCircle, Upload, Star
} from "lucide-react";
import type { LicencaAmbiental, Condicionante, CondicionanteEvidencia } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LicencaComEmpreendimento extends LicencaAmbiental {
  empreendimentoNome?: string;
}

type CondicionanteComExtra = Condicionante & { responsavelNomeDisplay?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIAS_CONDICIONANTE = [
  "Monitoramento Ambiental",
  "Controle de Emissões",
  "Relatório Técnico",
  "Entrega de Documento",
  "Compensação Ambiental",
  "Programa de Gestão",
  "Comunicação",
  "Treinamento",
  "Licença de Terceiro",
  "Outro",
];

const TIPOS_CONDICIONANTE = [
  { value: "periodica", label: "Periódica" },
  { value: "pontual", label: "Pontual" },
  { value: "entrega_documento", label: "Entrega de Documento" },
];

const STATUS_CONDICIONANTE: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: BarChart3 },
  cumprida: { label: "Cumprida", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  vencida: { label: "Vencida", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  cancelada: { label: "Cancelada", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: XCircle },
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const condicionanteSchema = z.object({
  item: z.string().optional(),
  codigo: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  categoria: z.string().optional(),
  tipoCondicionante: z.string().optional(),
  responsavelNome: z.string().optional(),
  prazo: z.string().min(1, "Prazo é obrigatório"),
  status: z.string().default("pendente"),
  progresso: z.number().min(0).max(100).default(0),
  observacoes: z.string().optional(),
});

type CondicionanteFormData = z.infer<typeof condicionanteSchema>;

const evidenciaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.string().default("documento"),
  url: z.string().optional(),
  descricao: z.string().optional(),
  emitidoPor: z.string().optional(),
  dataEmissao: z.string().optional(),
});

type EvidenciaFormData = z.infer<typeof evidenciaSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isArquivoAcessivel(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.startsWith("/files/") || path.startsWith("object:") || path.startsWith("http");
}

function diasParaVencer(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(prazo + "T00:00:00");
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function getLicencaStatusColor(status: string) {
  if (status === "ativa") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (status === "a_vencer") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

// ─── Painel de Conformidade ───────────────────────────────────────────────────

function PainelConformidade({ condicionantes }: { condicionantes: Condicionante[] }) {
  const total = condicionantes.length;
  const cumpridas = condicionantes.filter(c => c.status === "cumprida").length;
  const emAndamento = condicionantes.filter(c => c.status === "em_andamento").length;
  const pendentes = condicionantes.filter(c => c.status === "pendente").length;
  const vencidas = condicionantes.filter(c => c.status === "vencida").length;
  const conformidade = total > 0 ? Math.round((cumpridas / total) * 100) : 0;

  const vencendo7 = condicionantes.filter(c => {
    if (c.status === "cumprida" || c.status === "vencida") return false;
    const dias = diasParaVencer(c.prazo);
    return dias !== null && dias >= 0 && dias <= 7;
  }).length;

  const vencendo15 = condicionantes.filter(c => {
    if (c.status === "cumprida" || c.status === "vencida") return false;
    const dias = diasParaVencer(c.prazo);
    return dias !== null && dias >= 0 && dias <= 15;
  }).length;

  const vencendo30 = condicionantes.filter(c => {
    if (c.status === "cumprida" || c.status === "vencida") return false;
    const dias = diasParaVencer(c.prazo);
    return dias !== null && dias >= 0 && dias <= 30;
  }).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-slate-400">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{cumpridas}</div>
            <div className="text-xs text-muted-foreground">Cumpridas</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{emAndamento}</div>
            <div className="text-xs text-muted-foreground">Em Andamento</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{pendentes}</div>
            <div className="text-xs text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{vencidas}</div>
            <div className="text-xs text-muted-foreground">Vencidas</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{conformidade}%</div>
            <div className="text-xs text-muted-foreground">Conformidade</div>
          </CardContent>
        </Card>
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progresso de Conformidade</span>
            <span className="font-semibold">{cumpridas} de {total} cumpridas</span>
          </div>
          <Progress value={conformidade} className="h-3" />
        </div>
      )}

      {(vencendo7 > 0 || vencendo15 > 0 || vencendo30 > 0) && (
        <div className="flex flex-wrap gap-2">
          {vencendo7 > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {vencendo7} vencendo em 7 dias
            </Badge>
          )}
          {vencendo15 > 0 && (
            <Badge className="gap-1 bg-orange-100 text-orange-800 hover:bg-orange-100">
              <AlertCircle className="h-3 w-3" />
              {vencendo15} vencendo em 15 dias
            </Badge>
          )}
          {vencendo30 > 0 && (
            <Badge className="gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
              <Clock className="h-3 w-3" />
              {vencendo30} vencendo em 30 dias
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dialog de Criar Demanda ──────────────────────────────────────────────────

function CriarDemandaDialog({
  condicionante,
  licenca,
  empreendimentoId,
}: {
  condicionante: Condicionante;
  licenca: LicencaAmbiental;
  empreendimentoId: number;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: colaboradores = [] } = useQuery<any[]>({
    queryKey: ["/api/colaboradores"],
    enabled: open,
  });

  const form = useForm({
    defaultValues: {
      titulo: `${condicionante.titulo || condicionante.descricao?.substring(0, 60)} - ${condicionante.codigo || "COND"}`,
      descricao: `Condicionante: ${condicionante.titulo || condicionante.descricao}\n\nRef: Licença ${licenca.numero}`,
      setor: "Licenciamento",
      status: "a_fazer",
      prioridade: "media",
      complexidade: "media",
      categoria: "licenciamento",
      dataEntrega: condicionante.prazo || "",
      responsavelId: "",
    },
  });

  const criarDemanda = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/demandas", {
        ...data,
        responsavelId: parseInt(data.responsavelId),
        empreendimentoId,
        licencaId: licenca.id,
        condicionanteId: condicionante.id,
        origem: "condicionante",
        criadoPor: parseInt(data.responsavelId),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      toast({ title: "Demanda criada com sucesso" });
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao criar demanda", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Link2 className="h-3 w-3" />
          Criar Demanda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Demanda vinculada à Condicionante</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(d => criarDemanda.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input {...form.register("titulo")} />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea {...form.register("descricao")} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <select {...form.register("prioridade")} className="w-full border rounded p-2 text-sm bg-background">
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Prazo</label>
              <Input type="date" {...form.register("dataEntrega")} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Responsável *</label>
            <select {...form.register("responsavelId", { required: true })} className="w-full border rounded p-2 text-sm bg-background">
              <option value="">Selecione...</option>
              {colaboradores.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={criarDemanda.isPending}>
              {criarDemanda.isPending ? "Criando..." : "Criar Demanda"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog Adicionar ao Cronograma ──────────────────────────────────────────

function AdicionarCronogramaDialog({
  condicionante,
  licenca,
  empreendimentoId,
}: {
  condicionante: Condicionante;
  licenca: LicencaAmbiental;
  empreendimentoId: number;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      titulo: `${condicionante.titulo || "Marco"} [${licenca.numero}]`,
      descricao: condicionante.descricao,
      tipo: "marco",
      dataInicio: new Date().toISOString().split("T")[0],
      dataFim: condicionante.prazo || "",
      status: "pendente",
      prioridade: "media",
    },
  });

  const adicionar = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cronograma", {
        ...data,
        empreendimentoId,
        licencaId: licenca.id,
        condicionanteId: condicionante.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Marco adicionado ao cronograma" });
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Erro ao adicionar ao cronograma", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Flag className="h-3 w-3" />
          Cronograma
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Marco ao Cronograma</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(d => adicionar.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Título do Marco</label>
            <Input {...form.register("titulo")} />
          </div>
          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea {...form.register("descricao")} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Data Início</label>
              <Input type="date" {...form.register("dataInicio")} />
            </div>
            <div>
              <label className="text-sm font-medium">Data Fim (Prazo)</label>
              <Input type="date" {...form.register("dataFim")} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={adicionar.isPending}>
              {adicionar.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab: Condicionantes ──────────────────────────────────────────────────────

function CondicionantesTab({ licencaId, licenca, empreendimentoId }: {
  licencaId: number;
  licenca: LicencaAmbiental;
  empreendimentoId: number;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCond, setEditingCond] = useState<Condicionante | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [selectedCond, setSelectedCond] = useState<Condicionante | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: condicionantes = [], isLoading } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const form = useForm<CondicionanteFormData>({
    resolver: zodResolver(condicionanteSchema),
    defaultValues: {
      item: "",
      codigo: "",
      titulo: "",
      descricao: "",
      categoria: "",
      tipoCondicionante: "",
      responsavelNome: "",
      prazo: "",
      status: "pendente",
      progresso: 0,
      observacoes: "",
    },
  });

  const progressoValue = form.watch("progresso") ?? 0;
  const tipoCondWatch = form.watch("tipoCondicionante");

  const createCond = useMutation({
    mutationFn: async (data: CondicionanteFormData) => {
      const res = await apiRequest("POST", `/api/licencas/${licencaId}/condicionantes`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
      toast({ title: "Condicionante criada com sucesso" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ title: "Erro ao criar condicionante", variant: "destructive" }),
  });

  const updateCond = useMutation({
    mutationFn: async (data: CondicionanteFormData) => {
      const res = await apiRequest("PUT", `/api/condicionantes/${editingCond?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
      toast({ title: "Condicionante atualizada" });
      setIsDialogOpen(false);
      setEditingCond(null);
      form.reset();
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const deleteCond = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/condicionantes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
      toast({ title: "Condicionante excluída" });
      if (selectedCond?.id === deleteCond.variables) setSelectedCond(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const handleEdit = (cond: Condicionante) => {
    setEditingCond(cond);
    form.reset({
      item: (cond as any).item || "",
      codigo: (cond as any).codigo || "",
      titulo: (cond as any).titulo || "",
      descricao: cond.descricao,
      categoria: (cond as any).categoria || "",
      tipoCondicionante: (cond as any).tipoCondicionante || "",
      responsavelNome: (cond as any).responsavelNome || "",
      prazo: cond.prazo,
      status: cond.status,
      progresso: (cond as any).progresso ?? 0,
      observacoes: cond.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingCond(null);
    form.reset({
      item: "", codigo: "", titulo: "", descricao: "", categoria: "",
      tipoCondicionante: "", responsavelNome: "", prazo: "",
      status: "pendente", progresso: 0, observacoes: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: CondicionanteFormData) => {
    if (editingCond) updateCond.mutate(data);
    else createCond.mutate(data);
  };

  // Filter
  const filtered = condicionantes.filter(c => {
    const titulo = (c as any).titulo || c.descricao;
    const matchSearch = !searchTerm || titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((c as any).codigo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "todos" || c.status === filterStatus;
    const matchCat = filterCategoria === "todas" || (c as any).categoria === filterCategoria;
    return matchSearch && matchStatus && matchCat;
  });

  const categorias = [...new Set(condicionantes.map(c => (c as any).categoria).filter(Boolean))];

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Carregando condicionantes...</div>;

  return (
    <div className="space-y-4">
      <PainelConformidade condicionantes={condicionantes} />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar condicionante..."
              className="pl-8 w-52"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="cumprida">Cumprida</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Condicionante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCond ? "Editar Condicionante" : "Nova Condicionante"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <FormField control={form.control} name="item" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item</FormLabel>
                        <FormControl><Input {...field} placeholder="Ex: 1.1" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="codigo" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código</FormLabel>
                        <FormControl><Input {...field} placeholder="Ex: C01" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="tipoCondicionante" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIPOS_CONDICIONANTE.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="titulo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título *</FormLabel>
                      <FormControl><Input {...field} placeholder="Título curto da condicionante" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="descricao" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição Completa *</FormLabel>
                      <FormControl><Textarea {...field} rows={3} placeholder="Texto oficial da condicionante conforme licença" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="categoria" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIAS_CONDICIONANTE.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="responsavelNome" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <FormControl><Input {...field} placeholder="Nome do responsável" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="prazo" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Prazo *</FormLabel>
                          {tipoCondWatch === "periodica" && licenca.validade && (
                            <button
                              type="button"
                              className="text-xs text-[#00599C] hover:underline flex items-center gap-0.5 font-medium"
                              onClick={() => form.setValue("prazo", licenca.validade, { shouldValidate: true, shouldDirty: true })}
                            >
                              <CalendarDays className="h-3 w-3" />
                              Até venc. da licença ({formatDate(licenca.validade)})
                            </button>
                          )}
                        </div>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="em_andamento">Em Andamento</SelectItem>
                            <SelectItem value="cumprida">Cumprida</SelectItem>
                            <SelectItem value="vencida">Vencida</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="progresso" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progresso: {progressoValue}%</FormLabel>
                      <FormControl>
                        <input
                          type="range"
                          min={0} max={100} step={5}
                          value={field.value ?? 0}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="observacoes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl><Textarea {...field} rows={2} /></FormControl>
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createCond.isPending || updateCond.isPending}>
                      {editingCond ? "Salvar Alterações" : "Criar Condicionante"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards de Exigências Numerados */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhuma condicionante encontrada</p>
          <p className="text-sm">Clique em "Nova Condicionante" para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cond, idx) => {
            const dias = diasParaVencer(cond.prazo);
            const atrasado = dias !== null && dias < 0 && cond.status !== "cumprida";
            const st = STATUS_CONDICIONANTE[cond.status] || STATUS_CONDICIONANTE.pendente;
            const StatusIcon = st.icon;
            const isSelected = selectedCond?.id === cond.id;
            const itemLabel = (cond as any).item || String(idx + 1);
            const codigoLabel = (cond as any).codigo;
            const titulo = (cond as any).titulo;

            return (
              <div
                key={cond.id}
                className={`border rounded-xl transition-all duration-150 cursor-pointer hover:shadow-md ${
                  isSelected
                    ? "border-primary shadow-sm bg-primary/5 dark:bg-primary/10"
                    : atrasado
                    ? "border-red-200 bg-red-50/30 dark:border-red-800/40 dark:bg-red-900/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
                onClick={() => setSelectedCond(isSelected ? null : cond)}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Número sequencial */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm border-2 ${
                    cond.status === "cumprida"
                      ? "bg-green-100 border-green-400 text-green-700 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300"
                      : atrasado
                      ? "bg-red-100 border-red-400 text-red-700 dark:bg-red-900/40 dark:border-red-600 dark:text-red-300"
                      : "bg-[#00599C]/10 border-[#00599C]/40 text-[#00599C] dark:bg-[#00599C]/20 dark:border-[#00599C]/50"
                  }`}>
                    {itemLabel}
                  </div>

                  {/* Conteúdo principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      {codigoLabel && (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono border">{codigoLabel}</code>
                      )}
                      <span className="font-semibold text-sm leading-snug">
                        {titulo || cond.descricao.substring(0, 80)}
                      </span>
                    </div>
                    {titulo && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{cond.descricao}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {(cond as any).categoria && (
                        <Badge variant="outline" className="text-xs py-0">{(cond as any).categoria}</Badge>
                      )}
                      {(cond as any).responsavelNome && (
                        <span className="text-xs text-muted-foreground">👤 {(cond as any).responsavelNome}</span>
                      )}
                    </div>
                  </div>

                  {/* Coluna direita: status, prazo, progresso, ações */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[130px]">
                    <Badge className={`gap-1 text-xs ${st.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {st.label}
                    </Badge>

                    <div className="text-xs text-muted-foreground text-right">
                      📅 {formatDate(cond.prazo)}
                    </div>

                    {atrasado ? (
                      <Badge variant="destructive" className="text-xs">{Math.abs(dias!)}d de atraso</Badge>
                    ) : dias !== null && dias <= 7 && cond.status !== "cumprida" ? (
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-xs">{dias}d restantes</Badge>
                    ) : cond.status === "cumprida" ? (
                      <CheckCheck className="h-4 w-4 text-green-500" />
                    ) : null}

                    {/* Progresso */}
                    <div className="w-full space-y-0.5">
                      <Progress value={(cond as any).progresso || 0} className="h-1.5 w-28" />
                      <span className="text-xs text-muted-foreground">{(cond as any).progresso || 0}%</span>
                    </div>

                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(cond)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Excluir esta condicionante?")) deleteCond.mutate(cond.id);
                        }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Seção expandida ao selecionar */}
                {isSelected && (
                  <div className="border-t px-4 pt-3 pb-4 bg-muted/30 rounded-b-xl space-y-3">
                    {/* Texto completo da exigência */}
                    <div className="bg-background/70 border rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Texto da Exigência</p>
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{cond.descricao}</p>
                    </div>
                    {/* Metadados */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Tipo</span>
                        <span className="font-medium">{TIPOS_CONDICIONANTE.find(t => t.value === (cond as any).tipoCondicionante)?.label || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Responsável</span>
                        <span className="font-medium">{(cond as any).responsavelNome || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Prazo</span>
                        <span className="font-medium">{formatDate(cond.prazo)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Progresso</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Progress value={(cond as any).progresso || 0} className="h-1.5 flex-1" />
                          <span className="font-medium">{(cond as any).progresso || 0}%</span>
                        </div>
                      </div>
                    </div>
                    {cond.observacoes && (
                      <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2">Obs: {cond.observacoes}</p>
                    )}
                    {/* Botões de ação */}
                    <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                      <CriarDemandaDialog condicionante={cond} licenca={licenca} empreendimentoId={empreendimentoId} />
                      <AdicionarCronogramaDialog condicionante={cond} licenca={licenca} empreendimentoId={empreendimentoId} />
                    </div>
                    {/* Evidências */}
                    <div onClick={e => e.stopPropagation()}>
                      <EvidenciasPanel condicionanteId={cond.id} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

// ─── Painel de Evidências ─────────────────────────────────────────────────────

function EvidenciasPanel({ condicionanteId }: { condicionanteId: number }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: evidencias = [], isLoading } = useQuery<CondicionanteEvidencia[]>({
    queryKey: ["/api/condicionantes", condicionanteId, "evidencias"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/condicionantes/${condicionanteId}/evidencias`);
      return res.json();
    },
  });

  const form = useForm<EvidenciaFormData>({
    resolver: zodResolver(evidenciaSchema),
    defaultValues: { nome: "", tipo: "documento", url: "", descricao: "", emitidoPor: "", dataEmissao: "" },
  });

  const createEv = useMutation({
    mutationFn: async (data: EvidenciaFormData) => {
      const res = await apiRequest("POST", `/api/condicionantes/${condicionanteId}/evidencias`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/condicionantes", condicionanteId, "evidencias"] });
      toast({ title: "Evidência registrada" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ title: "Erro ao registrar evidência", variant: "destructive" }),
  });

  const aprovarEv = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/condicionantes/evidencias/${id}/aprovar`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/condicionantes", condicionanteId, "evidencias"] });
      toast({ title: "Evidência aprovada" });
    },
  });

  const deleteEv = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/condicionantes/evidencias/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/condicionantes", condicionanteId, "evidencias"] });
      toast({ title: "Evidência removida" });
    },
  });

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Evidências e Documentos ({evidencias.length})
        </h4>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7">
              <Upload className="h-3 w-3" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Evidência</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createEv.mutate(d))} className="space-y-3">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Documento *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Relatório de Monitoramento Q1 2025" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="documento">Documento</SelectItem>
                        <SelectItem value="imagem">Imagem</SelectItem>
                        <SelectItem value="relatorio">Relatório</SelectItem>
                        <SelectItem value="terceiros">Documento de Terceiros</SelectItem>
                        <SelectItem value="licenca">Licença/Autorização</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="descricao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea {...field} rows={2} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="emitidoPor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emitido Por</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Empresa Consultora X" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dataEmissao" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Emissão</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="url" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arquivo</FormLabel>
                    <FormControl>
                      <ObjectUploader
                        value={field.value}
                        onChange={field.onChange}
                        accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                        label="Upload do documento"
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createEv.isPending}>Registrar Evidência</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : evidencias.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
          Nenhuma evidência registrada. Adicione documentos de cumprimento.
        </div>
      ) : (
        <div className="space-y-2">
          {evidencias.map(ev => (
            <div key={ev.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="font-medium">{ev.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {ev.tipo} {ev.emitidoPor ? `• ${ev.emitidoPor}` : ""}
                    {ev.dataEmissao ? ` • ${formatDate(ev.dataEmissao)}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {ev.aprovado ? (
                  <Badge className="bg-green-100 text-green-800 gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Aprovado
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                    onClick={() => aprovarEv.mutate(ev.id)}>
                    <Star className="h-3 w-3" />
                    Aprovar
                  </Button>
                )}
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500"
                  onClick={() => deleteEv.mutate(ev.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Documentos e Evidências ─────────────────────────────────────────────

function DocumentosTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Evidências são gerenciadas por condicionante. Selecione uma condicionante abaixo para ver ou adicionar evidências.
      </p>
      {condicionantes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nenhuma condicionante cadastrada. Vá à aba Condicionantes para começar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {condicionantes.map(cond => (
            <Card key={cond.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {(cond as any).codigo && <code className="bg-muted px-1 rounded text-xs">{(cond as any).codigo}</code>}
                  {(cond as any).titulo || cond.descricao.substring(0, 80)}
                  <Badge className={`text-xs ml-auto ${STATUS_CONDICIONANTE[cond.status]?.color}`}>
                    {STATUS_CONDICIONANTE[cond.status]?.label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EvidenciasPanel condicionanteId={cond.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Cronograma ──────────────────────────────────────────────────────────

function CronogramaTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const sorted = [...condicionantes].sort((a, b) =>
    new Date(a.prazo).getTime() - new Date(b.prazo).getTime()
  );

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Linha do tempo de vencimentos das condicionantes desta licença.
      </p>
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nenhuma condicionante para exibir no cronograma.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-16 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {sorted.map(cond => {
              const dataVenc = new Date(cond.prazo + "T00:00:00");
              const dias = diasParaVencer(cond.prazo);
              const atrasado = dias !== null && dias < 0 && cond.status !== "cumprida";
              const st = STATUS_CONDICIONANTE[cond.status] || STATUS_CONDICIONANTE.pendente;
              const StatusIcon = st.icon;

              return (
                <div key={cond.id} className="flex items-start gap-4 pl-4">
                  <div className="w-12 text-right text-xs text-muted-foreground flex-shrink-0 pt-1">
                    {dataVenc.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </div>
                  <div className={`relative z-10 flex-shrink-0 mt-1 w-4 h-4 rounded-full border-2 ${
                    cond.status === "cumprida" ? "bg-green-500 border-green-500" :
                    atrasado ? "bg-red-500 border-red-500" :
                    "bg-background border-primary"
                  }`} />
                  <Card className={`flex-1 ${atrasado ? "border-red-200" : cond.status === "cumprida" ? "border-green-200" : ""}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm">
                            {(cond as any).codigo && <code className="mr-2 text-xs bg-muted px-1 rounded">{(cond as any).codigo}</code>}
                            {(cond as any).titulo || cond.descricao.substring(0, 60)}
                          </div>
                          {(cond as any).responsavelNome && (
                            <div className="text-xs text-muted-foreground mt-0.5">Resp.: {(cond as any).responsavelNome}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs ${st.color} gap-1`}>
                            <StatusIcon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                          {atrasado && <Badge variant="destructive" className="text-xs">{Math.abs(dias!)}d atraso</Badge>}
                          {!atrasado && dias !== null && dias <= 7 && cond.status !== "cumprida" && (
                            <Badge className="bg-orange-100 text-orange-800 text-xs">Urgente</Badge>
                          )}
                        </div>
                      </div>
                      <Progress value={(cond as any).progresso || 0} className="h-1.5 mt-2" />
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Histórico ───────────────────────────────────────────────────────────

function HistoricoTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const eventos = condicionantes
    .map(c => ({
      id: c.id,
      titulo: (c as any).titulo || c.descricao.substring(0, 60),
      codigo: (c as any).codigo,
      status: c.status,
      data: c.criadoEm,
      tipo: "criação",
    }))
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Registro de criações e alterações das condicionantes desta licença.
      </p>
      {eventos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Nenhum registro de histórico disponível.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventos.map(ev => (
            <div key={ev.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">
                  {ev.codigo && <code className="mr-2 text-xs bg-muted px-1 rounded">{ev.codigo}</code>}
                  {ev.titulo}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Condicionante registrada • Status: {STATUS_CONDICIONANTE[ev.status]?.label}
                  {ev.data && ` • ${new Date(ev.data).toLocaleDateString("pt-BR")}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LicenseDetail() {
  const [, params] = useRoute("/licencas/:id");
  const licencaId = parseInt(params?.id || "0");

  const { data: licenca, isLoading } = useQuery<LicencaComEmpreendimento>({
    queryKey: ["/api/licencas", licencaId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}`);
      return res.json();
    },
    enabled: !!licencaId,
  });

  const { data: empreendimento } = useQuery<any>({
    queryKey: ["/api/empreendimentos", licenca?.empreendimentoId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/empreendimentos/${licenca!.empreendimentoId}`);
      return res.json();
    },
    enabled: !!licenca?.empreendimentoId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando licença...</div>
      </div>
    );
  }

  if (!licenca) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Licença não encontrada.</div>
      </div>
    );
  }

  const licencaStatus = licenca.status;
  const diasVencer = diasParaVencer(licenca.validade);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/empreendimentos">
          <span className="hover:text-foreground cursor-pointer">Empreendimentos</span>
        </Link>
        <ChevronRight className="h-4 w-4" />
        {empreendimento && (
          <>
            <Link href={`/empreendimentos/${licenca.empreendimentoId}`}>
              <span className="hover:text-foreground cursor-pointer">{empreendimento.nome}</span>
            </Link>
            <ChevronRight className="h-4 w-4" />
          </>
        )}
        <span className="text-foreground font-medium">Licença {licenca.numero}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href={`/empreendimentos/${licenca.empreendimentoId}`}>
            <Button variant="outline" size="sm" className="gap-1 flex-shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                {licenca.numero}
              </h1>
              <Badge className={`${getLicencaStatusColor(licencaStatus)}`}>
                {licencaStatus === "ativa" ? "Ativa" : licencaStatus === "a_vencer" ? "A Vencer" : "Vencida"}
              </Badge>
              <Badge variant="outline">{licenca.tipo}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {licenca.orgaoEmissor}
              {empreendimento && <span className="ml-2">• {empreendimento.nome}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/licencas/${licencaId}/editar`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Pencil className="h-4 w-4" />
              Editar Licença
            </Button>
          </Link>
          {licenca.arquivoPdf && (
            isArquivoAcessivel(licenca.arquivoPdf) ? (
              <a href={`/api/licencas/${licencaId}/arquivo`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </a>
            ) : (
              <Button variant="outline" size="sm" className="gap-1 text-amber-600 border-amber-300 cursor-default" disabled title="Arquivo do sistema anterior. Edite a licença e faça o upload novamente.">
                <AlertTriangle className="h-4 w-4" />
                Re-upload necessário
              </Button>
            )
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Emissão</div>
            <div className="font-semibold">{formatDate(licenca.dataEmissao)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Validade</div>
            <div className="font-semibold">{formatDate(licenca.validade)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Órgão Emissor</div>
            <div className="font-semibold text-sm">{licenca.orgaoEmissor}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Dias p/ Vencer</div>
            <div className={`font-semibold ${diasVencer !== null && diasVencer < 0 ? "text-red-600" : diasVencer !== null && diasVencer < 30 ? "text-yellow-600" : "text-green-600"}`}>
              {diasVencer === null ? "-" : diasVencer < 0 ? `${Math.abs(diasVencer)}d vencida` : `${diasVencer}d`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="condicionantes" className="w-full">
        <TabsList className="w-full flex overflow-x-auto flex-nowrap h-auto">
          <TabsTrigger value="detalhes" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <Shield className="h-4 w-4" />
            Detalhes
          </TabsTrigger>
          <TabsTrigger value="condicionantes" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Condicionantes
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <FileText className="h-4 w-4" />
            Documentos e Evidências
          </TabsTrigger>
          <TabsTrigger value="cronograma" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Cronograma
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <History className="h-4 w-4" />
            Histórico e Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Licença</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Número:</span>
                <div className="font-semibold">{licenca.numero}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <div className="font-semibold">{licenca.tipo}</div>
              </div>
              {(licenca as any).tipoOutorga && (
                <div>
                  <span className="text-muted-foreground">Tipo de Outorga:</span>
                  <div className="font-semibold capitalize">{(licenca as any).tipoOutorga}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Órgão Emissor:</span>
                <div className="font-semibold">{licenca.orgaoEmissor}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Data de Emissão:</span>
                <div className="font-semibold">{formatDate(licenca.dataEmissao)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Validade:</span>
                <div className="font-semibold">{formatDate(licenca.validade)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <div>
                  <Badge className={getLicencaStatusColor(licenca.status)}>
                    {licenca.status === "ativa" ? "Ativa" : licenca.status === "a_vencer" ? "A Vencer" : "Vencida"}
                  </Badge>
                </div>
              </div>
              {empreendimento && (
                <div>
                  <span className="text-muted-foreground">Empreendimento:</span>
                  <div className="font-semibold">{empreendimento.nome}</div>
                </div>
              )}
              {licenca.arquivoPdf && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Arquivo PDF:</span>
                  <div>
                    {isArquivoAcessivel(licenca.arquivoPdf) ? (
                      <a href={`/api/licencas/${licencaId}/arquivo`} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Visualizar PDF
                      </a>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Arquivo do sistema anterior — edite a licença e faça o upload novamente
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="condicionantes" className="mt-6">
          <CondicionantesTab
            licencaId={licencaId}
            licenca={licenca}
            empreendimentoId={licenca.empreendimentoId}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <DocumentosTab licencaId={licencaId} />
        </TabsContent>

        <TabsContent value="cronograma" className="mt-6">
          <CronogramaTab licencaId={licencaId} />
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <HistoricoTab licencaId={licencaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
