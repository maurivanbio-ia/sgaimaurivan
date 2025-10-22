import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEmpreendimentoSchema, 
  insertLicencaAmbientalSchema,
  insertCondicionanteSchema,
  insertEntregaSchema,
  insertNotificationSchema,
  insertEquipamentoSchema,
} from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
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

// Register schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
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

  // Admin authorization middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Acesso negado. Apenas administradores podem realizar esta ação." });
    }
    
    next();
  };

  // Initialize seed user
  const initSeedUser = async () => {
    const adminEmail = "maurivan@ecobrasil.bio.br";
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    if (!existingAdmin) {
      await storage.createUser({
        email: adminEmail,
        passwordHash: "bor192023", // createUser will hash this
        role: "admin",
      });
      console.log("Admin user created: maurivan@ecobrasil.bio.br");
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
      res.json({ message: "Login successful", user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este e-mail já está cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        email,
        passwordHash: hashedPassword,
        role: "colaborador",
      });

      req.session.userId = newUser.id;
      res.json({ message: "Registro bem-sucedido", user: { id: newUser.id, email: newUser.email, role: newUser.role } });
    } catch (error) {
      console.error("Register error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao criar conta" });
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
      res.json({ id: user.id, email: user.email, role: user.role });
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

  app.post("/api/licencas/:licencaId/condicionantes", requireAuth, async (req, res) => {
    try {
      const licencaId = parseInt(req.params.licencaId);
      const data = insertCondicionanteSchema.parse({ ...req.body, licencaId });
      const condicionante = await storage.createCondicionante(data);
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

  // Enhanced Stats routes
  app.get("/api/stats/licenses", requireAuth, async (req, res) => {
    try {
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const stats = await storage.getLicenseStats(empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error("Get license stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Enhanced Stats routes with empreendimento filter
  app.get("/api/stats/licenses/:empreendimentoId", requireAuth, async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const stats = await storage.getLicenseStats(empreendimentoId);
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
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const monthlyData = await storage.getMonthlyExpiryData(empreendimentoId);
      res.json(monthlyData);
    } catch (error) {
      console.error("Get monthly expiry data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/stats/expiry-monthly/:empreendimentoId", requireAuth, async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const monthlyData = await storage.getMonthlyExpiryData(empreendimentoId);
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







  // ==== DEMANDAS ROUTES ====

  // Get all demandas with filters
  app.get('/api/demandas', async (req, res) => {
    try {
      const filters = {
        setor: req.query.setor as string,
        responsavel: req.query.responsavel as string,
        empreendimento: req.query.empreendimento as string,
        prioridade: req.query.prioridade as string,
        status: req.query.status as string,
        search: req.query.search as string,
      };
      
      // Clean undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });
      
      const demandas = await storage.getDemandas(filters);
      res.json(demandas);
    } catch (error) {
      console.error('Error fetching demandas:', error);
      res.status(500).json({ error: 'Failed to fetch demandas' });
    }
  });

  // Get demandas statistics for dashboard
  app.get('/api/demandas/dashboard/stats', async (req, res) => {
    try {
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const stats = await storage.getDemandasStats(empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching demandas stats:', error);
      res.status(500).json({ error: 'Failed to fetch demandas statistics' });
    }
  });

  app.get('/api/demandas/dashboard/stats/:empreendimentoId', async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const stats = await storage.getDemandasStats(empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching demandas stats:', error);
      res.status(500).json({ error: 'Failed to fetch demandas statistics' });
    }
  });

  // Get demandas chart data for dashboard
  app.get('/api/demandas/dashboard/charts', async (req, res) => {
    try {
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const chartData = await storage.getDemandasChartData(empreendimentoId);
      res.json(chartData);
    } catch (error) {
      console.error('Error fetching demandas charts:', error);
      res.status(500).json({ error: 'Failed to fetch demandas chart data' });
    }
  });

  app.get('/api/demandas/dashboard/charts/:empreendimentoId', async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const chartData = await storage.getDemandasChartData(empreendimentoId);
      res.json(chartData);
    } catch (error) {
      console.error('Error fetching demandas charts:', error);
      res.status(500).json({ error: 'Failed to fetch demandas chart data' });
    }
  });

  // Create new demanda
  app.post('/api/demandas', async (req, res) => {
    try {
      const demanda = await storage.createDemanda(req.body);
      res.status(201).json(demanda);
    } catch (error) {
      console.error('Error creating demanda:', error);
      res.status(500).json({ error: 'Failed to create demanda' });
    }
  });

  // Update demanda
  app.patch('/api/demandas/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid demanda ID' });
      }
      
      // Get current demanda to track status change
      const currentDemanda = await storage.getDemandaById(id);
      if (!currentDemanda) {
        return res.status(404).json({ error: 'Demanda not found' });
      }

      const demanda = await storage.updateDemanda(id, req.body);
      if (!demanda) {
        return res.status(404).json({ error: 'Demanda not found' });
      }

      // Create history record if status changed
      if (req.body.status && req.body.status !== currentDemanda.status) {
        const user = req.user as { id: number } | undefined;
        if (user) {
          await storage.createHistoricoMovimentacao({
            demandaId: id,
            usuarioId: user.id,
            acao: 'moveu',
            statusAnterior: currentDemanda.status || null,
            statusNovo: req.body.status,
            descricao: `Status alterado de ${currentDemanda.status} para ${req.body.status}`,
          });
        }
      }
      
      res.json(demanda);
    } catch (error) {
      console.error('Error updating demanda:', error);
      res.status(500).json({ error: 'Failed to update demanda' });
    }
  });

  // Delete demanda
  app.delete('/api/demandas/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid demanda ID' });
      }

      const success = await storage.deleteDemanda(id);
      if (!success) {
        return res.status(404).json({ error: 'Demanda not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting demanda:', error);
      res.status(500).json({ error: 'Failed to delete demanda' });
    }
  });

  // Get all historical movements
  app.get('/api/demandas/historico/all', async (req, res) => {
    try {
      const historico = await storage.getAllHistorico();
      res.json(historico);
    } catch (error) {
      console.error('Error fetching historico:', error);
      res.status(500).json({ error: 'Failed to fetch historico' });
    }
  });

  // Get historical movements for a specific demanda
  app.get('/api/demandas/:id/historico', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid demanda ID' });
      }

      const historico = await storage.getHistoricoByDemanda(id);
      res.json(historico);
    } catch (error) {
      console.error('Error fetching historico:', error);
      res.status(500).json({ error: 'Failed to fetch historico' });
    }
  });

  // ==== END DEMANDAS ROUTES ====

  // =============================================
  // FINANCIAL MODULE ROUTES
  // =============================================

  // Categorias Financeiras routes
  app.get('/api/categorias-financeiras', async (req, res) => {
    try {
      const categorias = await storage.getCategorias();
      res.json(categorias);
    } catch (error) {
      console.error('Error fetching categorias:', error);
      res.status(500).json({ error: 'Failed to fetch categorias' });
    }
  });

  app.post('/api/categorias-financeiras', async (req, res) => {
    try {
      const categoria = await storage.createCategoria(req.body);
      res.status(201).json(categoria);
    } catch (error) {
      console.error('Error creating categoria:', error);
      res.status(500).json({ error: 'Failed to create categoria' });
    }
  });

  app.put('/api/categorias-financeiras/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid categoria ID' });
      }
      const categoria = await storage.updateCategoria(id, req.body);
      res.json(categoria);
    } catch (error) {
      console.error('Error updating categoria:', error);
      res.status(500).json({ error: 'Failed to update categoria' });
    }
  });

  app.delete('/api/categorias-financeiras/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid categoria ID' });
      }
      const deleted = await storage.deleteCategoria(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Categoria not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting categoria:', error);
      res.status(500).json({ error: 'Failed to delete categoria' });
    }
  });

  // Lançamentos Financeiros routes
  app.get('/api/financeiro/lancamentos', async (req, res) => {
    try {
      const filters = {
        tipo: req.query.tipo as string,
        status: req.query.status as string,
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
        categoriaId: req.query.categoriaId ? parseInt(req.query.categoriaId as string) : undefined,
        search: req.query.search as string,
      };
      const lancamentos = await storage.getLancamentos(filters);
      res.json(lancamentos);
    } catch (error) {
      console.error('Error fetching lancamentos:', error);
      res.status(500).json({ error: 'Failed to fetch lancamentos' });
    }
  });

  app.post('/api/financeiro/lancamentos', async (req, res) => {
    try {
      // Add created by user info to the request
      const lancamentoData = {
        ...req.body,
        criadoPor: req.session?.userId || 1, // Default to user ID 1 for now
      };
      const lancamento = await storage.createLancamento(lancamentoData);
      res.status(201).json(lancamento);
    } catch (error) {
      console.error('Error creating lancamento:', error);
      res.status(500).json({ error: 'Failed to create lancamento' });
    }
  });

  app.put('/api/financeiro/lancamentos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid lancamento ID' });
      }
      const lancamento = await storage.updateLancamento(id, req.body);
      res.json(lancamento);
    } catch (error) {
      console.error('Error updating lancamento:', error);
      res.status(500).json({ error: 'Failed to update lancamento' });
    }
  });

  app.delete('/api/financeiro/lancamentos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid lancamento ID' });
      }
      const deleted = await storage.deleteLancamento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Lancamento not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting lancamento:', error);
      res.status(500).json({ error: 'Failed to delete lancamento' });
    }
  });

  // Solicitações de Recursos routes
  app.get('/api/solicitacoes-recursos', async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string,
        solicitanteId: req.query.solicitanteId ? parseInt(req.query.solicitanteId as string) : undefined,
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
      };
      const solicitacoes = await storage.getSolicitacoes(filters);
      res.json(solicitacoes);
    } catch (error) {
      console.error('Error fetching solicitacoes:', error);
      res.status(500).json({ error: 'Failed to fetch solicitacoes' });
    }
  });

  app.post('/api/solicitacoes-recursos', async (req, res) => {
    try {
      const solicitacaoData = {
        ...req.body,
        solicitanteId: req.session?.userId || 1, // Default to user ID 1 for now
      };
      const solicitacao = await storage.createSolicitacao(solicitacaoData);
      res.status(201).json(solicitacao);
    } catch (error) {
      console.error('Error creating solicitacao:', error);
      res.status(500).json({ error: 'Failed to create solicitacao' });
    }
  });

  app.put('/api/solicitacoes-recursos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid solicitacao ID' });
      }
      const solicitacao = await storage.updateSolicitacao(id, req.body);
      res.json(solicitacao);
    } catch (error) {
      console.error('Error updating solicitacao:', error);
      res.status(500).json({ error: 'Failed to update solicitacao' });
    }
  });

  app.delete('/api/solicitacoes-recursos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid solicitacao ID' });
      }
      const deleted = await storage.deleteSolicitacao(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Solicitacao not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting solicitacao:', error);
      res.status(500).json({ error: 'Failed to delete solicitacao' });
    }
  });

  // Orçamentos routes
  app.get('/api/orcamentos', async (req, res) => {
    try {
      const filters = {
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
        periodo: req.query.periodo as string,
      };
      const orcamentos = await storage.getOrcamentos(filters);
      res.json(orcamentos);
    } catch (error) {
      console.error('Error fetching orcamentos:', error);
      res.status(500).json({ error: 'Failed to fetch orcamentos' });
    }
  });

  app.post('/api/orcamentos', async (req, res) => {
    try {
      const orcamentoData = {
        ...req.body,
        criadoPor: req.session?.userId || 1, // Default to user ID 1 for now
      };
      const orcamento = await storage.createOrcamento(orcamentoData);
      res.status(201).json(orcamento);
    } catch (error) {
      console.error('Error creating orcamento:', error);
      res.status(500).json({ error: 'Failed to create orcamento' });
    }
  });

  app.put('/api/orcamentos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid orcamento ID' });
      }
      const orcamento = await storage.updateOrcamento(id, req.body);
      res.json(orcamento);
    } catch (error) {
      console.error('Error updating orcamento:', error);
      res.status(500).json({ error: 'Failed to update orcamento' });
    }
  });

  app.delete('/api/orcamentos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid orcamento ID' });
      }
      const deleted = await storage.deleteOrcamento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Orcamento not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting orcamento:', error);
      res.status(500).json({ error: 'Failed to delete orcamento' });
    }
  });

  // Financial Statistics route
  app.get('/api/financeiro/stats', async (req, res) => {
    try {
      const stats = await storage.getFinancialStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching financial stats:', error);
      res.status(500).json({ error: 'Failed to fetch financial stats' });
    }
  });

  // ==== END FINANCIAL ROUTES ====

  // ==== EQUIPMENT ROUTES ====

  // Get all equipamentos with optional filters
  app.get('/api/equipamentos', requireAuth, async (req, res) => {
    try {
      const { tipo, status, search, localizacaoAtual, empreendimentoId } = req.query;
      const filters: any = {};

      if (tipo) filters.tipo = String(tipo);
      if (status) filters.status = String(status);
      if (search) filters.search = String(search);
      if (localizacaoAtual) filters.localizacaoAtual = String(localizacaoAtual);
      if (empreendimentoId) filters.empreendimentoId = parseInt(String(empreendimentoId));

      const equipamentos = await storage.getEquipamentos(filters);
      res.json(equipamentos);
    } catch (error) {
      console.error('Error fetching equipamentos:', error);
      res.status(500).json({ error: 'Failed to fetch equipamentos' });
    }
  });

  // Get equipamentos stats
  app.get('/api/equipamentos/stats', requireAuth, async (req, res) => {
    try {
      const { empreendimentoId } = req.query;
      const stats = await storage.getEquipamentosStats(
        empreendimentoId ? parseInt(String(empreendimentoId)) : undefined
      );
      res.json(stats);
    } catch (error) {
      console.error('Error fetching equipamentos stats:', error);
      res.status(500).json({ error: 'Failed to fetch equipamentos stats' });
    }
  });

  // Get single equipamento
  app.get('/api/equipamentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }
      res.json(equipamento);
    } catch (error) {
      console.error('Error fetching equipamento:', error);
      res.status(500).json({ error: 'Failed to fetch equipamento' });
    }
  });

  // Create equipamento
  app.post('/api/equipamentos', requireAuth, async (req, res) => {
    try {
      const validatedData = insertEquipamentoSchema.parse({
        ...req.body,
        criadoPor: req.session.userId,
      });
      const equipamento = await storage.createEquipamento(validatedData);
      res.status(201).json(equipamento);
    } catch (error) {
      console.error('Error creating equipamento:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create equipamento' });
    }
  });

  // Update equipamento
  app.put('/api/equipamentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      const equipamento = await storage.updateEquipamento(id, req.body);
      res.json(equipamento);
    } catch (error) {
      console.error('Error updating equipamento:', error);
      res.status(500).json({ error: 'Failed to update equipamento' });
    }
  });

  // Delete equipamento
  app.delete('/api/equipamentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      const deleted = await storage.deleteEquipamento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting equipamento:', error);
      res.status(500).json({ error: 'Failed to delete equipamento' });
    }
  });

  // ==== END EQUIPMENT ROUTES ====

  // =============================================
  // FLEET MODULE - GESTÃO DE FROTA (VEÍCULOS)
  // =============================================

  // Get all veículos with optional filters
  app.get('/api/frota', requireAuth, async (req, res) => {
    try {
      const { tipo, status, combustivel, search } = req.query;
      const filters: any = {};

      if (tipo) filters.tipo = String(tipo);
      if (status) filters.status = String(status);
      if (combustivel) filters.combustivel = String(combustivel);
      if (search) filters.search = String(search);

      const veiculos = await storage.getVeiculos(filters);
      res.json(veiculos);
    } catch (error) {
      console.error('Error fetching veiculos:', error);
      res.status(500).json({ error: 'Failed to fetch veiculos' });
    }
  });

  // Get veículos stats
  app.get('/api/frota/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getVeiculosStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching veiculos stats:', error);
      res.status(500).json({ error: 'Failed to fetch veiculos stats' });
    }
  });

  // Get single veículo
  app.get('/api/frota/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      const veiculo = await storage.getVeiculoById(id);
      if (!veiculo) {
        return res.status(404).json({ error: 'Veiculo not found' });
      }
      res.json(veiculo);
    } catch (error) {
      console.error('Error fetching veiculo:', error);
      res.status(500).json({ error: 'Failed to fetch veiculo' });
    }
  });

  // Create veículo
  app.post('/api/frota', requireAuth, async (req, res) => {
    try {
      const validatedData = {
        ...req.body,
        criadoPor: req.session.userId,
      };
      const veiculo = await storage.createVeiculo(validatedData);
      res.status(201).json(veiculo);
    } catch (error) {
      console.error('Error creating veiculo:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create veiculo' });
    }
  });

  // Update veículo
  app.put('/api/frota/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      const veiculo = await storage.updateVeiculo(id, req.body);
      res.json(veiculo);
    } catch (error) {
      console.error('Error updating veiculo:', error);
      res.status(500).json({ error: 'Failed to update veiculo' });
    }
  });

  // Delete veículo
  app.delete('/api/frota/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      const deleted = await storage.deleteVeiculo(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Veiculo not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting veiculo:', error);
      res.status(500).json({ error: 'Failed to delete veiculo' });
    }
  });

  // ==== END FLEET ROUTES ====

  // =============================================
  // DATASETS MODULE - GESTÃO DE DADOS
  // =============================================

  // Get all datasets with optional filters
  app.get('/api/datasets', requireAuth, async (req, res) => {
    try {
      const { empreendimentoId, tipo } = req.query;
      
      const filters: any = {};
      if (empreendimentoId) filters.empreendimentoId = parseInt(empreendimentoId as string);
      if (tipo) filters.tipo = tipo as string;

      const datasets = await storage.getDatasets(filters);
      res.json(datasets);
    } catch (error) {
      console.error('Error fetching datasets:', error);
      res.status(500).json({ error: 'Failed to fetch datasets' });
    }
  });

  // Get single dataset
  app.get('/api/datasets/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid dataset ID' });
      }

      const dataset = await storage.getDatasetById(id);
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      res.json(dataset);
    } catch (error) {
      console.error('Error fetching dataset:', error);
      res.status(500).json({ error: 'Failed to fetch dataset' });
    }
  });

  // Create dataset
  app.post('/api/datasets', requireAuth, async (req, res) => {
    try {
      const dataset = await storage.createDataset(req.body);
      res.status(201).json(dataset);
    } catch (error) {
      console.error('Error creating dataset:', error);
      res.status(500).json({ error: 'Failed to create dataset' });
    }
  });

  // Delete dataset
  app.delete('/api/datasets/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid dataset ID' });
      }

      const deleted = await storage.deleteDataset(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting dataset:', error);
      res.status(500).json({ error: 'Failed to delete dataset' });
    }
  });

  // ==== END DATASETS ROUTES ====

  // =============================================
  // SEGURANÇA DO TRABALHO MODULE
  // =============================================

  // Get all colaboradores with optional filters
  app.get('/api/colaboradores', requireAuth, async (req, res) => {
    try {
      const { empreendimentoId, status, search } = req.query;
      
      const filters: any = {};
      if (empreendimentoId) filters.empreendimentoId = parseInt(empreendimentoId as string);
      if (status) filters.status = status as string;
      if (search) filters.search = search as string;

      const colaboradores = await storage.getColaboradores(filters);
      res.json(colaboradores);
    } catch (error) {
      console.error('Error fetching colaboradores:', error);
      res.status(500).json({ error: 'Failed to fetch colaboradores' });
    }
  });

  // Get single colaborador
  app.get('/api/colaboradores/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid colaborador ID' });
      }

      const colaborador = await storage.getColaboradorById(id);
      if (!colaborador) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json(colaborador);
    } catch (error) {
      console.error('Error fetching colaborador:', error);
      res.status(500).json({ error: 'Failed to fetch colaborador' });
    }
  });

  // Create colaborador
  app.post('/api/colaboradores', requireAuth, async (req, res) => {
    try {
      const colaborador = await storage.createColaborador(req.body);
      res.status(201).json(colaborador);
    } catch (error) {
      console.error('Error creating colaborador:', error);
      res.status(500).json({ error: 'Failed to create colaborador' });
    }
  });

  // Update colaborador
  app.patch('/api/colaboradores/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid colaborador ID' });
      }

      const colaborador = await storage.updateColaborador(id, req.body);
      res.json(colaborador);
    } catch (error) {
      console.error('Error updating colaborador:', error);
      res.status(500).json({ error: 'Failed to update colaborador' });
    }
  });

  // Delete colaborador
  app.delete('/api/colaboradores/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid colaborador ID' });
      }

      const deleted = await storage.deleteColaborador(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Colaborador not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting colaborador:', error);
      res.status(500).json({ error: 'Failed to delete colaborador' });
    }
  });

  // Get all documentos de segurança with optional filters
  app.get('/api/seg-documentos', requireAuth, async (req, res) => {
    try {
      const { colaboradorId, empreendimentoId, status, tipoDocumento } = req.query;
      
      const filters: any = {};
      if (colaboradorId) filters.colaboradorId = parseInt(colaboradorId as string);
      if (empreendimentoId) filters.empreendimentoId = parseInt(empreendimentoId as string);
      if (status) filters.status = status as string;
      if (tipoDocumento) filters.tipoDocumento = tipoDocumento as string;

      const documentos = await storage.getSegDocumentos(filters);
      res.json(documentos);
    } catch (error) {
      console.error('Error fetching seg documentos:', error);
      res.status(500).json({ error: 'Failed to fetch documentos' });
    }
  });

  // Get single documento de segurança
  app.get('/api/seg-documentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid documento ID' });
      }

      const documento = await storage.getSegDocumentoById(id);
      if (!documento) {
        return res.status(404).json({ error: 'Documento not found' });
      }

      res.json(documento);
    } catch (error) {
      console.error('Error fetching documento:', error);
      res.status(500).json({ error: 'Failed to fetch documento' });
    }
  });

  // Create documento de segurança
  app.post('/api/seg-documentos', requireAuth, async (req, res) => {
    try {
      const documento = await storage.createSegDocumento(req.body);
      res.status(201).json(documento);
    } catch (error) {
      console.error('Error creating documento:', error);
      res.status(500).json({ error: 'Failed to create documento' });
    }
  });

  // Update documento de segurança
  app.patch('/api/seg-documentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid documento ID' });
      }

      const documento = await storage.updateSegDocumento(id, req.body);
      res.json(documento);
    } catch (error) {
      console.error('Error updating documento:', error);
      res.status(500).json({ error: 'Failed to update documento' });
    }
  });

  // Delete documento de segurança
  app.delete('/api/seg-documentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid documento ID' });
      }

      const deleted = await storage.deleteSegDocumento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Documento not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting documento:', error);
      res.status(500).json({ error: 'Failed to delete documento' });
    }
  });

  // Get indicadores de segurança
  app.get('/api/seguranca/indicadores', requireAuth, async (req, res) => {
    try {
      const { empreendimentoId } = req.query;
      const filters = empreendimentoId ? parseInt(empreendimentoId as string) : undefined;

      const indicadores = await storage.getSegurancaIndicadores(filters);
      res.json(indicadores);
    } catch (error) {
      console.error('Error fetching indicadores:', error);
      res.status(500).json({ error: 'Failed to fetch indicadores' });
    }
  });

  // ==== END SEGURANÇA DO TRABALHO ROUTES ====

  const httpServer = createServer(app);
  return httpServer;
}
