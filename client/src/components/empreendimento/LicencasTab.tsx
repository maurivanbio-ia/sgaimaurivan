import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, apiRequestFormData } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, FileText, Calendar, Building, Download, Shield, AlertCircle, CheckCircle, Save, Pencil, Trash2, AlertTriangle, Loader2, Upload, RefreshCw, Archive, RefreshCcw } from "lucide-react";
import { formatDate, getStatusLabel, getStatusClass } from "@/lib/date-utils";
import type { LicencaAmbiental } from "@shared/schema";
import { ExportButton } from "@/components/ExportButton";
import { useToast } from "@/hooks/use-toast";

interface LicencasTabProps {
  empreendimentoId: number;
}

const licenseSchema = z.object({
  numero: z.string().min(1, "Número da licença é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  tipoOutorga: z.string().optional(),
  orgaoEmissor: z.string().min(1, "Órgão emissor é obrigatório"),
  dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
  validade: z.string().min(1, "Validade é obrigatória"),
  arquivoPdf: z.string().optional(),
}).refine(
  (data) => {
    if (data.tipo === "Licença de Outorga") {
      return !!data.tipoOutorga;
    }
    return true;
  },
  { message: "Selecione o tipo de outorga (Superficial ou Subterrânea)", path: ["tipoOutorga"] }
);

type LicenseFormData = z.infer<typeof licenseSchema>;

const licenseTypes = [
  "Licença Prévia (LP)",
  "Licença de Instalação (LI)",
  "Licença de Operação (LO)",
  "Licença Ambiental Simplificada (LAS)",
  "Autorização Ambiental",
  "Licença de Alteração",
  "Licença de Outorga",
];

export function LicencasTab({ empreendimentoId }: LicencasTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicencaAmbiental | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [uploadedPdfPath, setUploadedPdfPath] = useState<string | null>(null);
  const [renovatingLicense, setRenovatingLicense] = useState<LicencaAmbiental | null>(null);
  const [isRenovacaoDialogOpen, setIsRenovacaoDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: licencas = [], isLoading } = useQuery<LicencaAmbiental[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"],
  });

  const licencasAtivas = licencas.filter(l => l.status === 'ativa');
  const licencasVencidas = licencas.filter(l => l.status === 'vencida');
  const licencasAVencer = licencas.filter(l => l.status === 'a_vencer');
  const licencasFinalizadas = licencas.filter(l => l.status === 'finalizada');
  const licencasEmRenovacao = licencas.filter(l => l.status === 'em_renovacao');

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      numero: "",
      tipo: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
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
      setUploadedPdfPath(null);
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
      await apiRequest("DELETE", `/api/licencas/${id}`);
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

  const finalizarLicenca = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/licencas/${id}/finalizar`, {});
      return response.json();
    },
  });

  const renovacaoForm = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: { numero: "", tipo: "", orgaoEmissor: "", dataEmissao: "", validade: "", arquivoPdf: "" },
  });
  const [renovacaoPdfPath, setRenovacaoPdfPath] = useState<string | null>(null);
  const [renovacaoPdfUploading, setRenovacaoPdfUploading] = useState(false);

  const createRenovacao = useMutation({
    mutationFn: async (data: LicenseFormData & { predecessorId: number }) => {
      const response = await apiRequest("POST", "/api/licencas", { ...data, empreendimentoId });
      return response.json();
    },
    onSuccess: async (_, variables) => {
      await finalizarLicenca.mutateAsync(variables.predecessorId);
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });
      toast({ title: "Renovação concluída", description: "Nova licença criada e a anterior marcada como finalizada." });
      setIsRenovacaoDialogOpen(false);
      setRenovatingLicense(null);
      setRenovacaoPdfPath(null);
      renovacaoForm.reset();
    },
    onError: () => {
      toast({ title: "Erro", description: "Erro ao processar renovação. Tente novamente.", variant: "destructive" });
    },
  });

  const handleRenovar = (license: LicencaAmbiental) => {
    setRenovatingLicense(license);
    setRenovacaoPdfPath(null);
    renovacaoForm.reset({
      numero: "",
      tipo: license.tipo,
      tipoOutorga: (license as any).tipoOutorga || "",
      orgaoEmissor: license.orgaoEmissor,
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
    });
    setIsRenovacaoDialogOpen(true);
  };

  const onRenovacaoSubmit = (data: LicenseFormData) => {
    if (!renovatingLicense) return;
    const finalData = renovacaoPdfPath ? { ...data, arquivoPdf: renovacaoPdfPath } : data;
    createRenovacao.mutate({ ...finalData, predecessorId: renovatingLicense.id });
  };

  const onSubmit = (data: LicenseFormData) => {
    const finalData = uploadedPdfPath ? { ...data, arquivoPdf: uploadedPdfPath } : data;
    console.log("[LicencasTab] onSubmit arquivoPdf:", finalData.arquivoPdf);
    if (editingLicense) {
      updateLicense.mutate(finalData);
    } else {
      createLicense.mutate(finalData);
    }
  };

  const handleEdit = (license: LicencaAmbiental) => {
    setEditingLicense(license);
    setUploadedPdfPath(null);
    form.reset({
      numero: license.numero || "",
      tipo: license.tipo,
      tipoOutorga: (license as any).tipoOutorga || "",
      orgaoEmissor: license.orgaoEmissor,
      dataEmissao: license.dataEmissao,
      validade: license.validade,
      arquivoPdf: license.arquivoPdf || "",
    });
    setIsDialogOpen(true);
  };

  const handleNewLicense = () => {
    setEditingLicense(null);
    form.reset({
      numero: "",
      tipo: "",
      tipoOutorga: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
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
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (val !== "Licença de Outorga") {
                              form.setValue("tipoOutorga", "");
                            }
                          }}
                          value={field.value}
                        >
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

                  {form.watch("tipo") === "Licença de Outorga" && (
                    <FormField
                      control={form.control}
                      name="tipoOutorga"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Outorga *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo de outorga" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="superficial">Superficial</SelectItem>
                              <SelectItem value="subterranea">Subterrânea</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

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
                    name="arquivoPdf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Arquivo PDF da licença (opcional)</FormLabel>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md hover:border-primary/50 transition-colors">
                          <div className="space-y-1 text-center">
                            {pdfUploading ? (
                              <Loader2 className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
                            ) : (
                              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                            )}
                            <div className="flex text-sm text-muted-foreground justify-center">
                              <label className="relative cursor-pointer bg-background rounded-md font-medium text-primary hover:text-primary/80">
                                <span>{pdfUploading ? "Enviando..." : "Faça upload do arquivo"}</span>
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="sr-only"
                                  disabled={pdfUploading}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setPdfUploading(true);
                                    try {
                                      const formData = new FormData();
                                      formData.append("file", file);
                                      const response = await apiRequestFormData("POST", "/api/upload/pdf/server", formData);
                                      const result = await response.json();
                                      console.log("[LicencasTab] upload result:", result);
                                      if (result.filePath) {
                                        setUploadedPdfPath(result.filePath);
                                        form.setValue("arquivoPdf", result.filePath, { shouldValidate: true, shouldDirty: true });
                                        console.log("[LicencasTab] uploadedPdfPath set to:", result.filePath);
                                        toast({ title: "Upload realizado", description: "PDF enviado com sucesso!" });
                                      }
                                    } catch (err) {
                                      toast({ title: "Erro no upload", description: "Falha ao enviar o arquivo. Tente novamente.", variant: "destructive" });
                                    } finally {
                                      setPdfUploading(false);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                              </label>
                              <p className="pl-1">ou arraste e solte</p>
                            </div>
                            <p className="text-xs text-muted-foreground">Apenas arquivos PDF até 20MB</p>
                          </div>
                        </div>
                        {uploadedPdfPath ? (
                          <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                            <CheckCircle className="h-3 w-3" />
                            PDF pronto para salvar — clique em Salvar
                          </p>
                        ) : field.value && !(field.value.toLowerCase().startsWith("/files/") || field.value.toLowerCase().startsWith("object:") || field.value.toLowerCase().startsWith("http")) ? (
                          <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            Arquivo legado — faça o upload acima para substituir
                          </p>
                        ) : field.value && (field.value.toLowerCase().startsWith("/files/") || field.value.toLowerCase().startsWith("object:") || field.value.toLowerCase().startsWith("http")) ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <CheckCircle className="h-3 w-3" />
                            Arquivo atual vinculado. Faça upload para substituir.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => { setIsDialogOpen(false); setUploadedPdfPath(null); }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createLicense.isPending || updateLicense.isPending || pdfUploading}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {createLicense.isPending || updateLicense.isPending ? "Salvando..." : pdfUploading ? "Aguardando upload..." : "Salvar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

        {licencasEmRenovacao.length > 0 && (
          <Card className="shadow-sm border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <RefreshCcw className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Em Renovação</p>
                  <p className="text-2xl font-bold text-blue-700">{licencasEmRenovacao.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-xs text-muted-foreground">Finalizadas</p>
                <p className="text-2xl font-bold text-slate-600">{licencasFinalizadas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Diálogo de Renovação */}
      <Dialog open={isRenovacaoDialogOpen} onOpenChange={(open) => { setIsRenovacaoDialogOpen(open); if (!open) { setRenovatingLicense(null); setRenovacaoPdfPath(null); renovacaoForm.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <RefreshCw className="h-5 w-5" />
              Renovar Licença
            </DialogTitle>
          </DialogHeader>
          {renovatingLicense && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-2 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">Renovando: {renovatingLicense.tipo} — {renovatingLicense.numero}</p>
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">Ao salvar, esta licença será marcada como <strong>Finalizada</strong> e a nova será cadastrada.</p>
            </div>
          )}
          <Form {...renovacaoForm}>
            <form onSubmit={renovacaoForm.handleSubmit(onRenovacaoSubmit)} className="space-y-4">
              <FormField control={renovacaoForm.control} name="numero" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da nova licença *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: LO 001/2025" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={renovacaoForm.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de licença *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {licenseTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {renovacaoForm.watch("tipo") === "Licença de Outorga" && (
                <FormField control={renovacaoForm.control} name="tipoOutorga" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Outorga *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="superficial">Superficial</SelectItem>
                        <SelectItem value="subterranea">Subterrânea</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              <FormField control={renovacaoForm.control} name="orgaoEmissor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Órgão emissor *</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: INEMA, IBAMA" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={renovacaoForm.control} name="dataEmissao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de emissão *</FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={renovacaoForm.control} name="validade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade *</FormLabel>
                    <FormControl><Input {...field} type="date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={renovacaoForm.control} name="arquivoPdf" render={({ field }) => (
                <FormItem>
                  <FormLabel>PDF da nova licença (opcional)</FormLabel>
                  <div className="mt-1 flex justify-center px-6 pt-4 pb-5 border-2 border-border border-dashed rounded-md hover:border-primary/50 transition-colors">
                    <div className="space-y-1 text-center">
                      {renovacaoPdfUploading ? (
                        <Loader2 className="mx-auto h-7 w-7 text-muted-foreground animate-spin" />
                      ) : (
                        <Upload className="mx-auto h-7 w-7 text-muted-foreground" />
                      )}
                      <div className="flex text-sm text-muted-foreground justify-center">
                        <label className="relative cursor-pointer bg-background rounded-md font-medium text-primary hover:text-primary/80">
                          <span>{renovacaoPdfUploading ? "Enviando..." : "Faça upload do PDF"}</span>
                          <input type="file" accept=".pdf" className="sr-only" disabled={renovacaoPdfUploading} onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setRenovacaoPdfUploading(true);
                            try {
                              const formData = new FormData();
                              formData.append("file", file);
                              const response = await apiRequestFormData("POST", "/api/upload/pdf/server", formData);
                              const result = await response.json();
                              if (result.filePath) {
                                setRenovacaoPdfPath(result.filePath);
                                renovacaoForm.setValue("arquivoPdf", result.filePath, { shouldValidate: true });
                                toast({ title: "Upload realizado", description: "PDF enviado com sucesso!" });
                              }
                            } catch {
                              toast({ title: "Erro no upload", description: "Falha ao enviar o arquivo.", variant: "destructive" });
                            } finally {
                              setRenovacaoPdfUploading(false);
                              e.target.value = "";
                            }
                          }} />
                        </label>
                        <p className="pl-1">ou arraste e solte</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Apenas PDF até 20MB</p>
                    </div>
                  </div>
                  {renovacaoPdfPath && (
                    <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                      <CheckCircle className="h-3 w-3" /> PDF pronto — clique em Salvar
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setIsRenovacaoDialogOpen(false); setRenovatingLicense(null); }}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createRenovacao.isPending || finalizarLicenca.isPending || renovacaoPdfUploading} className="bg-emerald-600 hover:bg-emerald-700">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {createRenovacao.isPending || finalizarLicenca.isPending ? "Processando..." : "Confirmar Renovação"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {licencas.length > 0 ? (
        <div className="space-y-4">
          {licencas.map((license) => (
            <Card key={license.id} className={`shadow-sm hover:shadow-md transition-shadow ${license.status === 'finalizada' ? 'opacity-70 border-slate-200 dark:border-slate-700' : license.status === 'em_renovacao' ? 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2 flex-wrap gap-2">
                      <h4 className="text-lg font-semibold text-card-foreground">
                        {license.tipo}
                        {(license as any).tipoOutorga && (
                          <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                            — {(license as any).tipoOutorga === "superficial" ? "Superficial" : "Subterrânea"}
                          </span>
                        )}
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
                    {license.arquivoPdf && (
                      <div className="mt-2">
                        {(license.arquivoPdf.toLowerCase().startsWith("/files/") || license.arquivoPdf.toLowerCase().startsWith("object:") || license.arquivoPdf.toLowerCase().startsWith("http")) ? (
                          <a 
                            href={`/api/licencas/${license.id}/arquivo`}
                            className="text-primary hover:underline text-sm flex items-center gap-1"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3 w-3" />
                            Baixar PDF
                          </a>
                        ) : (
                          <span className="text-xs text-amber-600 flex items-center gap-1" title="Arquivo salvo no sistema anterior. Edite a licença e faça o upload novamente.">
                            <AlertTriangle className="h-3 w-3" />
                            Arquivo legado — faça o re-upload
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4 flex-wrap justify-end">
                    <Link href={`/licencas/${license.id}`}>
                      <Button variant="default" size="sm" className="gap-1">
                        <Shield className="h-4 w-4" />
                        Detalhes
                      </Button>
                    </Link>
                    {license.status === 'vencida' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRenovar(license)}
                        className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                        title="Renovar licença — cria nova licença e marca esta como finalizada"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Renovar
                      </Button>
                    )}
                    {license.status !== 'finalizada' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(license)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
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
