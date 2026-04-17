import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date-utils";
import {
  Plus, Pencil, Trash2, FileText, Link2, Flag, CalendarDays,
  CheckCheck, Shield, Search, RotateCcw,
} from "lucide-react";
import type { LicencaAmbiental, Condicionante } from "@shared/schema";
import {
  STATUS_CONDICIONANTE, CATEGORIAS_CONDICIONANTE, TIPOS_CONDICIONANTE, PERIODICIDADES,
  condicionanteSchema, type CondicionanteFormData,
  calcularOcorrencias, diasParaVencer,
} from "./types";
import { PainelConformidade } from "./PainelConformidade";
import { EvidenciasPanel } from "./EvidenciasPanel";

// ─── Dialog: Criar Demanda vinculada ──────────────────────────────────────────

function CriarDemandaDialog({ condicionante, licenca, empreendimentoId }: {
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
      titulo: `${(condicionante as any).titulo || condicionante.descricao?.substring(0, 60)} - ${(condicionante as any).codigo || "COND"}`,
      descricao: `Condicionante: ${(condicionante as any).titulo || condicionante.descricao}\n\nRef: Licença ${licenca.numero}`,
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
    onError: () => toast({ title: "Erro ao criar demanda", variant: "destructive" }),
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

// ─── Dialog: Adicionar ao Cronograma ──────────────────────────────────────────

function AdicionarCronogramaDialog({ condicionante, licenca, empreendimentoId }: {
  condicionante: Condicionante;
  licenca: LicencaAmbiental;
  empreendimentoId: number;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      titulo: `${(condicionante as any).titulo || "Marco"} [${licenca.numero}]`,
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
        ...data, empreendimentoId, licencaId: licenca.id, condicionanteId: condicionante.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Marco adicionado ao cronograma" });
      setOpen(false);
    },
    onError: () => toast({ title: "Erro ao adicionar ao cronograma", variant: "destructive" }),
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

// ─── CondicionantesTab ────────────────────────────────────────────────────────

export function CondicionantesTab({ licencaId, licenca, empreendimentoId, empreendimento }: {
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

  const { data: colaboradores = [] } = useQuery<any[]>({ queryKey: ["/api/colaboradores"] });

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
      item: "", codigo: "", titulo: "", descricao: "", categoria: "",
      tipoCondicionante: "", responsavelNome: "", prazo: "", periodicidade: "",
      status: "pendente", progresso: 0, observacoes: "",
    },
  });

  const tipoCondWatch = form.watch("tipoCondicionante");
  const periodicidadeWatch = form.watch("periodicidade");
  const prazoWatch = form.watch("prazo");
  const ocorrenciasInfo = tipoCondWatch === "periodica"
    ? calcularOcorrencias(periodicidadeWatch ?? "", prazoWatch ?? "")
    : null;

  const AUTO_PRAZO_TIPOS = ["permanente", "conforme_necessidade"];
  useEffect(() => {
    if (AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "") && licenca?.validade) {
      form.setValue("prazo", licenca.validade, { shouldValidate: true, shouldDirty: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/condicionantes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
      toast({ title: "Condicionante excluída" });
      if (selectedCond?.id === deleteCond.variables) setSelectedCond(null);
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const recalcularProgresso = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/licencas/${licencaId}/condicionantes/recalcular`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
      toast({ title: "Progresso recalculado", description: `${data.recalculados} condicionante(s) atualizados.` });
    },
    onError: () => toast({ title: "Erro ao recalcular", variant: "destructive" }),
  });

  // Auto-recalculate on first load so manually-set values are corrected
  useEffect(() => {
    if (licencaId) {
      void apiRequest("POST", `/api/licencas/${licencaId}/condicionantes/recalcular`).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licencaId]);

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
    // progresso is auto-calculated server-side from evidências — never send manually
    const { progresso: _p, ...dataWithoutProgresso } = data;
    if (editingCond) updateCond.mutate(dataWithoutProgresso as CondicionanteFormData);
    else createCond.mutate(dataWithoutProgresso as CondicionanteFormData);
  };

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
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
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
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={recalcularProgresso.isPending}
            onClick={() => recalcularProgresso.mutate()}
            title="Recalcular progresso de todas as condicionantes com base nas evidências"
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${recalcularProgresso.isPending ? 'animate-spin' : ''}`} />
            Recalcular
          </Button>
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
                          <FormControl><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {TIPOS_CONDICIONANTE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione a periodicidade" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {PERIODICIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
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
                          <FormControl><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {CATEGORIAS_CONDICIONANTE.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <div />
                  </div>

                  <FormField control={form.control} name="responsavelNome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button type="button"
                            onClick={() => { setTipoResponsavel("empreendedor"); field.onChange(empreendimento?.cliente || empreendimento?.nome || ""); }}
                            className={`flex-1 text-xs py-2 px-3 rounded-md border font-medium transition-all ${tipoResponsavel === "empreendedor" ? "bg-[#00599C] text-white border-[#00599C]" : "bg-background text-muted-foreground border-border hover:border-[#00599C] hover:text-[#00599C]"}`}>
                            🏢 Empreendedor
                          </button>
                          <button type="button"
                            onClick={() => { setTipoResponsavel("ecobrasil"); field.onChange(""); }}
                            className={`flex-1 text-xs py-2 px-3 rounded-md border font-medium transition-all ${tipoResponsavel === "ecobrasil" ? "bg-[#1A7A45] text-white border-[#1A7A45]" : "bg-background text-muted-foreground border-border hover:border-[#1A7A45] hover:text-[#1A7A45]"}`}>
                            🌿 Ecobrasil
                          </button>
                        </div>
                        {tipoResponsavel === "empreendedor" && (
                          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2 text-sm">
                            <span className="text-blue-700 dark:text-blue-300 font-medium">{field.value || "(sem nome de cliente cadastrado)"}</span>
                          </div>
                        )}
                        {tipoResponsavel === "ecobrasil" && (
                          <Select onValueChange={(val) => field.onChange(val)} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Selecione o colaborador Ecobrasil" /></SelectTrigger>
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
                        {tipoResponsavel === "" && <Input {...field} placeholder="Selecione acima ou digite o nome" />}
                      </div>
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="prazo" render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>
                            {AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "") ? "Prazo (vencimento da licença)" : "Prazo *"}
                          </FormLabel>
                          {licenca.validade && !AUTO_PRAZO_TIPOS.includes(tipoCondWatch ?? "") && (
                            <button type="button" className="text-xs text-[#00599C] hover:underline flex items-center gap-0.5 font-medium"
                              onClick={() => form.setValue("prazo", licenca.validade, { shouldValidate: true, shouldDirty: true })}>
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
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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

      {/* Cards */}
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
              <div key={cond.id}
                className={`border rounded-xl transition-all duration-150 cursor-pointer hover:shadow-md ${
                  isSelected ? "border-primary shadow-sm bg-primary/5 dark:bg-primary/10"
                  : atrasado ? "border-red-200 bg-red-50/30 dark:border-red-800/40 dark:bg-red-900/10"
                  : "border-border bg-card hover:border-primary/40"
                }`}
                onClick={() => setSelectedCond(isSelected ? null : cond)}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Número sequencial */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {itemLabel}
                  </div>

                  {/* Conteúdo esquerdo */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {codigoLabel && (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-muted-foreground">{codigoLabel}</code>
                      )}
                      {titulo && <span className="font-semibold text-sm">{titulo}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{cond.descricao}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(cond as any).categoria && (
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{(cond as any).categoria}</span>
                      )}
                      {(cond as any).responsavelNome && (
                        <span className="text-xs text-muted-foreground">👤 {(cond as any).responsavelNome}</span>
                      )}
                    </div>
                  </div>

                  {/* Coluna direita */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2 min-w-[130px]">
                    <Badge className={`gap-1 text-xs ${st.color}`}>
                      {StatusIcon && <StatusIcon className="h-3 w-3" />}
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

                    {/* Badge evidências */}
                    {((cond as any).evidenciasCount ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        {(cond as any).evidenciasCount} doc{(cond as any).evidenciasCount !== 1 ? "s" : ""}
                      </Badge>
                    )}

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
                        onClick={() => { if (confirm("Excluir esta condicionante?")) deleteCond.mutate(cond.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Seção expandida */}
                {isSelected && (
                  <div className="border-t px-4 pt-3 pb-4 bg-muted/30 rounded-b-xl space-y-3">
                    <div className="bg-background/70 border rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Texto da Exigência</p>
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{cond.descricao}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Tipo</span>
                        <span className="font-medium">{TIPOS_CONDICIONANTE.find(t => t.value === (cond as any).tipoCondicionante)?.label || "-"}</span>
                        {(cond as any).tipoCondicionante === "periodica" && (cond as any).periodicidade && (
                          <span className="block text-muted-foreground italic">
                            {PERIODICIDADES.find(p => p.value === (cond as any).periodicidade)?.label}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Categoria</span>
                        <span className="font-medium">{(cond as any).categoria || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Responsável</span>
                        <span className="font-medium">{(cond as any).responsavelNome || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Prazo</span>
                        <span className="font-medium">{formatDate(cond.prazo)}</span>
                      </div>
                    </div>
                    {cond.observacoes && (
                      <p className="text-xs text-muted-foreground italic border-l-2 border-muted-foreground/30 pl-2">Obs: {cond.observacoes}</p>
                    )}
                    <div className="flex gap-2 pt-1" onClick={e => e.stopPropagation()}>
                      <CriarDemandaDialog condicionante={cond} licenca={licenca} empreendimentoId={empreendimentoId} />
                      <AdicionarCronogramaDialog condicionante={cond} licenca={licenca} empreendimentoId={empreendimentoId} />
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <EvidenciasPanel condicionanteId={cond.id} licencaId={licencaId} />
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
