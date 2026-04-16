import React, { useMemo, useState, useRef } from "react";
import { formatDateBR } from "@/lib/date-utils";
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
  differenceInDays,
  startOfDay,
  min as minDate,
  max as maxDate,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
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
  LayoutList,
  GitBranch,
  Kanban,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RefreshButton } from "@/components/RefreshButton";

import { DemandaCard } from '@/components/demandas/DemandaCard';
import { KanbanColumn } from '@/components/demandas/KanbanColumn';
// ===================================================
// Tipos e Constantes
// ===================================================

interface Colaborador {
  id: number;
  nome: string;
  cargo: string | null;
  email: string | null;
  tipo: "rh" | "user";
  whatsapp?: string | null;
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
    licencaId: (initial as any)?.licencaId ? String((initial as any).licencaId) : "",
    condicionanteId: (initial as any)?.condicionanteId ? String((initial as any).condicionanteId) : "",
  });

  // Licenças do empreendimento selecionado
  const { data: licencasEmp = [] } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos", form.empreendimentoId, "licencas"],
    queryFn: async () => apiRequest("GET", `/api/empreendimentos/${form.empreendimentoId}/licencas`),
    enabled: Boolean(form.empreendimentoId),
  });

  // Condicionantes/exigências da licença selecionada
  const { data: condicionantesLic = [] } = useQuery<any[]>({
    queryKey: ["/api/licencas", form.licencaId, "condicionantes"],
    queryFn: async () => apiRequest("GET", `/api/licencas/${form.licencaId}/condicionantes`),
    enabled: Boolean(form.licencaId),
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
      if (form.licencaId) payload.licencaId = Number(form.licencaId);
      if (form.condicionanteId) {
        payload.condicionanteId = Number(form.condicionanteId);
        payload.origem = "condicionante";
      }

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
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/dashboard/stats"] });
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
        <Select value={form.empreendimentoId || ""} onValueChange={(v) => setForm({ ...form, empreendimentoId: v, licencaId: "", condicionanteId: "" })}>
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

      {/* Licença (aparece quando empreendimento está selecionado) */}
      {form.empreendimentoId && (
        <div>
          <Label>Licença Ambiental <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Select value={form.licencaId || ""} onValueChange={(v) => setForm({ ...form, licencaId: v, condicionanteId: "" })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma licença" />
            </SelectTrigger>
            <SelectContent>
              {ensureArray<any>(licencasEmp).map((lic: any) => (
                <SelectItem key={lic.id} value={String(lic.id)}>
                  {lic.numero} — {lic.tipo || "Licença"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Exigência/Condicionante (aparece quando licença está selecionada) */}
      {form.licencaId && (
        <div>
          <Label>Exigência / Condicionante <span className="text-muted-foreground font-normal">(opcional)</span></Label>
          <Select value={form.condicionanteId || ""} onValueChange={(v) => {
            const cond = condicionantesLic.find((c: any) => String(c.id) === v);
            const updates: any = { condicionanteId: v };
            if (cond && !form.dataEntrega && cond.prazo) updates.dataEntrega = cond.prazo;
            setForm({ ...form, ...updates });
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a exigência" />
            </SelectTrigger>
            <SelectContent>
              {ensureArray<any>(condicionantesLic).map((cond: any, idx: number) => {
                const num = cond.item || String(idx + 1);
                const label = cond.titulo || cond.descricao?.substring(0, 60);
                return (
                  <SelectItem key={cond.id} value={String(cond.id)}>
                    <span className="font-mono text-xs mr-1">{num}.</span> {label}
                    {cond.codigo ? <span className="text-muted-foreground ml-1">[{cond.codigo}]</span> : null}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {form.condicionanteId && (() => {
            const cond = condicionantesLic.find((c: any) => String(c.id) === form.condicionanteId);
            if (!cond) return null;
            return (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-muted/50 rounded px-2 py-1">
                {cond.descricao}
              </p>
            );
          })()}
        </div>
      )}

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
          {form.responsavelId && (() => {
            const resp = colaboradores.find(c => c.id === form.responsavelId);
            if (!resp) return null;
            return resp.whatsapp ? (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                ✅ Receberá notificação por WhatsApp
              </p>
            ) : (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                ⚠️ Sem WhatsApp — cadastre em Sistema → Gerenciar Usuários
              </p>
            );
          })()}
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

// DemandaCard → extraído para client/src/components/demandas/DemandaCard.tsx

// KanbanColumn → extraído para client/src/components/demandas/KanbanColumn.tsx

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
  onView,
}: {
  demandas: Demanda[];
  colaboradores: Colaborador[];
  monthDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  exportRef: React.RefObject<HTMLDivElement>;
  onView?: (d: Demanda) => void;
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
              <div style={{ fontSize: "14px", opacity: 0.9 }}>Calendário de Demandas - {formatDate(monthDate, "MMMM yyyy", { locale: ptBR })}</div>
            </div>
            <div style={{ color: "#ffffff", fontSize: "13px", opacity: 0.9 }}>
              Gerado em {formatDate(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ backgroundColor: ECOBRASIL.cinzaClaro }}>
                {weekdays.map((w) => (
                  <th key={w} style={{ 
                    padding: "8px 4px", 
                    fontSize: "12px", 
                    fontWeight: "600", 
                    textAlign: "center",
                    color: ECOBRASIL.azulEscuro,
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}>
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
                    const isToday = isSameDay(d, new Date());
                    const isOutside = !isSameMonth(d, monthStart);

                    return (
                      <td
                        key={`${wi}-${di}`}
                        style={{
                          minHeight: "100px",
                          verticalAlign: "top",
                          padding: "8px",
                          backgroundColor: isToday ? "#e0f2fe" : "#ffffff",
                          border: "1px solid rgba(0,0,0,0.08)",
                          opacity: isOutside ? 0.4 : 1,
                        }}
                      >
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between",
                          marginBottom: "6px",
                        }}>
                          <span style={{ 
                            fontSize: "14px", 
                            fontWeight: "700", 
                            color: ECOBRASIL.azulEscuro,
                          }}>
                            {formatDate(d, "d", { locale: ptBR })}
                          </span>
                          {list.length > 0 && (
                            <span style={{ 
                              fontSize: "10px", 
                              padding: "2px 6px",
                              backgroundColor: ECOBRASIL.azulEscuro,
                              borderRadius: "10px",
                              color: "#ffffff",
                              fontWeight: "600",
                            }}>
                              {list.length}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {list.map((dem) => {
                            const resp = getResponsavelNome(dem, colaboradores);
                            const todayYmd = formatDate(new Date(), "yyyy-MM-dd");
                            const entregaYmd = dem.dataEntrega ? normalizeDateYmd(dem.dataEntrega) : null;
                            const isDone = ["concluido", "cancelado"].includes(dem.status ?? "");
                            const isOverdue = !isDone && entregaYmd && entregaYmd < todayYmd;
                            const isVenceHoje = !isDone && entregaYmd === todayYmd;

                            const borderColor = isOverdue ? "#dc2626"
                              : isVenceHoje ? "#f59e0b"
                              : dem.prioridade === "alta" ? "#dc2626"
                              : dem.prioridade === "media" ? "#ca8a04"
                              : "#16a34a";
                            const bgColor = isOverdue ? "#fef2f2"
                              : isVenceHoje ? "#fffbeb"
                              : dem.prioridade === "alta" ? "#fef2f2"
                              : dem.prioridade === "media" ? "#fefce8"
                              : "#f0fdf4";

                            return (
                              <div
                                key={dem.id}
                                onClick={() => onView?.(dem)}
                                title={dem.titulo}
                                style={{
                                  backgroundColor: bgColor,
                                  borderLeft: `3px solid ${borderColor}`,
                                  borderRadius: "3px",
                                  padding: "2px 5px",
                                  fontSize: "10px",
                                  lineHeight: "1.4",
                                  border: isOverdue ? `1px solid #fca5a5` : isVenceHoje ? `1px solid #fde68a` : `1px solid ${borderColor}22`,
                                  borderLeftWidth: "3px",
                                  borderLeftColor: borderColor,
                                  cursor: onView ? "pointer" : "default",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  overflow: "hidden",
                                  transition: "filter 0.12s",
                                }}
                                onMouseEnter={e => { if (onView) e.currentTarget.style.filter = "brightness(0.93)"; }}
                                onMouseLeave={e => { e.currentTarget.style.filter = ""; }}
                              >
                                {isOverdue && (
                                  <span style={{ fontSize: "9px", flexShrink: 0 }}>⚠</span>
                                )}
                                {isVenceHoje && !isOverdue && (
                                  <span style={{ fontSize: "9px", flexShrink: 0 }}>⚡</span>
                                )}
                                <span style={{
                                  fontWeight: "600",
                                  color: isOverdue ? "#991b1b" : ECOBRASIL.azulEscuro,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  textDecoration: isDone ? "line-through" : "none",
                                }}>
                                  {dem.titulo}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ 
            padding: "12px 20px",
            backgroundColor: "#ffffff",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: "600", color: ECOBRASIL.azulEscuro }}>Legenda:</span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "12px", height: "12px", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderLeft: "3px solid #dc2626", borderRadius: "2px", display: "inline-block" }} />
                ⚠ Atrasada
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "12px", height: "12px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderLeft: "3px solid #f59e0b", borderRadius: "2px", display: "inline-block" }} />
                ⚡ Vence hoje
              </span>
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
            <div style={{ color: "#6b7280" }}>
              EcoBrasil - Demandas com data de entrega
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===================================================
// Timeline View
// ===================================================

const PRIORIDADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  alta:  { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
  media: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
  baixa: { bg: "#dcfce7", text: "#166534", border: "#22c55e" },
};

const STATUS_ICON_COLOR: Record<string, string> = {
  a_fazer: "#94a3b8",
  em_andamento: "#3b82f6",
  em_revisao: "#f59e0b",
  concluido: "#22c55e",
  cancelado: "#ef4444",
};

function TimelineView({ demandas, colaboradores }: { demandas: Demanda[]; colaboradores: Colaborador[] }) {
  const sorted = useMemo(() => {
    return [...demandas].sort((a, b) => {
      const da = normalizeDateYmd(a.dataEntrega) ?? "9999";
      const db = normalizeDateYmd(b.dataEntrega) ?? "9999";
      return da.localeCompare(db);
    });
  }, [demandas]);

  const todayStr = formatDate(new Date(), "yyyy-MM-dd");

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <LayoutList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma demanda encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative space-y-1 pl-8 pt-2 pb-8">
      {/* vertical line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 via-gray-200 to-gray-100 rounded-full" />

      {sorted.map((d, idx) => {
        const prazo = normalizeDateYmd(d.dataEntrega) ?? "";
        const inicio = normalizeDateYmd(d.dataInicio ?? "") ?? prazo;
        const isOverdue = prazo && prazo < todayStr && d.status !== "concluido" && d.status !== "cancelado";
        const isToday = prazo === todayStr;
        const isConcluido = d.status === "concluido";
        const isCancelado = d.status === "cancelado";
        const respNome = getResponsavelNome(d, colaboradores);
        const pc = PRIORIDADE_COLORS[d.prioridade] ?? PRIORIDADE_COLORS.baixa;
        const dotColor = isConcluido ? "#22c55e" : isCancelado ? "#94a3b8" : isOverdue ? "#ef4444" : isToday ? "#f59e0b" : "#3b82f6";

        return (
          <div key={d.id} className={cn("relative flex gap-4 group pb-6", idx === sorted.length - 1 ? "pb-0" : "")}>
            {/* dot */}
            <div
              className="absolute -left-[21px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10"
              style={{ backgroundColor: dotColor }}
            />

            <div className={cn(
              "flex-1 rounded-xl border shadow-sm p-4 transition-all hover:shadow-md",
              isConcluido ? "opacity-70" : "",
              isOverdue ? "border-l-4 border-l-red-400" : isToday ? "border-l-4 border-l-amber-400" : "border-l-4",
            )} style={{ borderLeftColor: isOverdue ? "#ef4444" : isToday ? "#f59e0b" : pc.border }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge
                      className="text-xs font-medium"
                      style={{ backgroundColor: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
                    >
                      {d.prioridade.charAt(0).toUpperCase() + d.prioridade.slice(1)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{STATUS_LABEL[d.status]}</Badge>
                    {d.categoria && <Badge variant="secondary" className="text-xs">{d.categoria}</Badge>}
                    {isOverdue && <Badge className="text-xs bg-red-100 text-red-700 border-red-300">Atrasada</Badge>}
                    {isToday && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300">Vence hoje</Badge>}
                  </div>
                  <h3 className={cn("font-semibold text-base leading-tight", isConcluido ? "line-through text-muted-foreground" : "")}>
                    {d.titulo}
                  </h3>
                  {d.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.descricao}</p>}
                </div>

                <div className="text-right text-xs text-muted-foreground space-y-1 flex-shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <CalendarDays className="h-3 w-3" />
                    {inicio !== prazo ? (
                      <span>{formatDateBR(inicio)} → {formatDateBR(prazo)}</span>
                    ) : (
                      <span>{formatDateBR(prazo)}</span>
                    )}
                  </div>
                  {respNome && (
                    <div className="flex items-center gap-1 justify-end">
                      <User className="h-3 w-3" />
                      <span>{respNome}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===================================================
// Gantt View com Milestones
// ===================================================

const GANTT_ROW_H = 40;
const GANTT_LABEL_W = 260;
const GANTT_MIN_DAYS = 30;

function isMilestone(d: Demanda): boolean {
  const inicio = normalizeDateYmd(d.dataInicio ?? "");
  const fim = normalizeDateYmd(d.dataEntrega);
  if (!inicio || !fim) return false;
  return inicio === fim;
}

function GanttView({ demandas, colaboradores, onView }: { demandas: Demanda[]; colaboradores: Colaborador[]; onView?: (d: Demanda) => void }) {
  const today = startOfDay(new Date());
  const todayStr = formatDate(today, "yyyy-MM-dd");

  const validDemandas = useMemo(() =>
    demandas.filter(d => normalizeDateYmd(d.dataEntrega)),
  [demandas]);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (validDemandas.length === 0) {
      const rs = startOfDay(addDays(today, -7));
      const re = startOfDay(addDays(today, GANTT_MIN_DAYS));
      return { rangeStart: rs, rangeEnd: re, totalDays: differenceInDays(re, rs) + 1 };
    }
    const dates: Date[] = [];
    validDemandas.forEach(d => {
      const fim = normalizeDateYmd(d.dataEntrega);
      if (fim) dates.push(parseISO(fim));
      const ini = normalizeDateYmd(d.dataInicio ?? "");
      if (ini) dates.push(parseISO(ini));
    });
    const minD = startOfDay(addDays(minDate(dates), -3));
    const maxD = startOfDay(addDays(maxDate(dates), 5));
    const days = Math.max(differenceInDays(maxD, minD) + 1, GANTT_MIN_DAYS);
    return { rangeStart: minD, rangeEnd: addDays(minD, days - 1), totalDays: days };
  }, [validDemandas, today]);

  const sorted = useMemo(() =>
    [...validDemandas].sort((a, b) => {
      const da = normalizeDateYmd(a.dataEntrega) ?? "9999";
      const db = normalizeDateYmd(b.dataEntrega) ?? "9999";
      return da.localeCompare(db);
    }),
  [validDemandas]);

  // Generate month headers
  const months = useMemo(() => {
    const result: { label: string; startDay: number; span: number }[] = [];
    let cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      const mStart = Math.max(differenceInDays(cur, rangeStart), 0);
      const mEnd = Math.min(differenceInDays(endOfMonth(cur), rangeStart), totalDays - 1);
      result.push({
        label: formatDate(cur, "MMM yyyy", { locale: ptBR }),
        startDay: mStart,
        span: mEnd - mStart + 1,
      });
      cur = addMonths(startOfMonth(cur), 1);
    }
    return result;
  }, [rangeStart, rangeEnd, totalDays]);

  const dayPct = 100 / totalDays;

  const todayOffset = useMemo(() => {
    const diff = differenceInDays(today, rangeStart);
    if (diff < 0 || diff >= totalDays) return null;
    return diff * dayPct;
  }, [today, rangeStart, totalDays, dayPct]);

  const getBarStyle = (d: Demanda) => {
    const fimStr = normalizeDateYmd(d.dataEntrega)!;
    const iniStr = normalizeDateYmd(d.dataInicio ?? "") || fimStr; // use || to catch empty string
    const startDay = Math.max(differenceInDays(parseISO(iniStr), rangeStart), 0);
    const endDay = Math.min(differenceInDays(parseISO(fimStr), rangeStart), totalDays - 1);
    const left = startDay * dayPct;
    const durationDays = Math.max(endDay - startDay + 1, 1);
    const width = Math.max(durationDays * dayPct, dayPct * 0.5);
    return { left: `${left}%`, width: `${width}%`, durationDays };
  };

  const barColor = (d: Demanda) => {
    if (d.status === "concluido") return { bg: "#22c55e", fg: "#fff" };
    if (d.status === "cancelado") return { bg: "#94a3b8", fg: "#fff" };
    if (d.prioridade === "alta") return { bg: "#ef4444", fg: "#fff" };
    if (d.prioridade === "media") return { bg: "#f59e0b", fg: "#fff" };
    return { bg: "#3b82f6", fg: "#fff" };
  };

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma demanda com datas encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  const chartH = sorted.length * GANTT_ROW_H + 56;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-5 w-5" />
          Gantt de Demandas
          <span className="ml-auto flex gap-4 text-xs font-normal text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-400"/><span>Alta</span></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-400"/><span>Média</span></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-400"/><span>Baixa</span></span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-400"/><span>Concluído</span></span>
            <span className="flex items-center gap-1"><span className="text-purple-600 font-bold text-base">◆</span><span>Marco</span></span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pr-0">
        <div style={{ minWidth: `${GANTT_LABEL_W + 600}px` }}>
          {/* Row: month headers */}
          <div className="flex" style={{ marginLeft: GANTT_LABEL_W }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="border-r border-gray-200 text-xs text-center py-1 font-semibold text-gray-500 bg-gray-50"
                style={{ width: `${m.span * dayPct}%`, flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap" }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="relative" style={{ height: chartH }}>
            {/* Label column */}
            <div className="absolute left-0 top-0 bottom-0 flex flex-col" style={{ width: GANTT_LABEL_W, zIndex: 10 }}>
              <div style={{ height: 28 }} className="border-b border-gray-200 bg-white flex items-center justify-between px-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Demanda</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Dias</span>
              </div>
              {sorted.map((d, i) => {
                const resp = getResponsavelNome(d, colaboradores);
                const fimStr = normalizeDateYmd(d.dataEntrega)!;
                const iniStr = normalizeDateYmd(d.dataInicio ?? "") || fimStr;
                const durDays = iniStr && fimStr
                  ? Math.max(differenceInDays(parseISO(fimStr), parseISO(iniStr)) + 1, 1)
                  : 1;
                return (
                  <div
                    key={d.id}
                    className="border-b border-gray-100 bg-white flex items-center gap-2 px-3"
                    style={{ height: GANTT_ROW_H }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_ICON_COLOR[d.status] ?? "#94a3b8" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs font-medium leading-tight truncate", d.status === "concluido" ? "line-through text-muted-foreground" : "")}>
                        {d.titulo}
                      </p>
                      {resp && <p className="text-[10px] text-muted-foreground truncate">{resp}</p>}
                    </div>
                    <div
                      className="flex-shrink-0 text-[9px] font-bold text-center rounded px-1 py-0.5"
                      style={{
                        backgroundColor: durDays === 1 ? "#e2e8f0" : durDays <= 7 ? "#dbeafe" : durDays <= 30 ? "#fef9c3" : "#fce7f3",
                        color: durDays === 1 ? "#64748b" : durDays <= 7 ? "#1d4ed8" : durDays <= 30 ? "#92400e" : "#9d174d",
                        minWidth: 28,
                      }}
                      title={`${durDays} dia${durDays !== 1 ? "s" : ""} de duração`}
                    >
                      {durDays}d
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid + bars area */}
            <div className="absolute top-0 bottom-0 overflow-hidden" style={{ left: GANTT_LABEL_W, right: 0 }}>
              {/* Week grid lines */}
              <div className="absolute inset-0">
                {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, wi) => (
                  <div
                    key={wi}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${wi * 7 * dayPct}%` }}
                  />
                ))}
              </div>

              {/* Day header row */}
              <div className="absolute top-0 left-0 right-0 border-b border-gray-200" style={{ height: 28 }}>
                {Array.from({ length: totalDays }).map((_, di) => {
                  const d = addDays(rangeStart, di);
                  const dow = formatDate(d, "d");
                  const isWeekend = [0, 6].includes(d.getDay());
                  const isTod = formatDate(d, "yyyy-MM-dd") === todayStr;
                  return (
                    <div
                      key={di}
                      className="absolute top-0 bottom-0 flex items-center justify-center text-[9px]"
                      style={{
                        left: `${di * dayPct}%`,
                        width: `${dayPct}%`,
                        color: isTod ? "#2563eb" : isWeekend ? "#d1d5db" : "#9ca3af",
                        fontWeight: isTod ? 700 : 400,
                      }}
                    >
                      {di % 3 === 0 ? dow : ""}
                    </div>
                  );
                })}
              </div>

              {/* Today line */}
              {todayOffset !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 z-20"
                  style={{ left: `${todayOffset}%`, backgroundColor: "#2563eb", opacity: 0.7 }}
                >
                  <div
                    className="absolute -top-0.5 -translate-x-1/2 text-[9px] bg-blue-600 text-white px-1 rounded"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Hoje
                  </div>
                </div>
              )}

              {/* Rows */}
              {sorted.map((d, i) => {
                const ms = isMilestone(d);
                const bc = barColor(d);
                const barStyle = getBarStyle(d);
                const fimStr = normalizeDateYmd(d.dataEntrega)!;
                const isOverdue = fimStr < todayStr && d.status !== "concluido" && d.status !== "cancelado";

                return (
                  <div
                    key={d.id}
                    className="absolute left-0 right-0 border-b border-gray-50"
                    style={{ top: 28 + i * GANTT_ROW_H, height: GANTT_ROW_H }}
                  >
                    {/* weekend shading */}
                    {Array.from({ length: totalDays }).map((_, di) => {
                      const day = addDays(rangeStart, di);
                      if (![0, 6].includes(day.getDay())) return null;
                      return (
                        <div
                          key={di}
                          className="absolute top-0 bottom-0 bg-gray-50"
                          style={{ left: `${di * dayPct}%`, width: `${dayPct}%` }}
                        />
                      );
                    })}

                    {ms ? (
                      /* Milestone diamond */
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                        style={{ left: barStyle.left, cursor: onView ? "pointer" : "default" }}
                        title={`Marco: ${d.titulo} — clique para detalhes`}
                        onClick={() => onView?.(d)}
                      >
                        <div
                          className="text-purple-600 drop-shadow hover:scale-125 transition-transform"
                          style={{ fontSize: 20, lineHeight: 1 }}
                        >
                          ◆
                        </div>
                      </div>
                    ) : (
                      /* Bar */
                      <div
                        className="absolute top-2 bottom-2 rounded flex items-center px-1.5 overflow-hidden group"
                        style={{
                          left: barStyle.left,
                          width: barStyle.width,
                          backgroundColor: bc.bg,
                          outline: isOverdue ? "2px solid #ef4444" : "none",
                          outlineOffset: "1px",
                          cursor: onView ? "pointer" : "default",
                          transition: "filter 0.15s",
                        }}
                        title={`${d.titulo} — ${barStyle.durationDays} dia${barStyle.durationDays !== 1 ? "s" : ""} — clique para detalhes`}
                        onClick={() => onView?.(d)}
                        onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.15)")}
                        onMouseLeave={e => (e.currentTarget.style.filter = "")}
                      >
                        <span className="text-[10px] font-medium truncate flex items-center gap-1" style={{ color: bc.fg }}>
                          {d.titulo}
                          {barStyle.durationDays > 1 && (
                            <span
                              className="flex-shrink-0 ml-1 text-[9px] font-bold opacity-90 bg-black/20 rounded px-0.5"
                              style={{ whiteSpace: "nowrap" }}
                            >
                              {barStyle.durationDays}d
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend footer */}
          <div className="text-xs text-muted-foreground text-right py-1 pr-4 border-t border-gray-100 bg-gray-50">
            ◆ Marco = demanda de prazo único (início = fim) &nbsp;|&nbsp; Linha azul = hoje
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const [viewDetail, setViewDetail] = useState<Demanda | null>(null);
  const [activeDemanda, setActiveDemanda] = useState<Demanda | null>(null);
  const [clearHistoricoDialogOpen, setClearHistoricoDialogOpen] = useState(false);
  const [clearHistoricoSenha, setClearHistoricoSenha] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "calendario" | "timeline" | "gantt">("kanban");

  const [confirmDocumentoDialogOpen, setConfirmDocumentoDialogOpen] = useState(false);
  const [demandaPendenteConclusao, setDemandaPendenteConclusao] = useState<{ id: number; titulo: string } | null>(null);
  const [, setLocation] = useLocation();

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
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgW = canvas.width;
      const imgH = canvas.height;

      // Fit width to page, calculate proportional height
      const ratio = pageW / imgW;
      const drawW = pageW;
      const drawH = imgH * ratio;

      if (drawH <= pageH) {
        // Fits in one page — center vertically
        const marginY = (pageH - drawH) / 2;
        pdf.addImage(imgData, "PNG", 0, marginY, drawW, drawH, undefined, "FAST");
      } else {
        // Needs multiple pages
        let yOffset = 0;
        while (yOffset < drawH) {
          if (yOffset > 0) pdf.addPage();
          // Clip the portion for this page
          const srcY = Math.round((yOffset / drawH) * imgH);
          const srcH = Math.round((pageH / drawH) * imgH);
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = imgW;
          tempCanvas.height = Math.min(srcH, imgH - srcY);
          const ctx = tempCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, srcY, imgW, tempCanvas.height, 0, 0, imgW, tempCanvas.height);
          }
          const pageSlice = tempCanvas.toDataURL("image/png", 1.0);
          const sliceH = (tempCanvas.height / imgH) * drawH;
          pdf.addImage(pageSlice, "PNG", 0, 0, drawW, sliceH, undefined, "FAST");
          yOffset += pageH;
        }
      }

      pdf.save(`ecobrasil_calendario_demandas_${formatDate(calendarMonth, "yyyy_MM")}.pdf`);
      toast({ title: "PDF do calendário gerado com sucesso!" });
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
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/dashboard/stats"] });
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
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/demandas/dashboard/stats"] });
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
    if (d && d.status !== newStatus) {
      if (newStatus === "concluido") {
        setDemandaPendenteConclusao({ id: d.id, titulo: d.titulo });
        setConfirmDocumentoDialogOpen(true);
      } else {
        moveMutation.mutate({ id, status: newStatus });
      }
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
      localStorage.setItem("demandaPendenteConclusao", JSON.stringify(demandaPendenteConclusao));
      setLocation("/gestao-dados");
    }
    setConfirmDocumentoDialogOpen(false);
    setDemandaPendenteConclusao(null);
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Quadro de Demandas</h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === "kanban" && "Arraste os cards entre as colunas para alterar o status."}
            {viewMode === "calendario" && "Visualização mensal com destaques por prioridade."}
            {viewMode === "timeline" && "Linha do tempo ordenada por prazo de entrega."}
            {viewMode === "gantt" && "Gráfico de Gantt com marcação de marcos (◆)."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end items-center">
          {/* View mode toggle */}
          <div className="flex rounded-lg border overflow-hidden shadow-sm">
            {([ 
              { key: "kanban",    icon: <Kanban className="h-4 w-4" />,     label: "Kanban" },
              { key: "calendario", icon: <Calendar className="h-4 w-4" />,  label: "Calendário" },
              { key: "timeline",  icon: <LayoutList className="h-4 w-4" />, label: "Timeline" },
              { key: "gantt",     icon: <GitBranch className="h-4 w-4" />,  label: "Gantt" },
            ] as const).map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === key
                    ? "text-white"
                    : "text-muted-foreground hover:bg-muted"
                )}
                style={viewMode === key ? { backgroundColor: ECOBRASIL.azulEscuro } : {}}
                title={label}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <RefreshButton />

          <Button variant="outline" onClick={downloadDemandasCSV}>
            <FileDown className="h-4 w-4 mr-2" />
            Baixar CSV
          </Button>

          {viewMode === "calendario" && (
            <Button
              style={{ backgroundColor: ECOBRASIL.azulEscuro, color: "white" }}
              onClick={downloadCalendarPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          )}

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

      {/* Views */}
      {viewMode === "kanban" && (
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
      )}

      {viewMode === "calendario" && (
        <CalendarioEcoBrasil
          demandas={demandas}
          colaboradores={colaboradores}
          monthDate={calendarMonth}
          onPrevMonth={() => setCalendarMonth((d) => subMonths(d, 1))}
          onNextMonth={() => setCalendarMonth((d) => addMonths(d, 1))}
          exportRef={calendarExportRef}
          onView={setViewDetail}
        />
      )}

      {viewMode === "timeline" && (
        <TimelineView demandas={demandas} colaboradores={colaboradores} />
      )}

      {viewMode === "gantt" && (
        <GanttView demandas={demandas} colaboradores={colaboradores} onView={setViewDetail} />
      )}

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

      {/* Modal de Detalhes (Gantt / Timeline click) */}
      <Dialog open={!!viewDetail} onOpenChange={() => setViewDetail(null)}>
        <DialogContent className="max-w-lg">
          {viewDetail && (() => {
            const vd = viewDetail;
            const resp = getResponsavelNome(vd, colaboradores);
            const statusLabel = STATUS_LABEL[vd.status] ?? vd.status;
            const prioridadeColor = vd.prioridade === "alta" ? "bg-red-500" : vd.prioridade === "media" ? "bg-amber-500" : "bg-blue-500";
            const categoriaLabel = CATEGORIAS.find(c => c.value === vd.categoria)?.label ?? vd.categoria ?? "-";
            const fimStr = normalizeDateYmd(vd.dataEntrega);
            const iniStr = normalizeDateYmd(vd.dataInicio ?? "") || fimStr;
            const durDays = iniStr && fimStr
              ? Math.max(differenceInDays(parseISO(fimStr!), parseISO(iniStr!)) + 1, 1)
              : null;
            const isOverdue = fimStr && fimStr < formatDate(new Date(), "yyyy-MM-dd") && vd.status !== "concluido" && vd.status !== "cancelado";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 pr-6">
                    <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="leading-snug">{vd.titulo}</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Status row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="outline">{statusLabel}</Badge>
                    <Badge className={`${prioridadeColor} text-white`}>
                      Prioridade: {vd.prioridade === "baixa" ? "Baixa" : vd.prioridade === "media" ? "Média" : "Alta"}
                    </Badge>
                    {durDays !== null && (
                      <Badge variant="secondary">{durDays} dia{durDays !== 1 ? "s" : ""}</Badge>
                    )}
                    {isOverdue && (
                      <Badge className="bg-red-100 text-red-700 border border-red-300">⚠ Atrasada</Badge>
                    )}
                  </div>

                  {/* Description */}
                  {vd.descricao && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                      <p className="text-sm whitespace-pre-wrap">{vd.descricao}</p>
                    </div>
                  )}

                  {/* Grid fields */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                        <User className="h-3 w-3" /> Responsável
                      </p>
                      <p>{resp || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                        <Tag className="h-3 w-3" /> Setor
                      </p>
                      <p>{vd.setor || "—"}</p>
                    </div>
                    {iniStr && iniStr !== fimStr && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                          <Calendar className="h-3 w-3" /> Data de Início
                        </p>
                        <p>{formatDate(parseISO(iniStr), "dd/MM/yyyy")}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                        <Calendar className="h-3 w-3" /> Data de Entrega
                      </p>
                      <p className={isOverdue ? "text-red-600 font-medium" : ""}>
                        {fimStr ? formatDate(parseISO(fimStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                        <AlertCircle className="h-3 w-3" /> Complexidade
                      </p>
                      <p className="capitalize">{vd.complexidade || "Não definida"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Categoria</p>
                      <p>{categoriaLabel}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button variant="outline" onClick={() => setViewDetail(null)}>Fechar</Button>
                    <Button onClick={() => { setViewDetail(null); setEditing(vd); }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

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
      <Dialog open={confirmDocumentoDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setConfirmDocumentoDialogOpen(false);
          setDemandaPendenteConclusao(null);
        }
      }}>
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
            <p className="text-center text-lg font-medium mb-2">
              Esta demanda gerou algum documento/produto?
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Se sim, você será direcionado para salvar o documento antes de concluir a demanda.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleConfirmSemDocumento}
              className="flex-1"
            >
              Não, apenas concluir
            </Button>
            <Button
              onClick={handleConfirmComDocumento}
              className="flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Sim, salvar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
