import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { db } from "../db";
import { arquivos } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

// Configurar armazenamento do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Filtro para aceitar apenas PDFs
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Apenas arquivos PDF são permitidos"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Controller para upload de arquivo
export async function uploadArquivo(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
    }

    const userId = (req.session as any).userId;
    const { origem } = req.body;

    // Calcular checksum do arquivo
    const fileBuffer = fs.readFileSync(req.file.path);
    const checksum = crypto.createHash("md5").update(fileBuffer).digest("hex");

    // Salvar no banco de dados
    const [arquivo] = await db
      .insert(arquivos)
      .values({
        nome: req.file.originalname,
        mime: req.file.mimetype,
        tamanho: req.file.size,
        caminho: req.file.path,
        checksum,
        origem: origem || "contrato",
        uploaderId: userId,
      })
      .returning();

    res.json(arquivo);
  } catch (error: any) {
    console.error("Erro ao fazer upload:", error);
    res.status(500).json({ message: error.message || "Erro ao fazer upload do arquivo" });
  }
}

// Controller para download de arquivo
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

    if (!fs.existsSync(arquivo.caminho)) {
      return res.status(404).json({ message: "Arquivo físico não encontrado" });
    }

    res.download(arquivo.caminho, arquivo.nome);
  } catch (error: any) {
    console.error("Erro ao baixar arquivo:", error);
    res.status(500).json({ message: error.message || "Erro ao baixar arquivo" });
  }
}

// Controller para deletar arquivo
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

    // Deletar arquivo físico
    if (fs.existsSync(arquivo.caminho)) {
      fs.unlinkSync(arquivo.caminho);
    }

    // Deletar do banco
    await db.delete(arquivos).where(sql`${arquivos.id} = ${arquivoId}`);

    res.json({ message: "Arquivo deletado com sucesso" });
  } catch (error: any) {
    console.error("Erro ao deletar arquivo:", error);
    res.status(500).json({ message: error.message || "Erro ao deletar arquivo" });
  }
}
