import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, FileText, Calendar, Building, Download, Shield, AlertCircle, CheckCircle, Save, Pencil, Trash2 } from "lucide-react";
import { formatDate, getStatusLabel, getStatusClass } from "@/lib/date-utils";
import type { LicencaAmbiental } from "@shared/schema";
import { ExportButton } from "@/components/ExportButton";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";

interface LicencasTabProps {
  empreendimentoId: number;
}

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

export function LicencasTab({ empreendimentoId }: LicencasTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicencaAmbiental | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: licencas = [], isLoading } = useQuery<LicencaAmbiental[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"],
  });

  const licencasAtivas = licencas.filter(l => l.status === 'ativa');
  const licencasVencidas = licencas.filter(l => l.status === 'vencida');
  const licencasAVencer = licencas.filter(l => l.status === 'a_vencer');

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
        empreendimentoId,
      };
      const response = await apiRequest("POST", "/api/licencas", licenseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({
        title: "Sucesso",
        description: "Licença cadastrada com sucesso!",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao cadastrar licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const updateLicense = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      const response = await apiRequest("PUT", `/api/licencas/${editingLicense?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({
        title: "Sucesso",
        description: "Licença atualizada com sucesso!",
      });
      setIsDialogOpen(false);
      setEditingLicense(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteLicense = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/licencas/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({
        title: "Sucesso",
        description: "Licença excluída com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LicenseFormData) => {
    if (editingLicense) {
      updateLicense.mutate(data);
    } else {
      createLicense.mutate(data);
    }
  };

  const handleEdit = (license: LicencaAmbiental) => {
    setEditingLicense(license);
    form.reset({
      numero: license.numero || "",
      tipo: license.tipo,
      orgaoEmissor: license.orgaoEmissor,
      dataEmissao: license.dataEmissao,
      validade: license.validade,
      arquivoPdf: license.arquivoPdf || "",
      observacao: license.observacao || "",
      numeroParqueEolico: license.numeroParqueEolico || "",
    });
    setIsDialogOpen(true);
  };

  const handleNewLicense = () => {
    setEditingLicense(null);
    form.reset({
      numero: "",
      tipo: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
      observacao: "",
      numeroParqueEolico: "",
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando licenças...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Licenças Ambientais
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {licencas.length} licença{licencas.length !== 1 ? 's' : ''} vinculada{licencas.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton entity="licencas" entityId={empreendimentoId} variant="outline" />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleNewLicense} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Licença
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingLicense ? "Editar Licença" : "Nova Licença"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
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
                        {field.value && (
                          <p className="text-sm text-muted-foreground">
                            Arquivo carregado: {field.value}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createLicense.isPending || updateLicense.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {createLicense.isPending || updateLicense.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{licencas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-green-700">{licencasAtivas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">A Vencer</p>
                <p className="text-2xl font-bold text-yellow-700">{licencasAVencer.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold text-red-700">{licencasVencidas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {licencas.length > 0 ? (
        <div className="space-y-4">
          {licencas.map((license) => (
            <Card key={license.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="text-lg font-semibold text-card-foreground mr-3">
                        {license.tipo}
                      </h4>
                      <span className={`status-badge ${getStatusClass(license.status)}`}>
                        {getStatusLabel(license.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          <FileText className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Número:</span> {license.numero || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Building className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Órgão Emissor:</span> {license.orgaoEmissor}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Calendar className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Data de Emissão:</span> {formatDate(license.dataEmissao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Calendar className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Validade:</span> {formatDate(license.validade)}
                        </p>
                      </div>
                    </div>
                    {license.numeroParqueEolico && (
                      <div className="mt-2 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Parque Eólico:</span> {license.numeroParqueEolico}
                        </p>
                      </div>
                    )}
                    {license.observacao && (
                      <div className="mt-2 text-sm">
                        <p className="text-muted-foreground">
                          <span className="font-medium">Observação:</span> {license.observacao}
                        </p>
                      </div>
                    )}
                    {license.arquivoPdf && (
                      <div className="mt-2">
                        <a 
                          href={license.arquivoPdf} 
                          className="text-primary hover:underline text-sm flex items-center gap-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-3 w-3" />
                          Baixar PDF
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(license)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja excluir esta licença?")) {
                          deleteLicense.mutate(license.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhuma licença vinculada
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui licenças ambientais cadastradas.
              Clique no botão acima para adicionar uma nova licença.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
