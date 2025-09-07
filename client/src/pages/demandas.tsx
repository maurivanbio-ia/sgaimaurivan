import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  User,
  Building,
  Tag,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Demanda, InsertDemanda } from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { demandas } from "@shared/schema";
import * as z from "zod";

// Status mapping
const STATUS_CONFIG = {
  a_fazer: { label: "A Fazer", color: "bg-gray-500", icon: Clock },
  em_andamento: { label: "Em Andamento", color: "bg-blue-500", icon: FileText },
  em_revisao: { label: "Em Revisão", color: "bg-yellow-500", icon: AlertCircle },
  concluido: { label: "Concluído", color: "bg-green-500", icon: CheckCircle },
  cancelado: { label: "Cancelado", color: "bg-red-500", icon: XCircle }
};

// Priority mapping
const PRIORITY_CONFIG = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-700" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  alta: { label: "Alta", color: "bg-red-100 text-red-700" }
};

// Setor options
const SETORES = [
  "Fauna",
  "Flora", 
  "Recursos Hídricos",
  "Licenciamento",
  "RH",
  "Engenharia",
  "Qualidade",
  "Meio Ambiente",
  "Administrativo"
];

// Create form schema for Nova Demanda
const novaDemandaSchema = z.object({
  titulo: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  descricao: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  setor: z.string().min(1, "Setor é obrigatório"),
  prioridade: z.enum(["baixa", "media", "alta"], { required_error: "Prioridade é obrigatória" }),
  responsavel: z.string().min(2, "Responsável deve ter pelo menos 2 caracteres"),
  empreendimento: z.string().optional(),
  dataEntrega: z.date({ required_error: "Data de entrega é obrigatória" }),
  observacoes: z.string().optional(),
  tempoEstimado: z.number().optional(),
});

type NovaDemandaFormData = z.infer<typeof novaDemandaSchema>;

// Nova Demanda Form Component
interface NovaDemandaFormProps {
  onSuccess: () => void;
}

function NovaDemandaForm({ onSuccess }: NovaDemandaFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<NovaDemandaFormData>({
    resolver: zodResolver(novaDemandaSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      setor: "",
      prioridade: "media",
      responsavel: "",
      empreendimento: "",
      observacoes: "",
    },
  });

  const createDemandaMutation = useMutation({
    mutationFn: async (data: NovaDemandaFormData) => {
      return apiRequest("POST", "/api/demandas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      toast({
        title: "Demanda criada",
        description: "Nova demanda foi criada com sucesso!",
      });
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: "Não foi possível criar a demanda. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao criar demanda:", error);
    },
  });

  const onSubmit = (data: NovaDemandaFormData) => {
    createDemandaMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="titulo"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Título da Demanda *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: Elaboração do RCA para UHE..."
                    {...field}
                    data-testid="input-titulo"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="setor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Setor *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-setor">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SETORES.map((setor) => (
                      <SelectItem key={setor} value={setor}>
                        {setor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="prioridade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridade *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-prioridade">
                      <SelectValue placeholder="Selecione a prioridade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="responsavel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome do responsável"
                    {...field}
                    data-testid="input-responsavel"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="empreendimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empreendimento</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome do empreendimento (opcional)"
                    {...field}
                    data-testid="input-empreendimento"
                  />
                </FormControl>
                <FormDescription>
                  Vincule a demanda a um empreendimento específico
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dataEntrega"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Entrega *</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-data-entrega"
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>Selecione a data de entrega</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  Data prevista para entrega final da demanda
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tempoEstimado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tempo Estimado (horas)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Ex: 40"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    data-testid="input-tempo-estimado"
                  />
                </FormControl>
                <FormDescription>
                  Estimativa de horas necessárias para conclusão
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="descricao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição Detalhada *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Descreva detalhadamente a demanda, objetivos, metodologia e entregaveis esperados..."
                    className="min-h-[120px] resize-none"
                    {...field}
                    data-testid="textarea-descricao"
                  />
                </FormControl>
                <FormDescription>
                  Inclua todos os detalhes relevantes, objetivos e entregaveis esperados
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="observacoes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Observações adicionais, recursos necessários, restrições..."
                    className="min-h-[80px] resize-none"
                    {...field}
                    data-testid="textarea-observacoes"
                  />
                </FormControl>
                <FormDescription>
                  Informações complementares sobre a demanda
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            data-testid="button-cancelar"
          >
            Limpar
          </Button>
          <Button
            type="submit"
            disabled={createDemandaMutation.isPending}
            data-testid="button-criar-demanda"
          >
            {createDemandaMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar Demanda"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface DemandaCardProps {
  demanda: Demanda;
  isOverlay?: boolean;
}

function DemandaCard({ demanda, isOverlay = false }: DemandaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: demanda.id,
    data: { type: "demanda", demanda }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusConfig = STATUS_CONFIG[demanda.status as keyof typeof STATUS_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[demanda.prioridade as keyof typeof PRIORITY_CONFIG];
  
  // Check if deadline is approaching or overdue
  const today = new Date();
  const deliveryDate = new Date(demanda.dataEntrega);
  const daysUntilDeadline = Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const isOverdue = daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline <= 2 && daysUntilDeadline >= 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing mb-3 transition-shadow hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      } ${isOverlay ? "rotate-3 shadow-xl" : ""}`}
      data-testid={`demanda-card-${demanda.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium line-clamp-2">
            {demanda.titulo}
          </CardTitle>
          <div className="flex items-center gap-1 ml-2">
            <Badge variant="outline" className={priorityConfig.color}>
              {priorityConfig.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {demanda.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {demanda.descricao}
          </p>
        )}
        
        {/* Setor */}
        <div className="flex items-center gap-2">
          <Building className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{demanda.setor}</span>
        </div>

        {/* Responsável */}
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-xs">
              {demanda.responsavelId ? "U" : "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            Responsável #{demanda.responsavelId}
          </span>
        </div>

        {/* Data de entrega */}
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className={`text-xs ${
            isOverdue ? "text-red-600 font-medium" : 
            isUrgent ? "text-yellow-600 font-medium" : 
            "text-muted-foreground"
          }`}>
            {format(new Date(demanda.dataEntrega), "dd/MM/yyyy", { locale: ptBR })}
            {isOverdue && " (Atrasado)"}
            {isUrgent && " (Urgente)"}
          </span>
        </div>

        {/* Tags */}
        {demanda.tags && demanda.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {demanda.tags.slice(0, 2).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {demanda.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{demanda.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Anexos indicator */}
        {demanda.anexos && demanda.anexos.length > 0 && (
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {demanda.anexos.length} anexo{demanda.anexos.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KanbanColumnProps {
  status: string;
  title: string;
  demandas: Demanda[];
  icon: React.ComponentType<any>;
}

function KanbanColumn({ status, title, demandas, icon: Icon }: KanbanColumnProps) {
  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  
  return (
    <div className="bg-muted/30 rounded-lg p-4 min-h-[600px] w-80">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4" />
        <h3 className="font-medium text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {demandas.length}
        </Badge>
      </div>
      
      <SortableContext items={demandas.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {demandas.map((demanda) => (
            <DemandaCard key={demanda.id} demanda={demanda} />
          ))}
        </div>
      </SortableContext>
      
      {demandas.length === 0 && (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Nenhuma demanda
        </div>
      )}
    </div>
  );
}

export default function DemandasPage() {
  const [filters, setFilters] = useState({
    setor: "",
    responsavel: "",
    empreendimento: "",
    prioridade: "",
    search: ""
  });
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDemanda, setActiveDemanda] = useState<Demanda | null>(null);
  
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor));

  // Fetch demandas
  const { data: demandas = [], isLoading } = useQuery<Demanda[]>({
    queryKey: ["/api/demandas", filters],
  });

  // Update demanda status mutation
  const updateDemandaMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/demandas/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
    }
  });

  // Group demandas by status
  const demandaColumns = {
    a_fazer: demandas.filter(d => d.status === "a_fazer"),
    em_andamento: demandas.filter(d => d.status === "em_andamento"),
    em_revisao: demandas.filter(d => d.status === "em_revisao"),
    concluido: demandas.filter(d => d.status === "concluido"),
    cancelado: demandas.filter(d => d.status === "cancelado")
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    const demanda = demandas.find(d => d.id === Number(active.id));
    if (demanda) {
      setActiveDemanda(demanda);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Check if dropped over a different column
    const newStatus = overId;
    const demanda = demandas.find(d => d.id === Number(activeId));
    
    if (demanda && demanda.status !== newStatus && Object.keys(STATUS_CONFIG).includes(newStatus)) {
      updateDemandaMutation.mutate({ 
        id: demanda.id, 
        status: newStatus 
      });
    }
    
    setActiveId(null);
    setActiveDemanda(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Carregando demandas...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-demandas">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Demandas
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie demandas organizacionais com sistema Kanban
          </p>
        </div>
        
        <div className="flex gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="button-nova-demanda">
                <Plus className="h-4 w-4 mr-2" />
                Nova Demanda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Demanda</DialogTitle>
              </DialogHeader>
              <NovaDemandaForm onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/demandas'] });
              }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar demandas..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-9"
                data-testid="filter-search"
              />
            </div>
            
            <Select value={filters.setor} onValueChange={(value) => setFilters({...filters, setor: value})}>
              <SelectTrigger data-testid="filter-setor">
                <SelectValue placeholder="Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {SETORES.map(setor => (
                  <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.prioridade} onValueChange={(value) => setFilters({...filters, prioridade: value})}>
              <SelectTrigger data-testid="filter-prioridade">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Responsável"
              value={filters.responsavel}
              onChange={(e) => setFilters({...filters, responsavel: e.target.value})}
              data-testid="filter-responsavel"
            />

            <Input
              placeholder="Empreendimento"
              value={filters.empreendimento}
              onChange={(e) => setFilters({...filters, empreendimento: e.target.value})}
              data-testid="filter-empreendimento"
            />

            <Button 
              onClick={() => setFilters({ setor: "", responsavel: "", empreendimento: "", prioridade: "", search: "" })}
              variant="outline"
              data-testid="button-clear-filters"
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4" data-testid="kanban-board">
          <KanbanColumn
            status="a_fazer"
            title="A Fazer"
            demandas={demandaColumns.a_fazer}
            icon={Clock}
          />
          <KanbanColumn
            status="em_andamento"
            title="Em Andamento"
            demandas={demandaColumns.em_andamento}
            icon={FileText}
          />
          <KanbanColumn
            status="em_revisao"
            title="Em Revisão"
            demandas={demandaColumns.em_revisao}
            icon={AlertCircle}
          />
          <KanbanColumn
            status="concluido"
            title="Concluído"
            demandas={demandaColumns.concluido}
            icon={CheckCircle}
          />
          <KanbanColumn
            status="cancelado"
            title="Cancelado"
            demandas={demandaColumns.cancelado}
            icon={XCircle}
          />
        </div>

        <DragOverlay>
          {activeDemanda ? (
            <DemandaCard demanda={activeDemanda} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}