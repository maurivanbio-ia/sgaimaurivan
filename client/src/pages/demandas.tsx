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
import { DemandaForm } from '@/components/demandas/DemandaForm';
import { CalendarioEcoBrasil } from '@/components/demandas/CalendarioEcoBrasil';
import { TimelineView } from '@/components/demandas/TimelineView';
import { GanttView } from '@/components/demandas/GanttView';
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

// DemandaForm → extraído para client/src/components/demandas/DemandaForm.tsx



// DemandaCard → extraído para client/src/components/demandas/DemandaCard.tsx

// KanbanColumn → extraído para client/src/components/demandas/KanbanColumn.tsx

// ===================================================
// Calendário EcoBrasil (mês, com destaques)
// ===================================================



// ===================================================
// Timeline View
// ===================================================



// ===================================================
// Gantt View com Milestones
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
