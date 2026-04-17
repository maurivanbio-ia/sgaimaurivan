/**
 * Licenças Routes — licenças ambientais, condicionantes, entregas, alertas, exportações, notificações
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express } from 'express';
import NodeCache from 'node-cache';
import { db } from '../db';
import { eq, and, or, desc, sql, gte, inArray, ne } from 'drizzle-orm';
import {
  insertLicencaAmbientalSchema,
  insertCondicionanteSchema,
  insertCondicionanteEvidenciaSchema,
  condicionanteEvidencias,
  insertEntregaSchema,
  licencasAmbientais,
  datasets,
  empreendimentos,
  users,
} from '@shared/schema';
import { notificationService } from '../notificationService';
import { exportService } from '../exportService';
import { alertService } from '../alertService';
import { websocketService } from '../services/websocketService';
import type { MiddlewareFn } from '../middleware/types';

const dashboardCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

interface LicencasRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
}

export function registerLicencasRoutes(app: Express, { storage, requireAuth }: LicencasRoutesContext) {
  // Licenca routes
  app.get("/api/licencas", requireAuth, async (req, res) => {
    try {
      const licencas = await storage.getLicencas();
      res.json(licencas);
    } catch (error) {
      console.error("Get licencas error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Filtered data routes (must be before /:id routes)
  app.get("/api/licencas/ativas", requireAuth, async (req, res) => {
    try {
      const licencas = await storage.getLicencasByStatus('ativa');
      res.json(licencas);
    } catch (error) {
      console.error("Get licenças ativas error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/licencas/vencer", requireAuth, async (req, res) => {
    try {
      const licencas = await storage.getLicencasByStatus('expiring');
      res.json(licencas);
    } catch (error) {
      console.error("Get licenças a vencer error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/licencas/vencidas", requireAuth, async (req, res) => {
    try {
      const licencas = await storage.getLicencasByStatus('expired');
      res.json(licencas);
    } catch (error) {
      console.error("Get licenças vencidas error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/licencas/em-renovacao", requireAuth, async (req, res) => {
    try {
      const licencas = await storage.getLicencasEmRenovacao();
      res.json(licencas);
    } catch (error) {
      console.error("Get licenças em renovação error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/licencas/calendar", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate e endDate são obrigatórios" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Datas inválidas" });
      }

      const licencas = await storage.getLicencasByDateRange(userUnidade, start, end);
      const demandas = await storage.getDemandasByDateRange(userUnidade, start, end);
      const tarefasData = await storage.getTarefasByDateRange(userUnidade, start, end, req.user.id);
      
      const events = [
        ...licencas.map((l: any) => ({ ...l, tipo: 'licenca', eventType: 'licenca' })),
        ...demandas.map((d: any) => ({ 
          id: d.id, 
          tipo: d.setor, 
          validade: d.dataEntrega, 
          empreendimentoNome: d.titulo, 
          orgaoEmissor: d.responsavel,
          eventType: 'demanda'
        })),
        ...tarefasData.map((t: any) => ({
          id: t.id,
          tipo: t.categoria || 'tarefa',
          validade: t.dataFim,
          empreendimentoNome: t.titulo,
          orgaoEmissor: t.status,
          eventType: 'tarefa'
        }))
      ];
      
      res.json(events);
    } catch (error) {
      console.error("Get licenças calendar error:", error);
      res.status(500).json({ message: "Erro ao buscar licenças do calendário" });
    }
  });

  app.get("/api/licencas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const licenca = await storage.getLicenca(id);
      if (!licenca) {
        return res.status(404).json({ message: "Licença not found" });
      }
      res.json(licenca);
    } catch (error) {
      console.error("Get licenca error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Download do arquivo PDF da licença — suporta /files/, object: e URLs diretas
  app.get("/api/licencas/:id/arquivo", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const licenca = await storage.getLicenca(id);
      if (!licenca || !licenca.arquivoPdf) {
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }

      const path = licenca.arquivoPdf;
      const pathLower = path.toLowerCase();

      // Caso 1: path /files/... — servido pelo objectStorage (aceita maiúsculas/minúsculas)
      // UUIDs gerados por randomUUID() são sempre lowercase; converter tudo para lowercase é seguro
      if (pathLower.startsWith("/files/")) {
        const { ObjectStorageService } = await import("../objectStorage");
        const svc = new ObjectStorageService();
        const fullPath = svc.getFullObjectPath(pathLower);
        return await svc.downloadFile(fullPath, res);
      }

      // Caso 2: path object:... — converte para fullPath
      if (pathLower.startsWith("object:")) {
        const { ObjectStorageService } = await import("../objectStorage");
        const svc = new ObjectStorageService();
        const privateDir = svc.getPrivateObjectDir();
        const relativePath = path.slice("object:".length);
        const fullPath = privateDir ? `${privateDir}/${relativePath}` : relativePath;
        return await svc.downloadFile(fullPath, res);
      }

      // Caso 3: URL pública (https://) — redireciona
      if (pathLower.startsWith("http")) {
        return res.redirect(path);
      }

      // Caso 4: caminho legado local não acessível
      return res.status(410).json({
        message: "Arquivo do sistema anterior não está mais disponível. Por favor, edite a licença e faça o upload novamente."
      });
    } catch (error: any) {
      console.error("Download licença arquivo error:", error);
      if (error?.message?.includes("not found") || error?.name === "ObjectNotFoundError") {
        return res.status(404).json({ message: "Arquivo não encontrado no servidor." });
      }
      res.status(500).json({ message: "Erro ao baixar arquivo" });
    }
  });

  app.post("/api/licencas", requireAuth, async (req, res) => {
    try {
      const data = insertLicencaAmbientalSchema.parse(req.body);
      const licenca = await storage.createLicenca(data);
      websocketService.broadcastInvalidate('licencas');
      res.status(201).json(licenca);
    } catch (error) {
      console.error("Create licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/licencas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`[PUT /api/licencas/${id}] body.arquivoPdf =`, req.body?.arquivoPdf);
      const data = insertLicencaAmbientalSchema.partial().parse(req.body);
      console.log(`[PUT /api/licencas/${id}] parsed.arquivoPdf =`, data?.arquivoPdf);
      // Preserve explicit status updates (status is omitted from insertSchema but valid for updates)
      if (req.body.status) {
        (data as any).status = req.body.status;
      }
      const licenca = await storage.updateLicenca(id, data);
      websocketService.broadcastInvalidate('licencas');
      res.json(licenca);
    } catch (error) {
      console.error("Update licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // PATCH /api/licencas/:id — status-only update (used by CicloVidaTab and quick actions)
  app.patch("/api/licencas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "status é obrigatório" });
      const licenca = await storage.updateLicenca(id, { status } as any);
      websocketService.broadcastInvalidate('licencas');
      res.json(licenca);
    } catch (error) {
      console.error("Patch licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/licencas/:id/finalizar", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const licenca = await storage.finalizarLicenca(id);
      websocketService.broadcastInvalidate('licencas');
      res.json(licenca);
    } catch (error) {
      console.error("Finalizar licenca error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/licencas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLicenca(id);
      websocketService.broadcastInvalidate('licencas');
      res.status(204).send();
    } catch (error) {
      console.error("Delete licenca error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Helper: recalcula progresso do condicionante com base nas evidências
  async function recalcularProgressoCondicionante(condicionanteId: number) {
    const [totRow] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(condicionanteEvidencias)
      .where(eq(condicionanteEvidencias.condicionanteId, condicionanteId));
    const [aprRow] = await db
      .select({ aprovadas: sql<number>`COUNT(*)::int` })
      .from(condicionanteEvidencias)
      .where(and(eq(condicionanteEvidencias.condicionanteId, condicionanteId), eq(condicionanteEvidencias.aprovado, true)));

    const total = Number(totRow?.total ?? 0);
    const aprovadas = Number(aprRow?.aprovadas ?? 0);

    const [cond] = await db.select({ status: condicionantes.status })
      .from(condicionantes).where(eq(condicionantes.id, condicionanteId));

    if (total === 0) {
      // Sem evidências — reseta progresso para 0 e status para pendente (se estava em andamento)
      const newStatus = cond?.status === 'em_andamento' ? 'pendente' : cond?.status;
      await db.update(condicionantes)
        .set({ progresso: 0, status: newStatus, atualizadoEm: new Date() })
        .where(eq(condicionantes.id, condicionanteId));
      return;
    }

    // Progresso: aprovadas/total * 100. Se há docs mas nenhum aprovado → pelo menos 10%
    const progresso = aprovadas > 0
      ? Math.round((aprovadas / total) * 100)
      : Math.min(10 * total, 50); // 10% por evidência inserida, max 50% sem aprovação

    // Muda status para em_andamento se estava pendente
    const newStatus = cond?.status === 'pendente' ? 'em_andamento' : cond?.status;

    await db.update(condicionantes)
      .set({ progresso, status: newStatus, atualizadoEm: new Date() })
      .where(eq(condicionantes.id, condicionanteId));
  }

  // Recalcular progresso de todos os condicionantes de uma licença
  app.post("/api/licencas/:licencaId/condicionantes/recalcular", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const conds = await db.select({ id: condicionantes.id })
        .from(condicionantes)
        .where(eq(condicionantes.licencaId, licencaId));
      await Promise.all(conds.map(c => recalcularProgressoCondicionante(c.id)));
      websocketService.broadcastInvalidate('condicionantes');
      res.json({ recalculados: conds.length });
    } catch (error) {
      console.error("Recalcular progresso error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Condicionante routes
  app.get("/api/condicionantes", requireAuth, async (req, res) => {
    try {
      const condicionantes = await storage.getCondicionantes();
      res.json(condicionantes);
    } catch (error) {
      console.error("Get condicionantes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Filtered condicionantes route (must be before /:id routes)
  app.get("/api/condicionantes/pendentes", requireAuth, async (req, res) => {
    try {
      const unidade = (req.user as any)?.unidade || '';
      const condicionantes = await storage.getCondicionantesByStatus('pendente', unidade);
      res.json(condicionantes);
    } catch (error) {
      console.error("Get condicionantes pendentes error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/condicionantes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const condicionante = await storage.getCondicionante(id);
      if (!condicionante) {
        return res.status(404).json({ message: "Condicionante not found" });
      }
      res.json(condicionante);
    } catch (error) {
      console.error("Get condicionante error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/licencas/:licencaId/condicionantes", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const condicionantes = await storage.getCondicionantesByLicenca(licencaId);
      res.json(condicionantes);
    } catch (error) {
      console.error("Get condicionantes by licenca error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/licencas/:licencaId/condicionantes", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const data = insertCondicionanteSchema.parse({ ...req.body, licencaId });
      const condicionante = await storage.createCondicionante(data);
      websocketService.broadcastInvalidate('condicionantes');
      res.status(201).json(condicionante);
    } catch (error) {
      console.error("Create condicionante for licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/condicionantes", requireAuth, async (req, res) => {
    try {
      const data = insertCondicionanteSchema.parse(req.body);
      const condicionante = await storage.createCondicionante(data);
      websocketService.broadcastInvalidate('condicionantes');
      res.status(201).json(condicionante);
    } catch (error) {
      console.error("Create condicionante error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/condicionantes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertCondicionanteSchema.partial().parse(req.body);
      // progresso is always auto-calculated from evidências — never allow manual override
      delete (data as any).progresso;
      const condicionante = await storage.updateCondicionante(id, data);
      websocketService.broadcastInvalidate('condicionantes');
      res.json(condicionante);
    } catch (error) {
      console.error("Update condicionante error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.delete("/api/condicionantes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCondicionante(id);
      websocketService.broadcastInvalidate('condicionantes');
      res.status(204).send();
    } catch (error) {
      console.error("Delete condicionante error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Condicionante Evidências routes
  app.get("/api/condicionantes/:condicionanteId/evidencias", requireAuth, async (req, res) => {
    try {
      const condicionanteId = parseInt(req.params.condicionanteId);
      const evidencias = await db.select().from(condicionanteEvidencias)
        .where(eq(condicionanteEvidencias.condicionanteId, condicionanteId))
        .orderBy(condicionanteEvidencias.criadoEm);
      res.json(evidencias);
    } catch (error) {
      console.error("Get evidencias error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/condicionantes/:condicionanteId/evidencias", requireAuth, async (req, res) => {
    try {
      const condicionanteId = parseInt(req.params.condicionanteId);
      const user = (req.session as any)?.user;
      const data = insertCondicionanteEvidenciaSchema.parse({
        ...req.body,
        condicionanteId,
        criadoPor: user?.email || user?.nome,
      });
      const [evidencia] = await db.insert(condicionanteEvidencias).values(data).returning();

      // Auto-calcular progresso e mudar status para em_andamento se estava pendente
      await recalcularProgressoCondicionante(condicionanteId);

      websocketService.broadcastInvalidate('condicionantes');
      res.status(201).json(evidencia);
    } catch (error) {
      console.error("Create evidencia error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/condicionantes/evidencias/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [evidencia] = await db.update(condicionanteEvidencias)
        .set(req.body)
        .where(eq(condicionanteEvidencias.id, id))
        .returning();
      res.json(evidencia);
    } catch (error) {
      console.error("Update evidencia error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/condicionantes/evidencias/:id/aprovar", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req.session as any)?.user;
      const [evidencia] = await db.update(condicionanteEvidencias)
        .set({
          aprovado: true,
          aprovadoPor: user?.nome || user?.email,
          dataAprovacao: new Date(),
        })
        .where(eq(condicionanteEvidencias.id, id))
        .returning();

      // Recalcula progresso com base nas aprovações
      if (evidencia?.condicionanteId) {
        await recalcularProgressoCondicionante(evidencia.condicionanteId);
        websocketService.broadcastInvalidate('condicionantes');
      }

      res.json(evidencia);
    } catch (error) {
      console.error("Approve evidencia error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.delete("/api/condicionantes/evidencias/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Buscar condicionanteId antes de deletar
      const [ev] = await db.select({ condicionanteId: condicionanteEvidencias.condicionanteId })
        .from(condicionanteEvidencias).where(eq(condicionanteEvidencias.id, id));
      await db.delete(condicionanteEvidencias).where(eq(condicionanteEvidencias.id, id));
      if (ev?.condicionanteId) {
        await recalcularProgressoCondicionante(ev.condicionanteId);
        websocketService.broadcastInvalidate('condicionantes');
      }
      res.status(204).send();
    } catch (error) {
      console.error("Delete evidencia error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Entrega routes
  app.get("/api/entregas", requireAuth, async (req, res) => {
    try {
      const entregas = await storage.getEntregas();
      res.json(entregas);
    } catch (error) {
      console.error("Get entregas error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entregas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entrega = await storage.getEntrega(id);
      if (!entrega) {
        return res.status(404).json({ message: "Entrega not found" });
      }
      res.json(entrega);
    } catch (error) {
      console.error("Get entrega error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // GET /api/licencas/:licencaId/documentos — datasets da Gestão de Dados vinculados à licença
  app.get("/api/licencas/:licencaId/documentos", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const docs = await db
        .select()
        .from(datasets)
        .where(eq(datasets.licencaId, licencaId))
        .orderBy(desc(datasets.criadoEm));
      res.json(docs);
    } catch (error) {
      console.error("Get documentos by licenca error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/licencas/:licencaId/entregas", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const entregas = await storage.getEntregasByLicenca(licencaId);
      res.json(entregas);
    } catch (error) {
      console.error("Get entregas by licenca error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/licencas/:licencaId/entregas", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const data = insertEntregaSchema.parse({ ...req.body, licencaId });
      const entrega = await storage.createEntrega(data);
      res.status(201).json(entrega);
    } catch (error) {
      console.error("Create entrega for licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/entregas", requireAuth, async (req, res) => {
    try {
      const data = insertEntregaSchema.parse(req.body);
      const entrega = await storage.createEntrega(data);
      res.status(201).json(entrega);
    } catch (error) {
      console.error("Create entrega error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/entregas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertEntregaSchema.partial().parse(req.body);
      const entrega = await storage.updateEntrega(id, data);
      res.json(entrega);
    } catch (error) {
      console.error("Update entrega error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.delete("/api/entregas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEntrega(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete entrega error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Consolidated dashboard stats endpoint (reduces 6+ requests to 1)
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const unidade = req.user?.unidade || '';
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      
      const defaultLicenseStats = { active: 0, expiring: 0, expired: 0, emRenovacao: 0, proxVencer: 0 };
      const defaultCondStats = { pendentes: 0, cumpridas: 0, vencidas: 0 };
      const defaultEntregaStats = { pendentes: 0, entregues: 0, atrasadas: 0 };
      const defaultFrotaStats = { total: 0, disponiveis: 0, emUso: 0, manutencao: 0, alugados: 0 };
      const defaultEquipStats = { total: 0, disponiveis: 0, emUso: 0, manutencao: 0 };
      const defaultRhStats = { total: 0, ativos: 0, afastados: 0 };
      const defaultDemandasStats = { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0 };
      const defaultContratosStats = { total: 0, ativos: 0, valorTotal: 0 };

      // Query condicionantes vencidas e em_andamento com contexto
      const getCondicionantesAlerta = async () => {
        const emps = unidade && unidade.trim() !== ''
          ? await db.select({ id: empreendimentos.id, nome: empreendimentos.nome, cliente: empreendimentos.cliente }).from(empreendimentos).where(eq(empreendimentos.unidade, unidade))
          : await db.select({ id: empreendimentos.id, nome: empreendimentos.nome, cliente: empreendimentos.cliente }).from(empreendimentos);
        
        const empIds = emps.map(e => e.id);
        if (empIds.length === 0) return [];

        const licencasData = empreendimentoId
          ? await db.select({ id: licencasAmbientais.id, numero: licencasAmbientais.numero, empreendimentoId: licencasAmbientais.empreendimentoId }).from(licencasAmbientais).where(and(eq(licencasAmbientais.empreendimentoId, empreendimentoId), sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`))
          : await db.select({ id: licencasAmbientais.id, numero: licencasAmbientais.numero, empreendimentoId: licencasAmbientais.empreendimentoId }).from(licencasAmbientais).where(sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);

        const licencaIds = licencasData.map(l => l.id);
        if (licencaIds.length === 0) return [];

        const allConds = await db.select({
          id: condicionantes.id,
          titulo: condicionantes.titulo,
          descricao: condicionantes.descricao,
          codigo: condicionantes.codigo,
          categoria: condicionantes.categoria,
          status: condicionantes.status,
          prazo: condicionantes.prazo,
          progresso: condicionantes.progresso,
          responsavelNome: condicionantes.responsavelNome,
          responsavelId: condicionantes.responsavelId,
          licencaId: condicionantes.licencaId,
        }).from(condicionantes).where(sql`${condicionantes.licencaId} IN (${sql.join(licencaIds.map(id => sql`${id}`), sql`, `)})`);

        return allConds
          .filter(c => c.status === 'vencida' || c.status === 'em_andamento')
          .map(c => {
            const lic = licencasData.find(l => l.id === c.licencaId);
            const emp = lic ? emps.find(e => e.id === lic.empreendimentoId) : null;
            const empCliente = emp?.cliente || '';
            // Determinar tipo: se responsavelNome bate com o cliente do empreendimento → empreendedor, senão → ecobrasil
            const tipoResponsavel: 'empreendedor' | 'ecobrasil' | 'sem_responsavel' =
              !c.responsavelNome ? 'sem_responsavel'
              : c.responsavelNome === empCliente ? 'empreendedor'
              : 'ecobrasil';
            return {
              ...c,
              licencaNumero: lic?.numero || '',
              empreendimentoNome: emp?.nome || '',
              empreendimentoId: lic?.empreendimentoId || null,
              empCliente,
              tipoResponsavel,
            };
          });
      };

      // Query autorizações vencidas inline — combina autorizacoes + datasets da Gestão de Dados
      const getAutorizacoesVencidas = async () => {
        const today = new Date().toISOString().split('T')[0];

        // 1) Autorizações formais
        const conditionsAut: SQL[] = [ne(autorizacoes.status, 'cancelada')];
        if (unidade) conditionsAut.push(eq(autorizacoes.unidade, unidade));
        if (empreendimentoId) conditionsAut.push(eq(autorizacoes.empreendimentoId, empreendimentoId));
        
        const allAut = await db.select({
          id: autorizacoes.id,
          numero: autorizacoes.numero,
          titulo: autorizacoes.titulo,
          tipo: autorizacoes.tipo,
          orgaoEmissor: autorizacoes.orgaoEmissor,
          dataValidade: autorizacoes.dataValidade,
          status: autorizacoes.status,
          empreendimentoId: autorizacoes.empreendimentoId,
          fonte: sql<string>`'autorizacao'`,
        }).from(autorizacoes).where(and(...conditionsAut));

        const vencidasAut = allAut.filter(a =>
          a.status === 'vencida' || (a.dataValidade && a.dataValidade < today)
        );

        // 2) Documentos da Gestão de Dados — tipos autorizativos vencidos
        // Considera vencido quando: prazoAtendimento < hoje OU dataValidade < hoje OU statusDocumental = 'vencido'
        const TIPOS_AUTORIZACAO = ['licenca', 'notificacao', 'documento_legal', 'auto_infracao'];
        const baseConditionsDs: SQL[] = [
          inArray(datasets.tipoDocumental, TIPOS_AUTORIZACAO),
        ];
        if (unidade) baseConditionsDs.push(eq(datasets.unidade, unidade));
        if (empreendimentoId) baseConditionsDs.push(eq(datasets.empreendimentoId, empreendimentoId));

        // OR: qualquer das três condições de vencimento
        const vencimentoOr = or(
          and(sql`${datasets.prazoAtendimento} IS NOT NULL`, sql`${datasets.prazoAtendimento} != ''`, sql`${datasets.prazoAtendimento} < ${today}`),
          and(sql`${datasets.dataValidade} IS NOT NULL`, sql`${datasets.dataValidade} != ''`, sql`${datasets.dataValidade} < ${today}`),
          eq(datasets.statusDocumental, 'vencido'),
        );

        const vencidasDs = await db.select({
          id: datasets.id,
          numero: datasets.numeroDocumento,
          titulo: datasets.titulo,
          tipo: datasets.tipoDocumental,
          orgaoEmissor: datasets.orgaoEmissor,
          dataValidade: datasets.dataValidade,
          prazoAtendimento: datasets.prazoAtendimento,
          status: sql<string>`'vencida'`,
          empreendimentoId: datasets.empreendimentoId,
          fonte: sql<string>`'gestao_dados'`,
          nome: datasets.nome,
          codigoArquivo: datasets.codigoArquivo,
        }).from(datasets).where(and(...baseConditionsDs, vencimentoOr!));

        // Deduplicar por ID (caso um doc atenda múltiplas condições)
        const seenIds = new Set<number>();
        const vencidasDsNorm = vencidasDs
          .filter(d => { if (seenIds.has(d.id)) return false; seenIds.add(d.id); return true; })
          .map(d => ({
            id: d.id,
            numero: d.numero || d.codigoArquivo || d.nome || `DOC-${d.id}`,
            titulo: d.titulo || d.nome || 'Documento sem título',
            tipo: d.tipo || 'documento',
            orgaoEmissor: d.orgaoEmissor,
            dataValidade: d.dataValidade || d.prazoAtendimento,
            status: 'vencida',
            empreendimentoId: d.empreendimentoId,
            fonte: 'gestao_dados' as const,
          }));

        return [...vencidasAut, ...vencidasDsNorm];
      };

      const [
        licenseStats,
        condicionanteStats,
        entregaStats,
        prazos,
        monthlyData,
        frotaStats,
        equipamentosStats,
        rhStats,
        demandasStats,
        contratosStats,
        autorizacoesVencidas,
        condicionantesAlerta
      ] = await Promise.all([
        storage.getLicenseStats(unidade, empreendimentoId).catch(() => defaultLicenseStats),
        storage.getCondicionanteStats(unidade, empreendimentoId).catch(() => defaultCondStats),
        storage.getEntregaStats(unidade, empreendimentoId).catch(() => defaultEntregaStats),
        storage.getAgendaPrazos(unidade, empreendimentoId).catch(() => []),
        storage.getMonthlyExpiryData(unidade, empreendimentoId).catch(() => []),
        storage.getFrotaStats(unidade, empreendimentoId).catch(() => defaultFrotaStats),
        storage.getEquipamentosStats(unidade, empreendimentoId).catch(() => defaultEquipStats),
        storage.getRhStats(unidade, empreendimentoId).catch(() => defaultRhStats),
        storage.getDemandasStats(unidade, empreendimentoId).catch(() => defaultDemandasStats),
        storage.getContratosStats(unidade, empreendimentoId).catch(() => defaultContratosStats),
        getAutorizacoesVencidas().catch(() => []),
        getCondicionantesAlerta().catch(() => [])
      ]);

      res.json({
        licenses: licenseStats || defaultLicenseStats,
        condicionantes: condicionanteStats || defaultCondStats,
        entregas: entregaStats || defaultEntregaStats,
        agenda: prazos || [],
        monthlyExpiry: monthlyData || [],
        frota: frotaStats || defaultFrotaStats,
        equipamentos: equipamentosStats || defaultEquipStats,
        rh: rhStats || defaultRhStats,
        demandas: demandasStats || defaultDemandasStats,
        contratos: contratosStats || defaultContratosStats,
        autorizacoesVencidas: autorizacoesVencidas || [],
        condicionantesAlerta: condicionantesAlerta || []
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard Executivo - Consolidated stats from all units
  app.get("/api/dashboard/executivo", requireAuth, async (req, res) => {
    try {
      const cacheKey = "executivo_stats";
      const cached = dashboardCache.get(cacheKey);
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        return res.json(cached);
      }

      const unidades = [
        { id: 'goiania', nome: 'Goiânia' },
        { id: 'salvador', nome: 'Salvador' },
        { id: 'luiz-eduardo-magalhaes', nome: 'Luiz Eduardo Magalhães' },
      ];

      const results = await Promise.all(
        unidades.map(async (unidadeItem) => {
          const empreendimentosData = await storage.getEmpreendimentos(unidadeItem.id);
          const empreendimentosAtivos = empreendimentosData.filter(e => e.status === 'planejamento' || e.status === 'em_andamento');
          const empreendimentosConcluidos = empreendimentosData.filter(e => e.status === 'concluido');
          
          const [frota, equipamentos, rh, demandas, contratos] = await Promise.all([
            storage.getFrotaStats(unidadeItem.id),
            storage.getEquipamentosStats(unidadeItem.id),
            storage.getRhStats(unidadeItem.id),
            storage.getDemandasStats(unidadeItem.id),
            storage.getContratosStats(unidadeItem.id),
          ]);

          return {
            unidade: unidadeItem.nome,
            empreendimentos: {
              total: empreendimentosData.length,
              ativos: empreendimentosAtivos.length,
              concluidos: empreendimentosConcluidos.length,
            },
            frota,
            equipamentos,
            rh,
            demandas,
            contratos,
          };
        })
      );

      dashboardCache.set(cacheKey, results);
      res.setHeader("X-Cache", "MISS");
      res.json(results);
    } catch (error) {
      console.error("Error fetching executive dashboard stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced Stats routes
  app.get("/api/stats/licenses", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const stats = await storage.getLicenseStats(userUnidade, empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error("Get license stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced Stats routes with empreendimento filter
  app.get("/api/stats/licenses/:empreendimentoId", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const stats = await storage.getLicenseStats(userUnidade, empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error("Get license stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/condicionantes", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const stats = await storage.getCondicionanteStats(userUnidade);
      res.json(stats);
    } catch (error) {
      console.error("Get condicionante stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/entregas", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const stats = await storage.getEntregaStats(userUnidade);
      res.json(stats);
    } catch (error) {
      console.error("Get entrega stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/entregas/mes", requireAuth, async (req, res) => {
    try {
      const entregas = await storage.getEntregasDoMes();
      res.json(entregas);
    } catch (error) {
      console.error("Get entregas do mês error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/agenda/prazos", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const agenda = await storage.getAgendaPrazos(userUnidade);
      res.json(agenda);
    } catch (error) {
      console.error("Get agenda prazos error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/expiry-monthly", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const monthlyData = await storage.getMonthlyExpiryData(userUnidade, empreendimentoId);
      res.json(monthlyData);
    } catch (error) {
      console.error("Get monthly expiry data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/expiry-monthly/:empreendimentoId", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const monthlyData = await storage.getMonthlyExpiryData(userUnidade, empreendimentoId);
      res.json(monthlyData);
    } catch (error) {
      console.error("Get monthly expiry data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Alert routes
  app.get("/api/alerts/configs", requireAuth, async (req, res) => {
    try {
      const configs = await storage.getAlertConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Get alert configs error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/alerts/configs/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const { enviarEmail, enviarWhatsapp, ativo } = req.body;
      
      const updates: any = {};
      if (typeof enviarEmail === 'boolean') updates.enviarEmail = enviarEmail;
      if (typeof enviarWhatsapp === 'boolean') updates.enviarWhatsapp = enviarWhatsapp;
      if (typeof ativo === 'boolean') updates.ativo = ativo;

      const updatedConfig = await storage.updateAlertConfig(id, updates);
      res.json(updatedConfig);
    } catch (error) {
      console.error("Update alert config error:", error);
      res.status(500).json({ message: "Erro ao atualizar configuração" });
    }
  });

  app.post("/api/alerts/test", requireAuth, async (req, res) => {
    try {
      console.log('Executando teste de alertas...');
      const result = await alertService.testAlerts();
      
      if (result.success) {
        res.json({ message: result.message });
      } else {
        res.status(500).json({ message: result.message });
      }
    } catch (error) {
      console.error("Test alerts error:", error);
      res.status(500).json({ message: "Erro ao executar teste de alertas" });
    }
  });

  // Export routes
  app.get("/api/export/empreendimentos", requireAuth, async (req, res) => {
    try {
      const format = req.query.format as 'csv' | 'excel' || 'excel';
      const filepath = await exportService.exportEmpreendimentos(format);
      const filename = `empreendimentos.${format === 'csv' ? 'csv' : 'xlsx'}`;
      await exportService.sendFileDownload(res, filepath, filename);
    } catch (error) {
      console.error("Export empreendimentos error:", error);
      res.status(500).json({ message: "Erro ao exportar empreendimentos" });
    }
  });

  app.get("/api/export/licencas", requireAuth, async (req, res) => {
    try {
      const format = req.query.format as 'csv' | 'excel' || 'excel';
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const filepath = await exportService.exportLicencas(format, empreendimentoId);
      const filename = `licencas${empreendimentoId ? `_empreendimento_${empreendimentoId}` : ''}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      await exportService.sendFileDownload(res, filepath, filename);
    } catch (error) {
      console.error("Export licencas error:", error);
      res.status(500).json({ message: "Erro ao exportar licenças" });
    }
  });

  app.get("/api/export/condicionantes", requireAuth, async (req, res) => {
    try {
      const format = req.query.format as 'csv' | 'excel' || 'excel';
      const licencaId = req.query.licencaId ? parseInt(req.query.licencaId as string) : undefined;
      const filepath = await exportService.exportCondicionantes(format, licencaId);
      const filename = `condicionantes${licencaId ? `_licenca_${licencaId}` : ''}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      await exportService.sendFileDownload(res, filepath, filename);
    } catch (error) {
      console.error("Export condicionantes error:", error);
      res.status(500).json({ message: "Erro ao exportar condicionantes" });
    }
  });

  app.get("/api/export/entregas", requireAuth, async (req, res) => {
    try {
      const format = req.query.format as 'csv' | 'excel' || 'excel';
      const licencaId = req.query.licencaId ? parseInt(req.query.licencaId as string) : undefined;
      const filepath = await exportService.exportEntregas(format, licencaId);
      const filename = `entregas${licencaId ? `_licenca_${licencaId}` : ''}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      await exportService.sendFileDownload(res, filepath, filename);
    } catch (error) {
      console.error("Export entregas error:", error);
      res.status(500).json({ message: "Erro ao exportar entregas" });
    }
  });

  app.get("/api/export/relatorio-completo", requireAuth, async (req, res) => {
    try {
      const format = req.query.format as 'csv' | 'excel' || 'excel';
      const filepath = await exportService.exportRelatorioCompleto(format);
      const filename = `relatorio_completo.${format === 'csv' ? 'csv' : 'xlsx'}`;
      await exportService.sendFileDownload(res, filepath, filename);
    } catch (error) {
      console.error("Export relatorio completo error:", error);
      res.status(500).json({ message: "Erro ao exportar relatório completo" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(id);
      res.json(notification);
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsAsRead();
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications", requireAuth, async (req, res) => {
    try {
      const data = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(data);
      res.status(201).json(notification);
    } catch (error) {
      console.error("Create notification error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Endpoint de teste para criar notificação
  app.post("/api/notifications/test", requireAuth, async (req, res) => {
    try {
      await notificationService.createTestNotification();
      res.json({ message: "Notificação de teste criada com sucesso!" });
    } catch (error) {
      console.error("Test notification error:", error);
      res.status(500).json({ message: "Erro ao criar notificação de teste" });
    }
  });

  // Endpoint para limpar notificações duplicadas
  app.post("/api/notifications/cleanup-duplicates", requireAuth, async (req, res) => {
    try {
      const count = await notificationService.cleanupDuplicateNotifications();
      res.json({ message: `${count} notificações duplicadas removidas`, count });
    } catch (error) {
      console.error("Cleanup duplicates error:", error);
      res.status(500).json({ message: "Erro ao limpar notificações duplicadas" });
    }
  });

  // Endpoint para limpar todas as notificações pendentes (reset)
  app.post("/api/notifications/clear-all", requireAuth, async (req, res) => {
    try {
      const count = await notificationService.clearAllPendingNotifications();
      res.json({ message: "Todas as notificações pendentes foram limpas", count });
    } catch (error) {
      console.error("Clear all notifications error:", error);
      res.status(500).json({ message: "Erro ao limpar notificações" });
    }
  });

  app.get("/api/entregas/mes", requireAuth, async (req, res) => {
    try {
      const entregas = await storage.getEntregasDoMes();
      res.json(entregas);
    } catch (error) {
      console.error("Get entregas do mês error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // File upload routes
  app.post("/api/upload/pdf", requireAuth, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const { uploadUrl, filePath } = await objectStorageService.getPdfUploadURL();
      res.json({ method: "PUT", url: uploadUrl, filePath });
    } catch (error) {
      console.error("Get PDF upload URL error:", error);
      res.status(500).json({ message: "Erro ao obter URL de upload" });
    }
  });

  // Server-side PDF upload (multer → Object Storage) — used by licencas, autorizacoes, etc.
  app.post("/api/upload/pdf/server", requireAuth, async (req, res) => {
    try {
      const { objectStorageClient, ObjectStorageService } = await import("../replit_integrations/object_storage/objectStorage");
      const multer = (await import('multer')).default;
      const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req as any, res as any, (err: any) => {
          if (err) reject(err); else resolve();
        });
      });
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      const objStorage = new ObjectStorageService();
      const privateDir = objStorage.getPrivateObjectDir();
      if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

      const { randomUUID } = await import('crypto');
      const objectId = randomUUID();
      const objectPath = `${privateDir}/pdfs/${objectId}.pdf`;
      const pathParts = objectPath.split("/").filter((p) => p.length > 0);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);
      await gcsFile.save(file.buffer, { contentType: 'application/pdf' });

      res.json({ filePath: `/files/pdfs/${objectId}.pdf` });
    } catch (error) {
      console.error("Server-side PDF upload error:", error);
      res.status(500).json({ message: "Erro ao fazer upload do arquivo" });
    }
  });


  // Server-side image upload (for empreendimento logos, etc.)
  app.post("/api/upload/image/server", requireAuth, async (req, res) => {
    try {
      const { objectStorageClient, ObjectStorageService } = await import("../replit_integrations/object_storage/objectStorage");
      const multer = (await import('multer')).default;
      const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
      await new Promise<void>((resolve, reject) => {
        upload.single('file')(req as any, res as any, (err: any) => {
          if (err) reject(err); else resolve();
        });
      });
      const file = (req as any).file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.mimetype)) {
        return res.status(400).json({ message: "Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF." });
      }

      const objStorage = new ObjectStorageService();
      const privateDir = objStorage.getPrivateObjectDir();
      if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

      const { randomUUID } = await import('crypto');
      const objectId = randomUUID();
      const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
      const objectPath = `${privateDir}/logos/${objectId}.${ext}`;
      const pathParts = objectPath.split("/").filter((p: string) => p.length > 0);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);
      await gcsFile.save(file.buffer, { contentType: file.mimetype });

      res.json({ filePath: `/files/logos/${objectId}.${ext}` });
    } catch (error) {
      console.error("Server-side image upload error:", error);
      res.status(500).json({ message: "Erro ao fazer upload da imagem" });
    }
  });

  // Serve uploaded files
  app.get("/files/:filePath(*)", requireAuth, async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const fullObjectPath = objectStorageService.getFullObjectPath(req.path);
      await objectStorageService.downloadFile(fullObjectPath, res);
    } catch (error: any) {
      console.error("Download file error:", error);
      const { ObjectNotFoundError } = await import("../objectStorage");
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }
      return res.status(500).json({ message: "Erro ao baixar arquivo" });
    }
  });

  // Serve newsletter images publicly (for email clients) - armazenamento local
  app.get("/newsletter-images/:filePath(*)", async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const fileName = req.params.filePath;
      const newsletterDir = path.default.join(process.cwd(), 'uploads', 'newsletter-destaques');
      const filePath = path.default.join(newsletterDir, fileName);
      
      console.log('[Newsletter Images] Buscando imagem:', filePath);
      
      if (!fs.default.existsSync(filePath)) {
        console.error('[Newsletter Images] Imagem não encontrada:', filePath);
        return res.status(404).json({ message: "Imagem não encontrada" });
      }
      
      const ext = path.default.extname(fileName).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(fs.default.readFileSync(filePath));
    } catch (error: any) {
      console.error("Newsletter image download error:", error);
      return res.status(500).json({ message: "Erro ao carregar imagem" });
    }
  });







}
