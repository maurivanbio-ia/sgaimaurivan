"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pencil,
  Loader2,
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
        />
      </div>

      <div>
        <Label>Descrição *</Label>
        <Textarea
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Setor *</Label>
          <Select
            value={form.setor}
            onValueChange={(v) => setForm({ ...form, setor: v })}
          >
            <SelectTrigger>
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
            <SelectTrigger>
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
          />
        </div>
        <div>
          <Label>Data de Entrega *</Label>
          <Input
            type="date"
            value={form.dataEntrega}
            onChange={(e) => setForm({ ...form, dataEntrega: e.target.value })}
            required
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
            <SelectTrigger>
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

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {isEdit ? "Salvar alterações" : "Criar demanda"}
      </Button>
    </form>
  );
}

// ===================================================
// Cartão de Demanda
// ===================================================

function DemandaCard({
  demanda,
  onEdit,
}: {
  demanda: Demanda;
  onEdit: (d: Demanda) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({
      id: demanda.id,
    });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2 cursor-grab hover:shadow-md"
    >
      <CardHeader className="pb-2 flex justify-between items-center">
        <CardTitle className="text-sm font-semibold">{demanda.titulo}</CardTitle>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // impede conflito com DnD
            onEdit(demanda); // abre modal corretamente
          }}
        >
          <Pencil className="h-4 w-4 text-gray-500" />
        </Button>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <p className="line-clamp-2">{demanda.descricao}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{demanda.setor}</Badge>
          <Badge>{demanda.prioridade}</Badge>
          <Badge variant="outline">
            {formatDate(new Date(demanda.dataEntrega), "dd/MM/yyyy", {
              locale: ptBR,
            })}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================================================
// Página Principal
// ===================================================

export default function DemandasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor));
  const { data: raw, isLoading } = useQuery({
    queryKey: ["/api/demandas"],
    queryFn: async () => apiRequest("GET", "/api/demandas"),
  });
  const demandas: Demanda[] = ensureArray<Demanda>(raw);
  const [editing, setEditing] = useState<Demanda | null>(null);

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Status }) =>
      apiRequest("PATCH", `/api/demandas/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/demandas"] }),
    onError: (e: any) =>
      toast({
        title: "Falha ao mover demanda",
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

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const id = Number(active.id);
    const newStatus = over.id as Status;
    const d = demandas.find((x) => x.id === id);
    if (d && d.status !== newStatus)
      moveMutation.mutate({ id, status: newStatus });
  };

  if (isLoading)
    return <div className="p-6 text-center">Carregando demandas...</div>;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Demandas</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Nova Demanda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Nova Demanda</DialogTitle>
            </DialogHeader>
            <DemandaForm
              onSuccess={() =>
                queryClient.invalidateQueries({ queryKey: ["/api/demandas"] })
              }
            />
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          {(Object.entries(STATUS_LABEL) as [Status, string][]).map(
            ([status, label]) => (
              <div
                key={status}
                id={status}
                className="w-80 rounded-xl border p-3 bg-muted/30"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{label}</Badge>
                </div>
                <SortableContext
                  items={columns[status].map((d) => d.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {columns[status].map((d) => (
                      <DemandaCard key={d.id} demanda={d} onEdit={setEditing} />
                    ))}
                  </div>
                </SortableContext>
              </div>
            )
          )}
        </div>
      </DndContext>

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
