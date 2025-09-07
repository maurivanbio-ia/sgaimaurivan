import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Save } from "lucide-react";
import { insertEquipamentoSchema } from "@shared/schema";

const equipamentoFormSchema = insertEquipamentoSchema.extend({
  proximaManutencao: z.string().optional(),
  dataAquisicao: z.string().min(1, "Data de aquisição é obrigatória"),
}).omit({
  qrCode: true,
  criadoPor: true,
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

const frequenciaManutencao = [
  "trimestral",
  "semestral",
  "anual"
];

export default function NewEquipamento() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EquipamentoFormData>({
    resolver: zodResolver(equipamentoFormSchema),
    defaultValues: {
      numeroPatrimonio: "",
      tipoEquipamento: "",
      marca: "",
      modelo: "",
      dataAquisicao: "",
      status: "funcionando",
      localizacaoAtual: "escritorio",
      responsavelAtual: "",
      observacoesGerais: "",
      proximaManutencao: "",
      frequenciaManutencao: "anual",
      vidaUtilEstimada: 5,
      valorAquisicao: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EquipamentoFormData) => {
      const payload = {
        ...data,
        dataAquisicao: data.dataAquisicao,
        proximaManutencao: data.proximaManutencao || null,
        valorAquisicao: data.valorAquisicao ? parseFloat(data.valorAquisicao as string) : null,
        vidaUtilEstimada: data.vidaUtilEstimada ? parseInt(data.vidaUtilEstimada.toString()) : null,
      };
      return apiRequest("/api/equipamentos", {
        method: "POST",
        body: JSON.stringify(payload),
      });
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
    <div className="container mx-auto py-8 space-y-6" data-testid="page-new-equipment">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/equipamentos")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Novo Equipamento</h1>
          <p className="text-muted-foreground mt-2">
            Cadastre um novo equipamento no sistema
          </p>
        </div>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informações Básicas */}
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
                    name="marca"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Ex: Dell, HP, Lenovo"
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
                            placeholder="Ex: Latitude 5520"
                            data-testid="input-modelo"
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
                        <FormLabel>Valor de Aquisição</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            data-testid="input-valor-aquisicao"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Status e Localização */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="localizacaoAtual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Localização Atual</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-localizacao">
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
                            placeholder="Nome do responsável"
                            data-testid="input-responsavel"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vidaUtilEstimada"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vida Útil Estimada (anos)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="20"
                            placeholder="5"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-vida-util"
                            value={field.value || ""}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
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
                            type="date"
                            data-testid="input-proxima-manutencao"
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="frequenciaManutencao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência de Manutenção</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequencia-manutencao">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {frequenciaManutencao.map((freq) => (
                              <SelectItem key={freq} value={freq}>
                                {freq.charAt(0).toUpperCase() + freq.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="observacoesGerais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações Gerais</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações sobre o equipamento..."
                        rows={4}
                        data-testid="textarea-observacoes"
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Botões */}
              <div className="flex items-center justify-end gap-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/equipamentos")}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="gap-2"
                  data-testid="button-save"
                >
                  <Save className="h-4 w-4" />
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