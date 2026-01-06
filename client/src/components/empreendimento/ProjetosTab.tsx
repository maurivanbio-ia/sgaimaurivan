import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FolderKanban, Plus, Edit, Trash2, DollarSign, TrendingUp, Calendar, Target } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date-utils";
import type { Projeto } from "@shared/schema";

export interface ProjetosTabProps {
  empreendimentoId: number;
}

type User = {
  id: number;
  email: string;
  cargo: string;
};

const statusOptions = [
  { value: "em_planejamento", label: "Em Planejamento" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "pausado", label: "Pausado" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "em_planejamento":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "em_andamento":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "concluido":
      return "bg-green-100 text-green-800 border-green-200";
    case "pausado":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusLabel = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.label || status;
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

const calcularEficiencia = (valorContratado: string | null, valorRecebido: string | null) => {
  const contratado = Number(valorContratado || 0);
  const recebido = Number(valorRecebido || 0);
  if (contratado === 0) return 0;
  return Math.round((recebido / contratado) * 100);
};

const projetoFormSchema = z.object({
  empreendimentoId: z.number(),
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  status: z.string().default("em_planejamento"),
  coordenadorId: z.number().optional().nullable(),
  valorContratado: z.string().optional(),
  valorRecebido: z.string().optional(),
  orcamentoPrevisto: z.string().optional(),
  metaReducaoGastos: z.string().optional(),
  inicioPrevisto: z.string().optional(),
  fimPrevisto: z.string().optional(),
  bmmServicos: z.string().optional(),
  ndReembolsaveis: z.string().optional(),
});

type ProjetoFormData = z.infer<typeof projetoFormSchema>;

export function ProjetosTab({ empreendimentoId }: ProjetosTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);

  const { data: projetos = [], isLoading } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/projetos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar projetos");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<ProjetoFormData>({
    resolver: zodResolver(projetoFormSchema),
    defaultValues: {
      empreendimentoId,
      nome: "",
      descricao: "",
      status: "em_planejamento",
      coordenadorId: undefined,
      valorContratado: "0",
      valorRecebido: "0",
      orcamentoPrevisto: "0",
      metaReducaoGastos: "0",
      inicioPrevisto: "",
      fimPrevisto: "",
      bmmServicos: "",
      ndReembolsaveis: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProjetoFormData) => {
      return apiRequest("POST", "/api/projetos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto criado com sucesso!" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar projeto", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProjetoFormData> }) => {
      return apiRequest("PUT", `/api/projetos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto atualizado com sucesso!" });
      setDialogOpen(false);
      setEditingProjeto(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar projeto", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/projetos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir projeto", variant: "destructive" });
    },
  });

  const handleOpenDialog = (projeto?: Projeto) => {
    if (projeto) {
      setEditingProjeto(projeto);
      form.reset({
        empreendimentoId: projeto.empreendimentoId,
        nome: projeto.nome,
        descricao: projeto.descricao || "",
        status: projeto.status,
        coordenadorId: projeto.coordenadorId || undefined,
        valorContratado: projeto.valorContratado || "0",
        valorRecebido: projeto.valorRecebido || "0",
        orcamentoPrevisto: projeto.orcamentoPrevisto || "0",
        metaReducaoGastos: projeto.metaReducaoGastos || "0",
        inicioPrevisto: projeto.inicioPrevisto || "",
        fimPrevisto: projeto.fimPrevisto || "",
        bmmServicos: projeto.bmmServicos || "",
        ndReembolsaveis: projeto.ndReembolsaveis || "",
      });
    } else {
      setEditingProjeto(null);
      form.reset({
        empreendimentoId,
        nome: "",
        descricao: "",
        status: "em_planejamento",
        coordenadorId: undefined,
        valorContratado: "0",
        valorRecebido: "0",
        orcamentoPrevisto: "0",
        metaReducaoGastos: "0",
        inicioPrevisto: "",
        fimPrevisto: "",
        bmmServicos: "",
        ndReembolsaveis: "",
      });
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: ProjetoFormData) => {
    const payload: ProjetoFormData = {
      ...data,
      coordenadorId: data.coordenadorId || undefined,
      inicioPrevisto: data.inicioPrevisto || undefined,
      fimPrevisto: data.fimPrevisto || undefined,
    };

    if (editingProjeto) {
      updateMutation.mutate({ id: editingProjeto.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totalValorContratado = projetos.reduce((acc, p) => acc + Number(p.valorContratado || 0), 0);
  const totalValorRecebido = projetos.reduce((acc, p) => acc + Number(p.valorRecebido || 0), 0);
  const eficienciaGeral = totalValorContratado > 0 ? Math.round((totalValorRecebido / totalValorContratado) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Projetos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Projetos vinculados a este empreendimento
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-novo-projeto">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProjeto ? "Editar Projeto" : "Novo Projeto"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Projeto *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-projeto-nome" />
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
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-projeto-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((opt) => (
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
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} data-testid="input-projeto-descricao" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="coordenadorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordenador</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val ? parseInt(val) : undefined)} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-projeto-coordenador">
                              <SelectValue placeholder="Selecione um coordenador" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.email}
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
                    name="metaReducaoGastos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Redução de Gastos (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value || ""} data-testid="input-projeto-meta-reducao" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="inicioPrevisto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Início Previsto</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-projeto-inicio" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fimPrevisto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fim Previsto</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} data-testid="input-projeto-fim" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="valorContratado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Contratado (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value || ""} data-testid="input-projeto-valor-contratado" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valorRecebido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Recebido (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value || ""} data-testid="input-projeto-valor-recebido" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="orcamentoPrevisto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orçamento Previsto (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} value={field.value || ""} data-testid="input-projeto-orcamento" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bmmServicos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BMM Serviços</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-projeto-bmm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ndReembolsaveis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ND Reembolsáveis</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-projeto-nd" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    data-testid="button-cancelar-projeto"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-salvar-projeto"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Salvando..."
                      : editingProjeto
                      ? "Atualizar"
                      : "Criar Projeto"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {projetos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Projetos</p>
                  <p className="text-2xl font-bold text-blue-700" data-testid="stat-projetos-total">
                    {projetos.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor Contratado</p>
                  <p className="text-lg font-bold text-green-700" data-testid="stat-valor-contratado">
                    {formatCurrency(totalValorContratado)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Valor Recebido</p>
                  <p className="text-lg font-bold text-emerald-700" data-testid="stat-valor-recebido">
                    {formatCurrency(totalValorRecebido)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Eficiência Geral</p>
                  <p className="text-2xl font-bold text-purple-700" data-testid="stat-eficiencia-geral">
                    {eficienciaGeral}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {projetos.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum projeto encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Este empreendimento ainda não possui projetos cadastrados.
              </p>
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-first-projeto">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Projeto
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lista de Projetos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor Contratado</TableHead>
                  <TableHead>Valor Recebido</TableHead>
                  <TableHead>Eficiência</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projetos.map((projeto) => {
                  const eficiencia = calcularEficiencia(projeto.valorContratado, projeto.valorRecebido);
                  return (
                    <TableRow key={projeto.id} data-testid={`row-projeto-${projeto.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium" data-testid={`text-projeto-nome-${projeto.id}`}>
                            {projeto.nome}
                          </p>
                          {projeto.descricao && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {projeto.descricao}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border ${getStatusColor(projeto.status)}`}
                          data-testid={`badge-projeto-status-${projeto.id}`}
                        >
                          {getStatusLabel(projeto.status)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-projeto-contratado-${projeto.id}`}>
                        {formatCurrency(projeto.valorContratado)}
                      </TableCell>
                      <TableCell data-testid={`text-projeto-recebido-${projeto.id}`}>
                        {formatCurrency(projeto.valorRecebido)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(eficiencia, 100)}
                            className={`h-2 w-16 ${
                              eficiencia >= 80
                                ? "[&>div]:bg-green-500"
                                : eficiencia >= 50
                                ? "[&>div]:bg-yellow-500"
                                : "[&>div]:bg-red-500"
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              eficiencia >= 80
                                ? "text-green-600"
                                : eficiencia >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                            data-testid={`text-projeto-eficiencia-${projeto.id}`}
                          >
                            {eficiencia}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {projeto.inicioPrevisto
                              ? formatDate(projeto.inicioPrevisto)
                              : "-"}{" "}
                            até{" "}
                            {projeto.fimPrevisto
                              ? formatDate(projeto.fimPrevisto)
                              : "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(projeto)}
                            data-testid={`button-editar-projeto-${projeto.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-excluir-projeto-${projeto.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o projeto "{projeto.nome}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancelar-exclusao">
                                  Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(projeto.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid="button-confirmar-exclusao"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
