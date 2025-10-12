import { db } from "./db";
import { eq, and, like, sql } from "drizzle-orm";
import { demandas } from "@shared/schema";

// ==========================================================
// Tipos auxiliares
// ==========================================================
type Status = "a_fazer" | "em_andamento" | "em_revisao" | "concluido" | "cancelado";
type Prioridade = "baixa" | "media" | "alta";

export interface Demanda {
  id: number;
  titulo: string;
  descricao: string;
  setor: string;
  prioridade: Prioridade;
  responsavel: string;
  dataEntrega: string;
  status: Status;
  empreendimentoId?: number | null;
}

// ==========================================================
// LISTAR Demandas com filtros opcionais
// ==========================================================
export async function getDemandas(filters: any = {}): Promise<Demanda[]> {
  const conditions: any[] = [];

  if (filters.setor) conditions.push(eq(demandas.setor, filters.setor));
  if (filters.responsavel) conditions.push(like(demandas.responsavel, `%${filters.responsavel}%`));
  if (filters.prioridade) conditions.push(eq(demandas.prioridade, filters.prioridade));
  if (filters.status) conditions.push(eq(demandas.status, filters.status));
  if (filters.empreendimentoId) conditions.push(eq(demandas.empreendimentoId, filters.empreendimentoId));
  if (filters.search) {
    conditions.push(
      sql`(${demandas.titulo} ILIKE ${"%" + filters.search + "%"} OR ${demandas.descricao} ILIKE ${"%" + filters.search + "%"})`
    );
  }

  const result = await db
    .select()
    .from(demandas)
    .where(and(...conditions.filter(Boolean)))
    .orderBy(demandas.id);

  return result as Demanda[];
}

// ==========================================================
// CRIAR nova Demanda
// ==========================================================
export async function createDemanda(data: Partial<Demanda>): Promise<Demanda> {
  const nova: Omit<Demanda, "id"> = {
    titulo: data.titulo?.trim() || "Sem título",
    descricao: data.descricao?.trim() || "",
    setor: data.setor || "Geral",
    prioridade: (data.prioridade as Prioridade) || "media",
    responsavel: data.responsavel || "Não definido",
    dataEntrega: data.dataEntrega || new Date().toISOString().slice(0, 10),
    status: (data.status as Status) || "a_fazer",
    empreendimentoId: data.empreendimentoId ?? null,
  };

  const inserted = await db.insert(demandas).values(nova).returning();
  return inserted[0] as Demanda;
}

// ==========================================================
// ATUALIZAR Demanda existente
// ==========================================================
export async function updateDemanda(id: number, data: Partial<Demanda>): Promise<Demanda | null> {
  const existing = await db.query.demandas.findFirst({
    where: (d, { eq }) => eq(d.id, id),
  });

  if (!existing) {
    console.warn(`Demanda com ID ${id} não encontrada.`);
    return null;
  }

  const updatedData: Partial<Demanda> = {
    titulo: data.titulo ?? existing.titulo,
    descricao: data.descricao ?? existing.descricao,
    setor: data.setor ?? existing.setor,
    prioridade: (data.prioridade as Prioridade) ?? existing.prioridade,
    responsavel: data.responsavel ?? existing.responsavel,
    dataEntrega: data.dataEntrega ?? existing.dataEntrega,
    status: (data.status as Status) ?? existing.status,
    empreendimentoId: data.empreendimentoId ?? existing.empreendimentoId,
  };

  const updated = await db
    .update(demandas)
    .set(updatedData)
    .where(eq(demandas.id, id))
    .returning();

  return updated[0] as Demanda;
}

// ==========================================================
// EXCLUIR Demanda (opcional)
// ==========================================================
export async function deleteDemanda(id: number): Promise<boolean> {
  const deleted = await db.delete(demandas).where(eq(demandas.id, id)).returning();
  return deleted.length > 0;
}

// ==========================================================
// ESTATÍSTICAS – para dashboards
// ==========================================================
export async function getDemandasStats(empreendimentoId?: number) {
  const base = db.select({
    status: demandas.status,
    total: sql<number>`COUNT(*)`,
  }).from(demandas);

  if (empreendimentoId) {
    base.where(eq(demandas.empreendimentoId, empreendimentoId));
  }

  const stats = await base.groupBy(demandas.status);
  return stats.map((s) => ({
    status: s.status,
    total: Number(s.total),
  }));
}

// ==========================================================
// DADOS para gráficos de demandas
// ==========================================================
export async function getDemandasChartData(empreendimentoId?: number) {
  const rows = await db
    .select({
      mes: sql<string>`TO_CHAR(${demandas.dataEntrega}, 'YYYY-MM')`,
      total: sql<number>`COUNT(*)`,
    })
    .from(demandas)
    .where(empreendimentoId ? eq(demandas.empreendimentoId, empreendimentoId) : undefined)
    .groupBy(sql`TO_CHAR(${demandas.dataEntrega}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${demandas.dataEntrega}, 'YYYY-MM')`);

  return rows.map((r) => ({
    mes: r.mes,
    total: Number(r.total),
  }));
}
