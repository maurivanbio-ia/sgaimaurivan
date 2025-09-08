import { useRoute, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { Equipamento } from "@shared/schema";

const equipamentoFormSchema = z.object({
  numeroPatrimonio: z.string().min(1, "Número do patrimônio é obrigatório"),
  nome: z.string().min(1, "Nome do equipamento é obrigatório"),
  marca: z.string().min(1, "Marca é obrigatória"),
  modelo: z.string().min(1, "Modelo é obrigatório"),
  tipoEquipamento: z.string().min(1, "Tipo do equipamento é obrigatório"),
  status: z.enum(["funcionando", "com_defeito", "em_manutencao", "descartado"]),
  localizacaoAtual: z.enum(["escritorio", "cliente", "colaborador"]),
  localizacaoPadrao: z.enum(["escritorio", "cliente", "colaborador"]),
  responsavelAtual: z.string().optional(),
  dataAquisicao: z.string().min(1, "Data de aquisição é obrigatória"),
  valorAquisicao: z.string().optional(),
  proximaManutencao: z.string().optional(),
  frequenciaManutencao: z.enum(["trimestral", "semestral", "anual"]).optional(),
  vidaUtilEstimada: z.number().min(1).optional(),
  quantidadeTotal: z.number().min(1, "Quantidade deve ser pelo menos 1"),
  quantidadeDisponivel: z.number().min(0),
  observacoesGerais: z.string().optional(),
});

type EquipamentoFormData = z.infer<typeof equipamentoFormSchema>;

const tiposEquipamento = [
  "Notebook",
  "Desktop", 
  "Monitor",
  "Impressora",
  "Tablet",
  "Smartphone",
  "Equipamento de Campo",
  "Outro"
];

async function fetchEquipamento(id: string): Promise<Equipamento> {
  const res = await fetch(`/api/equipamentos/${id}`);
  if (!res.ok) {
    throw new Error("Equipamento não encontrado");
  }
  return res.json();
}

export default function EditarEquipamento() {
  const [match, params] = useRoute("/equipamentos/:id/editar");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const id = params?.id;

  const { data: equipamento, isLoading, error } = useQuery({
    queryKey: ["/api/equipamentos", id],
    queryFn: () => fetchEquipamento(id!),
    enabled: !!id,
  });

  const form = useForm<EquipamentoFormData>({
    resolver: zodResolver(equipamentoFormSchema),
    defaultValues: {
      numeroPatrimonio: "",
      nome: "",
      marca: "",
      modelo: "",
      tipoEquipamento: "",
      status: "funcionando",
      localizacaoAtual: "escritorio",
      localizacaoPadrao: "escritorio",
      responsavelAtual: "",
      dataAquisicao: "",
      valorAquisicao: "",
      proximaManutencao: "",
      frequenciaManutencao: "anual",
      vidaUtilEstimada: 5,
      quantidadeTotal: 1,
      quantidadeDisponivel: 1,
      observacoesGerais: "",
    },
  });

  // Update form when equipment data is loaded
  useEffect(() => {
    if (equipamento) {
      form.reset({
        numeroPatrimonio: equipamento.numeroPatrimonio || "",
        nome: equipamento.nome || "",
        marca: equipamento.marca || "",
        modelo: equipamento.modelo || "",
        tipoEquipamento: equipamento.tipoEquipamento || "",
        status: equipamento.status || "funcionando",
        localizacaoAtual: equipamento.localizacaoAtual || "escritorio",
        localizacaoPadrao: equipamento.localizacaoPadrao || "escritorio",
        responsavelAtual: equipamento.responsavelAtual || "",
        dataAquisicao: equipamento.dataAquisicao || "",
        valorAquisicao: equipamento.valorAquisicao?.toString() || "",
        proximaManutencao: equipamento.proximaManutencao || "",
        frequenciaManutencao: equipamento.frequenciaManutencao || "anual",
        vidaUtilEstimada: equipamento.vidaUtilEstimada || 5,
        quantidadeTotal: equipamento.quantidadeTotal || 1,
        quantidadeDisponivel: equipamento.quantidadeDisponivel || 1,
        observacoesGerais: equipamento.observacoesGerais || "",
      });
    }
  }, [equipamento, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EquipamentoFormData) => {
      const payload = {
        ...data,
        valorAquisicao: data.valorAquisicao ? parseFloat(data.valorAquisicao) : null,
        proximaManutencao: data.proximaManutencao || null,
      };
      return apiRequest("PATCH", `/api/equipamentos/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos", id] });
      toast({
        title: "Sucesso",
        description: "Equipamento atualizado com sucesso!",
      });
      navigate(`/equipamentos/${id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar equipamento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/equipamentos/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({
        title: "Sucesso",
        description: "Equipamento excluído com sucesso!",
      });
      navigate("/equipamentos");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir equipamento",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EquipamentoFormData) => {
    updateMutation.mutate(data);
  };

  const onDelete = () => {
    deleteMutation.mutate();
  };

  if (!match || !id) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Equipamento não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/equipamentos">Voltar à lista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Carregando equipamento...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !equipamento) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar equipamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-600">{(error as Error)?.message || "Erro desconhecido"}</p>
            <Button asChild>
              <Link href="/equipamentos">Voltar à lista</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-editar-equipamento">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href={`/equipamentos/${id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Equipamento</h1>
            <p className="text-muted-foreground mt-1">{equipamento.numeroPatrimonio}</p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este equipamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column - Same fields as create form */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="numeroPatrimonio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número do Patrimônio *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-numero-patrimonio" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Equipamento *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-nome" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marca"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-marca" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-modelo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipoEquipamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Equipamento *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tipo-equipamento">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tiposEquipamento.map((tipo) => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo}
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
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="funcionando">Funcionando</SelectItem>
                            <SelectItem value="com_defeito">Com Defeito</SelectItem>
                            <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                            <SelectItem value="descartado">Descartado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="localizacaoAtual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localização Atual *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-localizacao-atual">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="escritorio">Escritório</SelectItem>
                            <SelectItem value="cliente">Cliente</SelectItem>
                            <SelectItem value="colaborador">Colaborador</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="responsavelAtual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável Atual</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-responsavel-atual" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dataAquisicao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Aquisição *</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-data-aquisicao" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valorAquisicao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor de Aquisição (R$)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" data-testid="input-valor-aquisicao" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proximaManutencao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Próxima Manutenção</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-proxima-manutencao" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantidadeTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade Total</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            data-testid="input-quantidade-total"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Full-width fields */}
              <FormField
                control={form.control}
                name="observacoesGerais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Gerais</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} data-testid="textarea-observacoes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/equipamentos/${id}`)}
                  data-testid="button-cancelar"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-salvar"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}