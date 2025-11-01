import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, User, FileText, DollarSign, Calendar } from "lucide-react";
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
import { insertRhRegistroSchema } from "@shared/schema";

export interface RhTabProps {
  empreendimentoId: number;
}

type RhRegistro = {
  id: number;
  fornecedor: string | null;
  nomeColaborador: string;
  cpf: string | null;
  rg: string | null;
  cnh: string | null;
  seguroNumero: string | null;
  valorTipo: string | null;
  valor: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
};

export function RhTab({ empreendimentoId }: RhTabProps) {
  const { toast } = useToast();
  
  const { data: registros = [], isLoading } = useQuery<RhRegistro[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "rh"],
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando registros de RH...</div>;
  }

  // Agrupar por fornecedor
  const porFornecedor = registros.reduce((acc, reg) => {
    const fornecedor = reg.fornecedor || "Sem Fornecedor";
    if (!acc[fornecedor]) {
      acc[fornecedor] = [];
    }
    acc[fornecedor].push(reg);
    return acc;
  }, {} as Record<string, RhRegistro[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Recursos Humanos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {registros.length} colaborador{registros.length !== 1 ? 'es' : ''} cadastrado{registros.length !== 1 ? 's' : ''}
          </p>
        </div>
        <RhDialog empreendimentoId={empreendimentoId} />
      </div>

      {registros.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(porFornecedor).map(([fornecedor, regs]) => (
            <Card key={fornecedor}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {fornecedor} ({regs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {regs.map((reg) => (
                    <div key={reg.id} className="border rounded-lg p-4" data-testid={`card-rh-${reg.id}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold" data-testid={`text-nome-${reg.id}`}>
                            {reg.nomeColaborador}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm">
                            {reg.cpf && (
                              <div>
                                <p className="text-muted-foreground">CPF:</p>
                                <p className="font-medium" data-testid={`text-cpf-${reg.id}`}>{reg.cpf}</p>
                              </div>
                            )}
                            {reg.rg && (
                              <div>
                                <p className="text-muted-foreground">RG:</p>
                                <p className="font-medium" data-testid={`text-rg-${reg.id}`}>{reg.rg}</p>
                              </div>
                            )}
                            {reg.cnh && (
                              <div>
                                <p className="text-muted-foreground">CNH:</p>
                                <p className="font-medium" data-testid={`text-cnh-${reg.id}`}>{reg.cnh}</p>
                              </div>
                            )}
                          </div>
                          {reg.valor && reg.valorTipo && (
                            <div className="mt-3">
                              <p className="text-sm text-muted-foreground">Valor:</p>
                              <p className="font-medium" data-testid={`text-valor-${reg.id}`}>
                                R$ {Number(reg.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {reg.valorTipo}
                              </p>
                            </div>
                          )}
                          {(reg.dataInicio || reg.dataFim) && (
                            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                              {reg.dataInicio && (
                                <div>
                                  <p className="text-muted-foreground">Início:</p>
                                  <p className="font-medium" data-testid={`text-data-inicio-${reg.id}`}>
                                    {formatDate(reg.dataInicio)}
                                  </p>
                                </div>
                              )}
                              {reg.dataFim && (
                                <div>
                                  <p className="text-muted-foreground">Fim:</p>
                                  <p className="font-medium" data-testid={`text-data-fim-${reg.id}`}>
                                    {formatDate(reg.dataFim)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {(reg.contatoEmail || reg.contatoTelefone) && (
                            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                              {reg.contatoEmail && (
                                <div>
                                  <p className="text-muted-foreground">Email:</p>
                                  <p className="font-medium" data-testid={`text-email-${reg.id}`}>{reg.contatoEmail}</p>
                                </div>
                              )}
                              {reg.contatoTelefone && (
                                <div>
                                  <p className="text-muted-foreground">Telefone:</p>
                                  <p className="font-medium" data-testid={`text-telefone-${reg.id}`}>{reg.contatoTelefone}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhum colaborador cadastrado
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando colaboradores para este empreendimento
          </p>
          <RhDialog empreendimentoId={empreendimentoId} />
        </div>
      )}
    </div>
  );
}

function RhDialog({ empreendimentoId }: { empreendimentoId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<z.infer<typeof insertRhRegistroSchema>>({
    resolver: zodResolver(insertRhRegistroSchema),
    defaultValues: {
      empreendimentoId,
      nomeColaborador: "",
      fornecedor: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertRhRegistroSchema>) => {
      return apiRequest(`/api/rh`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "rh"] });
      toast({ title: "Colaborador adicionado com sucesso!" });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar colaborador", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-rh">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Colaborador</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fornecedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-fornecedor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomeColaborador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Colaborador</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-cpf" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-rg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cnh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNH (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-cnh" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="valorTipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Valor (opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-valor-tipo">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hora">Hora</SelectItem>
                        <SelectItem value="dia">Dia</SelectItem>
                        <SelectItem value="mes">Mês</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (opcional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value || ""} data-testid="input-valor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seguroNumero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do Seguro (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-seguro" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-data-inicio" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dataFim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Fim (opcional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-data-fim" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contatoEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Contato (opcional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} value={field.value || ""} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contatoTelefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone de Contato (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} data-testid="input-telefone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-rh">
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-rh">
                {mutation.isPending ? "Salvando..." : "Salvar Colaborador"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
