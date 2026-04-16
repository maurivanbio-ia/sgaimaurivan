import * as z from "zod";
import type { FinanceiroLancamento, Empreendimento, CategoriaFinanceira } from "@shared/schema";

export type { FinanceiroLancamento, Empreendimento, CategoriaFinanceira };

export const novoLancamentoSchema = z.object({
  tipo: z.enum(["receita", "despesa", "reembolso", "solicitacao_recurso"], { required_error: "Tipo é obrigatório" }),
  empreendimentoId: z.number({ required_error: "Empreendimento é obrigatório" }).nullable(),
  categoriaId: z.number({ required_error: "Categoria é obrigatória" }),
  categoriaOutros: z.string().optional(),
  valor: z.number().min(0.01, "Valor deve ser maior que zero"),
  data: z.date({ required_error: "Data é obrigatória" }),
  dataVencimento: z.date().optional().nullable(),
  dataPagamento: z.date().optional().nullable(),
  descricao: z.string().min(5, "Descrição deve ter pelo menos 5 caracteres"),
  observacoes: z.string().optional(),
  unidade: z.enum(["salvador", "goiania", "lem"], { required_error: "Unidade é obrigatória" }),
});

export type NovoLancamentoFormData = z.infer<typeof novoLancamentoSchema>;

export interface FinancialStats {
  totalReceitas: number;
  totalDespesas: number;
  totalPendente: number;
  saldoAtual: number;
  porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
  porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
  evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
}

export const STATUS_CONFIG = {
  aguardando: { label: "Aguardando", color: "bg-yellow-500" },
  aprovado: { label: "Aprovado", color: "bg-blue-500" },
  pago: { label: "Pago", color: "bg-green-500" },
  recusado: { label: "Recusado", color: "bg-red-500" },
} as const;

export const TIPO_CONFIG = {
  receita: { label: "Receita", color: "bg-green-100 text-green-700" },
  despesa: { label: "Despesa", color: "bg-red-100 text-red-700" },
  reembolso: { label: "Reembolso", color: "bg-blue-100 text-blue-700" },
  solicitacao_recurso: { label: "Solicitação", color: "bg-purple-100 text-purple-700" },
} as const;

export const UNIDADES_CONFIG = {
  salvador: { label: "Salvador (BA)", sigla: "BA" },
  goiania: { label: "Goiânia (GO)", sigla: "GO" },
  lem: { label: "Luís Eduardo Magalhães (LEM)", sigla: "LEM" },
} as const;

export const CHART_COLORS = [
  "rgba(34, 197, 94, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(59, 130, 246, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(20, 184, 166, 0.8)",
  "rgba(249, 115, 22, 0.8)",
];

export function parseServerDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
}

export function formatServerDate(dateStr: string | null | undefined): string {
  const date = parseServerDate(dateStr);
  if (!date) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

export function formatDateLocal(date: Date | null | undefined): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
