import React, { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  format as formatDate,
  parseISO,
  isValid as isValidDate,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
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
  Download,
  FileDown,
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
  dataInicio?: string | null; // YYYY-MM-DD (início do período)
  dataEntrega: string; // YYYY-MM-DD (fim do período)
  status: Status;

  responsavelId?: number | null;
  responsavel?: string | null;
  empreendimentoId?: number | null;
};

const VALID_STATUSES: Status[] = ["a_fazer", "em_andamento", "em_revisao", "concluido", "cancelado"];

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

// Paleta EcoBrasil
const ECOBRASIL = {
  azulEscuro: "rgb(31, 56, 100)",
  cinzaClaro: "rgb(217, 217, 217)",
};

// ===================================================
// Helpers gerais
// ===================================================

function safeNumber(x: any): number | null {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

function normalizeStatus(x: any): Status {
  const s = String(x ?? "").trim();
  return VALID_STATUSES.includes(s as Status) ? (s as Status) : "a_fazer";
}

function normalizePrioridade(x: any): Prioridade {
  const s = String(x ?? "").trim().toLowerCase();
  if (s === "alta" || s === "high" || s === "urgent" || s === "urgente") return "alta";
  if (s === "baixa" || s === "low") return "baixa";
  return "media";
}

function normalizeComplexidade(x: any): Complexidade {
  const s = String(x ?? "").trim().toLowerCase();
  if (s === "alta" || s === "high") return "alta";
  if (s === "baixa" || s === "low") return "baixa";
  return "media";
}

function normalizeCategoria(x: any): Categoria {
  const s = String(x ?? "").trim().toLowerCase();
  const allowed: Categoria[] = ["reuniao","relatorio_tecnico","documento","campo","vistoria","licenciamento","analise","outro","geral"];
  return (allowed.includes(s as Categoria) ? (s as Categoria) : "geral");
}

function normalizeSetor(x: any): string {
  const s = String(x ?? "").trim();
  return SETORES.includes(s) ? s : SETORES[0];
}

function parseLocalYMD(ymd: string): Date | null {
  const s = String(ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((p) => Number(p));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return isValidDate(dt) ? dt : null;
}

function normalizeDateYmd(x: any): string {
  const s = String(x ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const d = s.includes("T") ? parseISO(s) : new Date(s);
    if (!isValidDate(d)) return "";
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    return local.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function normalizeDemanda(raw: any): Demanda | null {
  const id = safeNumber(raw?.id);
  if (!id) return null;

  const titulo = String(raw?.titulo ?? "").trim();
  const descricao = String(raw?.descricao ?? "").trim();
  const dataEntrega = normalizeDateYmd(raw?.dataEntrega ?? raw?.data_entrega);

  // mantido: descrição obrigatória
  if (!titulo || !descricao || !dataEntrega) return null;

  const dataInicio = normalizeDateYmd(raw?.dataInicio ?? raw?.data_inicio) || null;

  return {
    id,
    titulo,
    descricao,
    setor: normalizeSetor(raw?.setor),
    prioridade: normalizePrioridade(raw?.prioridade),
    complexidade: normalizeComplexidade(raw?.complexidade),
    categoria: normalizeCategoria(raw?.categoria),
    dataInicio,
    dataEntrega,
    status: normalizeStatus(raw?.status),
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

function escapeCsv(value: any) {
  const s = String(value ?? "");
  const needsQuotes = /[",\n;]/.test(s);
  const cleaned = s.replaceAll('"', '""');
  return needsQuotes ? `"${cleaned}"` : cleaned;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ===================================================
// apiRequest robusto. credenciais incluídas
// ===================================================

async function apiRequest<T = any>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "include",
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
    const msg =
      json && typeof json === "object"
        ? `${res.status}: ${json?.message ?? JSON.stringify(json)}`
        : `${res.status}: ${text || "Erro"}`;
    throw new Error(msg);
  }

  return (json ?? null) as T;
}

// ===================================================
// Persistência de ordem local por status
// ===================================================

const ORDER_STORAGE_KEY = "ecobrasil_demandas_order_v2";

type OrderState = Record<Status, number[]>;

function defaultOrderState(): OrderState {
  return { a_fazer: [], em_andamento: [], em_revisao: [], concluido: [], cancelado: [] };
}

function loadOrder(): OrderState | null {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const base = defaultOrderState();
    for (const st of VALID_STATUSES) {
      const arr = Array.isArray(parsed?.[st]) ? parsed[st].map((x: any) => safeNumber(x)).filter(Boolean) : [];
      base[st] = arr as number[];
    }
    return base;
  } catch {
    return null;
  }
}

function saveOrder(order: OrderState) {
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}

function buildOrderFromDemandas(demandas: Demanda[], prev?: OrderState | null): OrderState {
  const byStatus: Record<Status, number[]> = defaultOrderState();

  const idsByStatus = new Map<Status, number[]>();
  for (const st of VALID_STATUSES) idsByStatus.set(st, []);

  for (const d of demandas) {
    const st = normalizeStatus(d.status);
    idsByStatus.get(st)!.push(d.id);
  }

  for (const st of VALID_STATUSES) {
    const currentIds = idsByStatus.get(st)!;
    const prevIds = prev?.[st] ?? [];
    const kept = prevIds.filter((id) => currentIds.includes(id));
    const missing = currentIds.filter((id) => !kept.includes(id));
    byStatus[st] = [...kept, ...missing];
  }

  return byStatus;
}

function stableStringifyOrder(order: OrderState): string {
  return JSON.stringify(VALID_STATUSES.reduce((acc, st) => {
    acc[st] = order[st] ?? [];
    return acc;
  }, {} as any));
}

// ===================================================
// Helpers de invalidação
// ===================================================

function invalidateDashboard(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "/api/dashboard/stats",
    refetchType: "all",
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
    staleTime: 60_000,
  });

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
    queryFn: async () => apiRequest("GET", "/api/colaboradores"),
    staleTime: 60_000,
  });

  const [form, setForm] = useState({
    titulo: initial?.titulo ?? "",
    descricao: initial?.descricao ?? "",
    setor: initial?.setor ?? SETORES[0],
    prioridade: (initial?.prioridade ?? "media") as Prioridade,
    complexidade: (initial?.complexidade ?? "media") as Complexidade,
    categoria: (initial?.categoria ?? "geral") as Categoria,
    responsavelId: (initial as any)?.responsavelId ?? null,
    responsavelNome: (initial as any)?.responsavel ?? "",
    dataInicio: (initial as any)?.dataInicio ? normalizeDateYmd((initial as any).dataInicio) : "",
    dataEntrega: initial?.dataEntrega ? normalizeDateYmd(initial.dataEntrega) : "",
    status: (initial?.status ?? "a_fazer") as Status,
    empreendimentoId: initial?.empreendimentoId ? String(initial.empreendimentoId) : "",
  });

  const validate = (): string | null => {
    const titulo = String(form.titulo ?? "").trim();
    const descricao = String(form.descricao ?? "").trim();
    if (!titulo) return "Informe um título.";
    if (!descricao) return "Informe uma descrição.";
    if (!form.responsavelId) return "Selecione um responsável.";
    if (!form.dataEntrega) return "Informe a data de entrega.";

    const entrega = parseLocalYMD(form.dataEntrega);
    if (!entrega) return "Data de entrega inválida.";

    if (form.dataInicio) {
      const inicio = parseLocalYMD(form.dataInicio);
      if (!inicio) return "Data de início inválida.";
      if (inicio.getTime() > entrega.getTime()) return "A data de início não pode ser maior que a data de entrega.";
    }
    return null;
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<Demanda> => {
      const err = validate();
      if (err) throw new Error(err);

      const payload: any = {
        titulo: String(form.titulo).trim(),
        descricao: String(form.descricao).trim(),
        setor: normalizeSetor(form.setor),
        prioridade: normalizePrioridade(form.prioridade),
        complexidade: normalizeComplexidade(form.complexidade),
        categoria: normalizeCategoria(form.categoria),
        dataInicio: form.dataInicio || null,
        dataEntrega: form.dataEntrega,
        status: form.status ?? "a_fazer",
        responsavelId: form.responsavelId,
      };

      if (form.empreendimentoId) payload.empreendimentoId = Number(form.empreendimentoId);

      const res =
        isEdit && initial?.id != null
          ? await apiRequest<any>("PATCH", `/api/demandas/${initial.id}`, payload)
          : await apiRequest<any>("POST", "/api/demandas", payload);

      const norm = normalizeDemanda(res) ?? normalizeDemanda(res?.data) ?? null;
      if (!norm) throw new Error("Resposta inválida do servidor ao salvar demanda.");

      const nome = colaboradores.find((c) => c.id === form.responsavelId)?.nome ?? form.responsavelNome ?? null;
      return { ...norm, responsavelId: form.responsavelId, responsavel: nome };
    },
    onSuccess: async (createdOrUpdated: Demanda) => {
      queryClient.setQueryData<Demanda[]>(["/api/demandas"], (old) => {
        const arr = Array.isArray(old) ? old : [];
        const exists = arr.some((d) => d.id === createdOrUpdated.id);
        if (exists) return arr.map((d) => (d.id === createdOrUpdated.id ? createdOrUpdated : d));
        return [createdOrUpdated, ...arr];
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      await invalidateDashboard(queryClient);

      toast({ title: isEdit ? "Demanda atualizada." : "Demanda criada." });
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

      <div>
        <Label>Empreendimento</Label>
        <Select value={form.empreendimentoId || ""} onValueChange={(v) => setForm({ ...form, empreendimentoId: v })}>
          <SelectTrigger>
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
          <Select value={form.prioridade} onValueChange={(v: Prioridade) => setForm({ ...form, prioridade: v })}>
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

        <div>
          <Label>Complexidade *</Label>
          <Select value={form.complexidade} onValueChange={(v: Complexidade) => setForm({ ...form, complexidade: v })}>
            <SelectTrigger>
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
          <SelectTrigger>
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
              >
                {form.responsavelId
                  ? colaboradores.find((c) => c.id === form.responsavelId)?.nome ?? form.responsavelNome ?? "Selecionado"
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
                            setForm({ ...form, responsavelId: colab.id, responsavelNome: colab.nome });
                            setOpenResponsavel(false);
                          }}
                        >
                          <User className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{colab.nome}</span>
                            {colab.email ? <span className="text-xs text-muted-foreground">{colab.email}</span> : null}
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
          <Label>Data Início</Label>
          <Input
            type="date"
            value={form.dataInicio}
            onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
            placeholder="Opcional"
          />
        </div>

        <div>
          <Label>Data Entrega *</Label>
          <Input
            type="date"
            value={form.dataEntrega}
            onChange={(e) => setForm({ ...form, dataEntrega: e.target.value })}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Para demandas de vários dias, preencha Data Início e Data Entrega. Ex.: 13/01 a 17/01
      </p>

      {isEdit ? (
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v: Status) => setForm({ ...form, status: v })}>
            <SelectTrigger>
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
      ) : null}

      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isEdit ? "Salvar alterações" : "Criar demanda"}
      </Button>
    </form>
  );
}

// ===================================================
// Card Sortable
// ===================================================

function DemandaCard({
  demanda,
  colaboradores,
  onEdit,
  onAskDelete,
}: {
  demanda: Demanda;
  colaboradores: Colaborador[];
  onEdit: (d: Demanda) => void;
  onAskDelete: (d: Demanda) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const sortableId = `card:${demanda.id}`;

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { type: "card", demandaId: demanda.id, status: demanda.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prioridadeColor =
    { baixa: "bg-green-500", media: "bg-yellow-500", alta: "bg-red-500" }[demanda.prioridade] ?? "bg-yellow-500";

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
      <Card ref={setNodeRef} style={style} className="mb-2 hover:shadow-md transition-shadow">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-start justify-between gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pt-1">
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
                title="Visualizar detalhes"
                aria-label="Visualizar detalhes"
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
                title="Editar demanda"
                aria-label="Editar demanda"
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
                  onAskDelete(demanda);
                }}
                title="Excluir demanda"
                aria-label="Excluir demanda"
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
              {demanda.dataEntrega ? formatDate(parseISO(demanda.dataEntrega), "dd/MM/yyyy", { locale: ptBR }) : "."}
            </Badge>
          </div>

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
                  {demanda.dataEntrega ? formatDate(parseISO(demanda.dataEntrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "."}
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
// Coluna do Kanban. Droppable
// ===================================================

function KanbanColumn({
  status,
  label,
  demandas,
  colaboradores,
  onEdit,
  onAskDelete,
}: {
  status: Status;
  label: string;
  demandas: Demanda[];
  colaboradores: Colaborador[];
  onEdit: (d: Demanda) => void;
  onAskDelete: (d: Demanda) => void;
}) {
  const droppableId = `column:${status}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId, data: { type: "column", status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-80 flex-shrink-0 rounded-lg border-2 p-3 transition-all",
        STATUS_COLORS[status],
        isOver ? "ring-2 ring-primary ring-offset-2 shadow-lg" : ""
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge variant="secondary" className="font-semibold">
          {label}
        </Badge>
        <Badge variant="outline" className="ml-2">
          {demandas.length}
        </Badge>
      </div>

      <SortableContext items={demandas.map((d) => `card:${d.id}`)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {demandas.map((d) => (
            <DemandaCard
              key={d.id}
              demanda={d}
              colaboradores={colaboradores}
              onEdit={onEdit}
              onAskDelete={onAskDelete}
            />
          ))}
          {demandas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Arraste uma demanda aqui</div>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

// ===================================================
// Calendário EcoBrasil. mês
// ===================================================

function CalendarioEcoBrasil({
  demandas,
  colaboradores,
  monthDate,
  onPrevMonth,
  onNextMonth,
  exportRef,
}: {
  demandas: Demanda[];
  colaboradores: Colaborador[];
  monthDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  exportRef: React.RefObject<HTMLDivElement>;
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const weekStartsOn = 1;
  const startDate = startOfWeek(monthStart, { locale: ptBR, weekStartsOn });
  const endDate = endOfWeek(monthEnd, { locale: ptBR, weekStartsOn });

  const rows: Date[][] = [];
  let day = startDate;

  while (day <= endDate) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    rows.push(week);
  }

  const byDate = useMemo(() => {
    const map = new Map<string, Demanda[]>();
    const visibleStart = startDate;
    const visibleEnd = endDate;

    for (const d of demandas) {
      const entregaYmd = normalizeDateYmd(d.dataEntrega);
      if (!entregaYmd) continue;

      const fim = parseLocalYMD(entregaYmd) ?? (entregaYmd.includes("T") ? parseISO(entregaYmd) : new Date(entregaYmd));
      const inicioYmd = d.dataInicio ? normalizeDateYmd(d.dataInicio) : "";
      const ini = inicioYmd
        ? (parseLocalYMD(inicioYmd) ?? (inicioYmd.includes("T") ? parseISO(inicioYmd) : new Date(inicioYmd)))
        : fim;

      if (!isValidDate(ini) || !isValidDate(fim)) continue;

      const start = ini.getTime() <= fim.getTime() ? ini : fim;
      const end = ini.getTime() <= fim.getTime() ? fim : ini;

      const clampedStart = new Date(Math.max(start.getTime(), visibleStart.getTime()));
      const clampedEnd = new Date(Math.min(end.getTime(), visibleEnd.getTime()));

      if (clampedStart.getTime() > clampedEnd.getTime()) continue;

      const dias = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
      for (const dia of dias) {
        const ymd = formatDate(dia, "yyyy-MM-dd");
        if (!map.has(ymd)) map.set(ymd, []);
        map.get(ymd)!.push(d);
      }
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const prio = { alta: 0, media: 1, baixa: 2 };
        return (prio[a.prioridade] ?? 9) - (prio[b.prioridade] ?? 9);
      });
      map.set(k, arr);
    }

    return map;
  }, [demandas, startDate, endDate]);

  const weekdays = weekStartsOn === 1 ? ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] : ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendário de Demandas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Destaque por prioridade. Exportável em PDF com layout EcoBrasil.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onPrevMonth}>
            {formatDate(subMonths(monthDate, 1), "MMM yyyy", { locale: ptBR })}
          </Button>
          <Badge className="text-white" style={{ backgroundColor: ECOBRASIL.azulEscuro }}>
            {formatDate(monthDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </Badge>
          <Button variant="outline" onClick={onNextMonth}>
            {formatDate(addMonths(monthDate, 1), "MMM yyyy", { locale: ptBR })}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div
          ref={exportRef}
          id="ecobrasil-calendar-export"
          style={{
            borderRadius: "12px",
            border: `1px solid ${ECOBRASIL.cinzaClaro}`,
            overflow: "hidden",
            backgroundColor: "#ffffff",
            width: "100%",
          }}
        >
          <div
            style={{
              backgroundColor: ECOBRASIL.azulEscuro,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ color: "#ffffff" }}>
              <div style={{ fontSize: "18px", fontWeight: "600" }}>EcoBrasil Consultoria Ambiental</div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>
                Calendário de Demandas. {formatDate(monthDate, "MMMM yyyy", { locale: ptBR })}
              </div>
            </div>
            <div style={{ color: "#ffffff", fontSize: "13px", opacity: 0.9 }}>
              Gerado em {formatDate(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ backgroundColor: ECOBRASIL.cinzaClaro }}>
                {weekdays.map((w) => (
                  <th
                    key={w}
                    style={{
                      padding: "8px 4px",
                      fontSize: "12px",
                      fontWeight: "600",
                      textAlign: "center",
                      color: ECOBRASIL.azulEscuro,
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((week, wi) => (
                <tr key={wi}>
                  {week.map((d, di) => {
                    const ymd = formatDate(d, "yyyy-MM-dd");
                    const list = byDate.get(ymd) ?? [];
                    const today = isSameDay(d, new Date());
                    const outside = !isSameMonth(d, monthStart);

                    return (
                      <td
                        key={`${wi}-${di}`}
                        style={{
                          height: "110px",
                          verticalAlign: "top",
                          padding: "8px",
                          backgroundColor: today ? "#e0f2fe" : "#ffffff",
                          border: "1px solid rgba(0,0,0,0.08)",
                          opacity: outside ? 0.4 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "6px",
                          }}
                        >
                          <span style={{ fontSize: "14px", fontWeight: "700", color: ECOBRASIL.azulEscuro }}>
                            {formatDate(d, "d", { locale: ptBR })}
                          </span>
                          {list.length > 0 && (
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                backgroundColor: ECOBRASIL.azulEscuro,
                                borderRadius: "10px",
                                color: "#ffffff",
                                fontWeight: "600",
                              }}
                            >
                              {list.length}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {list.slice(0, 2).map((dem) => {
                            const resp = getResponsavelNome(dem, colaboradores);
                            const borderColor =
                              dem.prioridade === "alta" ? "#dc2626" : dem.prioridade === "media" ? "#ca8a04" : "#16a34a";
                            const bgColor =
                              dem.prioridade === "alta" ? "#fef2f2" : dem.prioridade === "media" ? "#fefce8" : "#f0fdf4";
                            return (
                              <div
                                key={dem.id}
                                style={{
                                  backgroundColor: bgColor,
                                  borderLeft: `4px solid ${borderColor}`,
                                  borderRadius: "4px",
                                  padding: "4px 6px",
                                  fontSize: "11px",
                                  lineHeight: "1.3",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: "600",
                                    color: ECOBRASIL.azulEscuro,
                                    wordBreak: "break-word",
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  }}
                                >
                                  {dem.titulo}
                                </div>
                                <div style={{ fontSize: "10px", color: "#4b5563", marginTop: "2px", fontWeight: "500" }}>
                                  {resp}
                                </div>
                              </div>
                            );
                          })}
                          {list.length > 2 && (
                            <div
                              style={{
                                fontSize: "10px",
                                color: ECOBRASIL.azulEscuro,
                                fontWeight: "600",
                                textAlign: "center",
                                padding: "2px",
                                backgroundColor: "#f1f5f9",
                                borderRadius: "4px",
                              }}
                            >
                              +{list.length - 2} mais
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "#ffffff",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontWeight: "600", color: ECOBRASIL.azulEscuro }}>Legenda:</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "12px", height: "12px", backgroundColor: "#dc2626", borderRadius: "2px", display: "inline-block" }} />
                Alta
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "12px", height: "12px", backgroundColor: "#ca8a04", borderRadius: "2px", display: "inline-block" }} />
                Média
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "12px", height: "12px", backgroundColor: "#16a34a", borderRadius: "2px", display: "inline-block" }} />
                Baixa
              </span>
            </div>
            <div style={{ color: "#6b7280" }}>EcoBrasil. Demandas com data de entrega</div>
          </div>
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
  const [, setLocation] = useLocation();

  const calendarExportRef = useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  const { data: colaboradores = [] } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
    queryFn: async () => apiRequest("GET", "/api/colaboradores"),
    staleTime: 60_000,
  });

  const demandasQuery = useQuery({
    queryKey: ["/api/demandas"],
    queryFn: async () => apiRequest("GET", "/api/demandas"),
    select: (raw) => normalizeDemandasList(raw),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
    onError: (e: any) => {
      toast({
        title: "Falha ao carregar demandas",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const demandas: Demanda[] = Array.isArray(demandasQuery.data) ? demandasQuery.data : [];
  const isLoading = demandasQuery.isLoading;

  const { data: historicoRaw, isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["/api/demandas/historico/all"],
    queryFn: async () => apiRequest("GET", "/api/demandas/historico/all"),
    staleTime: 30_000,
  });

  const historico30d = useMemo(() => {
    const arr = ensureArray<any>(historicoRaw);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return arr.filter((h) => {
      const t = h?.criadoEm ? new Date(h.criadoEm).getTime() : NaN;
      return Number.isFinite(t) ? t >= cutoff : false;
    });
  }, [historicoRaw]);

  const [editing, setEditing] = useState<Demanda | null>(null);
  const [activeDemanda, setActiveDemanda] = useState<Demanda | null>(null);

  const [clearHistoricoDialogOpen, setClearHistoricoDialogOpen] = useState(false);
  const [clearHistoricoSenha, setClearHistoricoSenha] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [confirmDocumentoDialogOpen, setConfirmDocumentoDialogOpen] = useState(false);
  const [demandaPendenteConclusao, setDemandaPendenteConclusao] = useState<{ id: number; titulo: string } | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [demandaParaExcluir, setDemandaParaExcluir] = useState<Demanda | null>(null);

  // ===================================================
  // Ordem local por status
  // ===================================================

  const [order, setOrder] = useState<OrderState>(() => {
    const loaded = typeof window !== "undefined" ? loadOrder() : null;
    return loaded ?? defaultOrderState();
  });

  // fingerprint: muda quando IDs/status mudam. evita reset indevido
  const demandasFingerprint = useMemo(() => {
    const base = demandas.map((d) => `${d.id}:${normalizeStatus(d.status)}`).sort().join("|");
    return base;
  }, [demandas]);

  // mantém ordem consistente com o conjunto atual
  useEffect(() => {
    const next = buildOrderFromDemandas(demandas, order);
    const prevStr = stableStringifyOrder(order);
    const nextStr = stableStringifyOrder(next);
    if (prevStr !== nextStr) {
      setOrder(next);
      saveOrder(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandasFingerprint]);

  // ===================================================
  // Downloads
  // ===================================================

  const downloadDemandasCSV = () => {
    const header = [
      "id",
      "titulo",
      "descricao",
      "setor",
      "prioridade",
      "complexidade",
      "categoria",
      "dataInicio",
      "dataEntrega",
      "status",
      "responsavel",
      "responsavelId",
      "empreendimentoId",
    ];

    const rows = demandas.map((d) => {
      const resp = getResponsavelNome(d, colaboradores);
      return [
        d.id,
        d.titulo,
        d.descricao,
        d.setor,
        d.prioridade,
        d.complexidade,
        d.categoria,
        d.dataInicio ?? "",
        d.dataEntrega,
        d.status,
        resp,
        d.responsavelId ?? "",
        d.empreendimentoId ?? "",
      ].map(escapeCsv).join(";");
    });

    const content = [header.join(";"), ...rows].join("\n");
    downloadTextFile(`ecobrasil_demandas_${formatDate(new Date(), "yyyyMMdd_HHmm")}.csv`, content, "text/csv;charset=utf-8");
    toast({ title: "CSV gerado." });
  };

  const downloadDemandasJSON = () => {
    const enriched = demandas.map((d) => ({
      ...d,
      responsavelNome: getResponsavelNome(d, colaboradores),
      statusLabel: STATUS_LABEL[d.status],
    }));
    downloadTextFile(
      `ecobrasil_demandas_${formatDate(new Date(), "yyyyMMdd_HHmm")}.json`,
      JSON.stringify(enriched, null, 2),
      "application/json;charset=utf-8"
    );
    toast({ title: "JSON gerado." });
  };

  const downloadCalendarPDF = async () => {
    try {
      const el = calendarExportRef.current;
      if (!el) throw new Error("Calendário não encontrado para exportação.");

      const scale = Math.min(3, (window.devicePixelRatio || 1) * 2);

      const canvas = await html2canvas(el, {
        scale,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pageW / imgW, pageH / imgH);

      const drawW = imgW * ratio;
      const drawH = imgH * ratio;

      const marginX = (pageW - drawW) / 2;
      const marginY = (pageH - drawH) / 2;

      pdf.addImage(imgData, "PNG", marginX, marginY, drawW, drawH, undefined, "FAST");
      pdf.save(`ecobrasil_calendario_demandas_${formatDate(calendarMonth, "yyyy_MM")}.pdf`);

      toast({ title: "PDF do calendário gerado." });
    } catch (e: any) {
      toast({
        title: "Falha ao gerar PDF",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  // ===================================================
  // Mutations
  // ===================================================

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Status }) => {
      if (!id || !Number.isFinite(id)) throw new Error("ID inválido da demanda.");
      if (!VALID_STATUSES.includes(status)) throw new Error("Status inválido.");
      return apiRequest("PATCH", `/api/demandas/${id}`, { status });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/demandas"] });

      const prev = queryClient.getQueryData<Demanda[]>(["/api/demandas"]);

      queryClient.setQueryData<Demanda[]>(["/api/demandas"], (old) => {
        const arr = Array.isArray(old) ? old : [];
        return arr.map((d) => (d.id === id ? { ...d, status } : d));
      });

      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["/api/demandas"], ctx.prev);
      toast({ title: "Falha ao mover demanda", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      await invalidateDashboard(queryClient);
      toast({ title: "Demanda movida." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!id || !Number.isFinite(id)) throw new Error("ID inválido da demanda.");
      return apiRequest("DELETE", `/api/demandas/${id}`);
    },
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/demandas"] });
      const prev = queryClient.getQueryData<Demanda[]>(["/api/demandas"]);

      queryClient.setQueryData<Demanda[]>(["/api/demandas"], (old) => {
        const arr = Array.isArray(old) ? old : [];
        return arr.filter((d) => d.id !== id);
      });

      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["/api/demandas"], ctx.prev);
      toast({ title: "Falha ao excluir demanda", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      await invalidateDashboard(queryClient);
      toast({ title: "Demanda excluída." });
    },
  });

  const clearHistoricoMutation = useMutation({
    mutationFn: async (senha: string) => apiRequest("POST", `/api/admin/demandas/historico/clear`, { senha }),
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      toast({ title: data?.message || "Histórico limpo." });
      setClearHistoricoDialogOpen(false);
      setClearHistoricoSenha("");
    },
    onError: (e: any) => {
      toast({ title: "Falha ao limpar histórico", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
      setClearHistoricoSenha("");
    },
  });

  // ===================================================
  // View model por coluna com ordem
  // ===================================================

  const demandaById = useMemo(() => {
    const m = new Map<number, Demanda>();
    for (const d of demandas) m.set(d.id, d);
    return m;
  }, [demandas]);

  const columns = useMemo(() => {
    const grouped: Record<Status, Demanda[]> = defaultOrderState() as any;

    for (const st of VALID_STATUSES) {
      const ids = order[st] ?? [];
      const list: Demanda[] = [];

      for (const id of ids) {
        const d = demandaById.get(id);
        if (d && normalizeStatus(d.status) === st) list.push(d);
      }

      // fallback: itens não presentes na ordem
      const present = new Set(list.map((x) => x.id));
      for (const d of demandas) {
        const s = normalizeStatus(d.status);
        if (s === st && !present.has(d.id)) list.push(d);
      }

      grouped[st] = list;
    }

    return grouped;
  }, [demandas, demandaById, order]);

  // ===================================================
  // DnD parsing ids
  // ===================================================

  function parseCardId(id: any): number | null {
    const s = String(id ?? "");
    if (s.startsWith("card:")) return safeNumber(s.slice(5));
    return safeNumber(id);
  }

  function parseColumnStatus(id: any): Status | null {
    const s = String(id ?? "");
    if (s.startsWith("column:")) {
      const st = s.slice(7);
      return VALID_STATUSES.includes(st as Status) ? (st as Status) : null;
    }
    return null;
  }

  // ===================================================
  // Preview DnD com throttle via requestAnimationFrame
  // ===================================================

  const rafRef = useRef<number | null>(null);
  const pendingOverRef = useRef<{ activeId: number; toStatus: Status; fromStatus: Status } | null>(null);

  const applyPreviewMove = (activeId: number, fromStatus: Status, toStatus: Status) => {
    // atualiza ordem (sem salvar storage aqui. salvar no end)
    setOrder((prev) => {
      const next: OrderState = {
        ...prev,
        [fromStatus]: (prev[fromStatus] ?? []).filter((x) => x !== activeId),
        [toStatus]: [activeId, ...((prev[toStatus] ?? []).filter((x) => x !== activeId))],
      };
      return next;
    });

    // aplica status no cache para render consistente no preview
    queryClient.setQueryData<Demanda[]>(["/api/demandas"], (old) => {
      const arr = Array.isArray(old) ? old : [];
      return arr.map((x) => (x.id === activeId ? { ...x, status: toStatus } : x));
    });
  };

  const schedulePreview = (activeId: number, fromStatus: Status, toStatus: Status) => {
    pendingOverRef.current = { activeId, fromStatus, toStatus };
    if (rafRef.current != null) return;

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const p = pendingOverRef.current;
      pendingOverRef.current = null;
      if (!p) return;
      if (p.fromStatus === p.toStatus) return;
      applyPreviewMove(p.activeId, p.fromStatus, p.toStatus);
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ===================================================
  // Drag handlers
  // ===================================================

  const onDragStart = (e: DragStartEvent) => {
    const id = parseCardId(e.active.id);
    if (!id) return;
    const d = demandaById.get(id);
    if (d) setActiveDemanda(d);
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;

    const activeId = parseCardId(active.id);
    if (!activeId) return;

    const d = demandaById.get(activeId);
    if (!d) return;

    const fromStatus = normalizeStatus(d.status);

    const overStatus = parseColumnStatus(over.id);
    const overCardId = parseCardId(over.id);

    let toStatus: Status | null = null;
    if (overStatus) toStatus = overStatus;
    else if (overCardId) {
      const target = demandaById.get(overCardId);
      if (target) toStatus = normalizeStatus(target.status);
    }

    if (!toStatus) return;
    if (toStatus === fromStatus) return;

    // preview com throttle. sem localStorage, sem backend
    schedulePreview(activeId, fromStatus, toStatus);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveDemanda(null);

    // sempre persistir a ordem final do estado atual
    const persistNow = (next?: OrderState) => {
      const toSave = next ?? order;
      saveOrder(toSave);
    };

    if (!over) {
      persistNow();
      return;
    }

    const activeId = parseCardId(active.id);
    if (!activeId) {
      persistNow();
      return;
    }

    // status “atual” pode ter sido alterado pelo preview no cache
    const current = queryClient.getQueryData<Demanda[]>(["/api/demandas"]) ?? [];
    const activeDem = (Array.isArray(current) ? current : []).find((x) => x.id === activeId) ?? demandaById.get(activeId);

    if (!activeDem) {
      persistNow();
      return;
    }

    const fromStatus = normalizeStatus(activeDem.status);

    const overStatus = parseColumnStatus(over.id);
    const overCardId = parseCardId(over.id);

    let toStatus: Status | null = null;
    if (overStatus) toStatus = overStatus;
    else if (overCardId) {
      const target = demandaById.get(overCardId);
      if (target) toStatus = normalizeStatus(target.status);
    }

    if (!toStatus) {
      persistNow();
      return;
    }

    // reorder dentro da mesma coluna
    if (toStatus === fromStatus && overCardId && overCardId !== activeId) {
      setOrder((prev) => {
        const ids = [...(prev[toStatus!] ?? [])];

        // garante que ids contenha todos os cards renderizados
        const renderedIds = columns[toStatus!].map((d) => d.id);
        const merged = [
          ...ids.filter((id) => renderedIds.includes(id)),
          ...renderedIds.filter((id) => !ids.includes(id)),
        ];

        const oldIndex = merged.indexOf(activeId);
        const newIndex = merged.indexOf(overCardId);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const moved = arrayMove(merged, oldIndex, newIndex);
        const next = { ...prev, [toStatus!]: moved };

        saveOrder(next);
        return next;
      });
      return;
    }

    // mover para outra coluna. confirmação se concluir
    if (toStatus !== fromStatus) {
      // atualiza ordem final e salva
      setOrder((prev) => {
        const next: OrderState = {
          ...prev,
          [fromStatus]: (prev[fromStatus] ?? []).filter((x) => x !== activeId),
          [toStatus!]: [activeId, ...((prev[toStatus!] ?? []).filter((x) => x !== activeId))],
        };
        saveOrder(next);
        return next;
      });

      if (toStatus === "concluido") {
        setDemandaPendenteConclusao({ id: activeId, titulo: activeDem.titulo });
        setConfirmDocumentoDialogOpen(true);
        return;
      }

      // persistir mudança no backend
      moveMutation.mutate({ id: activeId, status: toStatus });
    } else {
      persistNow();
    }
  };

  const handleConfirmSemDocumento = () => {
    if (demandaPendenteConclusao) {
      moveMutation.mutate({ id: demandaPendenteConclusao.id, status: "concluido" });
    }
    setConfirmDocumentoDialogOpen(false);
    setDemandaPendenteConclusao(null);
  };

  const handleConfirmComDocumento = () => {
    if (demandaPendenteConclusao) {
      localStorage.setItem("demandaPendenteConclusao", JSON.stringify({
        ...demandaPendenteConclusao,
        createdAt: Date.now(),
      }));
      setLocation("/gestao-dados");
    }
    setConfirmDocumentoDialogOpen(false);
    setDemandaPendenteConclusao(null);
  };

  // ===================================================
  // Exclusão com Dialog
  // ===================================================

  const askDelete = (d: Demanda) => {
    setDemandaParaExcluir(d);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (demandaParaExcluir) deleteMutation.mutate(demandaParaExcluir.id);
    setDeleteDialogOpen(false);
    setDemandaParaExcluir(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p>Carregando demandas.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Quadro de Demandas</h1>
          <p className="text-muted-foreground mt-1">Arraste os cards entre as colunas para alterar o status.</p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <RefreshButton />

          <Button variant="outline" onClick={downloadDemandasCSV}>
            <FileDown className="h-4 w-4 mr-2" />
            Baixar CSV
          </Button>

          <Button variant="outline" onClick={downloadDemandasJSON}>
            <FileDown className="h-4 w-4 mr-2" />
            Baixar JSON
          </Button>

          <Button style={{ backgroundColor: ECOBRASIL.azulEscuro, color: "white" }} onClick={downloadCalendarPDF}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF do Calendário
          </Button>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                onSuccess={() => {
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
        onDragOver={onDragOver}
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
              onAskDelete={askDelete}
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

      <CalendarioEcoBrasil
        demandas={demandas}
        colaboradores={colaboradores}
        monthDate={calendarMonth}
        onPrevMonth={() => setCalendarMonth((d) => subMonths(d, 1))}
        onNextMonth={() => setCalendarMonth((d) => addMonths(d, 1))}
        exportRef={calendarExportRef}
      />

      {/* Histórico */}
      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Histórico de Movimentações (últimos 30 dias)</CardTitle>

          {historico30d.length > 0 ? (
            <Dialog
              open={clearHistoricoDialogOpen}
              onOpenChange={(open) => {
                setClearHistoricoDialogOpen(open);
                if (!open) setClearHistoricoSenha("");
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Histórico
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Confirmar Limpeza do Histórico</DialogTitle>
                </DialogHeader>

                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (clearHistoricoSenha.trim()) clearHistoricoMutation.mutate(clearHistoricoSenha.trim());
                  }}
                >
                  <div>
                    <Label>Digite a senha de administrador</Label>
                    <Input
                      type="password"
                      value={clearHistoricoSenha}
                      onChange={(e) => setClearHistoricoSenha(e.target.value)}
                      placeholder="Senha"
                      autoFocus
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setClearHistoricoDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={!clearHistoricoSenha.trim() || clearHistoricoMutation.isPending}
                    >
                      {clearHistoricoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirmar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>

        <CardContent>
          {isLoadingHistorico ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : historico30d.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada nos últimos 30 dias.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                    <tr key={h.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        {h.criadoEm ? formatDate(new Date(h.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "."}
                      </td>
                      <td className="p-2">{h.demandaTitulo || "."}</td>
                      <td className="p-2">{h.acao || "."}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {h.statusAnterior || "."}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-xs">
                          {h.statusNovo || "."}
                        </Badge>
                      </td>
                      <td className="p-2">{h.usuarioEmail || "."}</td>
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

          {editing ? (
            <DemandaForm
              initial={editing}
              onSuccess={() => {
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Documento ao Concluir */}
      <Dialog
        open={confirmDocumentoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDocumentoDialogOpen(false);
            setDemandaPendenteConclusao(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Conclusão de Demanda
            </DialogTitle>
            <DialogDescription>
              {demandaPendenteConclusao?.titulo && (
                <span className="font-medium text-foreground">"{demandaPendenteConclusao.titulo}"</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-center text-lg font-medium mb-2">Esta demanda gerou algum documento/produto?</p>
            <p className="text-center text-sm text-muted-foreground">
              Se sim, você será direcionado para salvar o documento antes de concluir a demanda.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleConfirmSemDocumento} className="flex-1">
              Não. Apenas concluir
            </Button>
            <Button onClick={handleConfirmComDocumento} className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Sim. Salvar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDemandaParaExcluir(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir Demanda
            </DialogTitle>
            <DialogDescription>
              {demandaParaExcluir?.titulo ? (
                <span>
                  Confirma a exclusão da demanda <span className="font-medium text-foreground">"{demandaParaExcluir.titulo}"</span>?
                </span>
              ) : (
                "Confirma a exclusão desta demanda?"
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="flex-1" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
