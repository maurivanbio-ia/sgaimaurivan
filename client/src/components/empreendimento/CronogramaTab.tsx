import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar, Check, X } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { insertCronogramaItemSchema } from "@shared/schema";

export interface CronogramaTabProps {
  empreendimentoId: number;
}

type CronogramaItem = {
  id: number;
  etapa: string;
  dataInicio: string;
  dataFim: string;
  concluido: boolean;
  responsavel: string | null;
  observacoes: string | null;
};

export function CronogramaTab({ empreendimentoId }: CronogramaTabProps) {
  const { toast } = useToast();
  
  const { data: itens = [], isLoading } = useQuery<CronogramaItem[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "cronograma"],
  });

  const toggleConcluido = useMutation({
    mutationFn: async ({ id, concluido }: { id: number; concluido: boolean }) => {
      return apiRequest(`/api/cronograma/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ concluido }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "cronograma"] });
      toast({ title: "Status atualizado!" });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando cronograma...</div>;
  }

  // Calcular progress
  const totalItens = itens.length;
  const itensConcluidos = itens.filter(i => i.concluido).length;
  const progress = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Cronograma Executivo</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {itensConcluidos} de {totalItens} etapas concluídas ({progress}%)
          </p>
        </div>
        <CronogramaDialog empreendimentoId={empreendimentoId} />
      </div>

      {/* Barra de progresso */}
      {totalItens > 0 && (
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-all" 
            style={{ width: `${progress}%` }}
            data-testid="progress-bar"
          />
        </div>
      )}

      {itens.length > 0 ? (
        <div className="space-y-4">
          {itens.map((item) => {
            const hoje = new Date();
            const dataFim = new Date(item.dataFim);
            const atrasado = !item.concluido && dataFim < hoje;
            
            return (
              <Card key={item.id} className={atrasado ? "border-red-500" : ""} data-testid={`card-cronograma-${item.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={item.concluido}
                      onCheckedChange={(checked) => 
                        toggleConcluido.mutate({ id: item.id, concluido: !!checked })
                      }
                      data-testid={`checkbox-concluido-${item.id}`}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${item.concluido ? 'line-through text-muted-foreground' : ''}`} data-testid={`text-etapa-${item.id}`}>
                          {item.etapa}
                        </h4>
                        {atrasado && (
                          <Badge variant="destructive" data-testid={`badge-atrasado-${item.id}`}>
                            Atrasado
                          </Badge>
                        )}
                        {item.concluido && (
                          <Badge className="bg-green-500" data-testid={`badge-concluido-${item.id}`}>
                            <Check className="mr-1 h-3 w-3" />
                            Concluído
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Início:</p>
                          <p className="font-medium" data-testid={`text-data-inicio-${item.id}`}>
                            {formatDate(item.dataInicio)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Fim:</p>
                          <p className="font-medium" data-testid={`text-data-fim-${item.id}`}>
                            {formatDate(item.dataFim)}
                          </p>
                        </div>
                        {item.responsavel && (
                          <div>
                            <p className="text-muted-foreground">Responsável:</p>
                            <p className="font-medium" data-testid={`text-responsavel-${item.id}`}>
                              {item.responsavel}
                            </p>
                          </div>
                        )}
                      </div>
                      {item.observacoes && (
                        <p className="text-sm text-muted-foreground mt-2" data-testid={`text-observacoes-${item.id}`}>
                          {item.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhuma etapa no cronograma
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando as etapas do cronograma executivo
          </p>
          <CronogramaDialog empreendimentoId={empreendimentoId} />
        </div>
      )}
    </div>
  );
}

function CronogramaDialog({ empreendimentoId }: { empreendimentoId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  const form = useForm<z.infer<typeof insertCronogramaItemSchema>>({
    resolver: zodResolver(insertCronogramaItemSchema),
    defaultValues: {
      empreendimentoId,
      etapa: "",
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
      concluido: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertCronogramaItemSchema>) => {
      return apiRequest(`/api/cronograma`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "cronograma"] });
      toast({ title: "Etapa adicionada com sucesso!" });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar etapa", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-cronograma">
          <Plus className="mr-2 h-4 w-4" />
          Nova Etapa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Etapa ao Cronograma</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="etapa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Etapa</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-etapa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-data-inicio" />
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
                    <FormLabel>Data de Fim</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-data-fim" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="responsavel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-responsavel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} data-testid="input-observacoes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-cronograma">
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-cronograma">
                {mutation.isPending ? "Salvando..." : "Salvar Etapa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
