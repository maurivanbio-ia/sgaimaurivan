import { Router } from "express";
import { dbPromise } from "../db.js";
import { z } from "zod";

const router = Router();

const datasetSchema = z.object({
  empreendimentoId: z.number(),
  nome: z.string(),
  descricao: z.string().optional(),
  tipo: z.string(),
  tamanho: z.number(),
  usuario: z.string(),
  url: z.string(),
  dataUpload: z.string(),
});

router.get("/", async (req, res) => {
  try {
    const db = await dbPromise;
    const { empreendimentoId, tipo } = req.query;

    let query = "SELECT * FROM datasets WHERE 1=1";
    const params: any[] = [];

    if (empreendimentoId) {
      query += " AND empreendimentoId = ?";
      params.push(empreendimentoId);
    }
    if (tipo) {
      query += " AND tipo = ?";
      params.push(tipo);
    }

    const rows = await db.all(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar datasets" });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = datasetSchema.parse(req.body);
    const db = await dbPromise;

    await db.run(
      \`INSERT INTO datasets (
        empreendimentoId, nome, descricao, tipo, tamanho, usuario, url, dataUpload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
      [
        data.empreendimentoId,
        data.nome,
        data.descricao || "",
        data.tipo,
        data.tamanho,
        data.usuario,
        data.url,
        data.dataUpload,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Falha ao salvar dataset" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const db = await dbPromise;
    const id = Number(req.params.id);
    await db.run("DELETE FROM datasets WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir dataset" });
  }
});

export default router;