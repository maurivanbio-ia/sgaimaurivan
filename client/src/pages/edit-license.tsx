import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/date-utils";
import { Save, ArrowLeft, Upload, Download, FileText } from "lucide-react";
import type { LicencaAmbiental } from "@shared/schema";
import React from "react";

const licenseSchema = z.object({
  tipo: z.string().min(1, "Tipo é obrigatório"),
  orgaoEmissor: z.string().min(1, "Órgão emissor é obrigatório"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  validade: z.string().min(1, "Validade é obrigatória"),
  arquivoPdf: z.string().optional(),
});

type LicenseFormData = z.infer<typeof licenseSchema>;

const licenseTypes = [
  "Licença Prévia (LP)",
  "Licença de Instalação (LI)",
  "Licença de Operação (LO)",
  "Licença Ambiental Simplificada (LAS)",
  "Autorização Ambiental",
];

export default function EditLicense() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: license, isLoading } = useQuery<LicencaAmbiental>({
    queryKey: ["/api/licencas", id],
  });

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      tipo: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
    },
  });

  // Update form when license data loads
  React.useEffect(() => {
    if (license) {
      form.reset({
        tipo: license.tipo,
        orgaoEmissor: license.orgaoEmissor,
        dataEmissao: formatDateForInput(license.dataEmissao),
        validade: formatDateForInput(license.validade),
        arquivoPdf: license.arquivoPdf || "",
      });
    }
  }, [license, form]);

  const updateLicense = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const response = await apiRequest("PUT", `/api/licencas/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({
        title: "Sucesso",
        description: "Licença atualizada com sucesso!",
      });
      // Navigate back to project detail
      if (license) {
        setLocation(`/empreendimentos/${license.empreendimentoId}`);
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LicenseFormData) => {
    updateLicense.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando dados da licença...</div>
      </div>
    );
  }

  if (!license) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Licença não encontrada</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Editar Licença</h2>
        <p className="text-muted-foreground mt-2">Edite as informações da licença ambiental</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de licença *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-license-type">
                          <SelectValue placeholder="Selecione o tipo de licença" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {licenseTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="orgaoEmissor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Órgão emissor *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: IBAMA, IBRAM, Secretaria de Meio Ambiente"
                        data-testid="input-issuer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataEmissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de emissão *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          data-testid="input-issue-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date"
                          data-testid="input-validity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Current file display */}
              {license.arquivoPdf && (
                <div>
                  <FormLabel>Arquivo PDF atual</FormLabel>
                  <div className="flex items-center space-x-4 mb-4 p-3 bg-muted rounded-md">
                    <FileText className="h-5 w-5 text-destructive" />
                    <span className="text-sm text-muted-foreground flex-1" data-testid="text-current-file">
                      {license.arquivoPdf}
                    </span>
                    <a 
                      href={license.arquivoPdf} 
                      className="text-primary hover:underline text-sm"
                      data-testid="link-download-current"
                    >
                      <Download className="inline mr-1 h-3 w-3" />
                      Baixar
                    </a>
                  </div>
                </div>
              )}

              {/* File replacement */}
              <FormField
                control={form.control}
                name="arquivoPdf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {license.arquivoPdf ? "Substituir arquivo (opcional)" : "Arquivo PDF da licença (opcional)"}
                    </FormLabel>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md hover:border-primary/50 transition-colors">
                      <div className="space-y-1 text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                        <div className="flex text-sm text-muted-foreground">
                          <label htmlFor="license-file" className="relative cursor-pointer bg-background rounded-md font-medium text-primary hover:text-primary/80">
                            <span>
                              {license.arquivoPdf ? "Faça upload do novo arquivo" : "Faça upload do arquivo"}
                            </span>
                            <input 
                              id="license-file" 
                              type="file" 
                              accept=".pdf" 
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  // TODO: Implement file upload to object storage
                                  console.log("File selected:", file.name);
                                  field.onChange(file.name);
                                }
                              }}
                              data-testid="input-file"
                            />
                          </label>
                          <p className="pl-1">ou arraste e solte</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Apenas arquivos PDF até 10MB</p>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4">
                <Button 
                  type="submit" 
                  disabled={updateLicense.isPending}
                  className="font-medium"
                  data-testid="button-save-changes"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateLicense.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation(`/empreendimentos/${license.empreendimentoId}`)}
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
