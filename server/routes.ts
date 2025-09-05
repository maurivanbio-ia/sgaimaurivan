import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEmpreendimentoSchema, 
  insertLicencaAmbientalSchema,
  insertCondicionanteSchema,
  insertEntregaSchema,
  insertNotificationSchema
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import bcrypt from "bcrypt";
import { cronService } from "./cronService";
import { exportService } from "./exportService";
import { alertService } from "./alertService";
import { notificationService } from "./notificationService";

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Session configuration
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'licenca-facil-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  }));

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Initialize seed user
  const initSeedUser = async () => {
    const existingUser = await storage.getUserByEmail("ecobrasil@ecobrasil.bio.br");
    if (!existingUser) {
      await storage.createUser({
        email: "ecobrasil@ecobrasil.bio.br",
        passwordHash: "123456",
      });
      console.log("Seed user created: ecobrasil@ecobrasil.bio.br");
    }
  };

  // Initialize on startup
  await initSeedUser();
  
  // Initialize alert service
  console.log('Inicializando serviço de alertas automáticos...');
  cronService.start();

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      const isValidPassword = await storage.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      req.session.userId = user.id;
      res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, email: user.email });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Empreendimento routes
  app.get("/api/empreendimentos", requireAuth, async (req, res) => {
    try {
      const empreendimentos = await storage.getEmpreendimentos();
      res.json(empreendimentos);
    } catch (error) {
      console.error("Get empreendimentos error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/empreendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const empreendimento = await storage.getEmpreendimento(id);
      if (!empreendimento) {
        return res.status(404).json({ message: "Empreendimento not found" });
      }
      res.json(empreendimento);
    } catch (error) {
      console.error("Get empreendimento error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/empreendimentos", requireAuth, async (req, res) => {
    try {
      const data = insertEmpreendimentoSchema.parse({
        ...req.body,
        criadoPor: req.session.userId,
      });
      const empreendimento = await storage.createEmpreendimento(data);
      res.status(201).json(empreendimento);
    } catch (error) {
      console.error("Create empreendimento error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/empreendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertEmpreendimentoSchema.partial().parse(req.body);
      const empreendimento = await storage.updateEmpreendimento(id, data);
      res.json(empreendimento);
    } catch (error) {
      console.error("Update empreendimento error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.delete("/api/empreendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEmpreendimento(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete empreendimento error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  app.get("/api/licencas/calendar", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate e endDate são obrigatórios" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Datas inválidas" });
      }

      const licencas = await storage.getLicencasByDateRange(start, end);
      res.json(licencas);
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

  app.post("/api/licencas", requireAuth, async (req, res) => {
    try {
      const data = insertLicencaAmbientalSchema.parse(req.body);
      const licenca = await storage.createLicenca(data);
      res.status(201).json(licenca);
    } catch (error) {
      console.error("Create licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.put("/api/licencas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertLicencaAmbientalSchema.partial().parse(req.body);
      const licenca = await storage.updateLicenca(id, data);
      res.json(licenca);
    } catch (error) {
      console.error("Update licenca error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.delete("/api/licencas/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLicenca(id);
      res.status(204).send();
    } catch (error) {
      console.error("Delete licenca error:", error);
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
      const condicionantes = await storage.getCondicionantesByStatus('pendente');
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

  app.post("/api/condicionantes", requireAuth, async (req, res) => {
    try {
      const data = insertCondicionanteSchema.parse(req.body);
      const condicionante = await storage.createCondicionante(data);
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
      const condicionante = await storage.updateCondicionante(id, data);
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
      res.status(204).send();
    } catch (error) {
      console.error("Delete condicionante error:", error);
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

  // Enhanced Stats routes
  app.get("/api/stats/licenses", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getLicenseStats();
      res.json(stats);
    } catch (error) {
      console.error("Get license stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/condicionantes", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getCondicionanteStats();
      res.json(stats);
    } catch (error) {
      console.error("Get condicionante stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/entregas", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getEntregaStats();
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
      const agenda = await storage.getAgendaPrazos();
      res.json(agenda);
    } catch (error) {
      console.error("Get agenda prazos error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/expiry-monthly", requireAuth, async (req, res) => {
    try {
      const monthlyData = await storage.getMonthlyExpiryData();
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
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const { uploadUrl, filePath } = await objectStorageService.getPdfUploadURL();
      res.json({ method: "PUT", url: uploadUrl, filePath });
    } catch (error) {
      console.error("Get PDF upload URL error:", error);
      res.status(500).json({ message: "Erro ao obter URL de upload" });
    }
  });


  // Serve uploaded files
  app.get("/files/:filePath(*)", requireAuth, async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const fullObjectPath = objectStorageService.getFullObjectPath(req.path);
      await objectStorageService.downloadFile(fullObjectPath, res);
    } catch (error: any) {
      console.error("Download file error:", error);
      const { ObjectNotFoundError } = await import("./objectStorage");
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }
      return res.status(500).json({ message: "Erro ao baixar arquivo" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
