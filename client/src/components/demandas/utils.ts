import { isValid as isValidDate, format as formatDate } from "date-fns";
import type { Demanda, Colaborador, Status } from "./types";
import { VALID_STATUSES } from "./types";

export async function apiRequestDemandas<T = any>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const msg = json ? `${res.status}: ${JSON.stringify(json)}` : `${res.status}: ${text || "Erro"}`;
    throw new Error(msg);
  }
  return (json ?? null) as T;
}

export function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

export function safeNumber(x: any): number | null {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

export function normalizeStatus(x: any): Status {
  const s = String(x ?? "").trim();
  return VALID_STATUSES.includes(s as Status) ? (s as Status) : "a_fazer";
}

export function normalizeDateYmd(x: any): string {
  const s = String(x ?? "").trim();
  if (!s) return "";
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T12:00:00`);
  if (!isValidDate(d)) return "";
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).toISOString().slice(0, 10);
}

export function normalizeDemanda(raw: any): Demanda | null {
  const id = safeNumber(raw?.id);
  if (!id) return null;
  const status = normalizeStatus(raw?.status);
  const dataInicio = normalizeDateYmd(raw?.dataInicio ?? raw?.data_inicio) || null;
  const dataEntrega = normalizeDateYmd(raw?.dataEntrega);
  return {
    id,
    titulo: String(raw?.titulo ?? "").trim(),
    descricao: String(raw?.descricao ?? "").trim(),
    setor: String(raw?.setor ?? "Licenciamento"),
    prioridade: (raw?.prioridade ?? "media") as any,
    complexidade: (raw?.complexidade ?? "media") as any,
    categoria: (raw?.categoria ?? "geral") as any,
    dataInicio,
    dataEntrega,
    status,
    responsavelId: safeNumber(raw?.responsavelId ?? raw?.responsavel_id ?? raw?.responsavel?.id) ?? null,
    responsavel: raw?.responsavelNome ?? raw?.responsavel_nome ?? raw?.responsavel?.nome ?? raw?.responsavel ?? null,
    empreendimentoId: safeNumber(raw?.empreendimentoId ?? raw?.empreendimento_id) ?? null,
  };
}

export function normalizeDemandasList(raw: any): Demanda[] {
  return ensureArray<any>(raw).map(normalizeDemanda).filter((d): d is Demanda => Boolean(d?.id));
}

export function getResponsavelNome(d: Demanda, colaboradores: Colaborador[]): string {
  if (d?.responsavel && String(d.responsavel).trim()) return String(d.responsavel).trim();
  const rid = d?.responsavelId ?? null;
  if (!rid) return "Não atribuído";
  const c = colaboradores.find((x) => x.id === rid);
  return c?.nome ?? "Não atribuído";
}

export function insertDemandaInCache(queryClient: any, newDemanda: Demanda) {
  queryClient.setQueryData(["/api/demandas"], (old: any) => {
    const arr = normalizeDemandasList(old);
    const exists = arr.some((d) => d.id === newDemanda.id);
    if (exists) return arr.map((d) => (d.id === newDemanda.id ? newDemanda : d));
    return [newDemanda, ...arr];
  });
}

export function replaceDemandaInCache(queryClient: any, updated: Demanda) {
  queryClient.setQueryData(["/api/demandas"], (old: any) => {
    const arr = normalizeDemandasList(old);
    return arr.map((d) => (d.id === updated.id ? updated : d));
  });
}

export function removeDemandaFromCache(queryClient: any, id: number) {
  queryClient.setQueryData(["/api/demandas"], (old: any) => {
    const arr = normalizeDemandasList(old);
    return arr.filter((d) => d.id !== id);
  });
}

export function escapeCsv(value: any): string {
  const s = String(value ?? "");
  const needsQuotes = /[",\n;]/.test(s);
  const cleaned = s.replaceAll('"', '""');
  return needsQuotes ? `"${cleaned}"` : cleaned;
}

export function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
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

export function prioridadeBorder(prioridade: string): string {
  if (prioridade === "alta") return "border-l-4 border-l-red-600";
  if (prioridade === "media") return "border-l-4 border-l-yellow-600";
  return "border-l-4 border-l-green-600";
}
