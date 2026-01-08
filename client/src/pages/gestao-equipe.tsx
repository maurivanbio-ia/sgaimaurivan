"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  Loader2, 
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Filter
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

const membroEquipeSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  nome: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().optional(),
  cargo: z.enum(["tecnico_campo", "tecnico_laboratorio", "analista", "estagiario", "auxiliar"]),
  especialidade: z.string().optional(),
  unidade: z.string().optional(),
  coordenadorId: z.number().optional(),
  ativo: z.boolean().default(true),
});

const tarefaSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título obrigatório"),
  descricao: z.string().optional(),
  responsavelId: z.number().min(1, "Responsável obrigatório"),
  empreendimentoId: z.number().optional(),
  projetoId: z.number().optional(),
  categoria: z.enum(["campo", "escritorio", "relatorio", "reuniao", "vistoria"]),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]),
  status: z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).default("pendente"),
  dataInicio: z.string().min(1, "Data de início obrigatória"),
  dataFim: z.string().min(1, "Data de fim obrigatória"),
  horasEstimadas: z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional()),
  observacoes: z.string().optional(),
});

type MembroEquipe = z.infer<typeof membroEquipeSchema>;
type Tarefa = z.infer<typeof tarefaSchema>;

const CARGO_OPTIONS = [
  { value: "tecnico_campo", label: "Técnico de Campo" },
  { value: "tecnico_laboratorio", label: "Técnico de Laboratório" },
  { value: "analista", label: "Analista" },
  { value: "estagiario", label: "Estagiário" },
  { value: "auxiliar", label: "Auxiliar" },
];

const CATEGORIA_OPTIONS = [
  { value: "campo", label: "Campo" },
  { value: "escritorio", label: "Escritório" },
  { value: "relatorio", label: "Relatório" },
  { value: "reuniao", label: "Reunião" },
  { value: "vistoria", label: "Vistoria" },
];

const PRIORIDADE_OPTIONS = [
  { value: "baixa", label: "Baixa", color: "bg-gray-500" },
  { value: "media", label: "Média", color: "bg-blue-500" },
  { value: "alta", label: "Alta", color: "bg-orange-500" },
  { value: "urgente", label: "Urgente", color: "bg-red-500" },
];

const STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", color: "bg-yellow-500" },
  { value: "em_andamento", label: "Em Andamento", color: "bg-blue-500" },
  { value: "concluida", label: "Concluída", color: "bg-green-500" },
  { value: "cancelada", label: "Cancelada", color: "bg-gray-500" },
];

export default function GestaoEquipePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("equipe");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  
  const [isMembroDialogOpen, setIsMembroDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<MembroEquipe | null>(null);
  const [deleteMembroDialogOpen, setDeleteMembroDialogOpen] = useState(false);
  const [membroToDelete, setMembroToDelete] = useState<number | null>(null);
  
  const [isTarefaDialogOpen, setIsTarefaDialogOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [deleteTarefaDialogOpen, setDeleteTarefaDialogOpen] = useState(false);
  const [tarefaToDelete, setTarefaToDelete] = useState<number | null>(null);
  
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");

  const { data: membros = [], isLoading: loadingMembros } = useQuery<MembroEquipe[]>({
    queryKey: ["/api/equipe"],
  });

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/tarefas-stats"],
  });

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: projetos = [] } = useQuery({
    queryKey: ["/api/projetos"],
  });

  const membroForm = useForm<MembroEquipe>({
    resolver: zodResolver(membroEquipeSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      cargo: "tecnico_campo",
      especialidade: "",
      ativo: true,
    },
  });

  const tarefaForm = useForm<Tarefa>({
    resolver: zodResolver(tarefaSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      categoria: "campo",
      prioridade: "media",
      status: "pendente",
      dataInicio: new Date().toISOString().split("T")[0],
      dataFim: new Date().toISOString().split("T")[0],
    },
  });

  const createMembroMutation = useMutation({
    mutationFn: async (data: MembroEquipe) => apiRequest("POST", "/api/equipe", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipe"] });
      toast({ title: "Sucesso", description: "Membro cadastrado com sucesso!" });
      setIsMembroDialogOpen(false);
      membroForm.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao cadastrar membro", variant: "destructive" });
    },
  });

  const updateMembroMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: MembroEquipe }) =>
      apiRequest("PUT", `/api/equipe/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipe"] });
      toast({ title: "Sucesso", description: "Membro atualizado com sucesso!" });
      setIsMembroDialogOpen(false);
      setEditingMembro(null);
      membroForm.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar membro", variant: "destructive" });
    },
  });

  const deleteMembroMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/equipe/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipe"] });
      toast({ title: "Sucesso", description: "Membro excluído com sucesso!" });
      setDeleteMembroDialogOpen(false);
      setMembroToDelete(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir membro", variant: "destructive" });
    },
  });

  const createTarefaMutation = useMutation({
    mutationFn: async (data: Tarefa) => apiRequest("POST", "/api/tarefas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      toast({ title: "Sucesso", description: "Tarefa criada com sucesso!" });
      setIsTarefaDialogOpen(false);
      tarefaForm.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar tarefa", variant: "destructive" });
    },
  });

  const updateTarefaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Tarefa }) =>
      apiRequest("PUT", `/api/tarefas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      toast({ title: "Sucesso", description: "Tarefa atualizada com sucesso!" });
      setIsTarefaDialogOpen(false);
      setEditingTarefa(null);
      tarefaForm.reset();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar tarefa", variant: "destructive" });
    },
  });

  const deleteTarefaMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/tarefas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tarefas-stats"] });
      toast({ title: "Sucesso", description: "Tarefa excluída com sucesso!" });
      setDeleteTarefaDialogOpen(false);
      setTarefaToDelete(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir tarefa", variant: "destructive" });
    },
  });

  const filteredTarefas = useMemo(() => {
    let filtered = tarefas;
    
    if (debouncedSearch) {
      filtered = filtered.filter(t => 
        t.titulo?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        t.descricao?.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    
    if (prioridadeFilter !== "all") {
      filtered = filtered.filter(t => t.prioridade === prioridadeFilter);
    }
    
    return filtered;
  }, [tarefas, debouncedSearch, statusFilter, prioridadeFilter]);

  const onSubmitMembro = (data: MembroEquipe) => {
    if (editingMembro?.id) {
      updateMembroMutation.mutate({ id: editingMembro.id, data });
    } else {
      createMembroMutation.mutate(data);
    }
  };

  const onSubmitTarefa = (data: Tarefa) => {
    if (editingTarefa?.id) {
      updateTarefaMutation.mutate({ id: editingTarefa.id, data });
    } else {
      createTarefaMutation.mutate(data);
    }
  };

  const handleNewMembro = () => {
    setEditingMembro(null);
    membroForm.reset({
      nome: "",
      email: "",
      telefone: "",
      cargo: "tecnico_campo",
      especialidade: "",
      ativo: true,
    });
    setIsMembroDialogOpen(true);
  };

  const handleEditMembro = (membro: MembroEquipe) => {
    setEditingMembro(membro);
    membroForm.reset(membro);
    setIsMembroDialogOpen(true);
  };

  const handleDeleteMembro = (id: number) => {
    setMembroToDelete(id);
    setDeleteMembroDialogOpen(true);
  };

  const handleNewTarefa = () => {
    setEditingTarefa(null);
    tarefaForm.reset({
      titulo: "",
      descricao: "",
      categoria: "campo",
      prioridade: "media",
      status: "pendente",
      dataInicio: new Date().toISOString().split("T")[0],
      dataFim: new Date().toISOString().split("T")[0],
    });
    setIsTarefaDialogOpen(true);
  };

  const handleEditTarefa = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    tarefaForm.reset(tarefa);
    setIsTarefaDialogOpen(true);
  };

  const handleDeleteTarefa = (id: number) => {
    setTarefaToDelete(id);
    setDeleteTarefaDialogOpen(true);
  };

  const getMembroNome = (id: number) => {
    const membro = membros.find(m => m.id === id);
    return membro?.nome || "Não atribuído";
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const option = PRIORIDADE_OPTIONS.find(p => p.value === prioridade);
    return (
      <Badge className={`${option?.color || 'bg-gray-500'} text-white`}>
        {option?.label || prioridade}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <Badge className={`${option?.color || 'bg-gray-500'} text-white`}>
        {option?.label || status}
      </Badge>
    );
  };

  const completionRate = stats?.total > 0 
    ? Math.round((stats?.concluidas / stats?.total) * 100) 
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Equipe</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua equipe e tarefas</p>
        </div>
        <RefreshButton queryKeys={["/api/equipe", "/api/tarefas", "/api/tarefas-stats"]} />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card data-testid="card-total-tarefas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tarefas</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tarefas">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-pendentes">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pendentes">{stats?.pendentes || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-andamento">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-andamento">{stats?.emAndamento || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-concluidas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-concluidas">{stats?.concluidas || 0}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-atrasadas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-atrasadas">{stats?.atrasadas || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Taxa de Conclusão</CardTitle>
          <CardDescription>Progresso geral das tarefas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={completionRate} className="flex-1" />
            <span className="text-lg font-semibold" data-testid="text-completion-rate">{completionRate}%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="equipe" data-testid="tab-equipe">
            <Users className="h-4 w-4 mr-2" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="tarefas" data-testid="tab-tarefas">
            <ClipboardList className="h-4 w-4 mr-2" />
            Tarefas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipe" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar membro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-membro"
              />
            </div>
            <Button onClick={handleNewMembro} data-testid="button-novo-membro">
              <Plus className="h-4 w-4 mr-2" />
              Novo Membro
            </Button>
          </div>

          {loadingMembros ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membros.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum membro cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    membros.map((membro) => (
                      <TableRow key={membro.id} data-testid={`row-membro-${membro.id}`}>
                        <TableCell className="font-medium">{membro.nome}</TableCell>
                        <TableCell>
                          {CARGO_OPTIONS.find(c => c.value === membro.cargo)?.label || membro.cargo}
                        </TableCell>
                        <TableCell>{membro.especialidade || "-"}</TableCell>
                        <TableCell>{membro.email || "-"}</TableCell>
                        <TableCell>{membro.telefone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={membro.ativo ? "default" : "secondary"}>
                            {membro.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditMembro(membro)}
                            data-testid={`button-edit-membro-${membro.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMembro(membro.id!)}
                            data-testid={`button-delete-membro-${membro.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tarefas" className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tarefa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-tarefa"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
                <SelectTrigger className="w-40" data-testid="select-prioridade-filter">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Prioridades</SelectItem>
                  {PRIORIDADE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleNewTarefa} data-testid="button-nova-tarefa">
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>

          {loadingTarefas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTarefas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma tarefa encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTarefas.map((tarefa) => (
                      <TableRow key={tarefa.id} data-testid={`row-tarefa-${tarefa.id}`}>
                        <TableCell className="font-medium max-w-xs truncate">{tarefa.titulo}</TableCell>
                        <TableCell>{getMembroNome(tarefa.responsavelId)}</TableCell>
                        <TableCell>
                          {CATEGORIA_OPTIONS.find(c => c.value === tarefa.categoria)?.label || tarefa.categoria}
                        </TableCell>
                        <TableCell>{getPrioridadeBadge(tarefa.prioridade)}</TableCell>
                        <TableCell>{getStatusBadge(tarefa.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {tarefa.dataFim}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTarefa(tarefa)}
                            data-testid={`button-edit-tarefa-${tarefa.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTarefa(tarefa.id!)}
                            data-testid={`button-delete-tarefa-${tarefa.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isMembroDialogOpen} onOpenChange={setIsMembroDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMembro ? "Editar Membro" : "Novo Membro"}</DialogTitle>
            <DialogDescription>
              {editingMembro ? "Atualize os dados do membro" : "Cadastre um novo membro da equipe"}
            </DialogDescription>
          </DialogHeader>
          <Form {...membroForm}>
            <form onSubmit={membroForm.handleSubmit(onSubmitMembro)} className="space-y-4">
              <FormField
                control={membroForm.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-membro-nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={membroForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-membro-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={membroForm.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-membro-telefone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={membroForm.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-membro-cargo">
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CARGO_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={membroForm.control}
                name="especialidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-membro-especialidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsMembroDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMembroMutation.isPending || updateMembroMutation.isPending}
                  data-testid="button-save-membro"
                >
                  {(createMembroMutation.isPending || updateMembroMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTarefaDialogOpen} onOpenChange={setIsTarefaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTarefa ? "Atualize os dados da tarefa" : "Crie uma nova tarefa para a equipe"}
            </DialogDescription>
          </DialogHeader>
          <Form {...tarefaForm}>
            <form onSubmit={tarefaForm.handleSubmit(onSubmitTarefa)} className="space-y-4">
              <FormField
                control={tarefaForm.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-tarefa-titulo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={tarefaForm.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-tarefa-descricao" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={tarefaForm.control}
                name="responsavelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <Select 
                      onValueChange={(v) => field.onChange(parseInt(v))} 
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-tarefa-responsavel">
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {membros.map(m => (
                          <SelectItem key={m.id} value={m.id!.toString()}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={tarefaForm.control}
                  name="categoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tarefa-categoria">
                            <SelectValue placeholder="Categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIA_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={tarefaForm.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tarefa-prioridade">
                            <SelectValue placeholder="Prioridade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORIDADE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                  control={tarefaForm.control}
                  name="dataInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Início</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-tarefa-data-inicio" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={tarefaForm.control}
                  name="dataFim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fim</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-tarefa-data-fim" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={tarefaForm.control}
                name="horasEstimadas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horas Estimadas</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(e.target.value)}
                        data-testid="input-tarefa-horas" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={tarefaForm.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-tarefa-observacoes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsTarefaDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTarefaMutation.isPending || updateTarefaMutation.isPending}
                  data-testid="button-save-tarefa"
                >
                  {(createTarefaMutation.isPending || updateTarefaMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteMembroDialogOpen} onOpenChange={setDeleteMembroDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este membro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => membroToDelete && deleteMembroMutation.mutate(membroToDelete)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-membro"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarefaDialogOpen} onOpenChange={setDeleteTarefaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => tarefaToDelete && deleteTarefaMutation.mutate(tarefaToDelete)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-tarefa"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
