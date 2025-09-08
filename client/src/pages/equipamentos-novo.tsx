import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

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
  quantidadeTotal: z.number().min(1, "Quantidade deve ser pelo menos 1").default(1),
  quantidadeDisponivel: z.number().min(0).default(1),
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

export default function NovoEquipamento() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createMutation = useMutation({
    mutationFn: async (data: EquipamentoFormData) => {
      const payload = {
        ...data,
        valorAquisicao: data.valorAquisicao ? parseFloat(data.valorAquisicao) : null,
        proximaManutencao: data.proximaManutencao || null,
      };
      return apiRequest("POST", "/api/equipamentos", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      toast({
        title: "Sucesso",
        description: "Equipamento cadastrado com sucesso!",
      });
      navigate("/equipamentos");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao cadastrar equipamento",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EquipamentoFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-novo-equipamento">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          data-testid="button-voltar"
        >
          <Link href="/equipamentos">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Novo Equipamento</h1>
          <p className="text-muted-foreground mt-2">
            Cadastre um novo equipamento no sistema
          </p>
        </div>
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
                {/* Left Column */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="numeroPatrimonio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número do Patrimônio *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex: EQ-2024-001"
                            data-testid="input-numero-patrimonio"
                          />
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
                          <Input
                            {...field}
                            placeholder="Ex: Microscópio Biológico"
                            data-testid="input-nome"
                          />
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
                          <Input
                            {...field}
                            placeholder="Ex: Dell, HP, Canon"
                            data-testid="input-marca"
                          />
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
                          <Input
                            {...field}
                            placeholder="Ex: Inspiron 15 3000"
                            data-testid="input-modelo"
                          />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tipo-equipamento">
                              <SelectValue placeholder="Selecione o tipo" />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          <Input
                            {...field}
                            placeholder="Nome do responsável"
                            data-testid="input-responsavel-atual"
                          />
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
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-data-aquisicao"
                          />
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
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            data-testid="input-valor-aquisicao"
                          />
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
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-proxima-manutencao"
                          />
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
                      <Textarea
                        {...field}
                        placeholder="Observações sobre o equipamento..."
                        rows={4}
                        data-testid="textarea-observacoes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/equipamentos")}
                  data-testid="button-cancelar"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-salvar"
                >
                  {createMutation.isPending ? "Salvando..." : "Salvar Equipamento"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}