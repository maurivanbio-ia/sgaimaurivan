import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, DollarSign, Calendar, Edit, Trash2, Upload, Loader2, Download, X } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

export interface ContratosTabProps {
  empreendimentoId: number;
}

type Contrato = {
  id: number;
  numero: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  situacao: string;
  valorTotal: string;
  arquivoPdfId?: number | null;
  observacoes?: string | null;
  aditivos?: Aditivo[];
  pagamentos?: Pagamento[];
};

type Aditivo = {
  id: number;
  descricao: string;
  valorAdicional: string | null;
  vigenciaNovaFim: string | null;
  dataAssinatura: string;
};

type Pagamento = {
  id: number;
  descricao: string;
  valorPrevisto: string;
  dataPrevista: string;
  valorPago: string | null;
  dataPagamento: string | null;
  status: string;
};

const contratoFormSchema = z.object({
  numero: z.string().min(1, "Número do contrato é obrigatório"),
  objeto: z.string().min(1, "Objeto do contrato é obrigatório"),
  vigenciaInicio: z.string().min(1, "Data de início é obrigatória"),
  vigenciaFim: z.string().min(1, "Data de fim é obrigatória"),
  situacao: z.string().default("vigente"),
  valorTotal: z.string().min(1, "Valor total é obrigatório"),
  observacoes: z.string().optional().nullable(),
});

type ContratoFormData = z.infer<typeof contratoFormSchema>;

const aditivoFormSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorAdicional: z.string().optional().nullable(),
  vigenciaNovaFim: z.string().optional().nullable(),
  dataAssinatura: z.string().min(1, "Data de assinatura é obrigatória"),
});

type AditivoFormData = z.infer<typeof aditivoFormSchema>;

const pagamentoFormSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valorPrevisto: z.string().min(1, "Valor previsto é obrigatório"),
  dataPrevista: z.string().min(1, "Data prevista é obrigatória"),
  status: z.string().default("pendente"),
});

type PagamentoFormData = z.infer<typeof pagamentoFormSchema>;

export function ContratosTab({ empreendimentoId }: ContratosTabProps) {
  const { toast } = useToast();
  const [selectedContrato, setSelectedContrato] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"],
  });

  const form = useForm<ContratoFormData>({
    resolver: zodResolver(contratoFormSchema),
    defaultValues: {
      numero: "",
      objeto: "",
      vigenciaInicio: new Date().toISOString().split('T')[0],
      vigenciaFim: new Date().toISOString().split('T')[0],
      situacao: "vigente",
      valorTotal: "0",
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContratoFormData) => {
      return apiRequest("POST", "/api/contratos", {
        ...data,
        empreendimentoId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Contrato criado com sucesso!" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao criar contrato", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ContratoFormData) => {
      return apiRequest("PATCH", `/api/contratos/${editingContrato?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Contrato atualizado com sucesso!" });
      setDialogOpen(false);
      setEditingContrato(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar contrato", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/contratos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contratos"] });
      toast({ title: "Contrato excluído com sucesso!" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir contrato", variant: "destructive" });
    },
  });

  const handleOpenDialog = (contrato?: Contrato) => {
    if (contrato) {
      setEditingContrato(contrato);
      form.reset({
        numero: contrato.numero,
        objeto: contrato.objeto,
        vigenciaInicio: contrato.vigenciaInicio,
        vigenciaFim: contrato.vigenciaFim,
        situacao: contrato.situacao,
        valorTotal: contrato.valorTotal,
        observacoes: contrato.observacoes || "",
      });
    } else {
      setEditingContrato(null);
      form.reset({
        numero: "",
        objeto: "",
        vigenciaInicio: new Date().toISOString().split('T')[0],
        vigenciaFim: new Date().toISOString().split('T')[0],
        situacao: "vigente",
        valorTotal: "0",
        observacoes: "",
      });
    }
    setDialogOpen(true);
  };

  const onSubmit = (data: ContratoFormData) => {
    if (editingContrato) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, contratoId: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("contratoId", contratoId.toString());

    try {
      const response = await fetch("/api/contratos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
        toast({ title: "Documento anexado com sucesso!" });
      } else {
        toast({ title: "Erro ao anexar documento", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao anexar documento", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const contrato = selectedContrato 
    ? contratos.find(c => c.id === selectedContrato) 
    : contratos[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Contratos</h3>
        <Button onClick={() => handleOpenDialog()} data-testid="button-new-contrato">
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {contratos.length > 0 ? (
        <>
          {contratos.length > 1 && (
            <Select value={selectedContrato?.toString() || contratos[0].id.toString()} onValueChange={(v) => setSelectedContrato(Number(v))}>
              <SelectTrigger data-testid="select-contrato">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contratos.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.numero} - {c.objeto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {contrato && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle data-testid={`text-contrato-numero-${contrato.id}`}>
                        Contrato {contrato.numero}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-contrato-objeto-${contrato.id}`}>
                        {contrato.objeto}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={contrato.situacao === 'vigente' ? 'bg-green-500' : 'bg-red-500'} data-testid={`badge-situacao-${contrato.id}`}>
                        {contrato.situacao}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(contrato)} data-testid={`button-edit-contrato-${contrato.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(contrato.id)} data-testid={`button-delete-contrato-${contrato.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Vigência:</p>
                      <p className="font-medium" data-testid={`text-vigencia-${contrato.id}`}>
                        {formatDate(contrato.vigenciaInicio)} até {formatDate(contrato.vigenciaFim)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valor Total:</p>
                      <p className="font-medium text-lg" data-testid={`text-valor-${contrato.id}`}>
                        R$ {Number(contrato.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Aditivos:</p>
                      <p className="font-medium" data-testid={`text-aditivos-count-${contrato.id}`}>
                        {contrato.aditivos?.length || 0}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">Documento do Contrato:</p>
                        {contrato.arquivoPdfId ? (
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-500" />
                            <span className="text-sm">Documento anexado</span>
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/api/arquivos/${contrato.arquivoPdfId}/download`} target="_blank" data-testid={`button-download-${contrato.id}`}>
                                <Download className="h-4 w-4 mr-1" />
                                Baixar
                              </a>
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum documento anexado</p>
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileUpload(e, contrato.id)}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                          data-testid={`button-upload-${contrato.id}`}
                        >
                          {uploadingFile ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {contrato.arquivoPdfId ? "Substituir" : "Anexar"} Documento
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Aditivos</CardTitle>
                    <AditivoDialog contratoId={contrato.id} empreendimentoId={empreendimentoId} />
                  </div>
                </CardHeader>
                <CardContent>
                  {contrato.aditivos && contrato.aditivos.length > 0 ? (
                    <div className="space-y-3">
                      {contrato.aditivos.map((aditivo) => (
                        <div key={aditivo.id} className="border rounded-lg p-4" data-testid={`card-aditivo-${aditivo.id}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium" data-testid={`text-aditivo-descricao-${aditivo.id}`}>
                                {aditivo.descricao}
                              </p>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                                <p>Assinatura: {formatDate(aditivo.dataAssinatura)}</p>
                                {aditivo.valorAdicional && (
                                  <p>Valor: R$ {Number(aditivo.valorAdicional).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                )}
                                {aditivo.vigenciaNovaFim && (
                                  <p>Nova vigência: {formatDate(aditivo.vigenciaNovaFim)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">Nenhum aditivo cadastrado</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Pagamentos</CardTitle>
                    <PagamentoDialog contratoId={contrato.id} empreendimentoId={empreendimentoId} />
                  </div>
                </CardHeader>
                <CardContent>
                  {contrato.pagamentos && contrato.pagamentos.length > 0 ? (
                    <div className="space-y-3">
                      {contrato.pagamentos.map((pag) => (
                        <div key={pag.id} className="border rounded-lg p-4" data-testid={`card-pagamento-${pag.id}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium" data-testid={`text-pagamento-descricao-${pag.id}`}>
                                  {pag.descricao}
                                </p>
                                <Badge className={
                                  pag.status === 'pago' ? 'bg-green-500' : 
                                  pag.status === 'atrasado' ? 'bg-red-500' : 
                                  'bg-yellow-500'
                                }>
                                  {pag.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                                <p>Valor previsto: R$ {Number(pag.valorPrevisto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p>Data prevista: {formatDate(pag.dataPrevista)}</p>
                                {pag.valorPago && (
                                  <p>Valor pago: R$ {Number(pag.valorPago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                )}
                                {pag.dataPagamento && (
                                  <p>Data pagamento: {formatDate(pag.dataPagamento)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">Nenhum pagamento cadastrado</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhum contrato cadastrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece cadastrando o primeiro contrato para este empreendimento
          </p>
          <Button onClick={() => handleOpenDialog()} data-testid="button-new-contrato-empty">
            <Plus className="mr-2 h-4 w-4" />
            Novo Contrato
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Contrato</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: CT-2024-001" data-testid="input-contrato-numero" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="situacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situação</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-contrato-situacao">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="vigente">Vigente</SelectItem>
                          <SelectItem value="vencido">Vencido</SelectItem>
                          <SelectItem value="rescindido">Rescindido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="objeto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objeto do Contrato</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Descreva o objeto do contrato" data-testid="input-contrato-objeto" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="vigenciaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início da Vigência</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-contrato-inicio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vigenciaFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim da Vigência</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-contrato-fim" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valorTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-contrato-valor" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Observações adicionais" data-testid="input-contrato-obs" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-contrato">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-contrato">
                  {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingContrato ? "Atualizar" : "Criar Contrato"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AditivoDialog({ contratoId, empreendimentoId }: { contratoId: number; empreendimentoId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<AditivoFormData>({
    resolver: zodResolver(aditivoFormSchema),
    defaultValues: {
      descricao: "",
      valorAdicional: "",
      vigenciaNovaFim: "",
      dataAssinatura: new Date().toISOString().split('T')[0],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: AditivoFormData) => {
      return apiRequest("POST", `/api/contratos/${contratoId}/aditivos`, {
        ...data,
        contratoId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Aditivo adicionado com sucesso!" });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar aditivo", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-new-aditivo">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Aditivo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Aditivo</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Aditivo</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-aditivo-descricao" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valorAdicional"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Adicional (opcional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value || ""} data-testid="input-aditivo-valor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vigenciaNovaFim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Data Fim (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-aditivo-vigencia" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dataAssinatura"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Assinatura</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-aditivo-data" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-aditivo">
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-aditivo">
                {mutation.isPending ? "Salvando..." : "Salvar Aditivo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PagamentoDialog({ contratoId, empreendimentoId }: { contratoId: number; empreendimentoId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<PagamentoFormData>({
    resolver: zodResolver(pagamentoFormSchema),
    defaultValues: {
      descricao: "",
      valorPrevisto: "0",
      dataPrevista: new Date().toISOString().split('T')[0],
      status: "pendente",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PagamentoFormData) => {
      return apiRequest("POST", `/api/contratos/${contratoId}/pagamentos`, {
        ...data,
        contratoId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Pagamento adicionado com sucesso!" });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar pagamento", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-new-pagamento">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Pagamento</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Parcela 1/12" data-testid="input-pagamento-descricao" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valorPrevisto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Previsto (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-pagamento-valor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dataPrevista"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Prevista</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-pagamento-data" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-pagamento-status">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-pagamento">
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-pagamento">
                {mutation.isPending ? "Salvando..." : "Salvar Pagamento"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
