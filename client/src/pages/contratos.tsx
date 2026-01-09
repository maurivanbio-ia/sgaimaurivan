"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, FileText, Loader2, DollarSign, Calendar, CheckCircle, AlertCircle, Clock, ExternalLink, Download } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/date-utils";

const contratoSchema = z.object({
  id: z.number().optional(),
  empreendimentoId: z.preprocess((v) => Number(v), z.number().min(1, "Empreendimento obrigatório")),
  numero: z.string().min(1, "Número obrigatório"),
  objeto: z.string().min(1, "Objeto obrigatório"),
  centroCusto: z.string().optional(),
  municipioUf: z.string().optional(),
  dataProposta: z.string().optional(),
  referencia: z.string().optional(),
  vigenciaInicio: z.string().min(1, "Data de início obrigatória"),
  vigenciaFim: z.string().min(1, "Data de término obrigatória"),
  situacao: z.string().default("vigente"),
  valorTotal: z.string().min(1, "Valor obrigatório"),
  condPagto: z.string().optional(),
  formaPagto: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  observacoes: z.string().optional(),
  contratadaRazao: z.string().optional(),
  contratadaCnpj: z.string().optional(),
  contratadaEndereco: z.string().optional(),
  contratanteRazao: z.string().optional(),
  contratanteCnpj: z.string().optional(),
  contratanteRepresentante: z.string().optional(),
});

type Contrato = z.infer<typeof contratoSchema> & { empreendimentoNome?: string; arquivoPdfId?: number };

const SITUACAO_OPTIONS = [
  { value: "vigente", label: "Vigente", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "vencido", label: "Vencido", color: "bg-red-100 text-red-800", icon: AlertCircle },
  { value: "suspenso", label: "Suspenso", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  { value: "encerrado", label: "Encerrado", color: "bg-gray-100 text-gray-800", icon: FileText },
];

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

export default function ContratosPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [situacaoFilter, setSituacaoFilter] = useState("all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contratoToDelete, setContratoToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (situacaoFilter !== "all") params.situacao = situacaoFilter;
    if (empreendimentoFilter !== "all") params.empreendimentoId = empreendimentoFilter;
    return params;
  }, [debouncedSearch, situacaoFilter, empreendimentoFilter]);

  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["/api/contratos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/contratos${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar contratos");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<{ id: number; nome: string }[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const form = useForm<Contrato>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      empreendimentoId: undefined,
      numero: "",
      objeto: "",
      centroCusto: "",
      municipioUf: "",
      dataProposta: "",
      referencia: "",
      vigenciaInicio: "",
      vigenciaFim: "",
      situacao: "vigente",
      valorTotal: "",
      condPagto: "",
      formaPagto: "",
      banco: "",
      agencia: "",
      conta: "",
      observacoes: "",
      contratadaRazao: "",
      contratadaCnpj: "",
      contratadaEndereco: "",
      contratanteRazao: "",
      contratanteCnpj: "",
      contratanteRepresentante: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Contrato) => apiRequest("POST", "/api/contratos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Sucesso", description: "Contrato cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar contrato",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Contrato }) =>
      apiRequest("PATCH", `/api/contratos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Sucesso", description: "Contrato atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingContrato(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar contrato",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/contratos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Sucesso", description: "Contrato excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setContratoToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir contrato",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Contrato) => {
    if (editingContrato?.id) {
      updateMutation.mutate({ id: editingContrato.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openCreateDialog = () => {
    setEditingContrato(null);
    form.reset({
      empreendimentoId: undefined,
      numero: "",
      objeto: "",
      centroCusto: "",
      municipioUf: "",
      dataProposta: "",
      referencia: "",
      vigenciaInicio: "",
      vigenciaFim: "",
      situacao: "vigente",
      valorTotal: "",
      condPagto: "",
      formaPagto: "",
      banco: "",
      agencia: "",
      conta: "",
      observacoes: "",
      contratadaRazao: "",
      contratadaCnpj: "",
      contratadaEndereco: "",
      contratanteRazao: "",
      contratanteCnpj: "",
      contratanteRepresentante: "",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (contrato: Contrato) => {
    setEditingContrato(contrato);
    form.reset({
      ...contrato,
      valorTotal: contrato.valorTotal || "",
    });
    setIsDialogOpen(true);
  };

  const getSituacaoBadge = (situacao: string) => {
    const option = SITUACAO_OPTIONS.find((opt) => opt.value === situacao);
    const Icon = option?.icon || FileText;
    return (
      <Badge className={`${option?.color || "bg-gray-100 text-gray-800"} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {option?.label || situacao}
      </Badge>
    );
  };

  const totalValor = contratos.reduce((sum, c) => sum + Number(c.valorTotal || 0), 0);
  const contratosVigentes = contratos.filter(c => c.situacao === 'vigente').length;
  const contratosVencidos = contratos.filter(c => c.situacao === 'vencido').length;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Gestão de Contratos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os contratos vinculados aos empreendimentos
          </p>
        </div>
        <div className="flex gap-2">
          <RefreshButton queryKey={["/api/contratos"]} />
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total de Contratos</p>
                <p className="text-2xl font-bold">{contratos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vigentes</p>
                <p className="text-2xl font-bold text-green-600">{contratosVigentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{contratosVencidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(totalValor)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número ou objeto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={situacaoFilter} onValueChange={setSituacaoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Situações</SelectItem>
                {SITUACAO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Empreendimentos</SelectItem>
                {empreendimentos.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id.toString()}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : contratos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum contrato encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">{contrato.numero}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={contrato.objeto}>
                      {contrato.objeto}
                    </TableCell>
                    <TableCell>
                      <Link href={`/empreendimentos/${contrato.empreendimentoId}`}>
                        <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                          {contrato.empreendimentoNome || `#${contrato.empreendimentoId}`}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{getSituacaoBadge(contrato.situacao)}</TableCell>
                    <TableCell>
                      <div className="text-sm flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(contrato.vigenciaInicio)} - {formatDate(contrato.vigenciaFim)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(contrato.valorTotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {contrato.arquivoPdfId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={`/api/arquivos/${contrato.arquivoPdfId}/download`} target="_blank">
                              <Download className="h-4 w-4 text-blue-500" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(contrato)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setContratoToDelete(contrato.id!);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContrato ? "Editar Contrato" : "Novo Contrato"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do contrato
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="empreendimentoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento *</FormLabel>
                      <Select
                        value={field.value?.toString() || ""}
                        onValueChange={(v) => field.onChange(parseInt(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {empreendimentos.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              {emp.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Contrato *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: CT-001/2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="objeto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objeto *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descrição do objeto do contrato..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="situacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situação</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SITUACAO_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vigenciaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início da Vigência *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vigenciaFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Término da Vigência *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valorTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total (R$) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0,00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="centroCusto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de Custo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: CC-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Dados do Contratante</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contratanteRazao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social</FormLabel>
                        <FormControl>
                          <Input placeholder="Razão social do contratante" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contratanteCnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Dados da Contratada</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contratadaRazao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social</FormLabel>
                        <FormControl>
                          <Input placeholder="Razão social da contratada" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contratadaCnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações adicionais..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingContrato ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => contratoToDelete && deleteMutation.mutate(contratoToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
