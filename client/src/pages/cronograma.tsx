import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO, isPast, isFuture, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Plus, 
  FileText, 
  Target, 
  Flag, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Edit,
  Trash2,
  Filter,
  ChevronDown,
  Loader2,
  CalendarDays,
  Building2,
  FolderOpen
} from "lucide-react";
import type { CronogramaItem, Empreendimento, Projeto } from "@shared/schema";

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

export default function CronogramaPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CronogramaItem | null>(null);
  const [filters, setFilters] = useState({
    tipo: "todos",
    status: "todos",
    empreendimentoId: "",
    projetoId: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.tipo !== "todos") params.append("tipo", filters.tipo);
    if (filters.status !== "todos") params.append("status", filters.status);
    if (filters.empreendimentoId) params.append("empreendimentoId", filters.empreendimentoId);
    if (filters.projetoId) params.append("projetoId", filters.projetoId);
    return params.toString() ? `?${params.toString()}` : "";
  };

  const { data: cronogramaItens = [], isLoading } = useQuery<CronogramaItem[]>({
    queryKey: ["/api/cronograma", filters],
    queryFn: async () => {
      const res = await fetch(`/api/cronograma${buildQueryString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cronograma");
      return res.json();
    },
  });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: projetos = [] } = useQuery<Projeto[]>({
    queryKey: ["/api/projetos"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/cronograma", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Sucesso", description: "Item adicionado ao cronograma!" });
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/cronograma/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Sucesso", description: "Item atualizado!" });
      setDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cronograma/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cronograma"] });
      toast({ title: "Sucesso", description: "Item excluído!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (item: CronogramaItem) => {
    const endDate = parseISO(item.dataFim);
    const isLate = isPast(endDate) && !item.concluido;
    
    if (item.concluido) {
      return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Concluído</Badge>;
    }
    if (isLate) {
      return <Badge className="bg-red-500 text-white"><AlertCircle className="h-3 w-3 mr-1" /> Atrasado</Badge>;
    }
    if (item.status === "em_andamento") {
      return <Badge className="bg-blue-500 text-white"><Clock className="h-3 w-3 mr-1" /> Em Andamento</Badge>;
    }
    return <Badge className="bg-yellow-500 text-white"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
  };

  const getTipoIcon = (tipo: string) => {
    const tipoOption = TIPO_OPTIONS.find(t => t.value === tipo);
    if (tipoOption) {
      const Icon = tipoOption.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <Calendar className="h-4 w-4" />;
  };

  const getDaysRemaining = (dataFim: string) => {
    const endDate = parseISO(dataFim);
    const days = differenceInDays(endDate, new Date());
    if (days < 0) return <span className="text-red-600 font-medium">{Math.abs(days)} dias atrasado</span>;
    if (days === 0) return <span className="text-orange-600 font-medium">Vence hoje</span>;
    if (days <= 7) return <span className="text-yellow-600 font-medium">{days} dias restantes</span>;
    return <span className="text-gray-600">{days} dias restantes</span>;
  };

  const empMap = new Map(empreendimentos.map(e => [e.id, e.nome]));
  const projMap = new Map(projetos.map(p => [p.id, p.nome]));

  const pendentes = cronogramaItens.filter(i => !i.concluido && i.status !== "em_andamento");
  const emAndamento = cronogramaItens.filter(i => i.status === "em_andamento" && !i.concluido);
  const concluidos = cronogramaItens.filter(i => i.concluido);
  const atrasados = cronogramaItens.filter(i => !i.concluido && isPast(parseISO(i.dataFim)));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-8 w-8 text-primary" />
            Cronograma de Projetos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie campanhas, relatórios e marcos dos seus projetos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingItem(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-novo-cronograma">
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Editar Item" : "Novo Item do Cronograma"}</DialogTitle>
            </DialogHeader>
            <CronogramaForm
              item={editingItem}
              empreendimentos={empreendimentos}
              projetos={projetos}
              onSubmit={(data) => {
                if (editingItem) {
                  updateMutation.mutate({ id: editingItem.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{pendentes.length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-400">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{emAndamento.length}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-400">Concluídos</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">{concluidos.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 dark:text-red-400">Atrasados</p>
                <p className="text-2xl font-bold text-red-800 dark:text-red-300">{atrasados.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={filters.tipo} onValueChange={(v) => setFilters(prev => ({ ...prev, tipo: v }))}>
                <SelectTrigger data-testid="select-filter-tipo">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TIPO_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empreendimento</Label>
              <Select value={filters.empreendimentoId} onValueChange={(v) => setFilters(prev => ({ ...prev, empreendimentoId: v }))}>
                <SelectTrigger data-testid="select-filter-empreendimento">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {empreendimentos.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={filters.projetoId} onValueChange={(v) => setFilters(prev => ({ ...prev, projetoId: v }))}>
                <SelectTrigger data-testid="select-filter-projeto">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {projetos.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens do Cronograma</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : cronogramaItens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum item encontrado no cronograma</p>
              <p className="text-sm">Adicione campanhas, relatórios ou marcos para seus projetos</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cronogramaItens.map(item => (
                <div 
                  key={item.id} 
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`cronograma-item-${item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${TIPO_OPTIONS.find(t => t.value === item.tipo)?.color || 'bg-gray-500'} text-white`}>
                        {getTipoIcon(item.tipo)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{item.titulo}</h3>
                        {item.descricao && <p className="text-muted-foreground text-sm mt-1">{item.descricao}</p>}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {getStatusBadge(item)}
                          <Badge variant="outline" className="capitalize">{item.tipo}</Badge>
                          {item.prioridade && (
                            <Badge variant="outline" className={PRIORIDADE_OPTIONS.find(p => p.value === item.prioridade)?.color}>
                              {item.prioridade}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(parseISO(item.dataInicio), "dd/MM/yyyy", { locale: ptBR })} - {format(parseISO(item.dataFim), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {!item.concluido && <span>{getDaysRemaining(item.dataFim)}</span>}
                          {item.responsavel && <span>Resp: {item.responsavel}</span>}
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {item.empreendimentoId && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {empMap.get(item.empreendimentoId) || `ID: ${item.empreendimentoId}`}
                            </span>
                          )}
                          {item.projetoId && (
                            <span className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              {projMap.get(item.projetoId) || `Projeto ID: ${item.projetoId}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => { setEditingItem(item); setDialogOpen(true); }}
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir este item?")) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        data-testid={`button-delete-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CronogramaForm({ 
  item, 
  empreendimentos, 
  projetos, 
  onSubmit, 
  isLoading 
}: { 
  item: CronogramaItem | null;
  empreendimentos: Empreendimento[];
  projetos: Projeto[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    titulo: item?.titulo || "",
    tipo: item?.tipo || "campanha",
    descricao: item?.descricao || "",
    dataInicio: item?.dataInicio || format(new Date(), "yyyy-MM-dd"),
    dataFim: item?.dataFim || format(new Date(), "yyyy-MM-dd"),
    status: item?.status || "pendente",
    prioridade: item?.prioridade || "media",
    responsavel: item?.responsavel || "",
    empreendimentoId: item?.empreendimentoId ? String(item.empreendimentoId) : "",
    projetoId: item?.projetoId ? String(item.projetoId) : "",
    observacoes: item?.observacoes || "",
  });

  const filteredProjetos = formData.empreendimentoId 
    ? projetos.filter(p => p.empreendimentoId === parseInt(formData.empreendimentoId))
    : projetos;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      empreendimentoId: formData.empreendimentoId ? parseInt(formData.empreendimentoId) : null,
      projetoId: formData.projetoId ? parseInt(formData.projetoId) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="titulo">Título *</Label>
          <Input
            id="titulo"
            value={formData.titulo}
            onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
            placeholder="Ex: Campanha de Monitoramento Q1"
            required
            data-testid="input-titulo"
          />
        </div>
        
        <div>
          <Label htmlFor="tipo">Tipo *</Label>
          <Select value={formData.tipo} onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}>
            <SelectTrigger data-testid="select-tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dataInicio">Data Início *</Label>
          <Input
            id="dataInicio"
            type="date"
            value={formData.dataInicio}
            onChange={(e) => setFormData(prev => ({ ...prev, dataInicio: e.target.value }))}
            required
            data-testid="input-data-inicio"
          />
        </div>
        
        <div>
          <Label htmlFor="dataFim">Data Fim *</Label>
          <Input
            id="dataFim"
            type="date"
            value={formData.dataFim}
            onChange={(e) => setFormData(prev => ({ ...prev, dataFim: e.target.value }))}
            required
            data-testid="input-data-fim"
          />
        </div>

        <div>
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select value={formData.prioridade} onValueChange={(v) => setFormData(prev => ({ ...prev, prioridade: v }))}>
            <SelectTrigger data-testid="select-prioridade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORIDADE_OPTIONS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="responsavel">Responsável</Label>
          <Input
            id="responsavel"
            value={formData.responsavel}
            onChange={(e) => setFormData(prev => ({ ...prev, responsavel: e.target.value }))}
            placeholder="Nome do responsável"
            data-testid="input-responsavel"
          />
        </div>

        <div>
          <Label htmlFor="empreendimento">Empreendimento *</Label>
          <Select 
            value={formData.empreendimentoId} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, empreendimentoId: v, projetoId: "" }))}
          >
            <SelectTrigger data-testid="select-empreendimento">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {empreendimentos.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="projeto">Projeto (opcional)</Label>
          <Select 
            value={formData.projetoId} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, projetoId: v }))}
          >
            <SelectTrigger data-testid="select-projeto">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nenhum</SelectItem>
              {filteredProjetos.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            value={formData.descricao}
            onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descrição detalhada do item..."
            rows={3}
            data-testid="input-descricao"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
            placeholder="Observações adicionais..."
            rows={2}
            data-testid="input-observacoes"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isLoading || !formData.titulo || !formData.empreendimentoId} data-testid="button-submit">
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {item ? "Salvar Alterações" : "Criar Item"}
        </Button>
      </div>
    </form>
  );
}
