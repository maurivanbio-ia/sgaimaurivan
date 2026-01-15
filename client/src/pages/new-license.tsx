import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Save, ArrowLeft, Upload } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";

const licenseSchema = z.object({
  numero: z.string().min(1, "Número da licença é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  orgaoEmissor: z.string().min(1, "Órgão emissor é obrigatório"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  validade: z.string().min(1, "Validade é obrigatória"),
  arquivoPdf: z.string().optional(),
  observacao: z.string().optional(),
  numeroParqueEolico: z.string().optional(),
});

type LicenseFormData = z.infer<typeof licenseSchema>;

const licenseTypes = [
  "Licença Prévia (LP)",
  "Licença de Instalação (LI)",
  "Licença de Operação (LO)",
  "Licença Ambiental Simplificada (LAS)",
  "Autorização Ambiental",
];

export default function NewLicense() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      numero: "",
      tipo: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
      observacao: "",
      numeroParqueEolico: "",
    },
  });

  const createLicense = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const licenseData = {
        ...data,
        empreendimentoId: parseInt(id as string),
      };
      const response = await apiRequest("POST", "/api/licencas", licenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({
        title: "Sucesso",
        description: "Licença cadastrada com sucesso!",
      });
      setLocation(`/empreendimentos/${id}`);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LicenseFormData) => {
    createLicense.mutate(data);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Nova Licença</h2>
        <p className="text-muted-foreground mt-2">Cadastre uma nova licença ambiental</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da licença *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: LP 001/2024, LI 042/2023, LO 123/2024"
                        data-testid="input-license-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de licença *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <FormField
                control={form.control}
                name="numeroParqueEolico"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Parque Eólico (opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: PE-001, Parque Eólico Norte"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação (opcional)</FormLabel>
                    <FormControl>
                      <textarea 
                        {...field}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Observações adicionais sobre esta licença..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="arquivoPdf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arquivo PDF da licença (opcional)</FormLabel>
                    <ObjectUploader
                      onGetUploadParameters={async () => {
                        const response = await apiRequest("POST", "/api/upload/pdf");
                        const data = await response.json();
                        return { 
                          method: data.method, 
                          url: data.url, 
                          filePath: data.filePath 
                        };
                      }}
                      onComplete={(result) => {
                        if (result.filePath) {
                          field.onChange(result.filePath);
                        }
                      }}
                      accept=".pdf"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4">
                <Button 
                  type="submit" 
                  disabled={createLicense.isPending}
                  className="font-medium"
                  data-testid="button-save-license"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createLicense.isPending ? "Salvando..." : "Salvar Licença"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation(`/empreendimentos/${id}`)}
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
