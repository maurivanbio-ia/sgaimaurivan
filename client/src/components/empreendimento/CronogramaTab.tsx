import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Target, FileText, Flag, Edit, Trash2, Loader2 } from "lucide-react";
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
import type { CronogramaItem, Projeto } from "@shared/schema";

export interface CronogramaTabProps {
  empreendimentoId: number;
}

const TIPO_OPTIONS = [
  { value: "campanha", label: "Campanha", icon: Target, color: "bg-blue-500" },
  { value: "relatorio", label: "Relatório", icon: FileText, color: "bg-green-500" },
  { value: "marco", label: "Marco/Milestone", icon: Flag, color: "bg-purple-500" },
  { value: "etapa", label: "Etapa", icon: Calendar, color: "bg-orange-500" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-500" },
  { value: "concluido", label: "Concluído", color: "bg-green-500" },
  { value: "atrasado", label: "Atrasado", color: "bg-red-500" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa", color: "text-green-600" },
  { value: "media", label: "Média", color: "text-yellow-600" },
  { value: "alta", label: "Alta", color: "text-red-600" },
];

const cronogramaFormSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  status: z.string().default("pendente"),
  prioridade: z.string().default("media"),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
  dataFim: z.string().min(1, "Data de fim é obrigatória"),
  responsavel: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  projetoId: z.number().optional().nullable(),
});

type CronogramaFormData = z.infer<typeof cronogramaFormSchema>;

export function CronogramaTab({ empreendimentoId }: CronogramaTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CronogramaItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  
  const { data: itens = [], isLoading } = useQuery<CronogramaItem[]>({
    queryKey: ["/api/cronograma", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/cronograma?empreendimentoId=${empreendimentoId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cronograma");
      return res.json();
    },
  });

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos"],
  });

  const projetosEmpreendimento = projetos.filter(p => p.empreendimentoId === empreendimentoId);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cronograma/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Item excluído com sucesso!" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erro ao excluir item", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalItens = itens.length;
  const itensConcluidos = itens.filter(i => i.status === "concluido").length;
  const progress = totalItens > 0 ? Math.round((itensConcluidos / totalItens) * 100) : 0;

  const handleEdit = (item: CronogramaItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_OPTIONS.find(x => x.value === status);
    return s ? <Badge className={s.color}>{s.label}</Badge> : null;
  };

  const getTipoBadge = (tipo: string) => {
    const t = TIPO_OPTIONS.find(x => x.value === tipo);
    if (!t) return null;
    const Icon = t.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className="h-3 w-3" />
        {t.label}
      </Badge>
    );
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const p = PRIORIDADE_OPTIONS.find(x => x.value === prioridade);
    return p ? <span className={`text-xs font-medium ${p.color}`}>{p.label}</span> : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">Cronograma</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {itensConcluidos} de {totalItens} itens concluídos ({progress}%)
          </p>
        </div>
        <Button onClick={handleNew} data-testid="button-new-cronograma">
          <Plus className="mr-2 h-4 w-4" />
          Novo Item
        </Button>
      </div>

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
          {itens.map((item) => (
            <Card key={item.id} data-testid={`card-cronograma-${item.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="font-semibold" data-testid={`text-titulo-${item.id}`}>
                        {item.titulo || item.etapa}
                      </h4>
                      {getTipoBadge(item.tipo)}
                      {getStatusBadge(item.status)}
                      {item.prioridade && getPrioridadeBadge(item.prioridade)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Início:</p>
                        <p className="font-medium">{formatDate(item.dataInicio)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fim:</p>
                        <p className="font-medium">{formatDate(item.dataFim)}</p>
                      </div>
                      {item.responsavel && (
                        <div>
                          <p className="text-muted-foreground">Responsável:</p>
                          <p className="font-medium">{item.responsavel}</p>
                        </div>
                      )}
                      {item.projetoId && (
                        <div>
                          <p className="text-muted-foreground">Projeto:</p>
                          <p className="font-medium">
                            {projetos.find(p => p.id === item.projetoId)?.nome || `#${item.projetoId}`}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {item.descricao && (
                      <p className="text-sm text-muted-foreground mt-3">{item.descricao}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)} data-testid={`button-edit-${item.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} data-testid={`button-delete-${item.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhum item no cronograma
          </h3>
          <p className="text-muted-foreground mb-4">
            Adicione campanhas, relatórios, marcos e etapas
          </p>
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Item
          </Button>
        </div>
      )}

      <CronogramaDialog 
        empreendimentoId={empreendimentoId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        projetos={projetosEmpreendimento}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este item do cronograma?
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

interface CronogramaDialogProps {
  empreendimentoId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: CronogramaItem | null;
  projetos: Projeto[];
}

function CronogramaDialog({ empreendimentoId, open, onOpenChange, editingItem, projetos }: CronogramaDialogProps) {
  const { toast } = useToast();
  
  const form = useForm<CronogramaFormData>({
    resolver: zodResolver(cronogramaFormSchema),
    defaultValues: {
      titulo: "",
      tipo: "etapa",
      status: "pendente",
      prioridade: "media",
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: new Date().toISOString().split('T')[0],
      responsavel: "",
      descricao: "",
      projetoId: null,
    },
  });

  useState(() => {
    if (editingItem) {
      form.reset({
        titulo: editingItem.titulo || editingItem.etapa || "",
        tipo: editingItem.tipo || "etapa",
        status: editingItem.status || "pendente",
        prioridade: editingItem.prioridade || "media",
        dataInicio: editingItem.dataInicio,
        dataFim: editingItem.dataFim,
        responsavel: editingItem.responsavel || "",
        descricao: editingItem.descricao || "",
        projetoId: editingItem.projetoId || null,
      });
    } else {
      form.reset({
        titulo: "",
        tipo: "etapa",
        status: "pendente",
        prioridade: "media",
        dataInicio: new Date().toISOString().split('T')[0],
        dataFim: new Date().toISOString().split('T')[0],
        responsavel: "",
        descricao: "",
        projetoId: null,
      });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: CronogramaFormData) => {
      return apiRequest("POST", "/api/cronograma", {
        ...data,
        empreendimentoId,
        etapa: data.titulo,
        concluido: data.status === "concluido",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Item adicionado com sucesso!" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao adicionar item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CronogramaFormData) => {
      return apiRequest("PUT", `/api/cronograma/${editingItem?.id}`, {
        ...data,
        etapa: data.titulo,
        concluido: data.status === "concluido",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Item atualizado com sucesso!" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar item", variant: "destructive" });
    },
  });

  const onSubmit = (data: CronogramaFormData) => {
    if (editingItem) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Editar Item" : "Novo Item do Cronograma"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do item" data-testid="input-titulo" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tipo">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIPO_OPTIONS.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prioridade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-prioridade">
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORIDADE_OPTIONS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {projetos.length > 0 && (
                <FormField
                  control={form.control}
                  name="projetoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Projeto (opcional)</FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))} 
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-projeto">
                            <SelectValue placeholder="Vincular a projeto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {projetos.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dataInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início *</FormLabel>
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
                    <FormLabel>Data de Fim *</FormLabel>
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
                  <FormLabel>Responsável</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Nome do responsável" data-testid="input-responsavel" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} placeholder="Detalhes do item" data-testid="input-descricao" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-cronograma">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? "Salvar Alterações" : "Adicionar Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
