import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, DollarSign, Calendar, Edit, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { insertContratoAditivoSchema, insertContratoPagamentoSchema } from "@shared/schema";

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

export function ContratosTab({ empreendimentoId }: ContratosTabProps) {
  const { toast } = useToast();
  const [selectedContrato, setSelectedContrato] = useState<number | null>(null);
  
  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"],
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando contratos...</div>;
  }

  const contrato = selectedContrato 
    ? contratos.find(c => c.id === selectedContrato) 
    : contratos[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Contratos</h3>
        <Button data-testid="button-new-contrato">
          <Plus className="mr-2 h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {contratos.length > 0 ? (
        <>
          {/* Seletor de contratos */}
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
              {/* Resumo do contrato */}
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
                    <Badge className={contrato.situacao === 'vigente' ? 'bg-green-500' : 'bg-red-500'} data-testid={`badge-situacao-${contrato.id}`}>
                      {contrato.situacao}
                    </Badge>
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
                </CardContent>
              </Card>

              {/* Aditivos */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Aditivos</CardTitle>
                    <AditivoDialog contratoId={contrato.id} />
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
                                <p>
                                  Assinatura: {formatDate(aditivo.dataAssinatura)}
                                </p>
                                {aditivo.valorAdicional && (
                                  <p>
                                    Valor: R$ {Number(aditivo.valorAdicional).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                                {aditivo.vigenciaNovaFim && (
                                  <p>
                                    Nova vigência: {formatDate(aditivo.vigenciaNovaFim)}
                                  </p>
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

              {/* Pagamentos */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Pagamentos</CardTitle>
                    <PagamentoDialog contratoId={contrato.id} />
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
                                <Badge 
                                  className={
                                    pag.status === 'pago' ? 'bg-green-500' : 
                                    pag.status === 'atrasado' ? 'bg-red-500' : 'bg-yellow-500'
                                  }
                                  data-testid={`badge-pagamento-status-${pag.id}`}
                                >
                                  {pag.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-muted-foreground">
                                <p>
                                  Previsto: R$ {Number(pag.valorPrevisto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p>
                                  Data prevista: {formatDate(pag.dataPrevista)}
                                </p>
                                {pag.valorPago && (
                                  <p>
                                    Pago: R$ {Number(pag.valorPago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                                {pag.dataPagamento && (
                                  <p>
                                    Data pagamento: {formatDate(pag.dataPagamento)}
                                  </p>
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
          <Button data-testid="button-new-contrato-empty">
            <Plus className="mr-2 h-4 w-4" />
            Novo Contrato
          </Button>
        </div>
      )}
    </div>
  );
}

// Dialog para adicionar aditivo
function AditivoDialog({ contratoId }: { contratoId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<z.infer<typeof insertContratoAditivoSchema>>({
    resolver: zodResolver(insertContratoAditivoSchema),
    defaultValues: {
      contratoId,
      descricao: "",
      dataAssinatura: new Date().toISOString().split('T')[0],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertContratoAditivoSchema>) => {
      return apiRequest(`/api/contratos/${contratoId}/aditivos`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
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

// Dialog para adicionar pagamento
function PagamentoDialog({ contratoId }: { contratoId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<z.infer<typeof insertContratoPagamentoSchema>>({
    resolver: zodResolver(insertContratoPagamentoSchema),
    defaultValues: {
      contratoId,
      descricao: "",
      valorPrevisto: "0",
      dataPrevista: new Date().toISOString().split('T')[0],
      status: "pendente",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertContratoPagamentoSchema>) => {
      return apiRequest(`/api/contratos/${contratoId}/pagamentos`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
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
                    <Input {...field} data-testid="input-pagamento-descricao" />
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
                    <FormLabel>Valor Previsto</FormLabel>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-pagamento-status">
                        <SelectValue />
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
