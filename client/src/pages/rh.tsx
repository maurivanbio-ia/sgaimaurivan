"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Edit, Trash2, X, Users, Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

const rhRegistroSchema = z.object({
  id: z.number().optional(),
  nomeColaborador: z.string().min(1, "Nome obrigatório"),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  cnh: z.string().optional(),
  fornecedor: z.string().optional(),
  seguroNumero: z.string().optional(),
  valorTipo: z.string().optional(),
  valor: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  contatoEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  contatoTelefone: z.string().optional(),
  empreendimentoId: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()).optional(),
});

type RhRegistro = z.infer<typeof rhRegistroSchema>;

const VALOR_TIPO_OPTIONS = [
  { value: "hora", label: "Por Hora" },
  { value: "dia", label: "Por Dia" },
  { value: "mes", label: "Por Mês" },
];

export default function RhPage() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [fornecedorFilter, setFornecedorFilter] = useState("all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RhRegistro | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [registroToDelete, setRegistroToDelete] = useState<number | null>(null);

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (fornecedorFilter !== "all") params.fornecedor = fornecedorFilter;
    if (empreendimentoFilter !== "all") params.empreendimentoId = empreendimentoFilter;
    return params;
  }, [debouncedSearch, fornecedorFilter, empreendimentoFilter]);

  const { data: registros = [], isLoading } = useQuery<RhRegistro[]>({
    queryKey: ["/api/rh", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/rh${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar registros de RH");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["/api/empreendimentos"],
  });

  const form = useForm<RhRegistro>({
    resolver: zodResolver(rhRegistroSchema),
    defaultValues: {
      nomeColaborador: "",
      cpf: "",
      rg: "",
      cnh: "",
      fornecedor: "",
      empreendimentoId: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RhRegistro) => apiRequest("POST", "/api/rh", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh"] });
      toast({ title: "Sucesso", description: "Registro de RH cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao cadastrar registro",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RhRegistro }) =>
      apiRequest("PATCH", `/api/rh/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh"] });
      toast({ title: "Sucesso", description: "Registro atualizado com sucesso!" });
      setIsDialogOpen(false);
      setEditingRegistro(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar registro",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/rh/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rh"] });
      toast({ title: "Sucesso", description: "Registro excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setRegistroToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir registro",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RhRegistro) => {
    if (editingRegistro?.id) {
      updateMutation.mutate({ id: editingRegistro.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleNew = () => {
    setEditingRegistro(null);
    form.reset({
      nomeColaborador: "",
      cpf: "",
      rg: "",
      cnh: "",
      fornecedor: "",
      empreendimentoId: undefined,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (registro: RhRegistro) => {
    setEditingRegistro(registro);
    form.reset(registro);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setRegistroToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (registroToDelete) deleteMutation.mutate(registroToDelete);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFornecedorFilter("all");
    setEmpreendimentoFilter("all");
  };

  const fornecedores = useMemo(() => {
    const unique = new Set(registros.map((r) => r.fornecedor).filter(Boolean));
    return Array.from(unique);
  }, [registros]);

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-rh">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-8 w-8" />
            Recursos Humanos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie colaboradores, certificações e documentos de RH
          </p>
        </div>
        <Button onClick={handleNew} data-testid="button-novo-rh">
          <Plus className="h-4 w-4 mr-2" /> Novo Registro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-rh"
              />
            </div>
            <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
              <SelectTrigger data-testid="select-fornecedor-filter">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Fornecedores</SelectItem>
                {fornecedores.map((f) => <SelectItem key={f} value={f!}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
              <SelectTrigger data-testid="select-empreendimento-filter">
                <SelectValue placeholder="Empreendimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Empreendimentos</SelectItem>
                {empreendimentos.map((e: any) => (
                  <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(searchTerm || fornecedorFilter !== "all" || empreendimentoFilter !== "all") && (
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-2" /> Limpar Filtros
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : registros.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || fornecedorFilter !== "all" || empreendimentoFilter !== "all"
                  ? "Tente ajustar os filtros."
                  : "Comece cadastrando o primeiro colaborador."}
              </p>
              <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" /> Cadastrar Primeiro Registro</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>CNH</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Empreendimento</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.map((r: any) => (
                    <TableRow key={r.id} data-testid={`row-rh-${r.id}`}>
                      <TableCell className="font-medium">{r.id}</TableCell>
                      <TableCell>{r.nomeColaborador}</TableCell>
                      <TableCell>{r.cpf || "-"}</TableCell>
                      <TableCell>{r.cnh || "-"}</TableCell>
                      <TableCell>{r.fornecedor || "-"}</TableCell>
                      <TableCell>
                        {r.empreendimentoId
                          ? empreendimentos.find((e: any) => e.id === r.empreendimentoId)?.nome || "-"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {r.contatoEmail || r.contatoTelefone || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id!)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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
            <DialogTitle>{editingRegistro ? "Editar Registro" : "Novo Registro de RH"}</DialogTitle>
            <DialogDescription>
              {editingRegistro ? "Atualize os dados do colaborador." : "Preencha as informações para cadastrar."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="nomeColaborador" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField name="cpf" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>CPF</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="rg" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>RG</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="cnh" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>CNH</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="fornecedor" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Fornecedor</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="empreendimentoId" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empreendimento</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))}
                      value={field.value?.toString() || "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-empreendimento">
                          <SelectValue placeholder="Selecione (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {empreendimentos.map((e: any) => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField name="seguroNumero" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Nº Seguro</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
                <FormField name="valorTipo" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Tipo de Valor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {VALOR_TIPO_OPTIONS.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}/>
                <FormField name="valor" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Valor (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value as any || ""} placeholder="0.00" /></FormControl>
                  </FormItem>
                )}/>
                <FormField name="dataInicio" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Data Início</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                )}/>
                <FormField name="dataFim" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Data Fim</FormLabel><FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl></FormItem>
                )}/>
                <FormField name="contatoEmail" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField name="contatoTelefone" control={form.control} render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )}/>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingRegistro(null); form.reset(); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingRegistro ? "Atualizar" : "Cadastrar"}
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
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
