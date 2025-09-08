import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Edit, QrCode, Plus, Clock, MapPin, User, DollarSign } from "lucide-react";
import type { EquipamentoWithMovimentacoes, Movimentacao } from "@shared/schema";
import { insertMovimentacaoSchema } from "@shared/schema";

const movimentacaoFormSchema = insertMovimentacaoSchema.extend({
  dataHora: z.string().optional(),
});

type MovimentacaoFormData = z.infer<typeof movimentacaoFormSchema>;

const statusColors = {
  funcionando: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100",
  com_defeito: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100",
  em_manutencao: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100",
  descartado: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
};

const statusLabels = {
  funcionando: "Funcionando",
  com_defeito: "Com Defeito",
  em_manutencao: "Em Manutenção",
  descartado: "Descartado"
};

const tipoMovimentacaoLabels = {
  entrada: "Entrada",
  retirada: "Retirada",
  devolucao: "Devolução",
  manutencao: "Manutenção"
};

export default function EquipamentoDetail() {
  const [, params] = useRoute("/equipamentos/:id");
  const [, navigate] = useLocation();
  const [isMovimentacaoDialogOpen, setIsMovimentacaoDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const equipamentoId = parseInt(params?.id || "0");

  const { data: equipamento, isLoading } = useQuery({
    queryKey: ["/api/equipamentos", equipamentoId],
    queryFn: async () => {
      const res = await fetch(`/api/equipamentos/${equipamentoId}`);
      if (!res.ok) throw new Error('Equipamento não encontrado');
      return res.json() as Promise<EquipamentoWithMovimentacoes>;
    },
    enabled: !!equipamentoId,
  });

  const movimentacaoForm = useForm<MovimentacaoFormData>({
    resolver: zodResolver(movimentacaoFormSchema),
    defaultValues: {
      equipamentoId: equipamentoId,
      tipoMovimentacao: "retirada",
      responsavelAcao: "",
      finalidadeMovimentacao: "",
      observacoes: "",
      localizacaoOrigem: "",
      localizacaoDestino: "",
      statusAnterior: "",
      statusPosterior: "",
    },
  });

  const createMovimentacaoMutation = useMutation({
    mutationFn: async (data: MovimentacaoFormData) => {
      return apiRequest("POST", "/api/movimentacoes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos", equipamentoId] });
      toast({
        title: "Sucesso",
        description: "Movimentação registrada com sucesso!",
      });
      setIsMovimentacaoDialogOpen(false);
      movimentacaoForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao registrar movimentação",
        variant: "destructive",
      });
    },
  });

  const onSubmitMovimentacao = (data: MovimentacaoFormData) => {
    createMovimentacaoMutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR') + ' ' + 
           new Date(dateString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (value: number | string | null) => {
    if (!value) return "-";
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return "-";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando equipamento...</div>
        </div>
      </div>
    );
  }

  if (!equipamento) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="text-muted-foreground">Equipamento não encontrado</div>
          <Button className="mt-4" onClick={() => navigate("/equipamentos")}>
            Voltar para Equipamentos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipment-detail">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/equipamentos")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-equipment-title">
              {equipamento.numeroPatrimonio}
            </h1>
            <p className="text-muted-foreground mt-2">
              {equipamento.marca} {equipamento.modelo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/equipamentos/${equipamento.id}/qr`)}
            data-testid="button-qr-code"
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/equipamentos/${equipamento.id}/editar`)}
            data-testid="button-edit"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="detalhes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentações ({equipamento.movimentacoes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="detalhes" className="space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={statusColors[equipamento.status as keyof typeof statusColors]} data-testid="badge-status">
                  {statusLabels[equipamento.status as keyof typeof statusLabels]}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Localização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-localizacao">
                  {equipamento.localizacaoAtual === 'escritorio' && 'Escritório'}
                  {equipamento.localizacaoAtual === 'cliente' && 'Cliente'}
                  {equipamento.localizacaoAtual === 'colaborador' && 'Colaborador'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <User className="h-4 w-4 inline mr-1" />
                  Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-responsavel">
                  {equipamento.responsavelAtual || "-"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Valor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-valor">
                  {formatCurrency(equipamento.valorAquisicao)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalhes Completos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Equipamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                    <div className="font-medium" data-testid="text-tipo">{equipamento.tipoEquipamento}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Marca</label>
                    <div className="font-medium" data-testid="text-marca">{equipamento.marca}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Modelo</label>
                    <div className="font-medium" data-testid="text-modelo">{equipamento.modelo}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data de Aquisição</label>
                    <div className="font-medium" data-testid="text-data-aquisicao">
                      {formatDate(equipamento.dataAquisicao)}
                    </div>
                  </div>
                </div>
                {equipamento.observacoesGerais && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Observações</label>
                    <div className="mt-1 text-sm" data-testid="text-observacoes">
                      {equipamento.observacoesGerais}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Manutenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Próxima Manutenção</label>
                    <div className="font-medium" data-testid="text-proxima-manutencao">
                      {equipamento.proximaManutencao ? formatDate(equipamento.proximaManutencao) : "Não definida"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Frequência</label>
                    <div className="font-medium" data-testid="text-frequencia-manutencao">
                      {equipamento.frequenciaManutencao 
                        ? equipamento.frequenciaManutencao.charAt(0).toUpperCase() + equipamento.frequenciaManutencao.slice(1)
                        : "Não definida"}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Vida Útil Estimada</label>
                    <div className="font-medium" data-testid="text-vida-util">
                      {equipamento.vidaUtilEstimada ? `${equipamento.vidaUtilEstimada} anos` : "Não definida"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="movimentacoes" className="space-y-6">
          {/* Header das Movimentações */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Histórico de Movimentações</h2>
            <Dialog open={isMovimentacaoDialogOpen} onOpenChange={setIsMovimentacaoDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-new-movement">
                  <Plus className="h-4 w-4" />
                  Nova Movimentação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Registrar Nova Movimentação</DialogTitle>
                </DialogHeader>
                <Form {...movimentacaoForm}>
                  <form onSubmit={movimentacaoForm.handleSubmit(onSubmitMovimentacao)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={movimentacaoForm.control}
                        name="tipoMovimentacao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Movimentação *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-tipo-movimentacao">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="entrada">Entrada</SelectItem>
                                <SelectItem value="retirada">Retirada</SelectItem>
                                <SelectItem value="devolucao">Devolução</SelectItem>
                                <SelectItem value="manutencao">Manutenção</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={movimentacaoForm.control}
                        name="responsavelAcao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Responsável pela Ação *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Nome do responsável"
                                data-testid="input-responsavel-acao"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={movimentacaoForm.control}
                        name="localizacaoOrigem"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Localização de Origem</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Ex: Escritório, Cliente ABC"
                                data-testid="input-localizacao-origem"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={movimentacaoForm.control}
                        name="localizacaoDestino"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Localização de Destino</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ""}
                                placeholder="Ex: Cliente XYZ, Laboratório"
                                data-testid="input-localizacao-destino"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={movimentacaoForm.control}
                      name="finalidadeMovimentacao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Finalidade da Movimentação</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              placeholder="Ex: Trabalho em campo, manutenção preventiva"
                              data-testid="input-finalidade"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={movimentacaoForm.control}
                      name="observacoes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder="Observações adicionais sobre a movimentação"
                              rows={3}
                              data-testid="textarea-observacoes-movimentacao"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-end gap-4 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsMovimentacaoDialogOpen(false)}
                        data-testid="button-cancel-movement"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMovimentacaoMutation.isPending}
                        data-testid="button-save-movement"
                      >
                        {createMovimentacaoMutation.isPending ? "Registrando..." : "Registrar Movimentação"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabela de Movimentações */}
          <Card>
            <CardContent className="p-6">
              {(!equipamento.movimentacoes || equipamento.movimentacoes.length === 0) ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">
                    Nenhuma movimentação registrada para este equipamento
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Origem → Destino</TableHead>
                        <TableHead>Finalidade</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipamento.movimentacoes.map((movimentacao) => (
                        <TableRow key={movimentacao.id} data-testid={`row-movement-${movimentacao.id}`}>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateTime(movimentacao.dataHora.toString())}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`badge-movement-type-${movimentacao.tipoMovimentacao}`}>
                              {tipoMovimentacaoLabels[movimentacao.tipoMovimentacao as keyof typeof tipoMovimentacaoLabels]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {movimentacao.responsavelAcao}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {movimentacao.localizacaoOrigem || "-"} → {movimentacao.localizacaoDestino || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {movimentacao.finalidadeMovimentacao || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {movimentacao.observacoes || "-"}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}