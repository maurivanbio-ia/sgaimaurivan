import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import type { Empreendimento } from "@shared/schema";
import { useUnidade } from "@/contexts/UnidadeContext";

const tipologiaOptions = [
  { value: "hidreletrica", label: "💧 Hidrelétrica" },
  { value: "parque_eolico", label: "🌪️ Parque Eólico" },
  { value: "usina_solar", label: "☀️ Usina Solar" },
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

const projectSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cliente: z.string().min(1, "Cliente é obrigatório"),
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
  tipo: z.string().default("outro"),
  status: z.string().default("ativo"),
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function EditProject() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { unidadeSelecionada } = useUnidade();

  const { data: project, isLoading } = useQuery<Empreendimento>({
    queryKey: ["/api/empreendimentos", id, unidadeSelecionada],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unidadeSelecionada) {
        params.set("unidade", unidadeSelecionada);
      }
      const response = await fetch(`/api/empreendimentos/${id}?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      return response.json();
    },
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      nome: "",
      cliente: "",
      localizacao: "",
      latitude: "",
      longitude: "",
      responsavelInterno: "",
      tipo: "outro",
      status: "ativo",
    },
  });

  // Update form when project data loads
  useEffect(() => {
    if (project) {
      form.reset({
        nome: project.nome,
        cliente: project.cliente,
        localizacao: project.localizacao,
        latitude: project.latitude || "",
        longitude: project.longitude || "",
        responsavelInterno: project.responsavelInterno,
        tipo: project.tipo || "outro",
        status: project.status || "ativo",
      });
    }
  }, [project, form]);

  const updateProject = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("PUT", `/api/empreendimentos/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", id] });
      toast({
        title: "Sucesso",
        description: "Empreendimento atualizado com sucesso!",
      });
      setLocation(`/empreendimentos/${id}`);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar empreendimento. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    updateProject.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando dados do empreendimento...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Empreendimento não encontrado</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Editar Empreendimento</h2>
        <p className="text-muted-foreground mt-2">Atualize as informações do empreendimento</p>
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
                    <FormLabel>Nome do Empreendimento</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do empreendimento"
                        data-testid="input-nome"
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do cliente"
                        data-testid="input-cliente"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localização</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Localização do empreendimento"
                        data-testid="input-localizacao"
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
                    <FormLabel>Responsável Interno</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Nome do responsável interno"
                        data-testid="input-responsavel"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`/empreendimentos/${id}`)}
                  data-testid="button-cancel"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateProject.isPending}
                  data-testid="button-save"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateProject.isPending ? "Salvando..." : "Atualizar"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}