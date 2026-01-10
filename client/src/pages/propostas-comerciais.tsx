import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
    <div className="container mx-auto p-6 space-y-6">
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
    </div>
  );
}
