import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, ArrowLeft } from "lucide-react";

const tipologiaOptions = [
  { value: "hidreletrica", label: "💧 Hidrelétrica" },
  { value: "parque_eolico", label: "🌪️ Parque Eólico" },
  { value: "termoeletrica", label: "🔥 Termelétrica" },
  { value: "linha_transmissao", label: "⚡ Linha de Transmissão" },
  { value: "mina", label: "⛏️ Mineração" },
  { value: "pchs", label: "🏭 PCH" },
  { value: "outro", label: "📍 Outro" },
];

const statusOptions = [
  { value: "ativo", label: "✅ Ativo" },
  { value: "em_planejamento", label: "📋 Em Planejamento" },
  { value: "em_execucao", label: "🔄 Em Execução" },
  { value: "concluido", label: "🏁 Concluído" },
  { value: "inativo", label: "⏸️ Inativo" },
  { value: "cancelado", label: "❌ Cancelado" },
];
import { useUnidade } from "@/contexts/UnidadeContext";

const projectSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cliente: z.string().min(1, "Cliente é obrigatório"),
  clienteEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  clienteTelefone: z.string().optional(),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  latitude: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = Number(val);
    return !isNaN(num) && num >= -90 && num <= 90;
  }, "Latitude deve estar entre -90 e 90"),
  longitude: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true;
    const num = Number(val);
    return !isNaN(num) && num >= -180 && num <= 180;
  }, "Longitude deve estar entre -180 e 180"),
  responsavelInterno: z.string().min(1, "Responsável interno é obrigatório"),
  tipo: z.enum(["hidreletrica", "parque_eolico", "termoeletrica", "linha_transmissao", "mina", "pchs", "outro"]).default("outro"),
  status: z.enum(["ativo", "em_planejamento", "em_execucao", "concluido", "inativo", "cancelado"]).default("ativo"),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function NewProject() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { unidadeSelecionada } = useUnidade();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      nome: "",
      cliente: "",
      clienteEmail: "",
      clienteTelefone: "",
      localizacao: "",
      latitude: "",
      longitude: "",
      responsavelInterno: "",
      tipo: "outro",
      status: "ativo",
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("POST", "/api/empreendimentos", {
        ...data,
        unidade: unidadeSelecionada,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      toast({
        title: "Sucesso",
        description: "Empreendimento cadastrado com sucesso!",
      });
      setLocation("/empreendimentos");
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar empreendimento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    createProject.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Novo Empreendimento</h2>
        <p className="text-muted-foreground mt-2">Cadastre um novo empreendimento no sistema</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do empreendimento *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Digite o nome do empreendimento"
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipologia do Empreendimento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tipologia">
                            <SelectValue placeholder="Selecione a tipologia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tipologiaOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                      <FormLabel>Status do Empreendimento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                name="cliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do cliente responsável"
                        data-testid="input-client"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clienteEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email do Cliente</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email"
                          placeholder="cliente@empresa.com"
                          data-testid="input-client-email"
                        />
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
                      <FormLabel>Telefone/WhatsApp do Cliente</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="(71) 98780-2223"
                          data-testid="input-client-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Cidade, Estado"
                        data-testid="input-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: -12.345678"
                          data-testid="input-latitude"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Ex: -38.123456"
                          data-testid="input-longitude"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="responsavelInterno"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável interno *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do responsável na equipe"
                        data-testid="input-responsible"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4">
                <Button 
                  type="submit" 
                  disabled={createProject.isPending}
                  className="font-medium"
                  data-testid="button-save-project"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createProject.isPending ? "Salvando..." : "Salvar Empreendimento"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation("/empreendimentos")}
                  className="font-medium"
                  data-testid="button-cancel"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
