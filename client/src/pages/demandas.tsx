import React, { useMemo, useState, useRef } from "react";
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
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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

// Paleta EcoBrasil. Ajuste se você já tiver tokens no Tailwind.
const ECOBRASIL = {
  azulEscuro: "rgb(31, 56, 100)",
  cinzaClaro: "rgb(217, 217, 217)",
};

// ===================================================
// Funções auxiliares
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
    const msg = json ? `${res.status}: ${JSON.stringify(json)}` : `${res.status}: ${text || "Erro"}`;
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
  return VALID_STATUSES.includes(s as Status) ? (s as Status) : "a_fazer";
}

function normalizeDateYmd(x: any): string {
  const s = String(x ?? "").trim();
  if (!s) return "";
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T12:00:00`);
  if (!isValidDate(d)) return "";
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString().slice(0, 10);
}

function normalizeDemanda(raw: any): Demanda | null {
  const id = safeNumber(raw?.id);
  if (!id) return null;

  const status = normalizeStatus(raw?.status);
  const dataInicio = normalizeDateYmd(raw?.dataInicio ?? raw?.data_inicio) || null;
  const dataEntrega = normalizeDateYmd(raw?.dataEntrega);

  return {
    id,
    titulo: String(raw?.titulo ?? "").trim(),
    descricao: String(raw?.descricao ?? "").trim(),
    setor: String(raw?.setor ?? SETORES[0]),
    prioridade: (raw?.prioridade ?? "media") as Prioridade,
    complexidade: (raw?.complexidade ?? "media") as Complexidade,
    categoria: (raw?.categoria ?? "geral") as Categoria,
    dataInicio,
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
// Formulário de Criação/Edição
// ===================================================

function DemandaForm({ initial, onSuccess }: { initial?: Partial<Demanda>; onSuccess: () => void }) {
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

    responsavelId: (initial as any)?.responsavelId ?? null,
    responsavelNome: (initial as any)?.responsavel ?? "",

    dataInicio: (initial as any)?.dataInicio ? normalizeDateYmd((initial as any).dataInicio) : "",
    dataEntrega: initial?.dataEntrega ? normalizeDateYmd(initial.dataEntrega) : "",
    status: (initial?.status ?? "a_fazer") as Status,
    empreendimentoId: initial?.empreendimentoId ? String(initial.empreendimentoId) : "",
  });

  const mutation = useMutation({
    mutationFn: async (): Promise<Demanda> => {
      if (!form.responsavelId) throw new Error("Selecione um responsável.");

      const payload: any = {
        titulo: String(form.titulo).trim(),
        descricao: String(form.descricao).trim(),
        setor: form.setor,
        prioridade: form.prioridade,
        complexidade: form.complexidade,
        categoria: form.categoria,
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
      if (!isEdit) insertDemandaInCache(queryClient, createdOrUpdated);
      else replaceDemandaInCache(queryClient, createdOrUpdated);

      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
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
        <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
      </div>

      <div>
        <Label>Descrição *</Label>
        <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
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
                          <Check className={cn("ml-auto h-4 w-4", form.responsavelId === colab.id ? "opacity-100" : "opacity-0")} />
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
        Para demandas de vários dias, preencha Data Início e Data Entrega. Ex: 13/01 a 17/01
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
    data: { type: "card", status: demanda.status },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

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
                  {demanda.dataEntrega ? formatDate(parseISO(demanda.dataEntrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "-"}
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
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });

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

      <SortableContext items={demandas.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {demandas.map((d) => (
            <DemandaCard key={d.id} demanda={d} colaboradores={colaboradores} onEdit={onEdit} onDelete={onDelete} />
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
// Calendário EcoBrasil (mês, com destaques)
// ===================================================

function prioridadeBorder(prioridade: Prioridade) {
  if (prioridade === "alta") return "border-l-4 border-l-red-600";
  if (prioridade === "media") return "border-l-4 border-l-yellow-600";
  return "border-l-4 border-l-green-600";
}

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
  const startDate = startOfWeek(monthStart, { locale: ptBR });
  const endDate = endOfWeek(monthEnd, { locale: ptBR });

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
    for (const d of demandas) {
      const dataEntregaYmd = normalizeDateYmd(d.dataEntrega);
      if (!dataEntregaYmd) continue;
      
      const dataFim = parseISO(dataEntregaYmd);
      const dataInicioYmd = d.dataInicio ? normalizeDateYmd(d.dataInicio) : null;
      const dataInicio = dataInicioYmd ? parseISO(dataInicioYmd) : dataFim;
      
      if (dataInicio <= dataFim) {
        const diasPeriodo = eachDayOfInterval({ start: dataInicio, end: dataFim });
        for (const dia of diasPeriodo) {
          const ymd = formatDate(dia, "yyyy-MM-dd");
          if (!map.has(ymd)) map.set(ymd, []);
          map.get(ymd)!.push(d);
        }
      } else {
        if (!map.has(dataEntregaYmd)) map.set(dataEntregaYmd, []);
        map.get(dataEntregaYmd)!.push(d);
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
  }, [demandas]);

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
          <Badge
            className="text-white"
            style={{ backgroundColor: ECOBRASIL.azulEscuro }}
          >
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
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: ECOBRASIL.cinzaClaro }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ backgroundColor: ECOBRASIL.azulEscuro }}
          >
            <div className="text-white">
              <div className="text-lg font-semibold">EcoBrasil Consultoria Ambiental</div>
              <div className="text-sm opacity-90">Calendário de Demandas. {formatDate(monthDate, "MMMM yyyy", { locale: ptBR })}</div>
            </div>
            <div className="text-white text-sm opacity-90">
              Gerado em {formatDate(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          </div>

          <div className="grid grid-cols-7" style={{ backgroundColor: ECOBRASIL.cinzaClaro }}>
            {weekdays.map((w) => (
              <div key={w} className="px-2 py-2 text-xs font-semibold text-center" style={{ color: ECOBRASIL.azulEscuro }}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-rows-6">
            {rows.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((d, di) => {
                  const ymd = formatDate(d, "yyyy-MM-dd");
                  const list = byDate.get(ymd) ?? [];
                  const isToday = isSameDay(d, new Date());
                  const isOutside = !isSameMonth(d, monthStart);

                  return (
                    <div
                      key={`${wi}-${di}`}
                      className={cn(
                        "min-h-[120px] border p-2 align-top bg-white",
                        isOutside ? "opacity-45" : "",
                        isToday ? "ring-2 ring-offset-1" : ""
                      )}
                      style={{
                        borderColor: "rgba(0,0,0,0.06)",
                        ...(isToday ? { ringColor: ECOBRASIL.azulEscuro as any } : {}),
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold" style={{ color: ECOBRASIL.azulEscuro }}>
                          {formatDate(d, "d", { locale: ptBR })}
                        </div>
                        {list.length > 0 ? (
                          <Badge variant="outline" className="text-[10px]">
                            {list.length}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        {list.slice(0, 4).map((dem) => {
                          const resp = getResponsavelNome(dem, colaboradores);
                          return (
                            <div
                              key={dem.id}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[10px] leading-tight",
                                prioridadeBorder(dem.prioridade)
                              )}
                            >
                              <div className="font-semibold line-clamp-1">{dem.titulo}</div>
                              <div className="text-[10px] text-muted-foreground line-clamp-1">{dem.descricao}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">{dem.setor}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">{STATUS_LABEL[dem.status]}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">{resp}</span>
                              </div>
                            </div>
                          );
                        })}
                        {list.length > 4 ? (
                          <div className="text-[10px] text-muted-foreground">Mais {list.length - 4}…</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="px-5 py-3 text-[11px] flex items-center justify-between" style={{ backgroundColor: "white" }}>
            <div className="flex items-center gap-3">
              <span className="font-semibold" style={{ color: ECOBRASIL.azulEscuro }}>Legenda</span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#dc2626" }} />
                Alta
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#ca8a04" }} />
                Média
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: "#16a34a" }} />
                Baixa
              </span>
            </div>
            <div className="text-muted-foreground">
              EcoBrasil. Demandas com data de entrega.
            </div>
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

  const calendarExportRef = useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

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
  const [clearHistoricoDialogOpen, setClearHistoricoDialogOpen] = useState(false);
  const [clearHistoricoSenha, setClearHistoricoSenha] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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

      const canvas = await html2canvas(el, {
        scale: 2,
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
      const prev = queryClient.getQueryData(["/api/demandas"]);

      queryClient.setQueryData(["/api/demandas"], (old: any) => {
        const arr = normalizeDemandasList(old);
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
      const prev = queryClient.getQueryData(["/api/demandas"]);

      removeDemandaFromCache(queryClient, id);

      return { prev };
    },
    onError: (e: any, _vars, ctx: any) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["/api/demandas"], ctx.prev);
      toast({ title: "Falha ao excluir demanda", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] });
      toast({ title: "Demanda excluída." });
    },
  });

  const clearHistoricoMutation = useMutation({
    mutationFn: async (senha: string) => apiRequest("DELETE", `/api/admin/demandas/historico`, { senha }),
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

    demandas.forEach((d) => grouped[normalizeStatus(d.status)].push(d));
    return grouped;
  }, [demandas]);

  // ===================================================
  // Drag handlers
  // ===================================================

  const onDragStart = (e: DragStartEvent) => {
    const id = safeNumber(e.active.id);
    if (!id) return;
    const d = demandas.find((x) => x.id === id);
    if (d) setActiveDemanda(d);
  };

  function extractOverStatus(over: any): Status | null {
    const overIdStr = String(over?.id ?? "");
    if (VALID_STATUSES.includes(overIdStr as Status)) return overIdStr as Status;

    const sortableContainerId = over?.data?.current?.sortable?.containerId;
    const c = String(sortableContainerId ?? "");
    if (VALID_STATUSES.includes(c as Status)) return c as Status;

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
      toast({ title: "Falha ao mover demanda", description: "ID inválido do card.", variant: "destructive" });
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
            <Download className="h-4 w-4 mr-2" />
            Baixar JSON
          </Button>

          <Button
            style={{ backgroundColor: ECOBRASIL.azulEscuro, color: "white" }}
            onClick={downloadCalendarPDF}
          >
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

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
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
                if (confirm("Tem certeza que deseja excluir esta demanda?")) deleteMutation.mutate(id);
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
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setClearHistoricoDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="destructive" disabled={!clearHistoricoSenha.trim() || clearHistoricoMutation.isPending}>
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
    </div>
  );
}
