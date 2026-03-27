import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { db } from "../db";
import { arquivos } from "@shared/schema";
import { sql } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "../replit_integrations/object_storage/objectStorage";

// Pasta dentro do Object Storage onde os arquivos são guardados
const ARQUIVOS_SUBDIR = "arquivos";

// Prefixo que identifica caminhos do Object Storage no banco
const OBJ_PREFIX = "object:";

// ── Multer com memoryStorage (sem disco) ──────────────────────────────────────
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
];

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de arquivo não permitido. Formatos aceitos: PDF, Word, Excel, imagens (JPG, PNG), TXT, ZIP, RAR"));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

// ── Helper: salvar buffer no Object Storage ────────────────────────────────────
async function saveToObjectStorage(buffer: Buffer, originalName: string, mimeType: string): Promise<string> {
  const objStorage = new ObjectStorageService();
  const privateDir = objStorage.getPrivateObjectDir();

  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}_${safeName}`;
  const objectPath = `${privateDir}/${ARQUIVOS_SUBDIR}/${fileName}`;

  const pathParts = objectPath.split("/").filter((p) => p.length > 0);
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType: mimeType,
    metadata: { originalName: safeName, uploadedAt: new Date().toISOString() },
  });

  // Retorna referência portátil: "object:arquivos/timestamp_nome.pdf"
  return `${OBJ_PREFIX}${ARQUIVOS_SUBDIR}/${fileName}`;
}

// ── Helper: buscar arquivo do Object Storage ───────────────────────────────────
async function getFromObjectStorage(caminho: string) {
  const objStorage = new ObjectStorageService();
  const privateDir = objStorage.getPrivateObjectDir();

  // caminho = "object:arquivos/timestamp_nome.pdf"
  const relativePath = caminho.slice(OBJ_PREFIX.length); // "arquivos/timestamp_nome.pdf"
  const objectPath = `${privateDir}/${relativePath}`;

  const pathParts = objectPath.split("/").filter((p) => p.length > 0);
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  return exists ? file : null;
}

// ── Controller: upload ─────────────────────────────────────────────────────────
export async function uploadArquivo(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
    }

    const userId = (req.session as any).userId;
    const { origem, empreendimentoCliente, empreendimentoUf, empreendimentoCodigo, empreendimentoNome } = req.body;

    // MD5 do buffer (sem escrever em disco)
    const checksum = crypto.createHash("md5").update(req.file.buffer).digest("hex");

    // Salvar no Object Storage
    const caminho = await saveToObjectStorage(req.file.buffer, req.file.originalname, req.file.mimetype);
    console.log(`[Arquivo Upload] Salvo no Object Storage: ${caminho}`);

    // Registrar no banco
    const [arquivo] = await db
      .insert(arquivos)
      .values({
        nome: req.file.originalname,
        mime: req.file.mimetype,
        tamanho: req.file.size,
        caminho,
        checksum,
        origem: origem || "contrato",
        uploaderId: userId,
      })
      .returning();

    res.json(arquivo);

    // Sincronizar com Dropbox e indexar no RAG (background, não bloqueante)
    setImmediate(async () => {
      try {
        const { syncFileToDropbox } = await import("../services/dropboxService");
        await syncFileToDropbox({
          fileBuffer: req.file!.buffer,
          originalName: req.file!.originalname,
          mimeType: req.file!.mimetype,
          module: origem || "documento",
          empreendimento: empreendimentoCliente
            ? {
                cliente: empreendimentoCliente,
                uf: empreendimentoUf || "BR",
                codigo: empreendimentoCodigo || "",
                nome: empreendimentoNome || empreendimentoCodigo || "",
              }
            : undefined,
        });
      } catch (err: any) {
        console.warn("[Dropbox] Sync em background falhou:", err.message);
      }

      try {
        const { autoIndexDocument } = await import("../services/documentIndexService");
        const unidade = (req as any).user?.unidade || (req.session as any)?.unidade || "geral";
        await autoIndexDocument({
          unidade,
          fileName: req.file!.originalname,
          fileUrl: `/api/arquivos/${arquivo.id}/download`,
          fileBuffer: req.file!.buffer,
          fileType: req.file!.mimetype,
          module: origem || "documento",
          empreendimentoNome: empreendimentoNome || empreendimentoCliente || undefined,
        });
      } catch (err: any) {
        console.warn("[RAG] Auto-index em background falhou:", err.message);
      }
    });
  } catch (error: any) {
    console.error("Erro ao fazer upload:", error);
    res.status(500).json({ message: error.message || "Erro ao fazer upload do arquivo" });
  }
}

// ── Controller: download ────────────────────────────────────────────────────────
export async function downloadArquivo(req: Request, res: Response) {
  try {
    const arquivoId = parseInt(req.params.id);

    const [arquivo] = await db
      .select()
      .from(arquivos)
      .where(sql`${arquivos.id} = ${arquivoId}`);

    if (!arquivo) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    // ── Caminho no Object Storage (arquivos novos) ──
    if (arquivo.caminho.startsWith(OBJ_PREFIX)) {
      const file = await getFromObjectStorage(arquivo.caminho);
      if (!file) {
        return res.status(404).json({ message: "Arquivo não encontrado no armazenamento" });
      }

      const [metadata] = await file.getMetadata();
      const ext = path.extname(arquivo.nome).toLowerCase();
      let mimeType = metadata.contentType || arquivo.mime || "application/octet-stream";
      if (!mimeType || mimeType === "application/octet-stream") {
        if (ext === ".pdf") mimeType = "application/pdf";
        else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".png") mimeType = "image/png";
        else if (ext === ".docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (ext === ".xlsx") mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }

      res.setHeader("Content-Type", mimeType);
      if (metadata.size) res.setHeader("Content-Length", metadata.size);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(arquivo.nome)}"`);

      file
        .createReadStream()
        .on("error", (err) => {
          console.error("[Arquivo Download] Erro no stream:", err);
          if (!res.headersSent) res.status(500).json({ message: "Erro ao transmitir arquivo" });
        })
        .pipe(res);

      return;
    }

    // ── Fallback: arquivo antigo no disco local (legado) ──
    const fs = await import("fs");
    if (!fs.default.existsSync(arquivo.caminho)) {
      return res.status(404).json({
        message: "Arquivo físico não encontrado. O arquivo foi salvo antes da migração para armazenamento permanente. Por favor, faça o upload novamente.",
      });
    }

    res.download(arquivo.caminho, arquivo.nome);
  } catch (error: any) {
    console.error("Erro ao baixar arquivo:", error);
    res.status(500).json({ message: error.message || "Erro ao baixar arquivo" });
  }
}

// ── Controller: deletar ────────────────────────────────────────────────────────
export async function deleteArquivo(req: Request, res: Response) {
  try {
    const arquivoId = parseInt(req.params.id);

    const [arquivo] = await db
      .select()
      .from(arquivos)
      .where(sql`${arquivos.id} = ${arquivoId}`);

    if (!arquivo) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    // Deletar do Object Storage (arquivos novos)
    if (arquivo.caminho.startsWith(OBJ_PREFIX)) {
      try {
        const file = await getFromObjectStorage(arquivo.caminho);
        if (file) await file.delete();
      } catch (err: any) {
        console.warn("[Arquivo Delete] Erro ao remover do Object Storage:", err.message);
      }
    } else {
      // Fallback: deletar do disco local (legado)
      try {
        const fs = await import("fs");
        if (fs.default.existsSync(arquivo.caminho)) {
          fs.default.unlinkSync(arquivo.caminho);
        }
      } catch (err: any) {
        console.warn("[Arquivo Delete] Erro ao remover arquivo local:", err.message);
      }
    }

    // Deletar do banco
    await db.delete(arquivos).where(sql`${arquivos.id} = ${arquivoId}`);

    res.json({ message: "Arquivo deletado com sucesso" });
  } catch (error: any) {
    console.error("Erro ao deletar arquivo:", error);
    res.status(500).json({ message: error.message || "Erro ao deletar arquivo" });
  }
}
