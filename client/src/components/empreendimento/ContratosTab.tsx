import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FileText, DollarSign, Calendar, Plus, Edit, Trash2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  empreendimentoId: number;
};

const SITUACAO_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  vigente: { label: "Vigente", color: "bg-green-100 text-green-800", icon: CheckCircle },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800", icon: AlertCircle },
  suspenso: { label: "Suspenso", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  encerrado: { label: "Encerrado", color: "bg-gray-100 text-gray-800", icon: FileText },
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

type ContratoForm = {
  numero: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  situacao: string;
  valorTotal: string;
  observacoes: string;
};

const emptyForm: ContratoForm = {
  numero: "",
  objeto: "",
  vigenciaInicio: "",
  vigenciaFim: "",
  situacao: "vigente",
  valorTotal: "",
  observacoes: "",
};

export function ContratosTab({ empreendimentoId }: ContratosTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [contratoToDelete, setContratoToDelete] = useState<Contrato | null>(null);
  const [form, setForm] = useState<ContratoForm>(emptyForm);

  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/empreendimentos/${empreendimentoId}/contratos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Contrato criado", description: "O contrato foi cadastrado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/empreendimentos/${empreendimentoId}/contratos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Contrato atualizado", description: "O contrato foi atualizado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/empreendimentos/${empreendimentoId}/contratos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Contrato excluído", description: "O contrato foi removido com sucesso." });
      setDeleteDialogOpen(false);
      setContratoToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingContrato(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setForm({
      numero: contrato.numero,
      objeto: contrato.objeto,
      vigenciaInicio: contrato.vigenciaInicio,
      vigenciaFim: contrato.vigenciaFim,
      situacao: contrato.situacao,
      valorTotal: contrato.valorTotal,
      observacoes: contrato.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingContrato(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (!form.numero.trim() || !form.objeto.trim()) {
      toast({ title: "Erro", description: "Número e objeto do contrato são obrigatórios.", variant: "destructive" });
      return;
    }

    const data = {
      numero: form.numero,
      objeto: form.objeto,
      vigenciaInicio: form.vigenciaInicio,
      vigenciaFim: form.vigenciaFim,
      situacao: form.situacao,
      valorTotal: form.valorTotal || "0",
      observacoes: form.observacoes || null,
    };

    if (editingContrato) {
      updateMutation.mutate({ id: editingContrato.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (contrato: Contrato) => {
    setContratoToDelete(contrato);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contratoToDelete) {
      deleteMutation.mutate(contratoToDelete.id);
    }
  };

  const contratosVigentes = contratos.filter(c => c.situacao === 'vigente');
  const contratosVencidos = contratos.filter(c => c.situacao === 'vencido');
  const valorTotalContratos = contratos.reduce((sum, c) => sum + Number(c.valorTotal || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando contratos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contratos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} vinculado{contratos.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2" data-testid="button-novo-contrato">
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{contratos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vigentes</p>
                <p className="text-2xl font-bold text-green-700">{contratosVigentes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-700">{contratosVencidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(valorTotalContratos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {contratos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {contratos.map((contrato) => {
            const config = SITUACAO_CONFIG[contrato.situacao] || SITUACAO_CONFIG.vigente;
            const StatusIcon = config.icon;
            
            return (
              <Card key={contrato.id} className="hover:shadow-md transition-shadow" data-testid={`card-contrato-${contrato.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate" data-testid={`text-contrato-numero-${contrato.id}`}>
                        Contrato {contrato.numero}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {contrato.objeto}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={config.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(contrato)} data-testid={`button-edit-${contrato.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contrato)} data-testid={`button-delete-${contrato.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Valor Total
                      </p>
                      <p className="font-medium">{formatCurrency(contrato.valorTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Vigência
                      </p>
                      <p className="font-medium text-sm">
                        {formatDate(contrato.vigenciaInicio)} - {formatDate(contrato.vigenciaFim)}
                      </p>
                    </div>
                  </div>

                  {contrato.observacoes && (
                    <p className="text-sm text-muted-foreground mt-3 pt-3 border-t line-clamp-2">
                      {contrato.observacoes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhum contrato cadastrado
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui contratos. Clique no botão acima para criar o primeiro.
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Contrato
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero">Número do Contrato *</Label>
                <Input
                  id="numero"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="Ex: CT-2025-001"
                />
              </div>
              <div>
                <Label htmlFor="situacao">Situação</Label>
                <Select value={form.situacao} onValueChange={(value) => setForm({ ...form, situacao: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="objeto">Objeto do Contrato *</Label>
                <Textarea
                  id="objeto"
                  value={form.objeto}
                  onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                  placeholder="Descrição do objeto do contrato"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="vigenciaInicio">Início da Vigência</Label>
                <Input
                  id="vigenciaInicio"
                  type="date"
                  value={form.vigenciaInicio}
                  onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vigenciaFim">Fim da Vigência</Label>
                <Input
                  id="vigenciaFim"
                  type="date"
                  value={form.vigenciaFim}
                  onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="valorTotal">Valor Total</Label>
                <Input
                  id="valorTotal"
                  type="number"
                  step="0.01"
                  value={form.valorTotal}
                  onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações adicionais"
                  rows={2}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingContrato ? "Salvar Alterações" : "Criar Contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contrato "{contratoToDelete?.numero}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
