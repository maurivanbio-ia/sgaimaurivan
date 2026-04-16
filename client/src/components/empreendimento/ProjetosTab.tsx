import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FolderKanban, DollarSign, TrendingUp, Calendar, Target, Plus, Edit, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Projeto, User } from "@shared/schema";

export interface ProjetosTabProps {
  empreendimentoId: number;
}

const statusOptions = [
  { value: "em_planejamento", label: "Em Planejamento", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "concluido", label: "Concluído", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "pausado", label: "Pausado", color: "bg-gray-100 text-gray-800 border-gray-200" },
];

const getStatusColor = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.color || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusLabel = (status: string) => {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.label || status;
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

const calcularEficiencia = (valorContratado: string | null, valorRecebido: string | null) => {
  const contratado = Number(valorContratado || 0);
  const recebido = Number(valorRecebido || 0);
  if (contratado === 0) return 0;
  return Math.round((recebido / contratado) * 100);
};

type ProjetoForm = {
  nome: string;
  descricao: string;
  status: string;
  valorContratado: string;
  valorRecebido: string;
  orcamentoPrevisto: string;
  inicioPrevisto: string;
  fimPrevisto: string;
  coordenadorId: string;
};

const emptyForm: ProjetoForm = {
  nome: "",
  descricao: "",
  status: "em_planejamento",
  valorContratado: "",
  valorRecebido: "",
  orcamentoPrevisto: "",
  inicioPrevisto: "",
  fimPrevisto: "",
  coordenadorId: "",
};

export function ProjetosTab({ empreendimentoId }: ProjetosTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<Projeto | null>(null);
  const [projetoToDelete, setProjetoToDelete] = useState<Projeto | null>(null);
  const [form, setForm] = useState<ProjetoForm>(emptyForm);

  const { data: projetos = [], isLoading } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos", empreendimentoId],
    queryFn: async () => {
      const res = await fetch(`/api/projetos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar projetos");
      return res.json();
    },
  });

  const { data: coordenadores = [] } = useQuery<User[]>({
    queryKey: ["/api/users", "coordenadores"],
    queryFn: async () => {
      const res = await fetch("/api/users?cargo=coordenador");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/projetos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto criado", description: "O projeto foi cadastrado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/projetos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto atualizado", description: "O projeto foi atualizado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/projetos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projetos", empreendimentoId] });
      toast({ title: "Projeto excluído", description: "O projeto foi removido com sucesso." });
      setDeleteDialogOpen(false);
      setProjetoToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingProjeto(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (projeto: Projeto) => {
    setEditingProjeto(projeto);
    setForm({
      nome: projeto.nome,
      descricao: projeto.descricao || "",
      status: projeto.status,
      valorContratado: projeto.valorContratado || "",
      valorRecebido: projeto.valorRecebido || "",
      orcamentoPrevisto: projeto.orcamentoPrevisto || "",
      inicioPrevisto: projeto.inicioPrevisto || "",
      fimPrevisto: projeto.fimPrevisto || "",
      coordenadorId: projeto.coordenadorId?.toString() || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProjeto(null);
    setForm(emptyForm);
  };

  const handleSubmit = () => {
    if (!form.nome.trim()) {
      toast({ title: "Erro", description: "O nome do projeto é obrigatório.", variant: "destructive" });
      return;
    }

    const data = {
      nome: form.nome,
      descricao: form.descricao || null,
      status: form.status,
      valorContratado: form.valorContratado || null,
      valorRecebido: form.valorRecebido || null,
      orcamentoPrevisto: form.orcamentoPrevisto || null,
      inicioPrevisto: form.inicioPrevisto || null,
      fimPrevisto: form.fimPrevisto || null,
      coordenadorId: form.coordenadorId ? parseInt(form.coordenadorId) : null,
      empreendimentoId,
    };

    if (editingProjeto) {
      updateMutation.mutate({ id: editingProjeto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (projeto: Projeto) => {
    setProjetoToDelete(projeto);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (projetoToDelete) {
      deleteMutation.mutate(projetoToDelete.id);
    }
  };

  const projetosEmAndamento = projetos.filter(p => p.status === 'em_andamento');
  const projetosConcluidos = projetos.filter(p => p.status === 'concluido');
  const valorTotalContratado = projetos.reduce((sum, p) => sum + Number(p.valorContratado || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando projetos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Projetos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {projetos.length} projeto{projetos.length !== 1 ? 's' : ''} vinculado{projetos.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2" data-testid="button-novo-projeto">
          <Plus className="h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{projetos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-yellow-700">{projetosEmAndamento.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-green-700">{projetosConcluidos.length}</p>
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
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(valorTotalContratado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {projetos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {projetos.map((projeto) => {
            const eficiencia = calcularEficiencia(projeto.valorContratado, projeto.valorRecebido);
            
            return (
              <Card key={projeto.id} className="hover:shadow-md transition-shadow" data-testid={`card-projeto-${projeto.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate" data-testid={`text-projeto-nome-${projeto.id}`}>
                        {projeto.nome}
                      </h4>
                      {projeto.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {projeto.descricao}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={getStatusColor(projeto.status)}>
                        {getStatusLabel(projeto.status)}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(projeto)} data-testid={`button-edit-${projeto.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(projeto)} data-testid={`button-delete-${projeto.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Contratado
                      </p>
                      <p className="font-medium">{formatCurrency(projeto.valorContratado)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Recebido
                      </p>
                      <p className="font-medium text-green-600">{formatCurrency(projeto.valorRecebido)}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Eficiência</span>
                      <span className="font-medium">{eficiencia}%</span>
                    </div>
                    <Progress value={eficiencia} className="h-2" />
                  </div>

                  {(projeto.inicioPrevisto || projeto.fimPrevisto) && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                      {projeto.inicioPrevisto && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Início: {formatDate(projeto.inicioPrevisto)}</span>
                        </div>
                      )}
                      {projeto.fimPrevisto && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          <span>Fim: {formatDate(projeto.fimPrevisto)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhum projeto cadastrado
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui projetos. Clique no botão acima para criar o primeiro.
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Projeto
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProjeto ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="nome">Nome do Projeto *</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome do projeto"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descrição do projeto"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="coordenador">Coordenador</Label>
                <Select value={form.coordenadorId} onValueChange={(value) => setForm({ ...form, coordenadorId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o coordenador" />
                  </SelectTrigger>
                  <SelectContent>
                    {coordenadores.map((coord) => (
                      <SelectItem key={coord.id} value={coord.id.toString()}>
                        {coord.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="valorContratado">Valor Contratado</Label>
                <Input
                  id="valorContratado"
                  type="number"
                  step="0.01"
                  value={form.valorContratado}
                  onChange={(e) => setForm({ ...form, valorContratado: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="valorRecebido">Valor Recebido</Label>
                <Input
                  id="valorRecebido"
                  type="number"
                  step="0.01"
                  value={form.valorRecebido}
                  onChange={(e) => setForm({ ...form, valorRecebido: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="orcamentoPrevisto">Orçamento Previsto</Label>
                <Input
                  id="orcamentoPrevisto"
                  type="number"
                  step="0.01"
                  value={form.orcamentoPrevisto}
                  onChange={(e) => setForm({ ...form, orcamentoPrevisto: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="inicioPrevisto">Início Previsto</Label>
                <Input
                  id="inicioPrevisto"
                  type="date"
                  value={form.inicioPrevisto}
                  onChange={(e) => setForm({ ...form, inicioPrevisto: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fimPrevisto">Fim Previsto</Label>
                <Input
                  id="fimPrevisto"
                  type="date"
                  value={form.fimPrevisto}
                  onChange={(e) => setForm({ ...form, fimPrevisto: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingProjeto ? "Salvar Alterações" : "Criar Projeto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o projeto "{projetoToDelete?.nome}"? Esta ação não pode ser desfeita.
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
