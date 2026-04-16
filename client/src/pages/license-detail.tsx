import { useState, useEffect } from "react";
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
  CheckCheck, TrendingDown, AlertCircle, Upload, Star, ExternalLink,
  ClipboardList, RefreshCcw
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
  { value: "permanente", label: "Permanente" },
  { value: "conforme_necessidade", label: "Conforme Necessidade" },
];

const PERIODICIDADES = [
  { value: "diario", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "bianual", label: "Bianual" },
];

const PERIODICIDADE_MESES: Record<string, number> = {
  diario: 0,
  semanal: 0,
  quinzenal: 0,
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
  bianual: 24,
};

const PERIODICIDADE_DIAS: Record<string, number> = {
  diario: 1,
  semanal: 7,
  quinzenal: 15,
};

function calcularOcorrencias(periodicidade: string, prazo: string): { total: number; label: string } | null {
  if (!periodicidade || !prazo) return null;
  const hoje = new Date();
  const fim = new Date(prazo);
  if (isNaN(fim.getTime()) || fim <= hoje) return null;

  let total = 0;
  const diasLabel = PERIODICIDADE_DIAS[periodicidade];
  const mesesLabel = PERIODICIDADE_MESES[periodicidade];

  if (diasLabel) {
    const diffDias = Math.floor((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    total = Math.floor(diffDias / diasLabel);
  } else if (mesesLabel) {
    const mesesTotal =
      (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth());
    total = Math.floor(mesesTotal / mesesLabel);
  }

  if (total <= 0) return null;
  const freq = PERIODICIDADES.find(p => p.value === periodicidade)?.label ?? periodicidade;
  return { total, label: `${total} ocorrência${total !== 1 ? "s" : ""} ${freq.toLowerCase()}${total !== 1 ? "s" : ""}` };
}

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
  periodicidade: z.string().optional(),
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
  const lower = path.toLowerCase();
  return lower.startsWith("/files/") || lower.startsWith("object:") || lower.startsWith("http");
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
  if (status === "em_renovacao") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

function getLicencaStatusLabel(status: string) {
  if (status === "ativa") return "Ativa";
  if (status === "a_vencer") return "A Vencer";
  if (status === "em_renovacao") return "Em Renovação";
  if (status === "vencida") return "Vencida";
  if (status === "cancelada") return "Cancelada";
  return status;
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

function CondicionantesTab({ licencaId, licenca, empreendimentoId, empreendimento }: {
  licencaId: number;
  licenca: LicencaAmbiental;
  empreendimentoId: number;
  empreendimento?: any;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCond, setEditingCond] = useState<Condicionante | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [selectedCond, setSelectedCond] = useState<Condicionante | null>(null);
  const [tipoResponsavel, setTipoResponsavel] = useState<"" | "empreendedor" | "ecobrasil">("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: colaboradores = [] } = useQuery<any[]>({
    queryKey: ["/api/colaboradores"],
  });

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
      periodicidade: "",
      status: "pendente",
      progresso: 0,
      observacoes: "",
    },
  });

  const progressoValue = form.watch("progresso") ?? 0;
  const tipoCondWatch = form.watch("tipoCondicionante");
  const periodicidadeWatch = form.watch("periodicidade");
  const prazoWatch = form.watch("prazo");
  const ocorrenciasInfo = tipoCondWatch === "periodica"
    ? calcularOcorrencias(periodicidadeWatch ?? "", prazoWatch ?? "")
    : null;

  // Auto-preenche prazo com vencimento da licença para tipos sem data fixa
  const AUTO_PRAZO_TIPOS = ["permanente", "conforme_necessidade"];
  useEffect(() => {
    if (AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "") && licenca?.validade) {
      form.setValue("prazo", licenca.validade, { shouldValidate: true, shouldDirty: true });
    }
  }, [tipoCondWatch]);

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
    const respNome = (cond as any).responsavelNome || "";
    const isEmpreendedor = empreendimento?.cliente && respNome === empreendimento.cliente;
    setTipoResponsavel(isEmpreendedor ? "empreendedor" : respNome ? "ecobrasil" : "");
    form.reset({
      item: (cond as any).item || "",
      codigo: (cond as any).codigo || "",
      titulo: (cond as any).titulo || "",
      descricao: cond.descricao,
      categoria: (cond as any).categoria || "",
      tipoCondicionante: (cond as any).tipoCondicionante || "",
      responsavelNome: respNome,
      prazo: cond.prazo,
      periodicidade: (cond as any).periodicidade || "",
      status: cond.status,
      progresso: (cond as any).progresso ?? 0,
      observacoes: cond.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingCond(null);
    setTipoResponsavel("");
    form.reset({
      item: "", codigo: "", titulo: "", descricao: "", categoria: "",
      tipoCondicionante: "", responsavelNome: "", prazo: "", periodicidade: "",
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
                  {tipoCondWatch === "periodica" && (
                    <>
                      <FormField control={form.control} name="periodicidade" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Periodicidade</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Selecione a periodicidade" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PERIODICIDADES.map(p => (
                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      {ocorrenciasInfo && (
                        <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
                          <span className="text-lg">🔄</span>
                          <span className="text-blue-700 dark:text-blue-300 font-medium">
                            Previsão: <strong>{ocorrenciasInfo.label}</strong> até o prazo definido
                          </span>
                        </div>
                      )}
                    </>
                  )}
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
                    <div /> {/* spacer para manter grid alinhado */}
                  </div>
                  <FormField control={form.control} name="responsavelNome" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <div className="space-y-2">
                          {/* Seletor de tipo */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTipoResponsavel("empreendedor");
                                const nome = empreendimento?.cliente || empreendimento?.nome || "";
                                field.onChange(nome);
                              }}
                              className={`flex-1 text-xs py-2 px-3 rounded-md border font-medium transition-all ${
                                tipoResponsavel === "empreendedor"
                                  ? "bg-[#00599C] text-white border-[#00599C]"
                                  : "bg-background text-muted-foreground border-border hover:border-[#00599C] hover:text-[#00599C]"
                              }`}
                            >
                              🏢 Empreendedor
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTipoResponsavel("ecobrasil");
                                field.onChange("");
                              }}
                              className={`flex-1 text-xs py-2 px-3 rounded-md border font-medium transition-all ${
                                tipoResponsavel === "ecobrasil"
                                  ? "bg-[#1A7A45] text-white border-[#1A7A45]"
                                  : "bg-background text-muted-foreground border-border hover:border-[#1A7A45] hover:text-[#1A7A45]"
                              }`}
                            >
                              🌿 Ecobrasil
                            </button>
                          </div>

                          {/* Empreendedor: mostra nome auto-preenchido */}
                          {tipoResponsavel === "empreendedor" && (
                            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-sm">
                              <span className="text-blue-700 dark:text-blue-300 font-medium">
                                {field.value || "(sem nome de cliente cadastrado)"}
                              </span>
                            </div>
                          )}

                          {/* Ecobrasil: mostra select de usuários */}
                          {tipoResponsavel === "ecobrasil" && (
                            <Select
                              onValueChange={(val) => field.onChange(val)}
                              value={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o colaborador Ecobrasil" />
                              </SelectTrigger>
                              <SelectContent>
                                {colaboradores.map((col: any) => (
                                  <SelectItem key={col.id} value={col.nome || col.email}>
                                    <span className="flex flex-col">
                                      <span>{col.nome || col.email}</span>
                                      {col.cargo && <span className="text-xs text-muted-foreground">{col.cargo}</span>}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Nenhum selecionado: campo livre */}
                          {tipoResponsavel === "" && (
                            <Input {...field} placeholder="Selecione acima ou digite o nome" />
                          )}
                        </div>
                      </FormItem>
                    )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="prazo" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>
                            {AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "")
                              ? "Prazo (vencimento da licença)"
                              : "Prazo *"}
                          </FormLabel>
                          {licenca.validade && !AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "") && (
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
                        {AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "") && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <CalendarDays className="h-3 w-3" />
                            Preenchido automaticamente com o vencimento da licença. Ajuste se necessário.
                          </p>
                        )}
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
                        {(cond as any).tipoCondicionante === "periodica" && (cond as any).periodicidade && (() => {
                          const ocorr = calcularOcorrencias((cond as any).periodicidade, cond.prazo ?? "");
                          return (
                            <>
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium block mt-0.5">
                                {PERIODICIDADES.find(p => p.value === (cond as any).periodicidade)?.label || (cond as any).periodicidade}
                              </span>
                              {ocorr && (
                                <span className="text-[10px] text-blue-500 dark:text-blue-500 block">
                                  🔄 {ocorr.total} ocorr. previstas
                                </span>
                              )}
                            </>
                          );
                        })()}
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
  const [uploadedFilePath, setUploadedFilePath] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
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
      setUploadedFilePath("");
      setUploadedFileName("");
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
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setUploadedFilePath(""); setUploadedFileName(""); form.reset(); } }}>
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
              <form onSubmit={form.handleSubmit(d => createEv.mutate({ ...d, url: uploadedFilePath || d.url }))} className="space-y-3">
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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Arquivo <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  {uploadedFilePath ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-md border bg-green-50 text-green-800 text-sm">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{uploadedFileName || "Arquivo enviado"}</span>
                      <button type="button" onClick={() => { setUploadedFilePath(""); setUploadedFileName(""); }} className="text-green-600 hover:text-red-600 transition-colors ml-1 shrink-0" title="Remover arquivo">✕</button>
                    </div>
                  ) : (
                    <ObjectUploader
                      accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                      onGetUploadParameters={async () => {
                        const res = await apiRequest("POST", "/api/upload/pdf");
                        const data = await res.json();
                        return { method: "PUT" as const, url: data.url, filePath: data.filePath };
                      }}
                      onComplete={({ filePath, fileName }) => {
                        setUploadedFilePath(filePath || "");
                        setUploadedFileName(fileName || "Arquivo enviado");
                      }}
                    />
                  )}
                </div>
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

// ─── Tab: Ciclo de Vida da Licença ────────────────────────────────────────────

const VINCULO_EVENTO: Record<string, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
  requerimento:   { label: "Requerimento de Renovação",  icon: "📋", color: "text-blue-700",   bgColor: "bg-blue-50",   borderColor: "border-blue-300" },
  protocolo:      { label: "Protocolo",                  icon: "📮", color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-300" },
  notificacao:    { label: "Notificação Recebida",       icon: "📬", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-300" },
  resposta:       { label: "Resposta / Ofício",          icon: "📩", color: "text-green-700",  bgColor: "bg-green-50",  borderColor: "border-green-300" },
  renovacao:      { label: "Nova Licença Emitida",       icon: "✅", color: "text-teal-700",   bgColor: "bg-teal-50",   borderColor: "border-teal-300" },
  complementacao: { label: "Complementação",             icon: "➕", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-300" },
  recurso:        { label: "Recurso",                    icon: "⚖️", color: "text-red-700",    bgColor: "bg-red-50",    borderColor: "border-red-300" },
  outro:          { label: "Documento Vinculado",        icon: "📄", color: "text-gray-700",   bgColor: "bg-gray-50",   borderColor: "border-gray-300" },
};

function CicloVidaTab({ licenca, licencaId }: { licenca: any; licencaId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: docsGestao = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/licencas", licencaId, "documentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/documentos`);
      return res.json();
    },
  });

  // Auto-sincronizar status: se há documento de requerimento vinculado e a licença está vencida → marcar como em_renovacao
  const syncStatusMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/licencas/${licencaId}`, { status: "em_renovacao" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/licencas"] });
      toast({
        title: "Status sincronizado automaticamente",
        description: "Licença marcada como Em Renovação pois possui requerimento vinculado.",
      });
    },
  });

  // Dispara a sincronização quando detecta requerimento + status vencida
  useEffect(() => {
    if (docsGestao.length === 0) return;
    const temRequerimento = docsGestao.some((d: any) => d.licencaVinculoTipo === "requerimento");
    if (temRequerimento && licenca.status === "vencida" && !syncStatusMutation.isPending && !syncStatusMutation.isSuccess) {
      syncStatusMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsGestao, licenca.status]);

  // Construir eventos cronológicos
  const eventos: Array<{ date: string | null; label: string; icon: string; color: string; bgColor: string; borderColor: string; doc?: any; type: "emissao" | "doc" | "validade" | "status" }> = [];

  // 1) Emissão da licença
  eventos.push({
    date: licenca.dataEmissao || null,
    label: `Licença ${licenca.numero} emitida`,
    icon: "🛡️",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    type: "emissao",
  });

  // 2) Documentos vinculados em ordem cronológica
  const docsOrdenados = [...docsGestao].sort((a, b) => {
    const da = a.dataEmissao || a.dataUpload || "";
    const db2 = b.dataEmissao || b.dataUpload || "";
    return da.localeCompare(db2);
  });

  for (const doc of docsOrdenados) {
    const ev = VINCULO_EVENTO[doc.licencaVinculoTipo || "outro"] || VINCULO_EVENTO["outro"];
    eventos.push({
      date: doc.dataEmissao || doc.dataUpload || null,
      label: ev.label,
      icon: ev.icon,
      color: ev.color,
      bgColor: ev.bgColor,
      borderColor: ev.borderColor,
      doc,
      type: "doc",
    });
  }

  // 3) Status atual da licença (no final)
  const statusAtual = licenca.status;
  if (statusAtual === "em_renovacao") {
    eventos.push({
      date: null,
      label: "Em Processo de Renovação",
      icon: "⏳",
      color: "text-blue-700",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-400",
      type: "status",
    });
  } else if (statusAtual === "vencida") {
    eventos.push({
      date: licenca.validade || null,
      label: "Licença Vencida",
      icon: "🔴",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-400",
      type: "validade",
    });
  } else if (statusAtual === "cancelada") {
    eventos.push({
      date: null,
      label: "Licença Cancelada",
      icon: "❌",
      color: "text-gray-700",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-400",
      type: "status",
    });
  } else {
    // vigente — mostra validade futura
    eventos.push({
      date: licenca.validade || null,
      label: "Validade da Licença",
      icon: "📅",
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      borderColor: "border-gray-300",
      type: "validade",
    });
  }

  function formatEvDate(d: string | null) {
    if (!d) return "Data não informada";
    try {
      const [y, m, day] = d.split("T")[0].split("-");
      return `${day}/${m}/${y}`;
    } catch { return d; }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div>
        <h3 className="font-semibold text-base">Ciclo de Vida — {licenca.numero}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Linha do tempo de eventos e documentos vinculados a esta licença, em ordem cronológica.
        </p>
      </div>

      {/* Indicador de status atual */}
      {licenca.status === "em_renovacao" && (
        <div className="flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
          <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
          Licença em processo de renovação
        </div>
      )}

      {/* Aviso informativo sobre fluxo automático */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <ClipboardList className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          O status desta licença é atualizado <strong>automaticamente</strong> ao cadastrar documentos vinculados em{" "}
          <strong>Gestão de Dados</strong>. Para registrar um requerimento de renovação, acesse Gestão de Dados,
          faça upload do protocolo e selecione esta licença com o tipo de relação{" "}
          <em>Requerimento</em>.
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <Clock className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="relative">
          {/* Linha vertical central */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-300 via-blue-200 to-gray-200" />

          <div className="space-y-0">
            {eventos.map((ev, idx) => (
              <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Bolinha na linha */}
                <div className={`relative z-10 flex-shrink-0 h-12 w-12 rounded-full ${ev.bgColor} border-2 ${ev.borderColor} flex items-center justify-center text-xl shadow-sm`}>
                  {ev.icon}
                </div>

                {/* Conteúdo do evento */}
                <div className={`flex-1 rounded-lg border ${ev.borderColor} ${ev.bgColor} p-3 shadow-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${ev.color}`}>{ev.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatEvDate(ev.date)}</p>

                      {/* Detalhes do documento vinculado */}
                      {ev.doc && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {ev.doc.titulo || ev.doc.codigoArquivo || ev.doc.nome}
                          </p>
                          {ev.doc.numeroDocumento && (
                            <p className="text-xs text-muted-foreground">Nº {ev.doc.numeroDocumento}</p>
                          )}
                          {ev.doc.orgaoEmissor && (
                            <p className="text-xs text-muted-foreground">🏛 {ev.doc.orgaoEmissor}</p>
                          )}
                          {ev.doc.statusDocumental && (
                            <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs bg-white border border-gray-200 text-gray-600">
                              {ev.doc.statusDocumental}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Para eventos de validade */}
                      {ev.type === "validade" && licenca.validade && (
                        <p className="text-xs mt-1">
                          {new Date(licenca.validade + "T00:00:00") > new Date()
                            ? <span className="text-green-700">Ainda vigente</span>
                            : <span className="text-red-600 font-medium">⚠ Vencida</span>
                          }
                        </p>
                      )}
                    </div>

                    {/* Tipo badge */}
                    {ev.type === "doc" && ev.doc?.licencaVinculoTipo && (
                      <span className={`flex-shrink-0 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${ev.bgColor} ${ev.color} ${ev.borderColor}`}>
                        {VINCULO_EVENTO[ev.doc.licencaVinculoTipo]?.label || "Documento"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docsGestao.length === 0 && !isLoading && (
        <div className="border rounded-lg p-6 text-center text-muted-foreground bg-muted/20 mt-4">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhum evento registrado</p>
          <p className="text-xs mt-1 opacity-70">Vincule documentos da Gestão de Dados a esta licença para construir o ciclo de vida.</p>
          <a href="/gestao-dados" className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> Abrir Gestão de Dados
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Documentos e Evidências ─────────────────────────────────────────────

const LICENCA_VINCULO_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  requerimento:    { label: "Requerimento",     icon: "📋", color: "bg-blue-100 text-blue-800 border-blue-200" },
  protocolo:       { label: "Protocolo",         icon: "📮", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  notificacao:     { label: "Notificação",       icon: "📬", color: "bg-orange-100 text-orange-800 border-orange-200" },
  resposta:        { label: "Resposta/Ofício",   icon: "📩", color: "bg-green-100 text-green-800 border-green-200" },
  renovacao:       { label: "Renovação",         icon: "🔄", color: "bg-teal-100 text-teal-800 border-teal-200" },
  complementacao:  { label: "Complementação",    icon: "➕", color: "bg-purple-100 text-purple-800 border-purple-200" },
  recurso:         { label: "Recurso",           icon: "⚖️", color: "bg-red-100 text-red-800 border-red-200" },
  outro:           { label: "Outro",             icon: "📄", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

function DocumentosTab({ licencaId }: { licencaId: number }) {
  const { data: condicionantes = [] } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licencaId, "condicionantes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/condicionantes`);
      return res.json();
    },
  });

  const { data: docsGestao = [], isLoading: loadingDocs } = useQuery<any[]>({
    queryKey: ["/api/licencas", licencaId, "documentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licencaId}/documentos`);
      return res.json();
    },
  });

  return (
    <div className="space-y-6">

      {/* ── Documentos da Gestão de Dados ────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-1 rounded-full bg-green-600" />
          <h3 className="font-semibold text-sm">Documentos da Gestão de Dados</h3>
          <Badge variant="secondary" className="text-xs">{docsGestao.length}</Badge>
          <a href="/gestao-dados" className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Abrir Gestão de Dados
          </a>
        </div>
        {loadingDocs ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
        ) : docsGestao.length === 0 ? (
          <div className="border rounded-lg p-6 text-center text-muted-foreground bg-muted/20">
            <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum documento da Gestão de Dados vinculado a esta licença.</p>
            <p className="text-xs mt-1 opacity-70">No módulo Gestão de Dados, edite um documento e vincule-o a esta licença.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Documento</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo de Relação</th>
                  <th className="px-3 py-2 text-left font-medium">Órgão</th>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {docsGestao.map((doc: any, idx: number) => {
                  const vinculo = LICENCA_VINCULO_LABELS[doc.licencaVinculoTipo] || LICENCA_VINCULO_LABELS["outro"];
                  return (
                    <tr key={doc.id} className={`border-b last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-xs leading-tight">{doc.titulo || doc.codigoArquivo || doc.nome}</p>
                        {doc.numeroDocumento && <p className="text-muted-foreground text-xs">Nº {doc.numeroDocumento}</p>}
                      </td>
                      <td className="px-3 py-2">
                        {doc.licencaVinculoTipo ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${vinculo.color}`}>
                            {vinculo.icon} {vinculo.label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{doc.orgaoEmissor || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {doc.dataEmissao
                          ? new Intl.DateTimeFormat("pt-BR").format(new Date(doc.dataEmissao + "T12:00:00"))
                          : doc.dataUpload
                            ? new Intl.DateTimeFormat("pt-BR").format(new Date(doc.dataUpload))
                            : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          {doc.statusDocumental || doc.status || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Evidências por Condicionante ─────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-1 rounded-full bg-blue-600" />
          <h3 className="font-semibold text-sm">Evidências por Condicionante</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
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
                {getLicencaStatusLabel(licencaStatus)}
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

      {/* Banner Em Renovação */}
      {licenca.status === "em_renovacao" && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700 p-4">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <History className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm">Processo de Renovação em Andamento</p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
              Um requerimento de renovação foi protocolado para esta licença. Consulte a aba <strong>Ciclo de Vida</strong> para ver o documento vinculado.
            </p>
          </div>
          <button
            className="text-xs text-blue-600 dark:text-blue-400 underline flex-shrink-0 hover:text-blue-800"
            onClick={() => {
              const tab = document.querySelector('[data-state][value="ciclovida"]') as HTMLElement;
              if (tab) tab.click();
            }}
          >
            Ver detalhes →
          </button>
        </div>
      )}

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
          <TabsTrigger value="ciclovida" className="flex-shrink-0 whitespace-nowrap gap-1.5">
            <History className="h-4 w-4" />
            Ciclo de Vida
            {licenca.status === "em_renovacao" && (
              <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
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
            empreendimento={empreendimento}
          />
        </TabsContent>

        <TabsContent value="documentos" className="mt-6">
          <DocumentosTab licencaId={licencaId} />
        </TabsContent>

        <TabsContent value="ciclovida" className="mt-6">
          <CicloVidaTab licenca={licenca} licencaId={licencaId} />
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
