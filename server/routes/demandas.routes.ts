/**
 * Demandas Routes — kanban de demandas, dashboard e histórico
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  membrosEquipe,
  rhRegistros,
  empreendimentos,
  whatsappDemandaConfig,
} from "@shared/schema";
import { websocketService } from "../services/websocketService";
import type { MiddlewareFn } from "../middleware/types";

interface DemandasRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
}

/** Normaliza número de telefone para o formato E.164 Brasil (55XXYYYY...) */
function normalizePhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  if (digits.length === 12 && digits.startsWith("55")) return digits;
  if (digits.length === 11) return `55${digits}`;
  if (digits.length === 10) return `55${digits}`;
  return undefined;
}

export function registerDemandasRoutes(
  app: Express,
  { storage, requireAuth }: DemandasRoutesContext
) {
  // ==== DEMANDAS ROUTES ====

  app.get("/api/minhas-demandas", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const userUnidade = req.user!.unidade;
      const demandas = await storage.getDemandasByResponsavel(userId, userUnidade);
      res.json(demandas);
    } catch (error) {
      console.error("Error fetching user demandas:", error);
      res.status(500).json({ error: "Failed to fetch demandas" });
    }
  });

  app.get("/api/demandas", requireAuth, async (req: Request, res: Response) => {
    try {
      const userCargo = (req.user?.cargo || "").toLowerCase();
      const isAdmin = userCargo === "admin" || userCargo === "diretor";

      const filters: any = {
        setor: req.query.setor as string,
        responsavel: req.query.responsavel as string,
        empreendimento: (req.query.empreendimento as string) || (req.query.empreendimentoId as string),
        prioridade: req.query.prioridade as string,
        status: req.query.status as string,
        search: req.query.search as string,
      };

      if (!isAdmin && req.user?.unidade) filters.unidade = req.user.unidade;

      Object.keys(filters).forEach((key) => {
        if (filters[key] === undefined) delete filters[key];
      });

      const demandas = await storage.getDemandas(filters);
      res.json(demandas);
    } catch (error) {
      console.error("Error fetching demandas:", error);
      res.status(500).json({ error: "Failed to fetch demandas" });
    }
  });

  app.get("/api/demandas/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userUnidade = req.user?.unidade || "";
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const stats = await storage.getDemandasStats(userUnidade, empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching demandas stats:", error);
      res.status(500).json({ error: "Failed to fetch demandas statistics" });
    }
  });

  app.get("/api/demandas/dashboard/stats/:empreendimentoId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userUnidade = req.user?.unidade || "";
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const stats = await storage.getDemandasStats(userUnidade, empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching demandas stats:", error);
      res.status(500).json({ error: "Failed to fetch demandas statistics" });
    }
  });

  app.get("/api/demandas/dashboard/charts", async (req: Request, res: Response) => {
    try {
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const chartData = await storage.getDemandasChartData(empreendimentoId);
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching demandas charts:", error);
      res.status(500).json({ error: "Failed to fetch demandas chart data" });
    }
  });

  app.get("/api/demandas/dashboard/charts/:empreendimentoId", async (req: Request, res: Response) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const chartData = await storage.getDemandasChartData(empreendimentoId);
      res.json(chartData);
    } catch (error) {
      console.error("Error fetching demandas charts:", error);
      res.status(500).json({ error: "Failed to fetch demandas chart data" });
    }
  });

  app.post("/api/admin/demandas/historico/clear", requireAuth, async (req: Request, res: Response) => {
    try {
      const { senha } = req.body || {};
      const adminPassword = process.env.ADMIN_UNLOCK_PASSWORD;
      if (!senha || senha !== adminPassword) return res.status(403).json({ error: "Senha incorreta" });
      const result = await storage.clearDemandasHistorico();
      console.log(`[ADMIN] User ${req.user?.email} cleared demandas movement history. Deleted ${result.count} records.`);
      res.json({ success: true, message: `${result.count} registros de histórico removidos` });
    } catch (error) {
      console.error("Error clearing demandas history:", error);
      res.status(500).json({ error: "Falha ao limpar histórico" });
    }
  });

  app.post("/api/demandas", requireAuth, async (req: Request, res: Response) => {
    try {
      const demandaData: any = {
        titulo: req.body.titulo,
        descricao: req.body.descricao,
        setor: req.body.setor,
        prioridade: req.body.prioridade || "media",
        complexidade: req.body.complexidade || "media",
        categoria: req.body.categoria || "geral",
        dataEntrega: req.body.dataEntrega,
        status: req.body.status || "a_fazer",
        responsavelId: req.body.responsavelId || req.session.userId,
        criadoPor: req.session.userId,
        unidade: req.user?.unidade || "salvador",
      };

      if (req.body.empreendimentoId && !isNaN(parseInt(req.body.empreendimentoId))) {
        demandaData.empreendimentoId = parseInt(req.body.empreendimentoId);
      }

      if (req.body.observacoes) demandaData.observacoes = req.body.observacoes;
      if (req.body.tags) demandaData.tags = req.body.tags;
      if (req.body.anexos) demandaData.anexos = req.body.anexos;
      if (req.body.tempoEstimado) demandaData.tempoEstimado = req.body.tempoEstimado;
      if (req.body.origem) demandaData.origem = req.body.origem;
      if (req.body.campanhaId) demandaData.campanhaId = req.body.campanhaId;
      if (req.body.contratoId) demandaData.contratoId = req.body.contratoId;

      const demanda = await storage.createDemanda(demandaData);
      websocketService.broadcastInvalidate("demandas");

      // Notificação WhatsApp ao responsável
      try {
        const { whatsappService } = await import("../services/whatsappService");
        let empNome: string | undefined;
        let responsavelWhatsapp: string | undefined;
        let responsavelEmail: string | undefined;
        let whatsappFonte = "—";

        if (demandaData.responsavelId) {
          const [resp] = await db.select({ whatsapp: users.whatsapp, email: users.email })
            .from(users).where(eq(users.id, demandaData.responsavelId));
          responsavelEmail = resp?.email || undefined;

          if (resp?.whatsapp) {
            responsavelWhatsapp = normalizePhone(resp.whatsapp);
            if (responsavelWhatsapp) whatsappFonte = "users.whatsapp";
          }

          if (!responsavelWhatsapp) {
            const [membro] = await db.select({ telefone: membrosEquipe.telefone, rhRegistroId: membrosEquipe.rhRegistroId })
              .from(membrosEquipe).where(eq(membrosEquipe.userId, demandaData.responsavelId));
            if (membro?.telefone) {
              responsavelWhatsapp = normalizePhone(membro.telefone);
              if (responsavelWhatsapp) whatsappFonte = "membrosEquipe.telefone";
            }

            if (!responsavelWhatsapp && membro?.rhRegistroId) {
              const [rh] = await db.select({ telefone: rhRegistros.contatoTelefone })
                .from(rhRegistros).where(eq(rhRegistros.id, membro.rhRegistroId));
              if (rh?.telefone) {
                responsavelWhatsapp = normalizePhone(rh.telefone);
                if (responsavelWhatsapp) whatsappFonte = "rhRegistros.contatoTelefone";
              }
            }

            if (!responsavelWhatsapp && responsavelEmail) {
              const [rh] = await db.select({ telefone: rhRegistros.contatoTelefone })
                .from(rhRegistros).where(eq(rhRegistros.contatoEmail, responsavelEmail));
              if (rh?.telefone) {
                responsavelWhatsapp = normalizePhone(rh.telefone);
                if (responsavelWhatsapp) whatsappFonte = "rhRegistros.contatoEmail";
              }
            }
          }
        }

        if (demandaData.empreendimentoId) {
          const [emp] = await db.select({ nome: empreendimentos.nome })
            .from(empreendimentos).where(eq(empreendimentos.id, demandaData.empreendimentoId));
          empNome = emp?.nome;
        }

        const msg = whatsappService.buildNovaDemandaMessage({
          titulo: demandaData.titulo,
          setor: demandaData.setor || "outro",
          prioridade: demandaData.prioridade || "media",
          dataEntregaISO: demandaData.dataEntrega ? String(demandaData.dataEntrega) : null,
          empreendimento: empNome,
          descricao: demandaData.descricao,
        });

        if (responsavelWhatsapp) {
          whatsappService.sendTextMessage(responsavelWhatsapp, msg).catch((e) =>
            console.error("[WhatsApp] Falha ao enviar para responsável:", e)
          );
        }

        const unidade = req.user?.unidade;
        if (unidade) {
          const [groupConfig] = await db.select().from(whatsappDemandaConfig)
            .where(and(eq(whatsappDemandaConfig.unidade, unidade), eq(whatsappDemandaConfig.enabled, true)));
          if (groupConfig?.notifyNovaDemanda && groupConfig.groupJid) {
            whatsappService.sendGroupMessage(groupConfig.groupJid, msg).catch((e) =>
              console.error("[WhatsApp] Falha ao enviar para grupo:", e)
            );
          }
        }
      } catch (wpErr) {
        console.error("[WhatsApp] Erro ao enviar notificação de nova demanda:", wpErr);
      }

      res.status(201).json(demanda);
    } catch (error: any) {
      console.error("Error creating demanda:", error);
      res.status(500).json({ error: "Failed to create demanda", details: error?.message || "Unknown error" });
    }
  });

  app.patch("/api/demandas/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid demanda ID" });

      const currentDemanda = await storage.getDemandaById(id);
      if (!currentDemanda) return res.status(404).json({ error: "Demanda not found" });

      const demanda = await storage.updateDemanda(id, req.body);
      if (!demanda) return res.status(404).json({ error: "Demanda not found" });

      const userId = req.session.userId;
      if (userId) {
        const changes: string[] = [];
        let statusAnterior = null;
        let statusNovo = null;
        let acao = "editou";

        if (req.body.status && req.body.status !== currentDemanda.status) {
          statusAnterior = currentDemanda.status || null;
          statusNovo = req.body.status;
          acao = "moveu";
          changes.push(`Status: ${currentDemanda.status} → ${req.body.status}`);
        }
        if (req.body.dataEntrega) {
          const currentDate = currentDemanda.dataEntrega ? new Date(currentDemanda.dataEntrega).toISOString().split("T")[0] : null;
          const newDate = new Date(req.body.dataEntrega).toISOString().split("T")[0];
          if (currentDate !== newDate) changes.push(`Data de Entrega: ${currentDate || "sem data"} → ${newDate}`);
        }
        if (req.body.responsavel && req.body.responsavel !== currentDemanda.responsavel) {
          changes.push(`Responsável: ${currentDemanda.responsavel} → ${req.body.responsavel}`);
        }
        if (req.body.prioridade && req.body.prioridade !== currentDemanda.prioridade) {
          changes.push(`Prioridade: ${currentDemanda.prioridade} → ${req.body.prioridade}`);
        }
        if (req.body.setor && req.body.setor !== currentDemanda.setor) {
          changes.push(`Setor: ${currentDemanda.setor} → ${req.body.setor}`);
        }

        if (changes.length > 0) {
          await storage.createHistoricoMovimentacao({
            demandaId: id,
            usuarioId: userId,
            acao,
            statusAnterior,
            statusNovo,
            descricao: changes.join("; "),
          });
        }

        if (req.body.status === "concluido" && currentDemanda.status !== "concluido") {
          try {
            const { processarConclusaoDemanda } = await import("../services/gamificacaoService");
            await processarConclusaoDemanda(demanda, demanda.responsavelId);
          } catch (gamErr) {
            console.error("[Gamificação] Erro ao processar pontuação de demanda:", gamErr);
          }
        }

        if (req.body.status && req.body.status !== currentDemanda.status) {
          try {
            const unidade = req.user?.unidade;
            if (unidade) {
              const [groupConfig] = await db.select().from(whatsappDemandaConfig)
                .where(and(eq(whatsappDemandaConfig.unidade, unidade), eq(whatsappDemandaConfig.enabled, true)));
              if (groupConfig?.groupJid) {
                const { whatsappService } = await import("../services/whatsappService");
                let empNome: string | undefined;
                if (demanda.empreendimentoId) {
                  const [emp] = await db.select({ nome: empreendimentos.nome })
                    .from(empreendimentos).where(eq(empreendimentos.id, demanda.empreendimentoId));
                  empNome = emp?.nome;
                }
                const msg = whatsappService.buildMudancaStatusMessage({
                  titulo: demanda.titulo,
                  setor: demanda.setor || "outro",
                  prioridade: demanda.prioridade || "media",
                  statusAnterior: currentDemanda.status || "a_fazer",
                  statusNovo: req.body.status,
                  dataEntregaISO: demanda.dataEntrega ? String(demanda.dataEntrega) : null,
                  responsavel: demanda.responsavel || undefined,
                  empreendimento: empNome,
                });
                whatsappService.sendGroupMessage(groupConfig.groupJid, msg).catch((e) =>
                  console.error("[WhatsApp] Falha ao enviar mudança de status para grupo:", e)
                );
              }
            }
          } catch (wpErr) {
            console.error("[WhatsApp] Erro ao notificar mudança de status:", wpErr);
          }
        }
      }

      websocketService.broadcastInvalidate("demandas");
      res.json(demanda);
    } catch (error) {
      console.error("Error updating demanda:", error);
      res.status(500).json({ error: "Failed to update demanda" });
    }
  });

  app.delete("/api/demandas/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid demanda ID" });
      const success = await storage.deleteDemanda(id);
      if (!success) return res.status(404).json({ error: "Demanda not found" });
      websocketService.broadcastInvalidate("demandas");
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting demanda:", error);
      res.status(500).json({ error: "Failed to delete demanda" });
    }
  });

  app.get("/api/demandas/historico/all", async (req: Request, res: Response) => {
    try {
      const historico = await storage.getAllHistorico();
      res.json(historico);
    } catch (error) {
      console.error("Error fetching historico:", error);
      res.status(500).json({ error: "Failed to fetch historico" });
    }
  });

  app.get("/api/demandas/:id/historico", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid demanda ID" });
      const historico = await storage.getHistoricoByDemanda(id);
      res.json(historico);
    } catch (error) {
      console.error("Error fetching historico:", error);
      res.status(500).json({ error: "Failed to fetch historico" });
    }
  });

  // ==== END DEMANDAS ROUTES ====
}
