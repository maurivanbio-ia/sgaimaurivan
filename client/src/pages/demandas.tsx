import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format as formatDate, parseISO, isValid as isValidDate } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Loader2,
  GripVertical,
  Trash2,
  ChevronsUpDown,
  Check,
  User,
  Eye,
  Calendar,
  Tag,
  AlertCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RefreshButton } from "@/components/RefreshButton";

// ===================================================
// Tipos e Constantes
// ===================================================

interface Colaborador {
  id: number;
  nome: string;
  cargo: string | null;
  email: string | null;
  tipo: "rh" | "user";
}

type Status = "a_fazer" | "em_andamento" | "em_revisao" | "concluido" | "cancelado";
type Prioridade = "baixa" | "media" | "alta";
type Complexidade = "baixa" | "media" | "alta";
type Categoria =
  | "reuniao"
  | "relatorio_tecnico"
  | "documento"
  | "campo"
  | "vistoria"
  | "licenciamento"
  | "analise"
  | "outro"
  | "geral";

type Demanda = {
  id: number;
  titulo: string;
  descricao: string;
  setor: string;
  prioridade: Prioridade;
  complexidade: Complexidade;
  categoria: Categoria;
  dataEntrega: string; // YYYY-MM-DD
  status: Status;

  // RESPONSÁVEL (corrigido)
  responsavelId?: number | null; // vindo do backend ou enviado ao backend
  responsavel?: string | null; // nome (se o backend devolver)
  empreendimentoId?: number | null;
};

const VALID_STATUSES: Status[] = [
  "a_fazer",
  "em_andamento",
  "em_revisao",
  "concluido",
  "cancelado",
];

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "reuniao", label: "Reunião" },
  { value: "relatorio_tecnico", label: "Relatório Técnico" },
  { value: "documento", label: "Documento" },
  { value: "campo", label: "Trabalho de Campo" },
  { value: "vistoria", label: "Vistoria" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "analise", label: "Análise" },
  { value: "outro", label: "Outro" },
  { value: "geral", label: "Geral" },
];

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
// Funções auxiliares (robustez para evitar NaN/404)
// ===================================================

async function apiRequest<T = any>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

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

function safeNumber(x: any): number | null {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(x: any): Status {
  const s = String(x ?? "").trim();
  return (VALID_STATUSES.includes(s as Status) ? (s as Status) : "a_fazer");
}

function normalizeDateYmd(x: any): string {
  const s = String(x ?? "").trim();
  if (!s) return "";
  // aceita YYYY-MM-DD ou ISO
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T12:00:00`);
  if (!isValidDate(d)) return "";
  // normaliza p/ YYYY-MM-DD
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
    .toISOString()
    .slice(0, 10);
}

function normalizeDemanda(raw: any): Demanda | null {
  const id = safeNumber(raw?.id);
  if (!id) return null;

  const status = normalizeStatus(raw?.status);
  const dataEntrega = normalizeDateYmd(raw?.dataEntrega);

  return {
    id,
    titulo: String(raw?.titulo ?? "").trim(),
    descricao: String(raw?.descricao ?? "").trim(),
    setor: String(raw?.setor ?? SETORES[0]),
    prioridade: (raw?.prioridade ?? "media") as Prioridade,
    complexidade: (raw?.complexidade ?? "media") as Complexidade,
    categoria: (raw?.categoria ?? "geral") as Categoria,
    dataEntrega,
    status,

    responsavelId: safeNumber(raw?.responsavelId ?? raw?.responsavel_id ?? raw?.responsavel?.id) ?? null,
    responsavel: raw?.responsavelNome ?? raw?.responsavel_nome ?? raw?.responsavel?.nome ?? raw?.responsavel ?? null,
    empreendimentoId: safeNumber(raw?.empreendimentoId ?? raw?.empreendimento_id) ?? null,
  };
}

function normalizeDemandasList(raw: any): Demanda[] {
  return ensureArray<any>(raw)
    .map(normalizeDemanda)
    .filter((d): d is Demanda => Boolean(d?.id));
}

function getResponsavelNome(d: Demanda, colaboradores: Colaborador[]): string {
  if (d?.responsavel && String(d.responsavel).trim()) return String(d.responsavel).trim();
  const rid = d?.responsavelId ?? null;
  if (!rid) return "Não atribuído";
  const c = colaboradores.find((x) => x.id === rid);
  return c?.nome ?? "Não atribuído";
}

function insertDemandaInCache(queryClient: any, newDemanda: Demanda) {
  queryClient.setQueryData(["/api/demandas"], (old: any) => {
    const arr = normalizeDemandasList(old);
    const exists = arr.some((d) => d.id === newDemanda.id);
    if (exists) return arr.map((d) => (d.id === newDemanda.id ? newDemanda : d));
    return [newDemanda, ...arr];
  });
}

function replaceDemandaInCache(queryClient: any, updated: Demanda) {
  queryClient.setQueryData(["/api/demandas"], (old: any) => {
    const arr = normalizeDemandasList(old);
    return arr.map((d) => (d.id === updated.id ? updated : d));
  });
}

function removeDemandaFromCache(queryClient: any, id: number) {
  queryClient.setQueryData(["/api/demandas"], (old: any) => {
    const arr = normalizeDemandasList(old);
    return arr.filter((d) => d.id !== id);
  });
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
  const [openResponsavel, setOpenResponsavel] = useState(false);

  const { data: empreendimentos = [] } = useQuery({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => apiRequest("GET", "/api/empreendimentos"),
  });

  const { data: colaboradoresRaw = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
    queryFn: async () => apiRequest("GET", "/api/colaboradores"),
  });

  const colaboradores = Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [];

  const [form, setForm] = useState({
    titulo: initial?.titulo ?? "",
    descricao: initial?.descricao ?? "",
    setor: initial?.setor ?? SETORES[0],
    prioridade: (initial?.prioridade ?? "media") as Prioridade,
    complexidade: (initial?.complexidade ?? "media") as Complexidade,
    categoria: (initial?.categoria ?? "geral") as Categoria,

    // RESPONSÁVEL (corrigido)
    responsavelId: (initial as any)?.responsavelId ?? null,
    responsavelNome: (initial as any)?.responsavel ?? "",

    dataEntrega: initial?.dataEntrega ? normalizeDateYmd(initial.dataEntrega) : "",
    status: (initial?.status ?? "a_fazer") as Status,
    empreendimentoId: initial?.empreendimentoId ? String(initial.empreendimentoId) : "",
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<Demanda> => {
      if (!form.responsavelId) {
        // exige responsável de fato
        throw new Error("Selecione um responsável.");
      }

      const payload: any = {
        titulo: String(form.titulo).trim(),
        descricao: String(form.descricao).trim(),
        setor: form.setor,
        prioridade: form.prioridade,
        complexidade: form.complexidade,
        categoria: form.categoria,
        dataEntrega: form.dataEntrega,
        status: form.status ?? "a_fazer",

        // envia o ID do responsável (backend deve persistir)
        responsavelId: form.responsavelId,
      };

      if (form.empreendimentoId) payload.empreendimentoId = Number(form.empreendimentoId);

      const res = isEdit && initial?.id != null
        ? await apiRequest<any>("PATCH", `/api/demandas/${initial.id}`, payload)
        : await apiRequest<any>("POST", "/api/demandas", payload);

      // normaliza e garante nome do responsável no retorno (mesmo que o backend não devolva)
      const norm = normalizeDemanda(res) ?? normalizeDemanda(res?.data) ?? null;
      if (!norm) throw new Error("Resposta inválida do servidor ao salvar demanda.");

      const nome = colaboradores.find((c) => c.id === form.responsavelId)?.nome ?? form.responsavelNome ?? null;
      return { ...norm, responsavelId: form.responsavelId, responsavel: nome };
    },
    onSuccess: async (createdOrUpdated: Demanda) => {
      if (!isEdit) insertDemandaInCache(queryClient, createdOrUpdated);
      else replaceDemandaInCache(queryClient, createdOrUpdated);

      // atualiza histórico (não precisa invalidar /api/demandas se cache já atualizado)
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });

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

      <div>
        <Label>Empreendimento</Label>
        <Select value={form.empreendimentoId || ""} onValueChange={(v) => setForm({ ...form, empreendimentoId: v })}>
          <SelectTrigger data-testid="select-empreendimento">
            <SelectValue placeholder="Selecione um empreendimento (opcional)" />
          </SelectTrigger>
          <SelectContent>
            {ensureArray<any>(empreendimentos).map((emp: any) => (
              <SelectItem key={emp.id} value={String(emp.id)}>
                {emp.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Setor *</Label>
          <Select value={form.setor} onValueChange={(v) => setForm({ ...form, setor: v })}>
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

        <div>
          <Label>Complexidade *</Label>
          <Select
            value={form.complexidade}
            onValueChange={(v: Complexidade) => setForm({ ...form, complexidade: v })}
          >
            <SelectTrigger data-testid="select-complexidade">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="baixa">Baixa (5 pts)</SelectItem>
              <SelectItem value="media">Média (15 pts)</SelectItem>
              <SelectItem value="alta">Alta (30 pts)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Categoria *</Label>
        <Select value={form.categoria} onValueChange={(v: Categoria) => setForm({ ...form, categoria: v })}>
          <SelectTrigger data-testid="select-categoria">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <Label className="mb-2">Responsável *</Label>
          <Popover open={openResponsavel} onOpenChange={setOpenResponsavel}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openResponsavel}
                className={cn("w-full justify-between", !form.responsavelId && "text-muted-foreground")}
                data-testid="input-responsavel"
              >
                {form.responsavelId
                  ? (colaboradores.find((c) => c.id === form.responsavelId)?.nome ?? form.responsavelNome ?? "Selecionado")
                  : "Selecione um colaborador"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[320px] p-0">
              <Command>
                <CommandInput placeholder="Buscar colaborador..." />
                <CommandList>
                  <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                  <CommandGroup>
                    {colaboradores
                      .filter((c) => c.tipo === "user" && c.id)
                      .map((colab) => (
                        <CommandItem
                          key={`${colab.tipo}-${colab.id}`}
                          value={colab.nome}
                          onSelect={() => {
                            setForm({
                              ...form,
                              responsavelId: colab.id,
                              responsavelNome: colab.nome,
                            });
                            setOpenResponsavel(false);
                          }}
                        >
                          <User className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{colab.nome}</span>
                            {colab.email && (
                              <span className="text-xs text-muted-foreground">{colab.email}</span>
                            )}
                          </div>
                          <Check
                            className={cn(
                              "ml-auto h-4 w-4",
                              form.responsavelId === colab.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
          <Select value={form.status} onValueChange={(v: Status) => setForm({ ...form, status: v })}>
            <SelectTrigger data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALID_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-submit-demanda">
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  colaboradores,
  onEdit,
  onDelete,
}: {
  demanda: Demanda;
  colaboradores: Colaborador[];
  onEdit: (d: Demanda) => void;
  onDelete: (id: number) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: demanda.id,
    data: {
      type: "card",
      status: demanda.status, // ajuda a inferir destino no onDragEnd
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prioridadeColor =
    {
      baixa: "bg-green-500",
      media: "bg-yellow-500",
      alta: "bg-red-500",
    }[demanda.prioridade] ?? "bg-yellow-500";

  const statusLabel = STATUS_LABEL[demanda.status] ?? "A Fazer";

  const categoriaLabel =
    {
      reuniao: "Reunião",
      relatorio_tecnico: "Relatório Técnico",
      documento: "Documento",
      campo: "Campo",
      vistoria: "Vistoria",
      licenciamento: "Licenciamento",
      analise: "Análise",
      outro: "Outro",
      geral: "Geral",
    }[demanda.categoria || "geral"] ?? "Geral";

  const responsavelNome = getResponsavelNome(demanda, colaboradores);

  return (
    <>
      <Card ref={setNodeRef} style={style} className="mb-2 hover:shadow-md transition-shadow" data-testid={`demanda-card-${demanda.id}`}>
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-start justify-between gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pt-1" data-testid={`drag-handle-${demanda.id}`}>
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold line-clamp-2">{demanda.titulo}</CardTitle>
            </div>

            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDetails(true);
                }}
                data-testid={`button-view-demanda-${demanda.id}`}
                title="Visualizar detalhes"
              >
                <Eye className="h-4 w-4 text-blue-500 hover:text-blue-700" />
              </Button>

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
                title="Editar demanda"
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
                title="Excluir demanda"
              >
                <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/70" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="text-xs text-muted-foreground px-3 pb-3">
          <p className="line-clamp-2 mb-2">{demanda.descricao}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {demanda.setor}
            </Badge>
            <Badge className={`${prioridadeColor} text-white text-xs`}>
              {demanda.prioridade === "baixa" ? "Baixa" : demanda.prioridade === "media" ? "Média" : "Alta"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {demanda.dataEntrega ? formatDate(parseISO(demanda.dataEntrega), "dd/MM/yyyy", { locale: ptBR }) : "-"}
            </Badge>
          </div>

          {/* RESPONSÁVEL visível no card (opcional, mas ajuda a validar) */}
          <p className="text-xs text-muted-foreground mt-2">{responsavelNome}</p>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {demanda.titulo}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-sm">
                {statusLabel}
              </Badge>
              <Badge className={`${prioridadeColor} text-white text-sm`}>
                Prioridade: {demanda.prioridade === "baixa" ? "Baixa" : demanda.prioridade === "media" ? "Média" : "Alta"}
              </Badge>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Descrição</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{demanda.descricao || "Sem descrição"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Responsável
                </Label>
                <p className="mt-1 text-sm">{responsavelNome}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Setor
                </Label>
                <p className="mt-1 text-sm">{demanda.setor}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data de Entrega
                </Label>
                <p className="mt-1 text-sm">
                  {demanda.dataEntrega
                    ? formatDate(parseISO(demanda.dataEntrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                    : "-"}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Complexidade
                </Label>
                <p className="mt-1 text-sm capitalize">{demanda.complexidade || "Não definida"}</p>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Categoria</Label>
                <p className="mt-1 text-sm">{categoriaLabel}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDetails(false)}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setShowDetails(false);
                  onEdit(demanda);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===================================================
// Coluna do Kanban (Droppable)
// ===================================================

function KanbanColumn({
  status,
  label,
  demandas,
  colaboradores,
  onEdit,
  onDelete,
}: {
  status: Status;
  label: string;
  demandas: Demanda[];
  colaboradores: Colaborador[];
  onEdit: (d: Demanda) => void;
  onDelete: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
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

      <SortableContext items={demandas.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {demandas.map((d) => (
            <DemandaCard
              key={d.id}
              demanda={d}
              colaboradores={colaboradores}
              onEdit={onEdit}
              onDelete={onDelete}
            />
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
      activationConstraint: { distance: 8 },
    })
  );

  const { data: colaboradoresRaw = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
    queryFn: async () => apiRequest("GET", "/api/colaboradores"),
  });

  const colaboradores = Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [];

  const { data: raw, isLoading } = useQuery({
    queryKey: ["/api/demandas"],
    queryFn: async () => apiRequest("GET", "/api/demandas"),
  });

  const demandas: Demanda[] = useMemo(() => normalizeDemandasList(raw), [raw]);

  // Histórico: exibir apenas últimos 30 dias (frontend).
  // O purge automático real deve ser feito no backend (cron/job). Aqui fica uma proteção visual e uma tentativa opcional.
  const { data: historicoRaw, isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["/api/demandas/historico/all"],
    queryFn: async () => apiRequest("GET", "/api/demandas/historico/all"),
  });

  const historico30d = useMemo(() => {
    const arr = ensureArray<any>(historicoRaw);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return arr.filter((h) => {
      const t = h?.criadoEm ? new Date(h.criadoEm).getTime() : 0;
      return t && Number.isFinite(t) ? t >= cutoff : true;
    });
  }, [historicoRaw]);

  const [editing, setEditing] = useState<Demanda | null>(null);
  const [activeDemanda, setActiveDemanda] = useState<Demanda | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // ===================================================
  // Mutations com update otimista (corrige "não move" e "não deleta")
  // ===================================================

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Status }) => {
      if (!id || !Number.isFinite(id)) throw new Error("ID inválido da demanda.");
      if (!VALID_STATUSES.includes(status)) throw new Error("Status inválido.");
      return apiRequest("PATCH", `/api/demandas/${id}`, { status });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/demandas"] });
      const prev = queryClient.getQueryData(["/api/demandas"]);

      // otimista
      queryClient.setQueryData(["/api/demandas"], (old: any) => {
        const arr = normalizeDemandasList(old);
        return arr.map((d) => (d.id === id ? { ...d, status } : d));
      });

      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["/api/demandas"], ctx.prev);
      toast({
        title: "Falha ao mover demanda",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      toast({ title: "Demanda movida com sucesso!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!id || !Number.isFinite(id)) throw new Error("ID inválido da demanda.");
      return apiRequest("DELETE", `/api/demandas/${id}`);
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/demandas"] });
      const prev = queryClient.getQueryData(["/api/demandas"]);

      removeDemandaFromCache(queryClient, id);

      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["/api/demandas"], ctx.prev);
      toast({
        title: "Falha ao excluir demanda",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/licencas/calendar"], exact: false });
      toast({ title: "Demanda excluída com sucesso!" });
    },
  });

  const clearHistoricoMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/admin/demandas/historico`),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      toast({ title: data?.message || "Histórico limpo com sucesso!" });
    },
    onError: (e: any) =>
      toast({
        title: "Falha ao limpar histórico",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      }),
  });

  // ===================================================
  // Agrupamento por colunas
  // ===================================================

  const columns = useMemo(() => {
    const grouped: Record<Status, Demanda[]> = {
      a_fazer: [],
      em_andamento: [],
      em_revisao: [],
      concluido: [],
      cancelado: [],
    };

    demandas.forEach((d) => {
      grouped[normalizeStatus(d.status)].push(d);
    });

    return grouped;
  }, [demandas]);

  // ===================================================
  // Drag handlers (corrige drop sobre card vs coluna)
  // ===================================================

  const onDragStart = (e: DragStartEvent) => {
    const id = safeNumber(e.active.id);
    if (!id) return;
    const d = demandas.find((x) => x.id === id);
    if (d) setActiveDemanda(d);
  };

  function extractOverStatus(over: any): Status | null {
    // 1) se caiu na coluna, over.id será o status
    const overIdStr = String(over?.id ?? "");
    if (VALID_STATUSES.includes(overIdStr as Status)) return overIdStr as Status;

    // 2) se caiu em cima de outro card, tenta achar coluna via data do sortable
    const sortableContainerId = over?.data?.current?.sortable?.containerId;
    const c = String(sortableContainerId ?? "");
    if (VALID_STATUSES.includes(c as Status)) return c as Status;

    // 3) se o over.id for um número (id de card), usa status do card alvo
    const overIdNum = safeNumber(over?.id);
    if (overIdNum) {
      const target = demandas.find((x) => x.id === overIdNum);
      if (target) return normalizeStatus(target.status);
    }

    return null;
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDemanda(null);

    if (!over) return;

    const id = safeNumber(active.id);
    if (!id) {
      toast({
        title: "Falha ao mover demanda",
        description: "ID inválido do card (não numérico).",
        variant: "destructive",
      });
      return;
    }

    const newStatus = extractOverStatus(over);
    if (!newStatus) return;

    const d = demandas.find((x) => x.id === id);
    if (d && d.status !== newStatus) moveMutation.mutate({ id, status: newStatus });
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

        <div className="flex gap-2">
          <RefreshButton />

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
                  // a demanda já entra no Kanban via cache (insertDemandaInCache)
                  setCreateDialogOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(Object.entries(STATUS_LABEL) as [Status, string][]).map(([status, label]) => (
            <KanbanColumn
              key={status}
              status={status}
              label={label}
              demandas={columns[status]}
              colaboradores={colaboradores}
              onEdit={setEditing}
              onDelete={(id) => {
                if (confirm("Tem certeza que deseja excluir esta demanda?")) {
                  deleteMutation.mutate(id);
                }
              }}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDemanda ? (
            <Card className="w-80 opacity-90 rotate-3 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{activeDemanda.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                <p className="line-clamp-2">{activeDemanda.descricao}</p>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Tabela de Histórico (últimos 30 dias no frontend) */}
      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Histórico de Movimentações (últimos 30 dias)</CardTitle>

          {historico30d.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Tem certeza que deseja limpar todo o histórico de movimentações?")) {
                  clearHistoricoMutation.mutate();
                }
              }}
              disabled={clearHistoricoMutation.isPending}
            >
              {clearHistoricoMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpar Histórico
            </Button>
          )}
        </CardHeader>

        <CardContent>
          {isLoadingHistorico ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : historico30d.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma movimentação registrada nos últimos 30 dias
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
                  {historico30d.map((h: any) => (
                    <tr key={h.id} className="border-b hover:bg-muted/50" data-testid={`historico-row-${h.id}`}>
                      <td className="p-2">
                        {h.criadoEm
                          ? formatDate(new Date(h.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : "-"}
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
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
