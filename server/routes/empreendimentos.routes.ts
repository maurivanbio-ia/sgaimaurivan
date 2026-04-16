/**
 * Empreendimentos Routes — gestão de projetos/empreendimentos e seus responsáveis
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express, Request, Response } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db";
import {
  empreendimentoResponsaveis,
  empreendimentos,
  licencasAmbientais,
  insertEmpreendimentoSchema,
  insertEmpreendimentoResponsavelSchema,
} from "@shared/schema";
import { criarPastasParaEmpreendimento } from "../services/folderStructureService";
import type { MiddlewareFn } from "../middleware/types";

interface EmpreendimentosRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
}

export function registerEmpreendimentosRoutes(
  app: Express,
  { storage, requireAuth }: EmpreendimentosRoutesContext
) {
  app.get("/api/empreendimentos", requireAuth, async (req: Request, res: Response) => {
    try {
      const userCargo = (req.user?.cargo || "").toLowerCase();
      const isAdmin = userCargo === "admin" || userCargo === "diretor";
      const unidade = isAdmin ? undefined : req.user?.unidade;
      const emps = await storage.getEmpreendimentos(unidade);
      res.json(emps);
    } catch (error) {
      console.error("Get empreendimentos error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/empreendimentos/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userCargo = (req.user?.cargo || "").toLowerCase();
      const isAdmin = userCargo === "admin" || userCargo === "diretor";
      const unidade = isAdmin ? undefined : req.user?.unidade;
      const empreendimento = await storage.getEmpreendimento(id, unidade);
      if (!empreendimento) return res.status(404).json({ message: "Empreendimento not found" });
      res.json(empreendimento);
    } catch (error) {
      console.error("Get empreendimento error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/empreendimentos", requireAuth, async (req: Request, res: Response) => {
    try {
      const userUnidade = req.user?.unidade;
      if (!userUnidade) return res.status(400).json({ message: "Unidade do usuário não definida" });

      const body = { ...req.body };
      if (body.latitude === "" || body.latitude === undefined) body.latitude = null;
      if (body.longitude === "" || body.longitude === undefined) body.longitude = null;

      const data = insertEmpreendimentoSchema.parse({ ...body, unidade: userUnidade, criadoPor: req.session.userId });
      const empreendimento = await storage.createEmpreendimento(data);

      try {
        await criarPastasParaEmpreendimento(
          empreendimento.id,
          empreendimento.cliente || empreendimento.nome,
          empreendimento.uf || "BR",
          empreendimento.nome,
          empreendimento.codigo
        );
        console.log(`[Folder Structure] Pastas criadas para empreendimento: ${empreendimento.codigo || empreendimento.nome}`);
      } catch (folderError) {
        console.error("[Folder Structure] Erro ao criar pastas:", folderError);
      }

      res.status(201).json(empreendimento);
    } catch (error) {
      console.error("Create empreendimento error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/empreendimentos/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;
      const existing = await storage.getEmpreendimento(id, userUnidade);
      if (!existing) return res.status(404).json({ message: "Empreendimento not found" });

      const { unidade: _ignored, ...bodyWithoutUnidade } = req.body;
      if (bodyWithoutUnidade.latitude === "") bodyWithoutUnidade.latitude = null;
      if (bodyWithoutUnidade.longitude === "") bodyWithoutUnidade.longitude = null;

      const data = insertEmpreendimentoSchema.partial().parse(bodyWithoutUnidade);
      const empreendimento = await storage.updateEmpreendimento(id, data);
      res.json(empreendimento);
    } catch (error) {
      console.error("Update empreendimento error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.patch("/api/empreendimentos/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "Status obrigatório" });
      const validStatuses = ["ativo", "em_planejamento", "em_execucao", "concluido", "inativo", "cancelado"];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: "Status inválido" });
      const empreendimento = await storage.updateEmpreendimento(id, { status });
      res.json(empreendimento);
    } catch (error) {
      console.error("Quick status update error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  app.patch("/api/empreendimentos/:id/visivel", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { visivel } = req.body;
      if (typeof visivel !== "boolean") return res.status(400).json({ message: "Campo 'visivel' deve ser boolean" });
      const empreendimento = await storage.updateEmpreendimento(id, { visivel });
      res.json(empreendimento);
    } catch (error) {
      console.error("Toggle visibilidade error:", error);
      res.status(500).json({ message: "Erro ao atualizar visibilidade" });
    }
  });

  app.delete("/api/empreendimentos/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;
      const existing = await storage.getEmpreendimento(id, userUnidade);
      if (!existing) return res.status(404).json({ message: "Empreendimento not found" });
      await storage.deleteEmpreendimento(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete empreendimento error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Responsáveis do empreendimento ────────────────────────────────────────

  app.get("/api/empreendimentos/:id/responsaveis", requireAuth, async (req: Request, res: Response) => {
    try {
      const empId = parseInt(req.params.id);
      const rows = await db
        .select().from(empreendimentoResponsaveis)
        .where(eq(empreendimentoResponsaveis.empreendimentoId, empId))
        .orderBy(asc(empreendimentoResponsaveis.criadoEm));
      res.json(rows);
    } catch (error) {
      console.error("Get responsaveis error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/empreendimentos/:id/responsaveis", requireAuth, async (req: Request, res: Response) => {
    try {
      const empId = parseInt(req.params.id);
      const data = insertEmpreendimentoResponsavelSchema.parse({ ...req.body, empreendimentoId: empId });
      const [created] = await db.insert(empreendimentoResponsaveis).values(data).returning();
      res.status(201).json(created);
    } catch (error) {
      console.error("Create responsavel error:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao criar responsável" });
    }
  });

  app.put("/api/empreendimentos/:id/responsaveis/:rid", requireAuth, async (req: Request, res: Response) => {
    try {
      const rid = parseInt(req.params.rid);
      const empId = parseInt(req.params.id);
      const { nome, email, whatsapp, responsabilidade } = req.body;
      const [updated] = await db
        .update(empreendimentoResponsaveis)
        .set({ nome, email: email || null, whatsapp: whatsapp || null, responsabilidade })
        .where(and(eq(empreendimentoResponsaveis.id, rid), eq(empreendimentoResponsaveis.empreendimentoId, empId)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Responsável não encontrado" });
      res.json(updated);
    } catch (error) {
      console.error("Update responsavel error:", error);
      res.status(400).json({ message: "Erro ao atualizar responsável" });
    }
  });

  app.delete("/api/empreendimentos/:id/responsaveis/:rid", requireAuth, async (req: Request, res: Response) => {
    try {
      const rid = parseInt(req.params.rid);
      const empId = parseInt(req.params.id);
      await db
        .delete(empreendimentoResponsaveis)
        .where(and(eq(empreendimentoResponsaveis.id, rid), eq(empreendimentoResponsaveis.empreendimentoId, empId)));
      res.status(204).send();
    } catch (error) {
      console.error("Delete responsavel error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Licenças por empreendimento ───────────────────────────────────────────

  app.get("/api/empreendimentos/:id/licencas", requireAuth, async (req: Request, res: Response) => {
    try {
      const empreendimentoId = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;
      const userCargo = (req.user?.cargo || "").toLowerCase();
      const isAdmin = userCargo === "admin" || userCargo === "diretor";

      if (!isAdmin) {
        const emp = await storage.getEmpreendimento(empreendimentoId, userUnidade);
        if (!emp) return res.status(403).json({ message: "Acesso negado" });
      }

      const licencas = await storage.getLicencasByEmpreendimento(empreendimentoId);
      res.json(licencas);
    } catch (error) {
      console.error("Get licencas by empreendimento error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
