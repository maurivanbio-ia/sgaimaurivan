import fs from "fs";
import path from "path";
import { db } from "../db";
import { dropboxSyncLog, arquivos, empreendimentos } from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { syncFileToDropbox, gerarNomeAbnt, createInstitutionalFolderStructure, DROPBOX_ROOT } from "./dropboxService";

export interface SyncStatus {
  total: number;
  synced: number;
  pending: number;
  errors: number;
  lastSyncAt: string | null;
}

export interface SyncResult {
  success: boolean;
  total: number;
  synced: number;
  errors: number;
  details: Array<{ nome: string; status: string; path?: string; error?: string }>;
}

/**
 * Returns overall sync statistics.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const logs = await db.select().from(dropboxSyncLog);

  const synced = logs.filter(l => l.status === "synced").length;
  const errors = logs.filter(l => l.status === "error").length;
  const pending = logs.filter(l => l.status === "pending").length;

  const lastEntry = logs
    .filter(l => l.syncedAt)
    .sort((a, b) => new Date(b.syncedAt!).getTime() - new Date(a.syncedAt!).getTime())[0];

  return {
    total: logs.length,
    synced,
    pending,
    errors,
    lastSyncAt: lastEntry?.syncedAt?.toISOString() || null,
  };
}

/**
 * Returns paginated sync log with file details.
 */
export async function getSyncLog(limit = 100, offset = 0) {
  return db
    .select()
    .from(dropboxSyncLog)
    .orderBy(sql`${dropboxSyncLog.criadoEm} DESC`)
    .limit(limit)
    .offset(offset);
}

/**
 * Syncs all files from the local uploads folder + arquivos table to Dropbox.
 */
export async function syncAllFilesToDropbox(): Promise<SyncResult> {
  const details: SyncResult["details"] = [];
  let syncedCount = 0;
  let errorCount = 0;

  // Step 1: Ensure institutional folders exist
  try {
    await createInstitutionalFolderStructure();
    console.log("[DropboxSync] Estrutura institucional verificada/criada.");
  } catch (err: any) {
    console.warn("[DropboxSync] Erro ao criar estrutura institucional:", err.message);
  }

  // Step 2: Get all files from the database
  const allArquivos = await db.select().from(arquivos).orderBy(sql`${arquivos.criadoEm} ASC`);

  // Step 3: Get already-synced file IDs to avoid duplicates
  const syncedLogs = await db
    .select()
    .from(dropboxSyncLog)
    .where(eq(dropboxSyncLog.status, "synced"));
  const syncedArquivoIds = new Set(syncedLogs.map(l => l.arquivoId).filter(Boolean));

  console.log(`[DropboxSync] Total arquivos: ${allArquivos.length}, já sincronizados: ${syncedArquivoIds.size}`);

  for (const arquivo of allArquivos) {
    // Skip already synced
    if (syncedArquivoIds.has(arquivo.id)) {
      details.push({ nome: arquivo.nome, status: "skipped (already synced)" });
      continue;
    }

    try {
      // Check if file exists on disk
      const filePath = arquivo.caminho;
      if (!filePath || !fs.existsSync(filePath)) {
        // File not on disk — log as error
        await db.insert(dropboxSyncLog).values({
          arquivoId: arquivo.id,
          arquivoNome: arquivo.nome,
          arquivoOrigem: arquivo.origem || "unknown",
          status: "error",
          errorMessage: "Arquivo não encontrado no disco",
          fileSize: arquivo.tamanho,
          syncedAt: null,
        });
        details.push({ nome: arquivo.nome, status: "error", error: "File not found on disk" });
        errorCount++;
        continue;
      }

      const fileBuffer = fs.readFileSync(filePath);

      const result = await syncFileToDropbox({
        fileBuffer,
        originalName: arquivo.nome,
        mimeType: arquivo.mime,
        module: arquivo.origem || "documento",
        useAbntNaming: false,
      });

      if (result.success) {
        await db.insert(dropboxSyncLog).values({
          arquivoId: arquivo.id,
          arquivoNome: arquivo.nome,
          arquivoOrigem: arquivo.origem || "unknown",
          dropboxPath: result.path,
          status: "synced",
          fileSize: arquivo.tamanho,
          syncedAt: new Date(),
        });
        details.push({ nome: arquivo.nome, status: "synced", path: result.path });
        syncedCount++;
      } else {
        await db.insert(dropboxSyncLog).values({
          arquivoId: arquivo.id,
          arquivoNome: arquivo.nome,
          arquivoOrigem: arquivo.origem || "unknown",
          status: "error",
          errorMessage: result.error,
          fileSize: arquivo.tamanho,
          syncedAt: null,
        });
        details.push({ nome: arquivo.nome, status: "error", error: result.error });
        errorCount++;
      }
    } catch (err: any) {
      await db.insert(dropboxSyncLog).values({
        arquivoId: arquivo.id,
        arquivoNome: arquivo.nome,
        arquivoOrigem: arquivo.origem || "unknown",
        status: "error",
        errorMessage: err.message,
        fileSize: arquivo.tamanho,
        syncedAt: null,
      }).catch(() => {});
      details.push({ nome: arquivo.nome, status: "error", error: err.message });
      errorCount++;
    }
  }

  // Step 4: Also sync files from Object Storage paths stored in other tables
  await syncObjectStorageFiles(details, syncedArquivoIds);

  return {
    success: true,
    total: allArquivos.length,
    synced: syncedCount,
    errors: errorCount,
    details,
  };
}

/**
 * Sync files referenced in Object Storage (URLs stored in various tables).
 */
async function syncObjectStorageFiles(
  details: SyncResult["details"],
  alreadySyncedIds: Set<number | null>
) {
  try {
    const { listObjects, getObjectBuffer } = await import("./objectStorageHelper");
    const objects = await listObjects();

    for (const obj of objects) {
      try {
        const buf = await getObjectBuffer(obj.key);
        if (!buf) continue;

        const fileName = path.basename(obj.key);
        const module = detectModuleFromKey(obj.key);

        const existing = await db
          .select()
          .from(dropboxSyncLog)
          .where(
            and(
              eq(dropboxSyncLog.arquivoNome, fileName),
              eq(dropboxSyncLog.status, "synced")
            )
          )
          .limit(1);

        if (existing.length > 0) continue;

        const result = await syncFileToDropbox({
          fileBuffer: buf,
          originalName: fileName,
          module,
          useAbntNaming: false,
        });

        await db.insert(dropboxSyncLog).values({
          arquivoNome: fileName,
          arquivoOrigem: module,
          dropboxPath: result.success ? result.path : undefined,
          status: result.success ? "synced" : "error",
          errorMessage: result.success ? undefined : result.error,
          fileSize: buf.length,
          syncedAt: result.success ? new Date() : null,
        });

        details.push({
          nome: fileName,
          status: result.success ? "synced" : "error",
          path: result.path,
          error: result.error,
        });
      } catch (e: any) {
        console.warn("[DropboxSync] Erro ao sync Object Storage item:", e.message);
      }
    }
  } catch (e: any) {
    console.warn("[DropboxSync] Object Storage não disponível ou erro:", e.message);
  }
}

function detectModuleFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.includes("licenc")) return "licenca";
  if (lower.includes("condicional") || lower.includes("evidenc")) return "evidencia";
  if (lower.includes("contrat")) return "contrato";
  if (lower.includes("relat")) return "relatorio";
  if (lower.includes("mapa") || lower.includes("geospa") || lower.includes("kmz") || lower.includes("kml")) return "mapa";
  if (lower.includes("rh") || lower.includes("recursos")) return "rh";
  if (lower.includes("financ")) return "financeiro";
  if (lower.includes("base") || lower.includes("conhec")) return "base_conhecimento";
  return "documento";
}

/**
 * Retry all failed syncs.
 */
export async function retrySyncErrors(): Promise<{ retried: number; success: number }> {
  const failed = await db
    .select()
    .from(dropboxSyncLog)
    .where(eq(dropboxSyncLog.status, "error"));

  let success = 0;
  for (const log of failed) {
    if (!log.arquivoId) continue;
    const [arquivo] = await db
      .select()
      .from(arquivos)
      .where(eq(arquivos.id, log.arquivoId));

    if (!arquivo || !arquivo.caminho || !fs.existsSync(arquivo.caminho)) continue;

    try {
      const buf = fs.readFileSync(arquivo.caminho);
      const result = await syncFileToDropbox({
        fileBuffer: buf,
        originalName: arquivo.nome,
        mimeType: arquivo.mime,
        module: arquivo.origem || "documento",
        useAbntNaming: false,
      });

      if (result.success) {
        await db
          .update(dropboxSyncLog)
          .set({ status: "synced", dropboxPath: result.path, syncedAt: new Date(), errorMessage: null })
          .where(eq(dropboxSyncLog.id, log.id));
        success++;
      }
    } catch (e: any) {
      console.warn("[DropboxSync] Retry falhou:", e.message);
    }
  }

  return { retried: failed.length, success };
}
