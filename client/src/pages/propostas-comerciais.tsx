import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, FileText, Loader2, Users, TrendingUp, MessageSquare, Pencil, Phone, Mail, Building } from "lucide-react";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RefreshButton } from "@/components/RefreshButton";
import { DateInput } from "@/components/DateInput";
import type { PropostaComercial } from "@shared/schema";

const propostaSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  clienteNome: z.string().min(1, "Nome do cliente é obrigatório"),
  clienteEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  clienteTelefone: z.string().optional(),
  valorPrevisto: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? 0 : Number(v)),
    z.number().min(0.01, "Valor deve ser maior que zero")
  ),
  status: z.string().min(1, "Status é obrigatório"),
  dataElaboracao: z.date({ required_error: "Data de elaboração é obrigatória" }),
  dataEnvio: z.date().optional().nullable(),
  dataAprovacao: z.date().optional().nullable(),
  dataValidade: z.date().optional().nullable(),
  observacoes: z.string().optional(),
});

type PropostaFormData = z.infer<typeof propostaSchema>;

const STATUS_OPTIONS = [
  { value: "elaboracao", label: "Em Elaboração", color: "bg-gray-500" },
  { value: "enviado", label: "Enviado", color: "bg-blue-500" },
  { value: "aprovado", label: "Aprovado", color: "bg-green-500" },
  { value: "recusado", label: "Recusado", color: "bg-red-500" },
  { value: "em_execucao", label: "Em Execução", color: "bg-purple-500" },
  { value: "concluido", label: "Concluído", color: "bg-emerald-500" },
  { value: "cancelado", label: "Cancelado", color: "bg-orange-500" },
];

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "R$ 0,00";
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

function parseServerDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0);
}

function formatServerDate(dateStr: string | null | undefined): string {
  const date = parseServerDate(dateStr);
  if (!date) return "-";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function formatDateLocal(date: Date | null | undefined): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusBadge(status: string) {
  const statusConfig = STATUS_OPTIONS.find((s) => s.value === status);
  if (!statusConfig) return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge className={`${statusConfig.color} text-white`}>
      {statusConfig.label}
    </Badge>
  );
}

export default function PropostasComerciais() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProposta, setEditingProposta] = useState<PropostaComercial | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propostaToDelete, setPropostaToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    return params;
  }, [debouncedSearch, statusFilter]);

  const { data: propostas = [], isLoading } = useQuery<PropostaComercial[]>({
    queryKey: ["/api/propostas-comerciais", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/propostas-comerciais${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar propostas");
      return res.json();
    },
  });

  const form = useForm<PropostaFormData>({
    resolver: zodResolver(propostaSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      clienteNome: "",
      clienteEmail: "",
      clienteTelefone: "",
      valorPrevisto: 0,
      status: "elaboracao",
      dataElaboracao: new Date(),
      dataEnvio: null,
      dataAprovacao: null,
      dataValidade: null,
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PropostaFormData) => {
      const payload = {
        ...data,
        clienteEmail: data.clienteEmail || null,
        dataElaboracao: formatDateLocal(data.dataElaboracao),
        dataEnvio: formatDateLocal(data.dataEnvio),
        dataAprovacao: formatDateLocal(data.dataAprovacao),
        dataValidade: formatDateLocal(data.dataValidade),
      };
      return apiRequest("POST", "/api/propostas-comerciais", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/propostas-comerciais"] });
      toast({ title: "Sucesso", description: "Proposta criada com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao criar proposta",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PropostaFormData }) => {
      const payload = {
        ...data,
        clienteEmail: data.clienteEmail || null,
        dataElaboracao: formatDateLocal(data.dataElaboracao),
        dataEnvio: formatDateLocal(data.dataEnvio),
        dataAprovacao: formatDateLocal(data.dataAprovacao),
        dataValidade: formatDateLocal(data.dataValidade),
      };
      return apiRequest("PUT", `/api/propostas-comerciais/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/propostas-comerciais"] });
      toast({ title: "Sucesso", description: "Proposta atualizada!" });
      setIsDialogOpen(false);
      setEditingProposta(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar proposta",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/propostas-comerciais/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/propostas-comerciais"] });
      toast({ title: "Sucesso", description: "Proposta removida!" });
      setDeleteDialogOpen(false);
      setPropostaToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir proposta",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingProposta(null);
    form.reset({
      titulo: "",
      descricao: "",
      clienteNome: "",
      clienteEmail: "",
      clienteTelefone: "",
      valorPrevisto: 0,
      status: "elaboracao",
      dataElaboracao: new Date(),
      dataEnvio: null,
      dataAprovacao: null,
      dataValidade: null,
      observacoes: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (proposta: PropostaComercial) => {
    setEditingProposta(proposta);
    form.reset({
      id: proposta.id,
      titulo: proposta.titulo,
      descricao: proposta.descricao || "",
      clienteNome: proposta.clienteNome,
      clienteEmail: proposta.clienteEmail || "",
      clienteTelefone: proposta.clienteTelefone || "",
      valorPrevisto: parseFloat(proposta.valorPrevisto) || 0,
      status: proposta.status,
      dataElaboracao: parseServerDate(proposta.dataElaboracao) || new Date(),
      dataEnvio: parseServerDate(proposta.dataEnvio),
      dataAprovacao: parseServerDate(proposta.dataAprovacao),
      dataValidade: parseServerDate(proposta.dataValidade),
      observacoes: proposta.observacoes || "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (id: number) => {
    setPropostaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const onSubmit = (data: PropostaFormData) => {
    if (editingProposta) {
      updateMutation.mutate({ id: editingProposta.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <SensitivePageWrapper moduleName="Propostas Comerciais">
    <div className="container mx-auto p-6 space-y-6">
      <Tabs defaultValue="propostas">
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-4">
          <TabsTrigger value="propostas" className="gap-2"><FileText className="h-4 w-4" />Propostas</TabsTrigger>
          <TabsTrigger value="leads" className="gap-2"><TrendingUp className="h-4 w-4" />Leads / CRM</TabsTrigger>
          <TabsTrigger value="relacionamento" className="gap-2"><MessageSquare className="h-4 w-4" />Relacionamento</TabsTrigger>
        </TabsList>

        <TabsContent value="propostas">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Propostas Comerciais
          </CardTitle>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Proposta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : propostas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma proposta encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostas.map((proposta) => (
                    <TableRow key={proposta.id}>
                      <TableCell className="font-medium">{proposta.titulo}</TableCell>
                      <TableCell>{proposta.clienteNome}</TableCell>
                      <TableCell>{formatCurrency(proposta.valorPrevisto)}</TableCell>
                      <TableCell>{getStatusBadge(proposta.status)}</TableCell>
                      <TableCell>{formatServerDate(proposta.dataElaboracao)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(proposta)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDelete(proposta.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProposta ? "Editar Proposta" : "Nova Proposta Comercial"}
            </DialogTitle>
            <DialogDescription>
              {editingProposta
                ? "Atualize os dados da proposta comercial."
                : "Preencha os dados para criar uma nova proposta."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input placeholder="Título da proposta" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clienteNome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Cliente *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clienteEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do Cliente</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="clienteTelefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone do Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valorPrevisto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Previsto (R$) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
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
                  name="dataElaboracao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Elaboração *</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataEnvio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Envio</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataAprovacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Aprovação</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataValidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Validade</FormLabel>
                      <FormControl>
                        <DateInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição da proposta"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observações adicionais"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingProposta ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta proposta comercial? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => propostaToDelete && deleteMutation.mutate(propostaToDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>

        {/* Leads / CRM Tab */}
        <TabsContent value="leads">
          <LeadsSection />
        </TabsContent>

        {/* Relacionamento Tab */}
        <TabsContent value="relacionamento">
          <RelacionamentoSection />
        </TabsContent>
      </Tabs>
    </div>
    </SensitivePageWrapper>
  );
}

// ─── LEADS / CRM ─────────────────────────────────────────────────────────────
const STATUS_LEAD_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-800",
  contatado: "bg-yellow-100 text-yellow-800",
  proposta_enviada: "bg-orange-100 text-orange-800",
  negociando: "bg-purple-100 text-purple-800",
  ganho: "bg-green-100 text-green-800",
  perdido: "bg-red-100 text-red-800",
};

function LeadsSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ nome: "", empresa: "", email: "", telefone: "", origem: "indicacao", status: "novo", interesse: "", valorEstimado: "", probabilidade: 50, responsavel: "", proximaAcao: "", dataProximaAcao: "", observacoes: "" });

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/leads"],
    queryFn: () => fetch("/api/leads").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? fetch(`/api/leads/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json())
              : fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/leads"] }); setOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/leads"] }),
  });

  function openNew() { setEditing(null); setForm({ nome: "", empresa: "", email: "", telefone: "", origem: "indicacao", status: "novo", interesse: "", valorEstimado: "", probabilidade: 50, responsavel: "", proximaAcao: "", dataProximaAcao: "", observacoes: "" }); setOpen(true); }
  function openEdit(item: any) { setEditing(item); setForm({ nome: item.nome, empresa: item.empresa || "", email: item.email || "", telefone: item.telefone || "", origem: item.origem || "indicacao", status: item.status || "novo", interesse: item.interesse || "", valorEstimado: item.valorEstimado || "", probabilidade: item.probabilidade || 50, responsavel: item.responsavel || "", proximaAcao: item.proximaAcao || "", dataProximaAcao: item.dataProximaAcao || "", observacoes: item.observacoes || "" }); setOpen(true); }

  const byStatus = items.reduce((acc: Record<string, number>, i: any) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[["novo","Novos"],["contatado","Contatados"],["negociando","Negociando"],["proposta_enviada","Proposta"],["ganho","Ganhos"],["perdido","Perdidos"]].map(([s, l]) => (
          <div key={s} className={`rounded-lg p-3 text-center border ${STATUS_LEAD_COLORS[s]?.replace("text", "border") || ""}`}>
            <p className="text-xl font-bold">{byStatus[s] || 0}</p>
            <p className="text-xs">{l}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-5 w-5" />Pipeline de Leads</CardTitle>
          <Button size="sm" onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Novo Lead</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nenhum lead cadastrado</p></div>
          ) : (
            <div className="space-y-2">
              {items.map((item: any) => (
                <div key={item.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.nome}</span>
                      {item.empresa && <span className="text-xs text-muted-foreground flex items-center gap-1"><Building className="h-3 w-3" />{item.empresa}</span>}
                      <Badge className={`text-xs ${STATUS_LEAD_COLORS[item.status] || ""}`}>{item.status?.replace("_", " ")}</Badge>
                      {item.probabilidade && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.probabilidade}%</span>}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {item.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.email}</span>}
                      {item.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.telefone}</span>}
                      {item.valorEstimado && <span>Est.: R$ {item.valorEstimado}</span>}
                    </div>
                    {item.proximaAcao && <p className="text-xs text-muted-foreground mt-1 italic">→ {item.proximaAcao}{item.dataProximaAcao ? ` (${item.dataProximaAcao})` : ""}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover lead?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Lead" : "Novo Lead"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Nome *</Label><Input value={form.nome} onChange={(e: any) => setForm((f: any) => ({ ...f, nome: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Empresa</Label><Input value={form.empresa} onChange={(e: any) => setForm((f: any) => ({ ...f, empresa: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e: any) => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={form.telefone} onChange={(e: any) => setForm((f: any) => ({ ...f, telefone: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Origem</Label>
              <Select value={form.origem} onValueChange={(v: string) => setForm((f: any) => ({ ...f, origem: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["indicacao","site","linkedin","evento","email","outro"].map(o => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v: string) => setForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[["novo","Novo"],["contatado","Contatado"],["proposta_enviada","Proposta Enviada"],["negociando","Negociando"],["ganho","Ganho"],["perdido","Perdido"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Interesse</Label><Input value={form.interesse} onChange={(e: any) => setForm((f: any) => ({ ...f, interesse: e.target.value }))} placeholder="Ex: Licenciamento Ambiental" /></div>
            <div className="space-y-1"><Label>Valor Estimado (R$)</Label><Input value={form.valorEstimado} onChange={(e: any) => setForm((f: any) => ({ ...f, valorEstimado: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Probabilidade (%)</Label><Input type="number" min={0} max={100} value={form.probabilidade} onChange={(e: any) => setForm((f: any) => ({ ...f, probabilidade: parseInt(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Responsável</Label><Input value={form.responsavel} onChange={(e: any) => setForm((f: any) => ({ ...f, responsavel: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Data Próxima Ação</Label><Input type="date" value={form.dataProximaAcao} onChange={(e: any) => setForm((f: any) => ({ ...f, dataProximaAcao: e.target.value }))} /></div>
          </div>
          <div className="space-y-1"><Label>Próxima Ação</Label><Input value={form.proximaAcao} onChange={(e: any) => setForm((f: any) => ({ ...f, proximaAcao: e.target.value }))} /></div>
          <div className="space-y-1"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e: any) => setForm((f: any) => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
          <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate(form)} disabled={!form.nome || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></div>
        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── RELACIONAMENTO ───────────────────────────────────────────────────────────
function RelacionamentoSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ clienteNome: "", empresa: "", tipo: "reuniao", assunto: "", descricao: "", data: "", resultado: "", proximaAcao: "", responsavel: "" });

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/relacionamentos-cliente"],
    queryFn: () => fetch("/api/relacionamentos-cliente").then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? fetch(`/api/relacionamentos-cliente/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json())
              : fetch("/api/relacionamentos-cliente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/relacionamentos-cliente"] }); setOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/relacionamentos-cliente/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/relacionamentos-cliente"] }),
  });

  const TIPO_ICONS: Record<string, string> = { reuniao: "🤝", ligacao: "📞", email: "📧", visita: "🏢", proposta: "📋", outro: "💬" };

  function openNew() { setEditing(null); setForm({ clienteNome: "", empresa: "", tipo: "reuniao", assunto: "", descricao: "", data: "", resultado: "", proximaAcao: "", responsavel: "" }); setOpen(true); }
  function openEdit(item: any) { setEditing(item); setForm({ clienteNome: item.clienteNome, empresa: item.empresa || "", tipo: item.tipo, assunto: item.assunto, descricao: item.descricao || "", data: item.data, resultado: item.resultado || "", proximaAcao: item.proximaAcao || "", responsavel: item.responsavel || "" }); setOpen(true); }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-5 w-5" />Histórico de Relacionamentos</CardTitle>
          <Button size="sm" onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Registrar Interação</Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>Nenhuma interação registrada</p></div>
          ) : (
            <div className="space-y-2">
              {items.map((item: any) => (
                <div key={item.id} className="border rounded-lg p-3 flex items-start gap-3">
                  <div className="text-xl flex-shrink-0 mt-0.5">{TIPO_ICONS[item.tipo] || "💬"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.assunto}</span>
                      <Badge variant="outline" className="text-xs capitalize">{item.tipo}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item.clienteNome}{item.empresa ? ` · ${item.empresa}` : ""} · {item.data}</div>
                    {item.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>}
                    {item.resultado && <p className="text-xs text-green-700 mt-1">✓ {item.resultado}</p>}
                    {item.proximaAcao && <p className="text-xs text-blue-700 mt-0.5 italic">→ {item.proximaAcao}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(item.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Interação" : "Registrar Interação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Cliente *</Label><Input value={form.clienteNome} onChange={(e: any) => setForm((f: any) => ({ ...f, clienteNome: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Empresa</Label><Input value={form.empresa} onChange={(e: any) => setForm((f: any) => ({ ...f, empresa: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: string) => setForm((f: any) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["reuniao","ligacao","email","visita","proposta","outro"].map(t => <SelectItem key={t} value={t}>{TIPO_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Data *</Label><Input type="date" value={form.data} onChange={(e: any) => setForm((f: any) => ({ ...f, data: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Assunto *</Label><Input value={form.assunto} onChange={(e: any) => setForm((f: any) => ({ ...f, assunto: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e: any) => setForm((f: any) => ({ ...f, descricao: e.target.value }))} rows={3} /></div>
            <div className="space-y-1"><Label>Resultado / Conclusão</Label><Input value={form.resultado} onChange={(e: any) => setForm((f: any) => ({ ...f, resultado: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Próxima Ação</Label><Input value={form.proximaAcao} onChange={(e: any) => setForm((f: any) => ({ ...f, proximaAcao: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Responsável</Label><Input value={form.responsavel} onChange={(e: any) => setForm((f: any) => ({ ...f, responsavel: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => saveMutation.mutate(form)} disabled={!form.clienteNome || !form.assunto || !form.data || saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
