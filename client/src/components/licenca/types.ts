import { z } from "zod";
import type { LicencaAmbiental, Condicionante } from "@shared/schema";
import { Clock, BarChart3, CheckCircle2, XCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LicencaComEmpreendimento extends LicencaAmbiental {
  empreendimentoNome?: string;
}

export type CondicionanteComExtra = Condicionante & { responsavelNomeDisplay?: string };

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATEGORIAS_CONDICIONANTE = [
  "Monitoramento Ambiental",
  "Controle de Emissões",
  "Relatório Técnico",
  "Entrega de Documento",
  "Compensação Ambiental",
  "Programa de Gestão",
  "Comunicação",
  "Treinamento",
  "Licença de Terceiro",
  "Outro",
];

export const TIPOS_CONDICIONANTE = [
  { value: "periodica", label: "Periódica" },
  { value: "pontual", label: "Pontual" },
  { value: "entrega_documento", label: "Entrega de Documento" },
  { value: "permanente", label: "Permanente" },
  { value: "conforme_necessidade", label: "Conforme Necessidade" },
];

export const PERIODICIDADES = [
  { value: "diario", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "bianual", label: "Bianual" },
];

export const PERIODICIDADE_MESES: Record<string, number> = {
  diario: 0, semanal: 0, quinzenal: 0,
  mensal: 1, bimestral: 2, trimestral: 3,
  semestral: 6, anual: 12, bianual: 24,
};

export const PERIODICIDADE_DIAS: Record<string, number> = {
  diario: 1, semanal: 7, quinzenal: 15,
};

export const STATUS_CONDICIONANTE: Record<string, { label: string; color: string; icon: any }> = {
  pendente:    { label: "Pendente",    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  em_andamento:{ label: "Em Andamento",color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",   icon: BarChart3 },
  cumprida:    { label: "Cumprida",    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  vencida:     { label: "Vencida",     color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",         icon: XCircle },
  cancelada:   { label: "Cancelada",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",         icon: XCircle },
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const condicionanteSchema = z.object({
  item: z.string().optional(),
  codigo: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().min(1, "Descrição é obrigatória"),
  categoria: z.string().optional(),
  tipoCondicionante: z.string().optional(),
  responsavelNome: z.string().optional(),
  prazo: z.string().min(1, "Prazo é obrigatório"),
  periodicidade: z.string().optional(),
  status: z.string().default("pendente"),
  progresso: z.number().min(0).max(100).default(0),
  observacoes: z.string().optional(),
});

export type CondicionanteFormData = z.infer<typeof condicionanteSchema>;

export const evidenciaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  tipo: z.string().default("documento"),
  url: z.string().optional(),
  descricao: z.string().optional(),
  emitidoPor: z.string().optional(),
  dataEmissao: z.string().optional(),
});

export type EvidenciaFormData = z.infer<typeof evidenciaSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcularOcorrencias(periodicidade: string, prazo: string): { total: number; label: string } | null {
  if (!periodicidade || !prazo) return null;
  const hoje = new Date();
  const fim = new Date(prazo);
  if (isNaN(fim.getTime()) || fim <= hoje) return null;

  let total = 0;
  const diasLabel = PERIODICIDADE_DIAS[periodicidade];
  const mesesLabel = PERIODICIDADE_MESES[periodicidade];

  if (diasLabel) {
    const diffDias = Math.floor((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    total = Math.floor(diffDias / diasLabel);
  } else if (mesesLabel) {
    const mesesTotal =
      (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth());
    total = Math.floor(mesesTotal / mesesLabel);
  }

  if (total <= 0) return null;
  const freq = PERIODICIDADES.find(p => p.value === periodicidade)?.label ?? periodicidade;
  return { total, label: `${total} ocorrência${total !== 1 ? "s" : ""} ${freq.toLowerCase()}${total !== 1 ? "s" : ""}` };
}

export function isArquivoAcessivel(path: string | null | undefined): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  return lower.startsWith("/files/") || lower.startsWith("object:") || lower.startsWith("http");
}

export function diasParaVencer(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(prazo + "T00:00:00");
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export function getLicencaStatusColor(status: string) {
  if (status === "ativa") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (status === "a_vencer") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (status === "em_renovacao") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

export function getLicencaStatusLabel(status: string) {
  if (status === "ativa") return "Ativa";
  if (status === "a_vencer") return "A Vencer";
  if (status === "em_renovacao") return "Em Renovação";
  if (status === "vencida") return "Vencida";
  if (status === "cancelada") return "Cancelada";
  return status;
}
