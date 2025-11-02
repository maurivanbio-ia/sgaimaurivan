"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import wildlifeBg from "@assets/stock_images/brazilian_wildlife_b_15bd5736.jpg";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Loader2,
  GripVertical,
  Trash2,
} from "lucide-react";

// ===================================================
// Tipos e Constantes
// ===================================================

type Status =
  | "a_fazer"
  | "em_andamento"
  | "em_revisao"
  | "concluido"
  | "cancelado";
type Prioridade = "baixa" | "media" | "alta";

type Demanda = {
  id: number;
  titulo: string;
  descricao: string;
  setor: string;
  prioridade: Prioridade;
  responsavel: string;
  dataEntrega: string;
  status: Status;
};

const STATUS_LABEL: Record<Status, string> = {
  a_fazer: "A Fazer",
  em_andamento: "Em Andamento",
  em_revisao: "Em Revisão",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<Status, string> = {
  a_fazer: "bg-slate-100 border-slate-300",
  em_andamento: "bg-blue-100 border-blue-300",
  em_revisao: "bg-yellow-100 border-yellow-300",
  concluido: "bg-green-100 border-green-300",
  cancelado: "bg-red-100 border-red-300",
};

const SETORES = [
  "Fauna",
  "Flora",
  "Recursos Hídricos",
  "Licenciamento",
  "RH",
  "Engenharia",
  "Qualidade",
  "Meio Ambiente",
  "Administrativo",
];

// ===================================================
// Funções auxiliares
// ===================================================

async function apiRequest<T = any>(
  method: string,
  url: string,
  body?: any
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg = json
      ? `${res.status}: ${JSON.stringify(json)}`
      : `${res.status}: ${text || "Erro"}`;
    throw new Error(msg);
  }
  return (json ?? null) as T;
}

function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

function toYmd(dateStrOrDate: string | Date): string {
  const d =
    typeof dateStrOrDate === "string" ? new Date(dateStrOrDate) : dateStrOrDate;
  const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0)
    .toISOString()
    .slice(0, 10);
  return iso;
}

// ===================================================
// Formulário de Criação/Edição
// ===================================================

function DemandaForm({
  initial,
  onSuccess,
}: {
  initial?: Partial<Demanda>;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?.id);

  const [form, setForm] = useState({
    titulo: initial?.titulo ?? "",
    descricao: initial?.descricao ?? "",
    setor: initial?.setor ?? "",
    prioridade: (initial?.prioridade ?? "media") as Prioridade,
    responsavel: initial?.responsavel ?? "",
    dataEntrega: initial?.dataEntrega ? toYmd(initial.dataEntrega) : "",
    status: (initial?.status ?? "a_fazer") as Status,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        setor: form.setor,
        prioridade: form.prioridade,
        responsavel: form.responsavel.trim(),
        dataEntrega: toYmd(form.dataEntrega),
        status: form.status,
      };

      if (isEdit && initial?.id != null) {
        return apiRequest("PATCH", `/api/demandas/${initial.id}`, payload);
      } else {
        return apiRequest("POST", "/api/demandas", payload);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      toast({ title: isEdit ? "Demanda atualizada!" : "Demanda criada!" });
      onSuccess();
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao salvar",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div>
        <Label>Título *</Label>
        <Input
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          required
          data-testid="input-titulo"
        />
      </div>

      <div>
        <Label>Descrição *</Label>
        <Textarea
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          required
          data-testid="input-descricao"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Setor *</Label>
          <Select
            value={form.setor}
            onValueChange={(v) => setForm({ ...form, setor: v })}
          >
            <SelectTrigger data-testid="select-setor">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {SETORES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Prioridade *</Label>
          <Select
            value={form.prioridade}
            onValueChange={(v: Prioridade) => setForm({ ...form, prioridade: v })}
          >
            <SelectTrigger data-testid="select-prioridade">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Responsável *</Label>
          <Input
            value={form.responsavel}
            onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
            required
            data-testid="input-responsavel"
          />
        </div>
        <div>
          <Label>Data de Entrega *</Label>
          <Input
            type="date"
            value={form.dataEntrega}
            onChange={(e) => setForm({ ...form, dataEntrega: e.target.value })}
            required
            data-testid="input-data-entrega"
          />
        </div>
      </div>

      {isEdit && (
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(v: Status) => setForm({ ...form, status: v })}
          >
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a_fazer">A Fazer</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="em_revisao">Em Revisão</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-demanda">
        {mutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {isEdit ? "Salvar alterações" : "Criar demanda"}
      </Button>
    </form>
  );
}

// ===================================================
// Cartão de Demanda (Arrastável)
// ===================================================

function DemandaCard({
  demanda,
  onEdit,
  onDelete,
}: {
  demanda: Demanda;
  onEdit: (d: Demanda) => void;
  onDelete: (id: number) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: demanda.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prioridadeColor = {
    baixa: "bg-green-500",
    media: "bg-yellow-500",
    alta: "bg-red-500",
  }[demanda.prioridade];

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="mb-2 hover:shadow-md transition-shadow"
      data-testid={`demanda-card-${demanda.id}`}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          {/* Área de arrasto */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing pt-1"
            data-testid={`drag-handle-${demanda.id}`}
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Título */}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold line-clamp-2">
              {demanda.titulo}
            </CardTitle>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(demanda);
              }}
              data-testid={`button-edit-demanda-${demanda.id}`}
            >
              <Pencil className="h-4 w-4 text-gray-500 hover:text-gray-700" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 flex-shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(demanda.id);
              }}
              data-testid={`button-delete-demanda-${demanda.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/70" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="text-xs text-muted-foreground px-3 pb-3">
        <p className="line-clamp-2 mb-2">{demanda.descricao}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">{demanda.setor}</Badge>
          <Badge className={`${prioridadeColor} text-white text-xs`}>
            {demanda.prioridade === "baixa" ? "Baixa" : demanda.prioridade === "media" ? "Média" : "Alta"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {formatDate(new Date(demanda.dataEntrega), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {demanda.responsavel}
        </p>
      </CardContent>
    </Card>
  );
}

// ===================================================
// Coluna do Kanban (Droppable)
// ===================================================

function KanbanColumn({
  status,
  label,
  demandas,
  onEdit,
  onDelete,
}: {
  status: Status;
  label: string;
  demandas: Demanda[];
  onEdit: (d: Demanda) => void;
  onDelete: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 rounded-lg border-2 p-3 transition-all ${STATUS_COLORS[status]} ${
        isOver ? "ring-2 ring-primary ring-offset-2 shadow-lg" : ""
      }`}
      data-testid={`kanban-column-${status}`}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge variant="secondary" className="font-semibold">
          {label}
        </Badge>
        <Badge variant="outline" className="ml-2">
          {demandas.length}
        </Badge>
      </div>
      
      <SortableContext
        items={demandas.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[100px]">
          {demandas.map((d) => (
            <DemandaCard key={d.id} demanda={d} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {demandas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Arraste uma demanda aqui
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ===================================================
// Página Principal
// ===================================================

export default function DemandasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Inicia drag após mover 8px
      },
    })
  );

  const { data: raw, isLoading } = useQuery({
    queryKey: ["/api/demandas"],
    queryFn: async () => apiRequest("GET", "/api/demandas"),
  });
  
  const demandas: Demanda[] = ensureArray<Demanda>(raw);

  const { data: historicoRaw, isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["/api/demandas/historico/all"],
    queryFn: async () => apiRequest("GET", "/api/demandas/historico/all"),
  });

  const historico = ensureArray(historicoRaw);
  const [editing, setEditing] = useState<Demanda | null>(null);
  const [activeDemanda, setActiveDemanda] = useState<Demanda | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Status }) =>
      apiRequest("PATCH", `/api/demandas/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      toast({ title: "Demanda movida com sucesso!" });
    },
    onError: (e: any) =>
      toast({
        title: "Falha ao mover demanda",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/demandas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      toast({ title: "Demanda excluída com sucesso!" });
    },
    onError: (e: any) =>
      toast({
        title: "Falha ao excluir demanda",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      }),
  });

  const columns = useMemo(() => {
    const grouped: Record<Status, Demanda[]> = {
      a_fazer: [],
      em_andamento: [],
      em_revisao: [],
      concluido: [],
      cancelado: [],
    };

    (demandas ?? []).forEach((d) => {
      const rawStatus = (d.status ?? "").toString().trim();
      const s: Status = (["a_fazer", "em_andamento", "em_revisao", "concluido", "cancelado"].includes(rawStatus)
        ? (rawStatus as Status)
        : "a_fazer");
      grouped[s].push(d);
    });

    return grouped;
  }, [demandas]);

  const onDragStart = (e: any) => {
    const id = Number(e.active.id);
    const d = demandas.find((x) => x.id === id);
    if (d) setActiveDemanda(d);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDemanda(null);
    
    if (!over) return;
    
    const id = Number(active.id);
    const newStatus = over.id as Status;
    const d = demandas.find((x) => x.id === id);
    
    if (d && d.status !== newStatus) {
      moveMutation.mutate({ id, status: newStatus });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p>Carregando demandas...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-demandas">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quadro de Demandas</h1>
          <p className="text-muted-foreground mt-1">
            Arraste os cards entre as colunas para alterar o status
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-nova-demanda">
              <Plus className="h-4 w-4 mr-2" /> Nova Demanda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Nova Demanda</DialogTitle>
            </DialogHeader>
            <DemandaForm
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
                setCreateDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(Object.entries(STATUS_LABEL) as [Status, string][]).map(
            ([status, label]) => (
              <KanbanColumn
                key={status}
                status={status}
                label={label}
                demandas={columns[status]}
                onEdit={setEditing}
                onDelete={(id) => {
                  if (confirm("Tem certeza que deseja excluir esta demanda?")) {
                    deleteMutation.mutate(id);
                  }
                }}
              />
            )
          )}
        </div>

        <DragOverlay>
          {activeDemanda ? (
            <Card className="w-80 opacity-90 rotate-3 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {activeDemanda.titulo}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <p className="line-clamp-2">{activeDemanda.descricao}</p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Tabela de Histórico */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-xl">Histórico de Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingHistorico ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma movimentação registrada ainda
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-historico">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Demanda</th>
                    <th className="text-left p-2">Ação</th>
                    <th className="text-left p-2">De</th>
                    <th className="text-left p-2">Para</th>
                    <th className="text-left p-2">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h: any) => (
                    <tr key={h.id} className="border-b hover:bg-muted/50" data-testid={`historico-row-${h.id}`}>
                      <td className="p-2">
                        {h.criadoEm ? formatDate(new Date(h.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </td>
                      <td className="p-2">{h.demandaTitulo || "-"}</td>
                      <td className="p-2">{h.acao || "-"}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {h.statusAnterior || "-"}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {h.statusNovo || "-"}
                        </Badge>
                      </td>
                      <td className="p-2">{h.usuarioEmail || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Demanda</DialogTitle>
          </DialogHeader>
          {editing && (
            <DemandaForm
              initial={editing}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
