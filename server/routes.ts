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
  insertCampanhaSchema,
  insertCronogramaItemSchema,
  insertRhRegistroSchema,
  insertProjetoSchema,
  insertClienteSchema,
  insertClienteUsuarioSchema,
  insertClienteDocumentoSchema,
  campanhas,
  cronogramaItens,
  rhRegistros,
  clientes,
  clienteUsuarios,
  clienteDocumentos,
  empreendimentos,
  licencasAmbientais,
  demandas,
  arquivos,
  contratos,
  datasets,
  datasetPastas,
  datasetVersoes,
  datasetAuditTrail,
} from "@shared/schema";
import { db } from "./db";
import { sql, eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import session from "express-session";
import bcrypt from "bcrypt";
import { cronService } from "./cronService";
import { exportService } from "./exportService";
import { alertService } from "./alertService";
import { notificationService } from "./notificationService";
import { websocketService } from "./services/websocketService";
import { auditLogService } from "./services/auditLogService";
import { scheduledReportsService } from "./services/scheduledReportsService";
import { 
  initScheduledReportSender, 
  getReportConfig, 
  setRelatorio360Emails, 
  setRelatorioFinanceiroEmails,
  triggerRelatorio360Now,
  triggerRelatorioFinanceiroNow
} from "./services/scheduledReportSender";
import { 
  auditLogs,
  documentos,
  scheduledReports,
  realTimeNotifications,
  insertDocumentoSchema,
  insertScheduledReportSchema,
  membrosEquipe,
  tarefas,
  tarefaAtualizacoes,
  registroHoras,
  insertMembroEquipeSchema,
  insertTarefaSchema,
  insertTarefaAtualizacaoSchema,
  insertRegistroHorasSchema,
  insertPedidoReembolsoSchema,
} from "@shared/schema";

// Import new controllers
import * as contratoController from "./controllers/contratoController";
import * as arquivoController from "./controllers/arquivoController";

// Import n8n webhooks
import { registerN8nWebhooks } from "./webhooks/n8nRoutes";
// Import Evolution API webhooks
import { registerEvolutionWebhooks } from "./webhooks/evolutionRoutes";

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  unidade: z.enum(["goiania", "salvador", "luiz-eduardo-magalhaes"]),
  cargo: z.enum(["coordenador", "diretor", "rh", "financeiro", "colaborador"]),
});

// Client login schema
const clienteLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Session configuration
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    clienteUsuarioId?: number;
    clienteId?: number;
    painelUnlocked?: boolean;
  }
}

// Painel unlock password (retrieved from environment variable)
const PAINEL_UNLOCK_PASSWORD = process.env.PAINEL_UNLOCK_PASSWORD || "";
// Admin unlock password for restricted modules
const ADMIN_UNLOCK_PASSWORD = process.env.ADMIN_UNLOCK_PASSWORD || "";

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for secure cookies behind reverse proxy
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'licenca-facil-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  }));

  // Authentication middleware - also attaches user info to request
  const requireAuth = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Attach user info including unidade to request for downstream use
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
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

  // Client portal authentication middleware
  const requireClienteAuth = async (req: any, res: any, next: any) => {
    if (!req.session.clienteUsuarioId || !req.session.clienteId) {
      return res.status(401).json({ message: "Acesso não autorizado. Faça login no portal do cliente." });
    }
    
    const [clienteUsuario] = await db
      .select()
      .from(clienteUsuarios)
      .where(and(
        eq(clienteUsuarios.id, req.session.clienteUsuarioId),
        eq(clienteUsuarios.ativo, true)
      ))
      .limit(1);
    
    if (!clienteUsuario) {
      return res.status(401).json({ message: "Usuário não encontrado ou inativo" });
    }
    
    req.clienteUsuario = clienteUsuario;
    req.clienteId = req.session.clienteId;
    next();
  };

  // Initialize seed user (only if SEED_ADMIN_PASSWORD is set)
  const initSeedUser = async () => {
    // Only create admin in development or if explicitly enabled
    if (process.env.NODE_ENV === 'production' && !process.env.SEED_ADMIN_PASSWORD) {
      return; // Skip seeding in production without explicit env var
    }
    
    const adminEmail = "maurivan@ecobrasil.bio.br";
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    if (!existingAdmin) {
      const password = process.env.SEED_ADMIN_PASSWORD || "bor192023";
      await storage.createUser({
        email: adminEmail,
        passwordHash: password, // createUser will hash this
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
      res.json({ message: "Login successful", user: { id: user.id, email: user.email, role: user.role, unidade: user.unidade } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, unidade, cargo } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este e-mail já está cadastrado" });
      }

      const newUser = await storage.createUser({
        email,
        passwordHash: password,
        role: "colaborador",
        cargo,
        unidade,
      });

      req.session.userId = newUser.id;
      res.json({ message: "Registro bem-sucedido", user: { id: newUser.id, email: newUser.email, role: newUser.role, cargo: newUser.cargo, unidade: newUser.unidade } });
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
      res.json({ 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        unidade: user.unidade, 
        cargo: user.cargo,
        painelUnlocked: req.session.painelUnlocked || false 
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Painel unlock routes
  app.post("/api/painel/unlock", requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Senha é obrigatória" });
      }

      if (!PAINEL_UNLOCK_PASSWORD) {
        return res.status(500).json({ message: "Configuração de desbloqueio não disponível" });
      }

      if (password === PAINEL_UNLOCK_PASSWORD) {
        req.session.painelUnlocked = true;
        console.log(`Painel desbloqueado por usuário ${req.session.userId}`);
        return res.json({ success: true, message: "Painel desbloqueado com sucesso" });
      } else {
        console.log(`Tentativa de desbloqueio falhou para usuário ${req.session.userId}`);
        return res.status(401).json({ message: "Senha incorreta" });
      }
    } catch (error) {
      console.error("Painel unlock error:", error);
      res.status(500).json({ message: "Erro ao desbloquear painel" });
    }
  });

  app.get("/api/painel/unlock-status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const isCoordenador = user?.cargo === "coordenador" || user?.cargo === "diretor";
      const isUnlocked = isCoordenador || req.session.painelUnlocked === true;
      
      res.json({ 
        unlocked: isUnlocked,
        isCoordenador,
        cargo: user?.cargo
      });
    } catch (error) {
      console.error("Get unlock status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Module unlock endpoint - validates admin password for restricted module access
  app.post("/api/auth/unlock-module", requireAuth, async (req, res) => {
    try {
      const { password, module } = req.body;
      
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ success: false, message: "Senha é obrigatória" });
      }

      if (!module || typeof module !== 'string') {
        return res.status(400).json({ success: false, message: "Módulo é obrigatório" });
      }

      if (!ADMIN_UNLOCK_PASSWORD) {
        return res.status(500).json({ success: false, message: "Configuração de desbloqueio não disponível" });
      }

      if (password === ADMIN_UNLOCK_PASSWORD) {
        console.log(`Módulo '${module}' desbloqueado por usuário ${req.session.userId}`);
        return res.json({ success: true, message: "Módulo desbloqueado com sucesso" });
      } else {
        console.log(`Tentativa de desbloqueio do módulo '${module}' falhou para usuário ${req.session.userId}`);
        return res.json({ success: false, message: "Senha incorreta" });
      }
    } catch (error) {
      console.error("Module unlock error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  // Empreendimento routes
  app.get("/api/empreendimentos", requireAuth, async (req, res) => {
    try {
      // Use unidade from authenticated user, not from query string (security)
      const unidade = req.user?.unidade;
      const empreendimentos = await storage.getEmpreendimentos(unidade);
      res.json(empreendimentos);
    } catch (error) {
      console.error("Get empreendimentos error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/empreendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Use unidade from authenticated user, not from query string (security)
      const unidade = req.user?.unidade;
      const empreendimento = await storage.getEmpreendimento(id, unidade);
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
      // Force unidade from authenticated user (security - ignore client-provided value)
      const userUnidade = req.user?.unidade;
      if (!userUnidade) {
        return res.status(400).json({ message: "Unidade do usuário não definida" });
      }
      
      // Convert empty strings to null for numeric fields
      const body = { ...req.body };
      if (body.latitude === "" || body.latitude === undefined) body.latitude = null;
      if (body.longitude === "" || body.longitude === undefined) body.longitude = null;
      
      const data = insertEmpreendimentoSchema.parse({
        ...body,
        unidade: userUnidade, // Override any client-provided unidade
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
      const userUnidade = req.user?.unidade;
      
      // Verify the empreendimento belongs to user's unit before updating
      const existing = await storage.getEmpreendimento(id, userUnidade);
      if (!existing) {
        return res.status(404).json({ message: "Empreendimento not found" });
      }
      
      // Parse data and strip unidade (users cannot change empreendimento's unit)
      const { unidade: _ignored, ...bodyWithoutUnidade } = req.body;
      
      // Convert empty strings to null for numeric fields
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

  app.delete("/api/empreendimentos/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;
      
      // Verify the empreendimento belongs to user's unit before deleting
      const existing = await storage.getEmpreendimento(id, userUnidade);
      if (!existing) {
        return res.status(404).json({ message: "Empreendimento not found" });
      }
      
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

  // Consolidated dashboard stats endpoint (reduces 6+ requests to 1)
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const unidade = req.user?.unidade || '';
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      
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
        contratosStats
      ] = await Promise.all([
        storage.getLicenseStats(unidade, empreendimentoId),
        storage.getCondicionanteStats(unidade, empreendimentoId),
        storage.getEntregaStats(unidade, empreendimentoId),
        storage.getAgendaPrazos(unidade, empreendimentoId),
        storage.getMonthlyExpiryData(unidade, empreendimentoId),
        storage.getFrotaStats(unidade, empreendimentoId),
        storage.getEquipamentosStats(unidade, empreendimentoId),
        storage.getRhStats(unidade, empreendimentoId),
        storage.getDemandasStats(unidade, empreendimentoId),
        storage.getContratosStats(unidade, empreendimentoId)
      ]);

      res.json({
        licenses: licenseStats,
        condicionantes: condicionanteStats,
        entregas: entregaStats,
        agenda: prazos,
        monthlyExpiry: monthlyData,
        frota: frotaStats,
        equipamentos: equipamentosStats,
        rh: rhStats,
        demandas: demandasStats,
        contratos: contratosStats
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard Executivo - Consolidated stats from all units
  app.get("/api/dashboard/executivo", requireAuth, async (req, res) => {
    try {
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

  // Get user's own demandas (assigned to them)
  app.get('/api/minhas-demandas', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const userUnidade = req.user.unidade;
      const demandas = await storage.getDemandasByResponsavel(userId, userUnidade);
      res.json(demandas);
    } catch (error) {
      console.error('Error fetching user demandas:', error);
      res.status(500).json({ error: 'Failed to fetch demandas' });
    }
  });

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
  app.get('/api/demandas/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const empreendimentoId = req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined;
      const stats = await storage.getDemandasStats(userUnidade, empreendimentoId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching demandas stats:', error);
      res.status(500).json({ error: 'Failed to fetch demandas statistics' });
    }
  });

  app.get('/api/demandas/dashboard/stats/:empreendimentoId', requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const stats = await storage.getDemandasStats(userUnidade, empreendimentoId);
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
  app.post('/api/demandas', requireAuth, async (req, res) => {
    try {
      console.log('[DEBUG] Creating demanda - req.body:', JSON.stringify(req.body, null, 2));
      
      // Ensure required fields are set and remove undefined/invalid empreendimentoId
      const demandaData: any = {
        titulo: req.body.titulo,
        descricao: req.body.descricao,
        setor: req.body.setor,
        prioridade: req.body.prioridade,
        dataEntrega: req.body.dataEntrega,
        status: req.body.status || 'a_fazer',
        responsavel: req.body.responsavel, // This is the name string field
        responsavelId: req.body.responsavelId || req.session.userId,
        criadoPor: req.session.userId,
      };
      
      // Only add empreendimentoId if it's a valid number
      if (req.body.empreendimentoId && !isNaN(parseInt(req.body.empreendimentoId))) {
        demandaData.empreendimentoId = parseInt(req.body.empreendimentoId);
      }
      
      // Add optional fields if present
      if (req.body.observacoes) demandaData.observacoes = req.body.observacoes;
      if (req.body.tags) demandaData.tags = req.body.tags;
      if (req.body.anexos) demandaData.anexos = req.body.anexos;
      if (req.body.tempoEstimado) demandaData.tempoEstimado = req.body.tempoEstimado;
      if (req.body.origem) demandaData.origem = req.body.origem;
      if (req.body.campanhaId) demandaData.campanhaId = req.body.campanhaId;
      if (req.body.contratoId) demandaData.contratoId = req.body.contratoId;
      
      console.log('[DEBUG] Creating demanda - final data:', JSON.stringify(demandaData, null, 2));
      
      const demanda = await storage.createDemanda(demandaData);
      res.status(201).json(demanda);
    } catch (error: any) {
      console.error('Error creating demanda:', error);
      console.error('[DEBUG] Error details:', error?.message, error?.stack);
      // Return more detailed error for debugging
      res.status(500).json({ 
        error: 'Failed to create demanda',
        details: error?.message || 'Unknown error'
      });
    }
  });

  // Update demanda
  app.patch('/api/demandas/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid demanda ID' });
      }
      
      // Get current demanda to track changes
      const currentDemanda = await storage.getDemandaById(id);
      if (!currentDemanda) {
        return res.status(404).json({ error: 'Demanda not found' });
      }

      const demanda = await storage.updateDemanda(id, req.body);
      if (!demanda) {
        return res.status(404).json({ error: 'Demanda not found' });
      }

      const userId = req.session.userId;
      const user = userId ? { id: userId } : undefined;
      
      // Create history record if any significant field changed
      if (user) {
        const changes: string[] = [];
        let statusAnterior = null;
        let statusNovo = null;
        let acao = 'editou';

        // Check for status change
        if (req.body.status && req.body.status !== currentDemanda.status) {
          statusAnterior = currentDemanda.status || null;
          statusNovo = req.body.status;
          acao = 'moveu';
          changes.push(`Status: ${currentDemanda.status} → ${req.body.status}`);
        }

        // Check for date change
        if (req.body.dataEntrega) {
          const currentDate = currentDemanda.dataEntrega ? new Date(currentDemanda.dataEntrega).toISOString().split('T')[0] : null;
          const newDate = new Date(req.body.dataEntrega).toISOString().split('T')[0];
          if (currentDate !== newDate) {
            changes.push(`Data de Entrega: ${currentDate || 'sem data'} → ${newDate}`);
          }
        }

        // Check for responsible change
        if (req.body.responsavel && req.body.responsavel !== currentDemanda.responsavel) {
          changes.push(`Responsável: ${currentDemanda.responsavel} → ${req.body.responsavel}`);
        }

        // Check for priority change
        if (req.body.prioridade && req.body.prioridade !== currentDemanda.prioridade) {
          changes.push(`Prioridade: ${currentDemanda.prioridade} → ${req.body.prioridade}`);
        }

        // Check for sector change
        if (req.body.setor && req.body.setor !== currentDemanda.setor) {
          changes.push(`Setor: ${currentDemanda.setor} → ${req.body.setor}`);
        }

        // Create history record if there were changes
        if (changes.length > 0) {
          await storage.createHistoricoMovimentacao({
            demandaId: id,
            usuarioId: user.id,
            acao,
            statusAnterior,
            statusNovo,
            descricao: changes.join('; '),
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

  // Initialize default financial categories
  app.post('/api/categorias-financeiras/init', async (req, res) => {
    try {
      const existingCategorias = await storage.getCategorias();
      if (existingCategorias.length > 0) {
        return res.json({ message: 'Categories already initialized', categorias: existingCategorias });
      }

      const defaultCategories = [
        // DESPESAS PRINCIPAIS
        { nome: 'Combustível', tipo: 'despesa', cor: '#ef4444' },
        { nome: 'Hospedagem', tipo: 'despesa', cor: '#f97316' },
        { nome: 'Alimentação', tipo: 'despesa', cor: '#eab308' },
        { nome: 'Transporte', tipo: 'despesa', cor: '#22c55e' },
        { nome: 'Material de Campo', tipo: 'despesa', cor: '#14b8a6' },
        { nome: 'Material de Escritório', tipo: 'despesa', cor: '#06b6d4' },
        { nome: 'Manutenção de Veículos', tipo: 'despesa', cor: '#8b5cf6' },
        { nome: 'Manutenção de Equipamentos', tipo: 'despesa', cor: '#a855f7' },
        { nome: 'Serviços de Terceiros', tipo: 'despesa', cor: '#ec4899' },
        { nome: 'Análises Laboratoriais', tipo: 'despesa', cor: '#f43f5e' },
        { nome: 'Taxas e Licenças', tipo: 'despesa', cor: '#64748b' },
        { nome: 'Seguro', tipo: 'despesa', cor: '#475569' },
        { nome: 'Salários', tipo: 'despesa', cor: '#0ea5e9' },
        { nome: 'Encargos Trabalhistas', tipo: 'despesa', cor: '#3b82f6' },
        { nome: 'Aluguel', tipo: 'despesa', cor: '#6366f1' },
        { nome: 'Energia e Água', tipo: 'despesa', cor: '#84cc16' },
        { nome: 'Telefone e Internet', tipo: 'despesa', cor: '#10b981' },
        { nome: 'Software e Licenças', tipo: 'despesa', cor: '#0d9488' },
        { nome: 'Marketing e Publicidade', tipo: 'despesa', cor: '#f59e0b' },
        { nome: 'Outras Despesas', tipo: 'despesa', cor: '#94a3b8' },
        // RECEITAS PRINCIPAIS
        { nome: 'Serviços de Licenciamento', tipo: 'receita', cor: '#22c55e' },
        { nome: 'Consultoria Ambiental', tipo: 'receita', cor: '#16a34a' },
        { nome: 'Estudos Ambientais', tipo: 'receita', cor: '#15803d' },
        { nome: 'Monitoramento Ambiental', tipo: 'receita', cor: '#166534' },
        { nome: 'Georreferenciamento', tipo: 'receita', cor: '#14532d' },
        { nome: 'Treinamentos', tipo: 'receita', cor: '#65a30d' },
        { nome: 'Outras Receitas', tipo: 'receita', cor: '#a3e635' },
      ];

      const createdCategories = [];
      for (const cat of defaultCategories) {
        const created = await storage.createCategoria(cat);
        createdCategories.push(created);
      }

      res.status(201).json({ message: 'Categories initialized', categorias: createdCategories });
    } catch (error) {
      console.error('Error initializing categorias:', error);
      res.status(500).json({ error: 'Failed to initialize categorias' });
    }
  });

  // Sync/refresh categories - adds new ones without deleting existing
  app.post('/api/categorias-financeiras/sync', async (req, res) => {
    try {
      const existingCategorias = await storage.getCategorias();
      const existingNames = existingCategorias.map(c => c.nome);

      const allCategories = [
        // DESPESAS PRINCIPAIS
        { nome: 'Combustível', tipo: 'despesa', cor: '#ef4444' },
        { nome: 'Hospedagem', tipo: 'despesa', cor: '#f97316' },
        { nome: 'Alimentação', tipo: 'despesa', cor: '#eab308' },
        { nome: 'Transporte', tipo: 'despesa', cor: '#22c55e' },
        { nome: 'Material de Campo', tipo: 'despesa', cor: '#14b8a6' },
        { nome: 'Material de Escritório', tipo: 'despesa', cor: '#06b6d4' },
        { nome: 'Manutenção de Veículos', tipo: 'despesa', cor: '#8b5cf6' },
        { nome: 'Manutenção de Equipamentos', tipo: 'despesa', cor: '#a855f7' },
        { nome: 'Serviços de Terceiros', tipo: 'despesa', cor: '#ec4899' },
        { nome: 'Análises Laboratoriais', tipo: 'despesa', cor: '#f43f5e' },
        { nome: 'Taxas e Licenças', tipo: 'despesa', cor: '#64748b' },
        { nome: 'Seguro', tipo: 'despesa', cor: '#475569' },
        { nome: 'Salários', tipo: 'despesa', cor: '#0ea5e9' },
        { nome: 'Encargos Trabalhistas', tipo: 'despesa', cor: '#3b82f6' },
        { nome: 'Aluguel', tipo: 'despesa', cor: '#6366f1' },
        { nome: 'Energia e Água', tipo: 'despesa', cor: '#84cc16' },
        { nome: 'Telefone e Internet', tipo: 'despesa', cor: '#10b981' },
        { nome: 'Software e Licenças', tipo: 'despesa', cor: '#0d9488' },
        { nome: 'Marketing e Publicidade', tipo: 'despesa', cor: '#f59e0b' },
        { nome: 'Outras Despesas', tipo: 'despesa', cor: '#94a3b8' },
        // RECEITAS PRINCIPAIS
        { nome: 'Serviços de Licenciamento', tipo: 'receita', cor: '#22c55e' },
        { nome: 'Consultoria Ambiental', tipo: 'receita', cor: '#16a34a' },
        { nome: 'Estudos Ambientais', tipo: 'receita', cor: '#15803d' },
        { nome: 'Monitoramento Ambiental', tipo: 'receita', cor: '#166534' },
        { nome: 'Georreferenciamento', tipo: 'receita', cor: '#14532d' },
        { nome: 'Treinamentos', tipo: 'receita', cor: '#65a30d' },
        { nome: 'Outras Receitas', tipo: 'receita', cor: '#a3e635' },
      ];

      // Only add categories that don't exist yet
      const newCategories = allCategories.filter(cat => !existingNames.includes(cat.nome));
      const createdCategories = [];
      
      for (const cat of newCategories) {
        const created = await storage.createCategoria(cat);
        createdCategories.push(created);
      }

      res.status(201).json({ 
        message: `Synced ${createdCategories.length} new categories`, 
        newCategories: createdCategories,
        totalExisting: existingCategorias.length,
        totalNow: existingCategorias.length + createdCategories.length
      });
    } catch (error) {
      console.error('Error syncing categorias:', error);
      res.status(500).json({ error: 'Failed to sync categorias' });
    }
  });

  // Lançamentos Financeiros routes
  app.get('/api/financeiro/lancamentos', requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const userCargo = req.user?.cargo || '';
      const isAdmin = userCargo === 'admin' || userCargo === 'diretor';
      
      // Buscar empreendimentos da unidade do usuário (ou todos para admin/diretor)
      const empreendimentosAcessiveis = await storage.getEmpreendimentos(isAdmin ? undefined : userUnidade);
      const empreendimentoIds = empreendimentosAcessiveis.map(e => e.id);
      
      const filters = {
        tipo: req.query.tipo as string,
        status: req.query.status as string,
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
        categoriaId: req.query.categoriaId ? parseInt(req.query.categoriaId as string) : undefined,
        search: req.query.search as string,
        empreendimentoIds: isAdmin ? undefined : empreendimentoIds,
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
      // Helper para extrair data no formato YYYY-MM-DD
      const extractDateString = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string') {
          // Se já é string, extrair apenas a parte da data (YYYY-MM-DD)
          return value.split('T')[0];
        }
        return null;
      };
      
      const lancamentoData = {
        ...req.body,
        criadoPor: req.session?.userId || 1,
        data: extractDateString(req.body.data),
        dataVencimento: extractDateString(req.body.dataVencimento),
        dataPagamento: extractDateString(req.body.dataPagamento),
      };
      
      // Se dataPagamento foi informada, define status automaticamente como "pago"
      if (lancamentoData.dataPagamento) {
        lancamentoData.status = "pago";
      }
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
      
      // Helper para extrair data no formato YYYY-MM-DD
      const extractDateString = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string') {
          return value.split('T')[0];
        }
        return null;
      };
      
      const updateData = { ...req.body };
      
      // Processar campos de data se presentes
      if ('data' in req.body) {
        updateData.data = extractDateString(req.body.data);
      }
      if ('dataVencimento' in req.body) {
        updateData.dataVencimento = extractDateString(req.body.dataVencimento);
      }
      if ('dataPagamento' in req.body) {
        updateData.dataPagamento = extractDateString(req.body.dataPagamento);
      }
      
      // Se dataPagamento foi informada, define status automaticamente como "pago"
      if (updateData.dataPagamento) {
        updateData.status = "pago";
      }
      const lancamento = await storage.updateLancamento(id, updateData);
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
      const { empreendimentoId, startDate, endDate } = req.query;
      const empId = empreendimentoId ? parseInt(String(empreendimentoId)) : undefined;
      const start = startDate ? new Date(String(startDate)) : undefined;
      const end = endDate ? new Date(String(endDate)) : undefined;
      const stats = await storage.getFinancialStats(empId, start, end);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching financial stats:', error);
      res.status(500).json({ error: 'Failed to fetch financial stats' });
    }
  });

  app.get('/api/financeiro/expense-evolution', async (req, res) => {
    try {
      const { empreendimentoId, categoriaId } = req.query;
      const empId = empreendimentoId ? parseInt(String(empreendimentoId)) : undefined;
      const catId = categoriaId ? parseInt(String(categoriaId)) : undefined;
      const data = await storage.getExpenseEvolutionByCategory(empId, catId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching expense evolution:', error);
      res.status(500).json({ error: 'Failed to fetch expense evolution' });
    }
  });

  // Excel upload for financial data import
  const multer = await import('multer');
  const XLSX = await import('xlsx');
  
  const excelUpload = multer.default({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos Excel (.xlsx, .xls) ou CSV são permitidos'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  app.post('/api/financeiro/import-excel', requireAuth, excelUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy' });

      if (!data || data.length === 0) {
        return res.status(400).json({ error: 'Planilha vazia ou formato inválido' });
      }

      // Get categories and empreendimentos for lookup
      const categorias = await storage.getCategorias();
      const empreendimentos = await storage.getEmpreendimentos();
      
      const categoriaMap = new Map(categorias.map(c => [c.nome.toLowerCase(), c.id]));
      const empreendimentoMap = new Map(empreendimentos.map(e => [e.nome.toLowerCase(), e.id]));

      const results = {
        imported: 0,
        errors: [] as string[],
        skipped: 0
      };

      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        const rowNum = i + 2; // Excel row number (1-indexed + header)

        try {
          // Map columns - support multiple column name variations
          const tipo = (row['Tipo'] || row['tipo'] || row['TIPO'] || '').toString().toLowerCase().trim();
          const categoriaName = (row['Categoria'] || row['categoria'] || row['CATEGORIA'] || '').toString().toLowerCase().trim();
          const empreendimentoName = (row['Empreendimento'] || row['empreendimento'] || row['EMPREENDIMENTO'] || row['Projeto'] || row['projeto'] || '').toString().toLowerCase().trim();
          const valorStr = (row['Valor'] || row['valor'] || row['VALOR'] || '0').toString().replace(/[R$\s.]/g, '').replace(',', '.');
          const valor = parseFloat(valorStr);
          const descricao = (row['Descricao'] || row['descricao'] || row['Descrição'] || row['descrição'] || row['DESCRICAO'] || '').toString().trim();
          const dataStr = row['Data'] || row['data'] || row['DATA'];
          const statusStr = (row['Status'] || row['status'] || row['STATUS'] || 'aguardando').toString().toLowerCase().trim();

          // Parse date
          let dataLancamento: Date;
          if (dataStr instanceof Date) {
            dataLancamento = dataStr;
          } else if (typeof dataStr === 'string') {
            // Try to parse dd/mm/yyyy format
            const parts = dataStr.split(/[\/\-]/);
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2]);
              dataLancamento = new Date(year, month, day);
            } else {
              dataLancamento = new Date(dataStr);
            }
          } else {
            dataLancamento = new Date();
          }

          if (isNaN(dataLancamento.getTime())) {
            results.errors.push(`Linha ${rowNum}: Data inválida`);
            continue;
          }

          // Validate tipo
          const tipoValido = ['receita', 'despesa', 'reembolso', 'solicitacao_recurso'].includes(tipo);
          if (!tipoValido) {
            results.errors.push(`Linha ${rowNum}: Tipo inválido "${tipo}" (use: receita, despesa, reembolso, solicitacao_recurso)`);
            continue;
          }

          // Find categoria
          let categoriaId = categoriaMap.get(categoriaName);
          if (!categoriaId) {
            // Try partial match
            for (const [name, id] of categoriaMap) {
              if (name.includes(categoriaName) || categoriaName.includes(name)) {
                categoriaId = id;
                break;
              }
            }
          }
          if (!categoriaId) {
            results.errors.push(`Linha ${rowNum}: Categoria não encontrada "${categoriaName}"`);
            continue;
          }

          // Find empreendimento
          let empreendimentoId = empreendimentoMap.get(empreendimentoName);
          if (!empreendimentoId) {
            // Try partial match
            for (const [name, id] of empreendimentoMap) {
              if (name.includes(empreendimentoName) || empreendimentoName.includes(name)) {
                empreendimentoId = id;
                break;
              }
            }
          }
          if (!empreendimentoId) {
            results.errors.push(`Linha ${rowNum}: Empreendimento não encontrado "${empreendimentoName}"`);
            continue;
          }

          // Validate valor
          if (isNaN(valor) || valor <= 0) {
            results.errors.push(`Linha ${rowNum}: Valor inválido "${valorStr}"`);
            continue;
          }

          // Validate status
          const status = ['aguardando', 'aprovado', 'pago', 'recusado'].includes(statusStr) ? statusStr : 'aguardando';

          // Create lancamento
          await storage.createLancamento({
            tipo: tipo as 'receita' | 'despesa' | 'reembolso' | 'solicitacao_recurso',
            categoriaId,
            empreendimentoId,
            valor: valor.toString(),
            data: dataLancamento,
            descricao: descricao || `Importado do Excel - Linha ${rowNum}`,
            status: status as 'aguardando' | 'aprovado' | 'pago' | 'recusado',
            criadoPor: req.session.userId
          });

          results.imported++;
        } catch (rowError: any) {
          results.errors.push(`Linha ${rowNum}: ${rowError.message}`);
        }
      }

      res.json({
        success: true,
        message: `Importação concluída: ${results.imported} lançamentos importados`,
        imported: results.imported,
        errors: results.errors.slice(0, 20), // Limit errors shown
        totalErrors: results.errors.length,
        totalRows: data.length
      });

    } catch (error: any) {
      console.error('Error importing Excel:', error);
      res.status(500).json({ error: error.message || 'Erro ao processar arquivo Excel' });
    }
  });

  // Export financial data to Excel
  app.get('/api/financeiro/export-excel', requireAuth, async (req, res) => {
    try {
      const XLSX = await import('xlsx');
      
      // Get all financial data
      const lancamentos = await storage.getLancamentos();
      const categorias = await storage.getCategorias();
      const empreendimentos = await storage.getEmpreendimentos();
      
      // Create lookup maps
      const categoriaMap = new Map(categorias.map(c => [c.id, c.nome]));
      const empreendimentoMap = new Map(empreendimentos.map(e => [e.id, e.nome]));
      
      // Transform data for Excel
      const exportData = lancamentos.map(l => ({
        'ID': l.id,
        'Tipo': l.tipo.charAt(0).toUpperCase() + l.tipo.slice(1),
        'Categoria': categoriaMap.get(l.categoriaId) || 'N/A',
        'Empreendimento': empreendimentoMap.get(l.empreendimentoId) || 'N/A',
        'Valor': `R$ ${parseFloat(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        'Valor Numérico': parseFloat(l.valor),
        'Data': l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '',
        'Data Pagamento': l.dataPagamento ? new Date(l.dataPagamento).toLocaleDateString('pt-BR') : '',
        'Descrição': l.descricao || '',
        'Status': l.status ? l.status.charAt(0).toUpperCase() + l.status.slice(1) : 'Aguardando'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Add column widths
      worksheet['!cols'] = [
        { wch: 8 },  // ID
        { wch: 18 }, // Tipo
        { wch: 25 }, // Categoria
        { wch: 30 }, // Empreendimento
        { wch: 18 }, // Valor
        { wch: 15 }, // Valor Numérico
        { wch: 12 }, // Data
        { wch: 15 }, // Data Pagamento
        { wch: 50 }, // Descrição
        { wch: 15 }  // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos Financeiros');
      
      // Add summary sheet
      const totalReceitas = lancamentos.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const totalDespesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const saldo = totalReceitas - totalDespesas;
      
      const summaryData = [
        { 'Resumo': 'Total de Lançamentos', 'Valor': lancamentos.length },
        { 'Resumo': 'Total Receitas', 'Valor': `R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { 'Resumo': 'Total Despesas', 'Valor': `R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { 'Resumo': 'Saldo', 'Valor': `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      ];
      
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=lancamentos_financeiros_${dateStr}.xlsx`);
      res.send(buffer);

    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      res.status(500).json({ error: 'Erro ao exportar para Excel' });
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

  // Get upload URL for equipment damage image
  app.post('/api/equipamentos/:id/imagens/upload-url', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      const { extension = 'jpg' } = req.body;
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const { uploadUrl, filePath } = await objectStorageService.getEquipmentImageUploadURL(extension);
      
      res.json({ uploadUrl, filePath });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ error: 'Failed to get upload URL' });
    }
  });

  // Add damage image to equipment
  app.post('/api/equipamentos/:id/imagens', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      const { filePath, descricao } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      // Parse existing images
      let imagens: Array<{ filePath: string; descricao?: string; dataUpload: string }> = [];
      if (equipamento.imagensDanoJson) {
        try {
          imagens = JSON.parse(equipamento.imagensDanoJson);
        } catch (e) {
          imagens = [];
        }
      }

      // Add new image
      imagens.push({
        filePath,
        descricao: descricao || '',
        dataUpload: new Date().toISOString()
      });

      // Update equipment
      const updated = await storage.updateEquipamento(id, {
        imagensDanoJson: JSON.stringify(imagens)
      });

      res.json(updated);
    } catch (error) {
      console.error('Error adding damage image:', error);
      res.status(500).json({ error: 'Failed to add damage image' });
    }
  });

  // Get damage images for equipment (with signed URLs)
  app.get('/api/equipamentos/:id/imagens', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      let imagens: Array<{ filePath: string; descricao?: string; dataUpload: string }> = [];
      if (equipamento.imagensDanoJson) {
        try {
          imagens = JSON.parse(equipamento.imagensDanoJson);
        } catch (e) {
          imagens = [];
        }
      }

      // Generate signed URLs for viewing
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      const imagensComUrl = await Promise.all(
        imagens.map(async (img) => {
          try {
            const signedUrl = await objectStorageService.getSignedViewURL(img.filePath);
            return { ...img, signedUrl };
          } catch (error) {
            console.error('Error getting signed URL for image:', error);
            return { ...img, signedUrl: null };
          }
        })
      );

      res.json(imagensComUrl);
    } catch (error) {
      console.error('Error fetching damage images:', error);
      res.status(500).json({ error: 'Failed to fetch damage images' });
    }
  });

  // Delete damage image from equipment
  app.delete('/api/equipamentos/:id/imagens', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      // Parse existing images
      let imagens: Array<{ filePath: string; descricao?: string; dataUpload: string }> = [];
      if (equipamento.imagensDanoJson) {
        try {
          imagens = JSON.parse(equipamento.imagensDanoJson);
        } catch (e) {
          imagens = [];
        }
      }

      // Remove image from list
      const imagensFiltradas = imagens.filter(img => img.filePath !== filePath);

      // Delete from object storage
      try {
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.deleteFile(filePath);
      } catch (error) {
        console.error('Error deleting file from storage:', error);
      }

      // Update equipment
      const updated = await storage.updateEquipamento(id, {
        imagensDanoJson: JSON.stringify(imagensFiltradas)
      });

      res.json(updated);
    } catch (error) {
      console.error('Error deleting damage image:', error);
      res.status(500).json({ error: 'Failed to delete damage image' });
    }
  });

  // ==== END EQUIPMENT ROUTES ====

  // =============================================
  // FLEET MODULE - GESTÃO DE FROTA (VEÍCULOS)
  // =============================================

  // Get all veículos with optional filters
  app.get('/api/frota', requireAuth, async (req, res) => {
    try {
      const { tipo, status, combustivel, search, empreendimentoId } = req.query;
      const filters: any = {};

      if (tipo) filters.tipo = String(tipo);
      if (status) filters.status = String(status);
      if (combustivel) filters.combustivel = String(combustivel);
      if (search) filters.search = String(search);
      if (empreendimentoId) filters.empreendimentoId = parseInt(String(empreendimentoId));

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
      // Convert dataUpload string to Date object if present
      const datasetData = { ...req.body };
      if (datasetData.dataUpload && typeof datasetData.dataUpload === 'string') {
        datasetData.dataUpload = new Date(datasetData.dataUpload);
      }
      
      const dataset = await storage.createDataset(datasetData);
      res.status(201).json(dataset);
    } catch (error) {
      console.error('Error creating dataset:', error);
      res.status(500).json({ error: 'Failed to create dataset' });
    }
  });

  // Update dataset
  app.patch('/api/datasets/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid dataset ID' });
      }

      const { nome, descricao } = req.body;
      const updateData: { nome?: string; descricao?: string } = {};
      if (nome !== undefined) updateData.nome = nome;
      if (descricao !== undefined) updateData.descricao = descricao;

      const updated = await db.update(datasets).set(updateData).where(eq(datasets.id, id)).returning();
      if (updated.length === 0) {
        return res.status(404).json({ error: 'Dataset not found' });
      }

      res.json(updated[0]);
    } catch (error) {
      console.error('Error updating dataset:', error);
      res.status(500).json({ error: 'Failed to update dataset' });
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

  // ==== ESTRUTURA DE PASTAS E GESTÃO DOCUMENTAL ====

  // Definição da estrutura macro institucional
  const ESTRUTURA_MACRO = [
    { nome: "01_ADMINISTRATIVO", caminho: "/ECOBRASIL_GESTAO_DADOS/01_ADMINISTRATIVO" },
    { nome: "02_PROJETOS", caminho: "/ECOBRASIL_GESTAO_DADOS/02_PROJETOS" },
    { nome: "03_CLIENTES", caminho: "/ECOBRASIL_GESTAO_DADOS/03_CLIENTES" },
    { nome: "04_BASE_TECNICA", caminho: "/ECOBRASIL_GESTAO_DADOS/04_BASE_TECNICA" },
    { nome: "05_MODELOS_E_PADROES", caminho: "/ECOBRASIL_GESTAO_DADOS/05_MODELOS_E_PADROES" },
    { nome: "06_SISTEMA_E_BACKUP", caminho: "/ECOBRASIL_GESTAO_DADOS/06_SISTEMA_E_BACKUP" },
    { nome: "07_ARQUIVO_MORTO", caminho: "/ECOBRASIL_GESTAO_DADOS/07_ARQUIVO_MORTO" },
  ];

  // Estrutura de subpastas por projeto
  const ESTRUTURA_PROJETO = [
    "01_GESTAO_E_CONTRATOS",
    "02_PLANEJAMENTO_E_CRONOGRAMA",
    "03_BANCOS_DE_DADOS",
    "04_RELATORIOS_E_PARECERES",
    "05_SIG_E_CARTOGRAFIA",
    "06_IMAGENS_E_MIDIAS",
    "07_SCRIPTS_E_ANALISES",
    "08_COMUNICACAO_OFICIAL",
    "09_AUDITORIA_E_COMPLIANCE",
    "10_ENTREGAS_FINAIS",
  ];

  // Subpastas detalhadas
  const SUBPASTAS_DETALHADAS: Record<string, string[]> = {
    "03_BANCOS_DE_DADOS": [
      "01_DADOS_BRUTOS/FAUNA",
      "01_DADOS_BRUTOS/FLORA",
      "01_DADOS_BRUTOS/FISICO_QUIMICA",
      "01_DADOS_BRUTOS/SOCIOECONOMIA",
      "01_DADOS_BRUTOS/OUTROS",
      "02_DADOS_PROCESSADOS/FAUNA",
      "02_DADOS_PROCESSADOS/FLORA",
      "02_DADOS_PROCESSADOS/SIG",
      "02_DADOS_PROCESSADOS/ESTATISTICA",
      "03_DADOS_CONSOLIDADOS/BASE_OFICIAL_PROJETO",
      "04_METADADOS_E_DICIONARIOS/DICIONARIO_DE_VARIAVEIS",
      "04_METADADOS_E_DICIONARIOS/METODOLOGIAS",
    ],
    "04_RELATORIOS_E_PARECERES": [
      "01_RASCUNHOS",
      "02_PRELIMINARES",
      "03_REVISOES",
      "04_FINAIS",
      "05_ASSINADOS_E_PROTOCOLADOS",
    ],
    "05_SIG_E_CARTOGRAFIA": [
      "01_DADOS_VETORIAIS",
      "02_DADOS_RASTER",
      "03_PROJETOS_QGIS",
      "04_LAYOUTS_E_MAPAS",
      "05_METADADOS_SIG",
    ],
    "06_IMAGENS_E_MIDIAS": [
      "01_FOTOS_CAMPO",
      "02_DRONES_E_VIDEOS",
      "03_MAPAS_E_FIGURAS",
      "04_GRAFICOS_E_DIAGRAMAS",
      "05_MEMORIAL_FOTOGRAFICO",
    ],
    "07_SCRIPTS_E_ANALISES": [
      "01_R",
      "02_PYTHON",
      "03_SQL",
      "04_NOTEBOOKS",
      "05_LOGS_E_RESULTADOS",
    ],
    "08_COMUNICACAO_OFICIAL": [
      "01_OFICIOS",
      "02_EMAILS_PDF",
      "03_RESPOSTAS_A_ORGAOS",
      "04_PROTOCOLADOS",
    ],
    "09_AUDITORIA_E_COMPLIANCE": [
      "01_CHECKLISTS_ISO",
      "02_RASTREABILIDADE",
      "03_LGPD_E_CONFIDENCIALIDADE",
      "04_REGISTROS_DE_MUDANCA",
    ],
  };

  // Função para normalizar texto (remover acentos, caracteres especiais)
  function normalizarTexto(texto: string): string {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .replace(/\s+/g, "_")
      .toUpperCase()
      .trim();
  }

  // Função para gerar código do arquivo
  function gerarCodigoArquivo(dados: {
    cliente?: string;
    uf?: string;
    projeto?: string;
    subprojeto?: string;
    disciplina?: string;
    entrega?: string;
    tipoDocumento?: string;
    area?: string;
    periodo?: string;
    dataReferencia?: string;
    responsavel?: string;
    versao?: string;
    status?: string;
    extensao?: string;
  }): string {
    const partes = ["ECOBRASIL"];
    
    if (dados.cliente) partes.push(normalizarTexto(dados.cliente));
    if (dados.uf) partes.push(normalizarTexto(dados.uf));
    if (dados.projeto) partes.push(normalizarTexto(dados.projeto));
    if (dados.subprojeto) partes.push(normalizarTexto(dados.subprojeto));
    if (dados.disciplina) partes.push(normalizarTexto(dados.disciplina));
    if (dados.entrega) partes.push(normalizarTexto(dados.entrega));
    if (dados.tipoDocumento) partes.push(normalizarTexto(dados.tipoDocumento));
    if (dados.area) partes.push(normalizarTexto(dados.area));
    if (dados.periodo) partes.push(normalizarTexto(dados.periodo));
    if (dados.dataReferencia) partes.push(dados.dataReferencia);
    if (dados.responsavel) partes.push(normalizarTexto(dados.responsavel));
    if (dados.versao) partes.push(dados.versao);
    if (dados.status) partes.push(normalizarTexto(dados.status));
    
    let codigo = partes.join("-");
    if (dados.extensao) {
      codigo += "." + dados.extensao.toLowerCase();
    }
    
    return codigo;
  }

  // Função para calcular pasta destino baseado em DOC, STATUS e extensão
  function calcularPastaDestino(dados: {
    cliente?: string;
    uf?: string;
    projeto?: string;
    tipoDocumento?: string;
    status?: string;
    extensao?: string;
  }): string {
    const { cliente, uf, projeto, tipoDocumento, status, extensao } = dados;
    
    let basePath = `/ECOBRASIL_GESTAO_DADOS/02_PROJETOS`;
    
    if (cliente && uf && projeto) {
      basePath += `/ECOBRASIL_${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(projeto)}`;
    }
    
    const ext = extensao?.toLowerCase() || "";
    
    // Roteamento por tipo de documento
    if (tipoDocumento === "DAT") {
      return `${basePath}/03_BANCOS_DE_DADOS`;
    }
    
    if (tipoDocumento === "REL" || tipoDocumento === "NT") {
      let subpasta = "01_RASCUNHOS";
      if (status === "PRELIM") subpasta = "02_PRELIMINARES";
      else if (status === "FINAL") subpasta = "04_FINAIS";
      else if (status === "ASSIN" || status === "PROTOC") subpasta = "05_ASSINADOS_E_PROTOCOLADOS";
      return `${basePath}/04_RELATORIOS_E_PARECERES/${subpasta}`;
    }
    
    if (tipoDocumento === "OF") {
      return `${basePath}/08_COMUNICACAO_OFICIAL/01_OFICIOS`;
    }
    
    if (status === "PROTOC") {
      return `${basePath}/08_COMUNICACAO_OFICIAL/04_PROTOCOLADOS`;
    }
    
    // Roteamento por extensão
    if (["jpg", "jpeg", "png", "tif", "tiff", "webp", "gif"].includes(ext)) {
      return `${basePath}/06_IMAGENS_E_MIDIAS/01_FOTOS_CAMPO`;
    }
    
    if (["mp4", "avi", "mov", "mkv"].includes(ext)) {
      return `${basePath}/06_IMAGENS_E_MIDIAS/02_DRONES_E_VIDEOS`;
    }
    
    if (["gpkg", "shp", "geojson"].includes(ext)) {
      return `${basePath}/05_SIG_E_CARTOGRAFIA/01_DADOS_VETORIAIS`;
    }
    
    if (ext === "qgz" || ext === "qgs") {
      return `${basePath}/05_SIG_E_CARTOGRAFIA/03_PROJETOS_QGIS`;
    }
    
    if (["r", "R"].includes(ext)) {
      return `${basePath}/07_SCRIPTS_E_ANALISES/01_R`;
    }
    
    if (ext === "py") {
      return `${basePath}/07_SCRIPTS_E_ANALISES/02_PYTHON`;
    }
    
    if (ext === "sql") {
      return `${basePath}/07_SCRIPTS_E_ANALISES/03_SQL`;
    }
    
    if (ext === "ipynb") {
      return `${basePath}/07_SCRIPTS_E_ANALISES/04_NOTEBOOKS`;
    }
    
    // Default
    return `${basePath}/01_GESTAO_E_CONTRATOS`;
  }

  // Endpoint para garantir estrutura macro
  app.post('/api/datasets/estrutura/macro', requireAuth, async (req, res) => {
    try {
      const todasPastas = await db.select().from(datasetPastas);
      const caminhosExistentes = new Set(todasPastas.map(p => p.caminho));
      
      // Criar pasta raiz
      if (!caminhosExistentes.has("/ECOBRASIL_GESTAO_DADOS")) {
        await db.insert(datasetPastas).values({
          nome: "ECOBRASIL_GESTAO_DADOS",
          caminho: "/ECOBRASIL_GESTAO_DADOS",
          tipo: "macro",
        });
      }
      
      // Criar subpastas macro
      for (const pasta of ESTRUTURA_MACRO) {
        if (!caminhosExistentes.has(pasta.caminho)) {
          await db.insert(datasetPastas).values({
            nome: pasta.nome,
            caminho: pasta.caminho,
            pai: "/ECOBRASIL_GESTAO_DADOS",
            tipo: "macro",
          });
        }
      }
      
      // Buscar todos os empreendimentos ativos e criar pastas para cada um
      const empreendimentosList = await db.select().from(empreendimentos);
      
      for (const emp of empreendimentosList) {
        const nomeNormalizado = normalizarTexto(emp.nome);
        const empPath = `/ECOBRASIL_GESTAO_DADOS/02_PROJETOS/${nomeNormalizado}`;
        
        // Criar pasta do empreendimento
        if (!caminhosExistentes.has(empPath)) {
          await db.insert(datasetPastas).values({
            nome: nomeNormalizado,
            caminho: empPath,
            pai: "/ECOBRASIL_GESTAO_DADOS/02_PROJETOS",
            tipo: "empreendimento",
            empreendimentoId: emp.id,
          });
          caminhosExistentes.add(empPath);
        }
        
        // Criar subpastas do empreendimento
        const subpastasEmp = [
          "01_LICENCAS",
          "02_CONTRATOS", 
          "03_DOCUMENTOS_TECNICOS",
          "04_RELATORIOS",
          "05_MAPAS",
          "06_CORRESPONDENCIAS",
          "07_FOTOS",
          "08_PLANILHAS"
        ];
        
        for (const subpasta of subpastasEmp) {
          const subpastaPath = `${empPath}/${subpasta}`;
          if (!caminhosExistentes.has(subpastaPath)) {
            await db.insert(datasetPastas).values({
              nome: subpasta,
              caminho: subpastaPath,
              pai: empPath,
              tipo: "subpasta",
              empreendimentoId: emp.id,
            });
            caminhosExistentes.add(subpastaPath);
          }
        }
      }
      
      res.json({ success: true, message: "Estrutura macro e empreendimentos criada com sucesso" });
    } catch (error) {
      console.error('Error creating macro structure:', error);
      res.status(500).json({ error: 'Failed to create macro structure' });
    }
  });

  // Função auxiliar para criar pasta se não existir
  async function criarPastaSeNaoExistir(nome: string, caminho: string, pai: string | null, tipo: string, projetoId: number | null) {
    const existente = await db.select().from(datasetPastas).where(eq(datasetPastas.caminho, caminho));
    if (existente.length === 0) {
      await db.insert(datasetPastas).values({
        nome,
        caminho,
        pai,
        tipo,
        projetoId,
      });
    }
  }

  // Endpoint para garantir estrutura do projeto
  app.post('/api/datasets/estrutura/projeto', requireAuth, async (req, res) => {
    try {
      const { cliente, uf, projeto, projetoId } = req.body;
      
      if (!cliente || !uf || !projeto) {
        return res.status(400).json({ error: 'Cliente, UF e Projeto são obrigatórios' });
      }
      
      const projetoPath = `/ECOBRASIL_GESTAO_DADOS/02_PROJETOS/ECOBRASIL_${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(projeto)}`;
      
      // Criar pasta do projeto
      await criarPastaSeNaoExistir(
        `ECOBRASIL_${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(projeto)}`,
        projetoPath,
        "/ECOBRASIL_GESTAO_DADOS/02_PROJETOS",
        "projeto",
        projetoId || null
      );
      
      // Criar subpastas principais
      for (const subpasta of ESTRUTURA_PROJETO) {
        const subpastaPath = `${projetoPath}/${subpasta}`;
        await criarPastaSeNaoExistir(subpasta, subpastaPath, projetoPath, "subpasta", projetoId || null);
        
        // Criar subpastas detalhadas se existirem
        if (SUBPASTAS_DETALHADAS[subpasta]) {
          // Agrupar por pasta intermediária
          const intermediarios = new Set<string>();
          for (const detalhe of SUBPASTAS_DETALHADAS[subpasta]) {
            const partes = detalhe.split("/");
            if (partes.length > 1) {
              intermediarios.add(partes[0]);
            }
          }
          
          // Criar pastas intermediárias
          for (const intermediario of intermediarios) {
            const intermediarioPath = `${subpastaPath}/${intermediario}`;
            await criarPastaSeNaoExistir(intermediario, intermediarioPath, subpastaPath, "subpasta", projetoId || null);
          }
          
          // Criar pastas folha
          for (const detalhe of SUBPASTAS_DETALHADAS[subpasta]) {
            const partes = detalhe.split("/");
            if (partes.length === 1) {
              // Pasta direta (sem intermediário)
              const detalhePath = `${subpastaPath}/${detalhe}`;
              await criarPastaSeNaoExistir(detalhe, detalhePath, subpastaPath, "subpasta", projetoId || null);
            } else {
              // Pasta com intermediário
              const [intermediario, folha] = partes;
              const paiPath = `${subpastaPath}/${intermediario}`;
              const detalhePath = `${subpastaPath}/${detalhe}`;
              await criarPastaSeNaoExistir(folha, detalhePath, paiPath, "subpasta", projetoId || null);
            }
          }
        }
      }
      
      res.json({ success: true, message: "Estrutura do projeto criada/verificada com sucesso", path: projetoPath });
    } catch (error) {
      console.error('Error creating project structure:', error);
      res.status(500).json({ error: 'Failed to create project structure' });
    }
  });

  // Endpoint para listar pastas
  app.get('/api/datasets/pastas', requireAuth, async (req, res) => {
    try {
      const { tipo, pai } = req.query;
      
      let query = db.select().from(datasetPastas);
      
      if (tipo) {
        query = query.where(eq(datasetPastas.tipo, tipo as string)) as any;
      }
      if (pai) {
        query = query.where(eq(datasetPastas.pai, pai as string)) as any;
      }
      
      const pastas = await query;
      res.json(pastas);
    } catch (error) {
      console.error('Error fetching pastas:', error);
      res.status(500).json({ error: 'Failed to fetch pastas' });
    }
  });

  // Endpoint para gerar código de arquivo (preview)
  app.post('/api/datasets/gerar-codigo', requireAuth, async (req, res) => {
    try {
      const dados = req.body;
      
      const codigo = gerarCodigoArquivo(dados);
      const pastaDestino = calcularPastaDestino(dados);
      
      res.json({ codigo, pastaDestino });
    } catch (error) {
      console.error('Error generating code:', error);
      res.status(500).json({ error: 'Failed to generate code' });
    }
  });

  // Endpoint para upload com metadados avançados
  app.post('/api/datasets/upload-avancado', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const {
        empreendimentoId,
        nome,
        descricao,
        tipo,
        tamanho,
        url,
        cliente,
        uf,
        projeto,
        subprojeto,
        disciplina,
        tipoDocumento,
        entrega,
        area,
        periodo,
        responsavel,
        status,
        classificacao,
        titulo,
        hashSha256,
      } = req.body;
      
      // Gerar data de referência (AAAAMMDD)
      const hoje = new Date();
      const dataReferencia = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
      
      // Obter extensão do arquivo
      const extensao = nome.split('.').pop() || '';
      
      // Verificar se já existe documento com mesmo código base para versionar
      const codigoBase = gerarCodigoArquivo({
        cliente, uf, projeto, subprojeto, disciplina, entrega, tipoDocumento, area, periodo, dataReferencia, responsavel,
      });
      
      // Buscar versões existentes
      const existentes = await db.select().from(datasets).where(
        sql`${datasets.codigoArquivo} LIKE ${codigoBase + '%'}`
      );
      
      let versao = "V0.1";
      if (existentes.length > 0) {
        // Encontrar a maior versão
        const versoes = existentes.map(e => e.versao || "V0.0");
        const maxVersao = versoes.reduce((max, v) => {
          const numMax = parseFloat(max.replace("V", ""));
          const numV = parseFloat(v.replace("V", ""));
          return numV > numMax ? v : max;
        }, "V0.0");
        
        // Incrementar versão
        const numVersao = parseFloat(maxVersao.replace("V", ""));
        versao = `V${(numVersao + 0.1).toFixed(1)}`;
      }
      
      // Gerar código final com versão
      const codigoArquivo = gerarCodigoArquivo({
        cliente, uf, projeto, subprojeto, disciplina, entrega, tipoDocumento, area, periodo, dataReferencia, responsavel, versao, status, extensao,
      });
      
      // Calcular pasta destino
      const pastaDestino = calcularPastaDestino({ cliente, uf, projeto, tipoDocumento, status, extensao });
      
      // Garantir estrutura do projeto
      if (cliente && uf && projeto) {
        await db.insert(datasetPastas).values({
          nome: `ECOBRASIL_${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(projeto)}`,
          caminho: `/ECOBRASIL_GESTAO_DADOS/02_PROJETOS/ECOBRASIL_${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(projeto)}`,
          pai: "/ECOBRASIL_GESTAO_DADOS/02_PROJETOS",
          tipo: "projeto",
        }).onConflictDoNothing();
      }
      
      // Criar dataset
      const [dataset] = await db.insert(datasets).values({
        empreendimentoId,
        nome: codigoArquivo,
        descricao,
        tipo,
        tamanho,
        url,
        usuario: user?.nome || user?.email || "Sistema",
        codigoArquivo,
        cliente,
        uf,
        projeto,
        subprojeto,
        disciplina,
        tipoDocumento,
        entrega,
        area,
        periodo,
        dataReferencia,
        responsavel: responsavel || user?.nome,
        versao,
        status: status || "RASC",
        classificacao: classificacao || "INT",
        titulo,
        pastaDestino,
        hashSha256,
      }).returning();
      
      // Criar registro de versão
      await db.insert(datasetVersoes).values({
        datasetId: dataset.id,
        versao,
        nomeArquivo: codigoArquivo,
        storagePath: pastaDestino,
        hashSha256,
        tamanho,
        status: status || "RASC",
        criadoPor: user?.nome || user?.email || "Sistema",
      });
      
      // Criar audit trail
      await db.insert(datasetAuditTrail).values({
        datasetId: dataset.id,
        acao: "upload",
        userId: user?.id,
        usuario: user?.nome || user?.email || "Sistema",
        detalhes: { versao, pastaDestino, codigoArquivo },
      });
      
      res.status(201).json(dataset);
    } catch (error) {
      console.error('Error creating dataset:', error);
      res.status(500).json({ error: 'Failed to create dataset' });
    }
  });

  // Endpoint para obter histórico de versões
  app.get('/api/datasets/:id/versoes', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid dataset ID' });
      }
      
      const versoes = await db.select().from(datasetVersoes).where(eq(datasetVersoes.datasetId, id));
      res.json(versoes);
    } catch (error) {
      console.error('Error fetching versions:', error);
      res.status(500).json({ error: 'Failed to fetch versions' });
    }
  });

  // Endpoint para obter audit trail
  app.get('/api/datasets/:id/audit', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid dataset ID' });
      }
      
      const audit = await db.select().from(datasetAuditTrail).where(eq(datasetAuditTrail.datasetId, id));
      res.json(audit);
    } catch (error) {
      console.error('Error fetching audit trail:', error);
      res.status(500).json({ error: 'Failed to fetch audit trail' });
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

  // =============================================
  // PROJETOS MODULE - Gestão de Projetos
  // =============================================

  // Get all projetos with optional filter by empreendimentoId
  app.get('/api/projetos', requireAuth, async (req, res) => {
    try {
      const { empreendimentoId } = req.query;
      const projetos = await storage.getProjetos(
        empreendimentoId ? parseInt(String(empreendimentoId)) : undefined
      );
      res.json(projetos);
    } catch (error) {
      console.error('Error fetching projetos:', error);
      res.status(500).json({ error: 'Failed to fetch projetos' });
    }
  });

  // Get single projeto by ID
  app.get('/api/projetos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid projeto ID' });
      }
      const projeto = await storage.getProjetoById(id);
      if (!projeto) {
        return res.status(404).json({ error: 'Projeto not found' });
      }
      res.json(projeto);
    } catch (error) {
      console.error('Error fetching projeto:', error);
      res.status(500).json({ error: 'Failed to fetch projeto' });
    }
  });

  // Create new projeto
  app.post('/api/projetos', requireAuth, async (req, res) => {
    try {
      const validatedData = insertProjetoSchema.parse(req.body);
      const projeto = await storage.createProjeto(validatedData);
      res.status(201).json(projeto);
    } catch (error) {
      console.error('Error creating projeto:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create projeto' });
    }
  });

  // Update projeto
  app.put('/api/projetos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid projeto ID' });
      }
      const projeto = await storage.updateProjeto(id, req.body);
      res.json(projeto);
    } catch (error) {
      console.error('Error updating projeto:', error);
      res.status(500).json({ error: 'Failed to update projeto' });
    }
  });

  // Delete projeto
  app.delete('/api/projetos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid projeto ID' });
      }
      const deleted = await storage.deleteProjeto(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Projeto not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting projeto:', error);
      res.status(500).json({ error: 'Failed to delete projeto' });
    }
  });

  // ==== END PROJETOS ROUTES ====

  // ==== ARQUIVO ROUTES ====
  app.post('/api/arquivos/upload', requireAuth, arquivoController.upload.single('file'), arquivoController.uploadArquivo);
  app.get('/api/arquivos/:id/download', requireAuth, arquivoController.downloadArquivo);
  app.delete('/api/arquivos/:id', requireAuth, arquivoController.deleteArquivo);

  // ==== CONTRATO ROUTES ====
  // GET all contratos (with optional filters)
  app.get('/api/contratos', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req.session as any).userId);
      if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

      const { search, situacao, empreendimentoId } = req.query;
      
      let query = db.select({
        id: contratos.id,
        numero: contratos.numero,
        objeto: contratos.objeto,
        vigenciaInicio: contratos.vigenciaInicio,
        vigenciaFim: contratos.vigenciaFim,
        situacao: contratos.situacao,
        valorTotal: contratos.valorTotal,
        observacoes: contratos.observacoes,
        arquivoPdfId: contratos.arquivoPdfId,
        empreendimentoId: contratos.empreendimentoId,
        empreendimentoNome: empreendimentos.nome,
      }).from(contratos)
        .leftJoin(empreendimentos, eq(contratos.empreendimentoId, empreendimentos.id));

      const conditions = [];
      
      // Multi-tenant filter
      if (user.cargo !== 'admin' && user.cargo !== 'diretor') {
        conditions.push(eq(empreendimentos.unidade, user.unidade));
      }
      
      if (situacao && situacao !== 'all') {
        conditions.push(eq(contratos.situacao, situacao as string));
      }
      
      if (empreendimentoId && empreendimentoId !== 'all') {
        conditions.push(eq(contratos.empreendimentoId, parseInt(empreendimentoId as string)));
      }
      
      if (search) {
        const searchLower = `%${(search as string).toLowerCase()}%`;
        conditions.push(
          or(
            sql`LOWER(${contratos.numero}) LIKE ${searchLower}`,
            sql`LOWER(${contratos.objeto}) LIKE ${searchLower}`
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const result = await query.orderBy(desc(contratos.vigenciaFim));
      res.json(result);
    } catch (error) {
      console.error('Error fetching contratos:', error);
      res.status(500).json({ error: 'Erro ao buscar contratos' });
    }
  });

  app.get('/api/empreendimentos/:empreendimentoId/contratos', requireAuth, contratoController.getContratosByEmpreendimento);
  
  // Upload de PDF para contrato específico
  app.post('/api/empreendimentos/:empreendimentoId/contratos/:contratoId/pdf', requireAuth, arquivoController.upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }
      
      const contratoId = parseInt(req.params.contratoId);
      if (isNaN(contratoId)) {
        return res.status(400).json({ message: "ID do contrato inválido" });
      }
      
      const userId = (req.session as any).userId;
      const crypto = await import("crypto");
      const fs = await import("fs");
      
      const fileBuffer = fs.readFileSync(req.file.path);
      const checksum = crypto.createHash("md5").update(fileBuffer).digest("hex");
      
      const [arquivo] = await db.insert(arquivos).values({
        nome: req.file.originalname,
        mime: req.file.mimetype,
        tamanho: req.file.size,
        caminho: req.file.path,
        checksum,
        origem: "contrato",
        uploaderId: userId,
      }).returning();
      
      await db.update(contratos).set({ arquivoPdfId: arquivo.id }).where(eq(contratos.id, contratoId));
      
      res.json({ success: true, arquivo });
    } catch (error: any) {
      console.error("Erro ao fazer upload de PDF do contrato:", error);
      res.status(500).json({ message: error.message || "Erro ao fazer upload" });
    }
  });

  // Download de PDF do contrato
  app.get('/api/contratos/:id/pdf', requireAuth, async (req, res) => {
    try {
      const contratoId = parseInt(req.params.id);
      const [contrato] = await db.select().from(contratos).where(eq(contratos.id, contratoId)).limit(1);
      
      if (!contrato || !contrato.arquivoPdfId) {
        return res.status(404).json({ message: "PDF não encontrado" });
      }
      
      const [arquivo] = await db.select().from(arquivos).where(eq(arquivos.id, contrato.arquivoPdfId)).limit(1);
      if (!arquivo) {
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }
      
      const fs = await import("fs");
      if (!fs.existsSync(arquivo.caminho)) {
        return res.status(404).json({ message: "Arquivo não existe no servidor" });
      }
      
      res.setHeader('Content-Type', arquivo.mime);
      res.setHeader('Content-Disposition', `inline; filename="${arquivo.nome}"`);
      fs.createReadStream(arquivo.caminho).pipe(res);
    } catch (error: any) {
      console.error("Erro ao baixar PDF do contrato:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/contratos', requireAuth, contratoController.createContrato);
  app.patch('/api/contratos/:id', requireAuth, contratoController.updateContrato);
  app.delete('/api/contratos/:id', requireAuth, contratoController.deleteContrato);
  
  // Upload de documento para contrato
  app.post('/api/contratos/upload', requireAuth, arquivoController.upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
      }
      
      const contratoId = parseInt(req.body.contratoId);
      if (isNaN(contratoId)) {
        return res.status(400).json({ message: "ID do contrato inválido" });
      }
      
      const userId = (req.session as any).userId;
      const crypto = await import("crypto");
      const fs = await import("fs");
      
      // Calcular checksum do arquivo
      const fileBuffer = fs.readFileSync(req.file.path);
      const checksum = crypto.createHash("md5").update(fileBuffer).digest("hex");
      
      // Salvar arquivo no banco
      const [arquivo] = await db.insert(arquivos).values({
        nome: req.file.originalname,
        mime: req.file.mimetype,
        tamanho: req.file.size,
        caminho: req.file.path,
        checksum,
        origem: "contrato",
        uploaderId: userId,
      }).returning();
      
      // Atualizar contrato com o ID do arquivo
      await db.update(contratos).set({ arquivoPdfId: arquivo.id }).where(eq(contratos.id, contratoId));
      
      res.json({ success: true, arquivo });
    } catch (error: any) {
      console.error("Erro ao fazer upload de documento do contrato:", error);
      res.status(500).json({ message: error.message || "Erro ao fazer upload" });
    }
  });
  app.get('/api/contratos/:id/aditivos', requireAuth, contratoController.getAditivosByContrato);
  app.post('/api/contratos/:id/aditivos', requireAuth, contratoController.createAditivo);
  app.get('/api/contratos/:id/pagamentos', requireAuth, contratoController.getPagamentosByContrato);
  app.post('/api/contratos/:id/pagamentos', requireAuth, contratoController.createPagamento);
  app.patch('/api/pagamentos/:id', requireAuth, contratoController.updatePagamento);

  // ==== CAMPANHA ROUTES ====
  app.get('/api/empreendimentos/:empreendimentoId/campanhas', requireAuth, async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      if (isNaN(empreendimentoId)) {
        return res.status(400).json({ message: "ID de empreendimento inválido" });
      }
      const result = await db.select().from(campanhas).where(eq(campanhas.empreendimentoId, empreendimentoId));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/campanhas', requireAuth, async (req, res) => {
    try {
      const data = insertCampanhaSchema.parse(req.body);
      const [campanha] = await db.insert(campanhas).values(data).returning();
      res.json(campanha);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ==== CRONOGRAMA ROUTES ====
  
  // GET all cronograma items (with filters)
  app.get('/api/cronograma', requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const userUnidade = currentUser.unidade || 'goiania';
      const { empreendimentoId, projetoId, tipo, status } = req.query;
      
      const conditions = [eq(cronogramaItens.unidade, userUnidade)];
      
      if (empreendimentoId) {
        conditions.push(eq(cronogramaItens.empreendimentoId, parseInt(empreendimentoId as string)));
      }
      if (projetoId) {
        conditions.push(eq(cronogramaItens.projetoId, parseInt(projetoId as string)));
      }
      if (tipo && tipo !== 'todos') {
        conditions.push(eq(cronogramaItens.tipo, tipo as string));
      }
      if (status && status !== 'todos') {
        conditions.push(eq(cronogramaItens.status, status as string));
      }
      
      const result = await db.select().from(cronogramaItens).where(and(...conditions)).orderBy(cronogramaItens.dataInicio);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // GET cronograma by empreendimento
  app.get('/api/empreendimentos/:empreendimentoId/cronograma', requireAuth, async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      if (isNaN(empreendimentoId)) {
        return res.status(400).json({ message: "ID de empreendimento inválido" });
      }
      const result = await db.select().from(cronogramaItens).where(eq(cronogramaItens.empreendimentoId, empreendimentoId)).orderBy(cronogramaItens.dataInicio);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // GET cronograma by projeto
  app.get('/api/projetos/:projetoId/cronograma', requireAuth, async (req, res) => {
    try {
      const projetoId = parseInt(req.params.projetoId);
      if (isNaN(projetoId)) {
        return res.status(400).json({ message: "ID de projeto inválido" });
      }
      const result = await db.select().from(cronogramaItens).where(eq(cronogramaItens.projetoId, projetoId)).orderBy(cronogramaItens.dataInicio);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // GET single cronograma item
  app.get('/api/cronograma/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const [item] = await db.select().from(cronogramaItens).where(eq(cronogramaItens.id, id));
      if (!item) {
        return res.status(404).json({ message: "Item não encontrado" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // CREATE cronograma item
  app.post('/api/cronograma', requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const data = insertCronogramaItemSchema.parse({
        ...req.body,
        unidade: currentUser.unidade || 'goiania'
      });
      const [item] = await db.insert(cronogramaItens).values(data).returning();
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // UPDATE cronograma item
  app.put('/api/cronograma/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const [updated] = await db.update(cronogramaItens)
        .set({ ...req.body, atualizadoEm: new Date() })
        .where(eq(cronogramaItens.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Item não encontrado" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // DELETE cronograma item
  app.delete('/api/cronograma/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const [deleted] = await db.delete(cronogramaItens).where(eq(cronogramaItens.id, id)).returning();
      
      if (!deleted) {
        return res.status(404).json({ message: "Item não encontrado" });
      }
      res.json({ message: "Item excluído com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==== RH ROUTES ====
  app.get('/api/empreendimentos/:empreendimentoId/rh', requireAuth, async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      if (isNaN(empreendimentoId)) {
        return res.status(400).json({ message: "ID de empreendimento inválido" });
      }
      const result = await db.select().from(rhRegistros).where(
        and(
          eq(rhRegistros.empreendimentoId, empreendimentoId),
          isNull(rhRegistros.deletedAt)
        )
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/rh', requireAuth, async (req, res) => {
    try {
      const data = insertRhRegistroSchema.parse(req.body);
      const [registro] = await db.insert(rhRegistros).values(data).returning();
      res.json(registro);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/rh/upload-contrato', requireAuth, arquivoController.upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const crypto = await import('crypto');
      const checksum = crypto.createHash('md5').update(req.file.buffer).digest('hex');
      const userId = req.session.userId!;

      const [arquivo] = await db.insert(arquivos).values({
        nome: req.file.originalname,
        tipo: req.file.mimetype,
        tamanho: req.file.size,
        dados: req.file.buffer,
        checksum,
        origem: "contrato_rh",
        uploaderId: userId,
      }).returning();

      const url = `/api/arquivos/${arquivo.id}/download`;
      res.json({ url, arquivoId: arquivo.id, nome: arquivo.nome });
    } catch (error: any) {
      console.error("Upload contrato RH error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/rh/:id/documentos', requireAuth, arquivoController.upload.single('file'), async (req, res) => {
    try {
      const rhId = parseInt(req.params.id);
      if (isNaN(rhId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const rhRegistro = await db.select().from(rhRegistros).where(eq(rhRegistros.id, rhId)).limit(1);
      if (!rhRegistro.length) {
        return res.status(404).json({ message: "Registro de RH não encontrado" });
      }

      const crypto = await import('crypto');
      const checksum = crypto.createHash('md5').update(req.file.buffer).digest('hex');
      const userId = req.session.userId!;

      const [arquivo] = await db.insert(arquivos).values({
        nome: req.file.originalname,
        tipo: req.file.mimetype,
        tamanho: req.file.size,
        dados: req.file.buffer,
        checksum,
        origem: "rh",
        uploaderId: userId,
      }).returning();

      const currentArquivos = (rhRegistro[0].arquivosIdsJson as number[]) || [];
      await db.update(rhRegistros)
        .set({ arquivosIdsJson: [...currentArquivos, arquivo.id] })
        .where(eq(rhRegistros.id, rhId));

      res.json({ message: "Documento enviado com sucesso", arquivo });
    } catch (error: any) {
      console.error("Upload RH document error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/rh/:id/documentos', requireAuth, async (req, res) => {
    try {
      const rhId = parseInt(req.params.id);
      if (isNaN(rhId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      const rhRegistro = await db.select().from(rhRegistros).where(eq(rhRegistros.id, rhId)).limit(1);
      if (!rhRegistro.length) {
        return res.status(404).json({ message: "Registro não encontrado" });
      }

      const arquivoIds = (rhRegistro[0].arquivosIdsJson as number[]) || [];
      if (arquivoIds.length === 0) {
        return res.json([]);
      }

      const docs = await db.select({
        id: arquivos.id,
        nome: arquivos.nome,
        tipo: arquivos.tipo,
        tamanho: arquivos.tamanho,
        criadoEm: arquivos.criadoEm,
      }).from(arquivos).where(inArray(arquivos.id, arquivoIds));

      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/rh/:rhId/documentos/:docId', requireAuth, async (req, res) => {
    try {
      const rhId = parseInt(req.params.rhId);
      const docId = parseInt(req.params.docId);

      if (isNaN(rhId) || isNaN(docId)) {
        return res.status(400).json({ message: "IDs inválidos" });
      }

      const rhRegistro = await db.select().from(rhRegistros).where(eq(rhRegistros.id, rhId)).limit(1);
      if (!rhRegistro.length) {
        return res.status(404).json({ message: "Registro não encontrado" });
      }

      const currentArquivos = (rhRegistro[0].arquivosIdsJson as number[]) || [];
      const updatedArquivos = currentArquivos.filter(id => id !== docId);

      await db.update(rhRegistros)
        .set({ arquivosIdsJson: updatedArquivos })
        .where(eq(rhRegistros.id, rhId));

      await db.delete(arquivos).where(eq(arquivos.id, docId));

      res.json({ message: "Documento removido com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // COORDENADORES RANKING - GAMIFICATION
  // ========================================
  
  app.get('/api/coordenadores/ranking', requireAuth, async (req, res) => {
    try {
      // Get current user to filter by their unidade (multi-tenant isolation)
      const currentUser = await storage.getUser(req.session.userId!);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const userUnidade = currentUser.unidade || 'goiania';
      
      // Get all projetos grouped by coordenadorId with their financial totals - filtered by unidade
      const result = await db.execute(sql`
        SELECT 
          u.id as "userId",
          u.email,
          COUNT(p.id) as "totalProjetos",
          COALESCE(SUM(CAST(p.valor_contratado AS DECIMAL(15,2))), 0) as "valorContratado",
          COALESCE(SUM(CAST(p.valor_recebido AS DECIMAL(15,2))), 0) as "valorRecebido"
        FROM users u
        INNER JOIN projetos p ON p.coordenador_id = u.id
        INNER JOIN empreendimentos e ON p.empreendimento_id = e.id
        WHERE e.deleted_at IS NULL 
          AND e.unidade = ${userUnidade}
        GROUP BY u.id, u.email
        ORDER BY 
          CASE 
            WHEN COALESCE(SUM(CAST(p.valor_contratado AS DECIMAL(15,2))), 0) = 0 THEN 0
            ELSE COALESCE(SUM(CAST(p.valor_recebido AS DECIMAL(15,2))), 0) / COALESCE(SUM(CAST(p.valor_contratado AS DECIMAL(15,2))), 1) * 100
          END DESC
        LIMIT 10
      `);
      
      const ranking = result.rows.map((row: any) => ({
        userId: row.userId,
        email: row.email,
        totalProjetos: parseInt(row.totalProjetos) || 0,
        valorContratado: parseFloat(row.valorContratado) || 0,
        valorRecebido: parseFloat(row.valorRecebido) || 0,
        eficiencia: row.valorContratado > 0 
          ? (parseFloat(row.valorRecebido) / parseFloat(row.valorContratado)) * 100 
          : 0
      }));
      
      res.json(ranking);
    } catch (error) {
      console.error('Error fetching coordenadores ranking:', error);
      res.status(500).json({ error: 'Failed to fetch ranking' });
    }
  });

  // Get current user info (for dashboard)
  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, email: user.email, role: user.role, cargo: user.cargo, unidade: user.unidade });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // AI AGENT ROUTES - MULTI-TENANCY ENABLED
  // ========================================
  
  // Query the AI agent
  app.post("/api/ai/query", requireAuth, async (req, res) => {
    try {
      const { message, empreendimentoId } = req.body;
      // Use unidade from authenticated user (security - ignore client-provided value)
      const unidade = req.user?.unidade;
      
      if (!unidade) {
        return res.status(400).json({ message: "Unidade do usuário não definida" });
      }
      
      if (!message) {
        return res.status(400).json({ message: "Mensagem é obrigatória" });
      }
      
      const { processQuery } = await import("./ai/aiService");
      const response = await processQuery({
        unidade,
        userId: req.session.userId!,
        message,
        empreendimentoId,
      });
      
      res.json({ response });
    } catch (error: any) {
      console.error("AI query error:", error);
      res.status(500).json({ message: error.message || "Erro ao processar pergunta" });
    }
  });
  
  // Get conversation history
  app.get("/api/ai/history", requireAuth, async (req, res) => {
    try {
      // Use unidade from authenticated user (security - ignore client-provided value)
      const unidade = req.user?.unidade;
      
      if (!unidade) {
        return res.status(400).json({ message: "Unidade do usuário não definida" });
      }
      
      const { getConversationHistory } = await import("./ai/aiService");
      const history = await getConversationHistory(unidade, req.session.userId!, 20);
      res.json(history);
    } catch (error: any) {
      console.error("Get history error:", error);
      res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });
  
  // Index a document
  app.post("/api/ai/index", requireAuth, async (req, res) => {
    try {
      const { content, source, sourceType, empreendimentoId, metadata } = req.body;
      // Use unidade from authenticated user (security - ignore client-provided value)
      const unidade = req.user?.unidade;
      
      if (!unidade) {
        return res.status(400).json({ message: "Unidade do usuário não definida" });
      }
      
      if (!content || !source || !sourceType) {
        return res.status(400).json({ message: "Campos obrigatórios faltando" });
      }
      
      const { indexDocument } = await import("./ai/retriever");
      await indexDocument(unidade, content, source, sourceType, empreendimentoId, metadata);
      
      res.json({ message: "Documento indexado com sucesso" });
    } catch (error: any) {
      console.error("Index document error:", error);
      res.status(500).json({ message: "Erro ao indexar documento" });
    }
  });
  
  // Get available actions
  app.get("/api/ai/actions", requireAuth, async (req, res) => {
    try {
      const { ACOES_DISPONIVEIS } = await import("./ai/actions");
      res.json(ACOES_DISPONIVEIS);
    } catch (error: any) {
      console.error("Get actions error:", error);
      res.status(500).json({ message: "Erro ao buscar ações" });
    }
  });

  // =============================================
  // CLIENT PORTAL AUTHENTICATION ROUTES
  // =============================================

  // POST /api/cliente-auth/login - Login for cliente_usuarios
  app.post("/api/cliente-auth/login", async (req, res) => {
    try {
      const { email, password } = clienteLoginSchema.parse(req.body);
      
      const [clienteUsuario] = await db
        .select()
        .from(clienteUsuarios)
        .where(and(
          eq(clienteUsuarios.email, email),
          eq(clienteUsuarios.ativo, true)
        ))
        .limit(1);
      
      if (!clienteUsuario) {
        return res.status(401).json({ message: "E-mail ou senha inválidos" });
      }

      const isValidPassword = await bcrypt.compare(password, clienteUsuario.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "E-mail ou senha inválidos" });
      }

      // Update ultimo acesso
      await db
        .update(clienteUsuarios)
        .set({ ultimoAcesso: new Date() })
        .where(eq(clienteUsuarios.id, clienteUsuario.id));

      // Create session with cliente info
      req.session.clienteUsuarioId = clienteUsuario.id;
      req.session.clienteId = clienteUsuario.clienteId;

      // Get cliente info
      const [cliente] = await db
        .select()
        .from(clientes)
        .where(eq(clientes.id, clienteUsuario.clienteId))
        .limit(1);

      res.json({ 
        message: "Login bem-sucedido",
        user: { 
          id: clienteUsuario.id, 
          nome: clienteUsuario.nome,
          email: clienteUsuario.email, 
          role: clienteUsuario.role,
          cargo: clienteUsuario.cargo,
        },
        cliente: cliente ? {
          id: cliente.id,
          razaoSocial: cliente.razaoSocial,
          nomeFantasia: cliente.nomeFantasia,
        } : null
      });
    } catch (error) {
      console.error("Cliente login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos" });
      }
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // POST /api/cliente-auth/logout - Logout for clients
  app.post("/api/cliente-auth/logout", (req, res) => {
    req.session.clienteUsuarioId = undefined;
    req.session.clienteId = undefined;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout bem-sucedido" });
    });
  });

  // GET /api/cliente-auth/me - Get current client user info
  app.get("/api/cliente-auth/me", requireClienteAuth, async (req, res) => {
    try {
      const [cliente] = await db
        .select()
        .from(clientes)
        .where(eq(clientes.id, req.clienteId))
        .limit(1);

      res.json({
        user: {
          id: req.clienteUsuario.id,
          nome: req.clienteUsuario.nome,
          email: req.clienteUsuario.email,
          role: req.clienteUsuario.role,
          cargo: req.clienteUsuario.cargo,
        },
        cliente: cliente ? {
          id: cliente.id,
          razaoSocial: cliente.razaoSocial,
          nomeFantasia: cliente.nomeFantasia,
          cnpj: cliente.cnpj,
          email: cliente.email,
          telefone: cliente.telefone,
        } : null
      });
    } catch (error) {
      console.error("Get cliente user error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // =============================================
  // CLIENT PORTAL API ROUTES (read-only access)
  // =============================================

  // GET /api/cliente/empreendimentos - List empreendimentos for logged-in client
  app.get("/api/cliente/empreendimentos", requireClienteAuth, async (req, res) => {
    try {
      const result = await db
        .select({
          id: empreendimentos.id,
          nome: empreendimentos.nome,
          localizacao: empreendimentos.localizacao,
          tipo: empreendimentos.tipo,
          status: empreendimentos.status,
          municipio: empreendimentos.municipio,
          uf: empreendimentos.uf,
          dataInicio: empreendimentos.dataInicio,
          dataFimPrevista: empreendimentos.dataFimPrevista,
        })
        .from(empreendimentos)
        .where(and(
          eq(empreendimentos.clienteId, req.clienteId),
          isNull(empreendimentos.deletedAt)
        ));

      res.json(result);
    } catch (error) {
      console.error("Get cliente empreendimentos error:", error);
      res.status(500).json({ message: "Erro ao buscar empreendimentos" });
    }
  });

  // GET /api/cliente/empreendimentos/:id - Get single empreendimento detail
  app.get("/api/cliente/empreendimentos/:id", requireClienteAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const [empreendimento] = await db
        .select()
        .from(empreendimentos)
        .where(and(
          eq(empreendimentos.id, id),
          eq(empreendimentos.clienteId, req.clienteId),
          isNull(empreendimentos.deletedAt)
        ))
        .limit(1);

      if (!empreendimento) {
        return res.status(404).json({ message: "Empreendimento não encontrado" });
      }

      // Get counts for licencas and demandas
      const [licencasResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(licencasAmbientais)
        .where(eq(licencasAmbientais.empreendimentoId, id));

      const [demandasResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(demandas)
        .where(eq(demandas.empreendimentoId, id));

      res.json({
        ...empreendimento,
        licencasCount: licencasResult?.count || 0,
        demandasCount: demandasResult?.count || 0,
      });
    } catch (error) {
      console.error("Get cliente empreendimento error:", error);
      res.status(500).json({ message: "Erro ao buscar empreendimento" });
    }
  });

  // GET /api/cliente/empreendimentos/:id/licencas - List licenses for an empreendimento
  app.get("/api/cliente/empreendimentos/:id/licencas", requireClienteAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verify ownership
      const [empreendimento] = await db
        .select({ id: empreendimentos.id })
        .from(empreendimentos)
        .where(and(
          eq(empreendimentos.id, id),
          eq(empreendimentos.clienteId, req.clienteId),
          isNull(empreendimentos.deletedAt)
        ))
        .limit(1);

      if (!empreendimento) {
        return res.status(404).json({ message: "Empreendimento não encontrado" });
      }

      const licencas = await db
        .select({
          id: licencasAmbientais.id,
          numero: licencasAmbientais.numero,
          tipo: licencasAmbientais.tipo,
          orgaoEmissor: licencasAmbientais.orgaoEmissor,
          dataEmissao: licencasAmbientais.dataEmissao,
          validade: licencasAmbientais.validade,
          status: licencasAmbientais.status,
        })
        .from(licencasAmbientais)
        .where(eq(licencasAmbientais.empreendimentoId, id));

      res.json(licencas);
    } catch (error) {
      console.error("Get cliente licencas error:", error);
      res.status(500).json({ message: "Erro ao buscar licenças" });
    }
  });

  // GET /api/cliente/empreendimentos/:id/demandas - List demandas for an empreendimento
  app.get("/api/cliente/empreendimentos/:id/demandas", requireClienteAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verify ownership
      const [empreendimento] = await db
        .select({ id: empreendimentos.id })
        .from(empreendimentos)
        .where(and(
          eq(empreendimentos.id, id),
          eq(empreendimentos.clienteId, req.clienteId),
          isNull(empreendimentos.deletedAt)
        ))
        .limit(1);

      if (!empreendimento) {
        return res.status(404).json({ message: "Empreendimento não encontrado" });
      }

      const demandasList = await db
        .select({
          id: demandas.id,
          titulo: demandas.titulo,
          descricao: demandas.descricao,
          setor: demandas.setor,
          prioridade: demandas.prioridade,
          status: demandas.status,
          dataEntrega: demandas.dataEntrega,
          criadoEm: demandas.criadoEm,
        })
        .from(demandas)
        .where(eq(demandas.empreendimentoId, id));

      res.json(demandasList);
    } catch (error) {
      console.error("Get cliente demandas error:", error);
      res.status(500).json({ message: "Erro ao buscar demandas" });
    }
  });

  // GET /api/cliente/documentos - List uploaded documents by client
  app.get("/api/cliente/documentos", requireClienteAuth, async (req, res) => {
    try {
      const documentos = await db
        .select({
          id: clienteDocumentos.id,
          nome: clienteDocumentos.nome,
          descricao: clienteDocumentos.descricao,
          arquivoUrl: clienteDocumentos.arquivoUrl,
          tipo: clienteDocumentos.tipo,
          tamanho: clienteDocumentos.tamanho,
          criadoEm: clienteDocumentos.criadoEm,
          empreendimentoId: clienteDocumentos.empreendimentoId,
        })
        .from(clienteDocumentos)
        .where(eq(clienteDocumentos.clienteUsuarioId, req.session.clienteUsuarioId!));

      res.json(documentos);
    } catch (error) {
      console.error("Get cliente documentos error:", error);
      res.status(500).json({ message: "Erro ao buscar documentos" });
    }
  });

  // POST /api/cliente/documentos - Upload document (client can upload)
  app.post("/api/cliente/documentos", requireClienteAuth, async (req, res) => {
    try {
      const { empreendimentoId, nome, descricao, arquivoUrl, tipo, tamanho } = req.body;

      if (!empreendimentoId || !nome || !arquivoUrl || !tipo || !tamanho) {
        return res.status(400).json({ message: "Campos obrigatórios faltando" });
      }

      // Verify empreendimento belongs to client
      const [empreendimento] = await db
        .select({ id: empreendimentos.id })
        .from(empreendimentos)
        .where(and(
          eq(empreendimentos.id, empreendimentoId),
          eq(empreendimentos.clienteId, req.clienteId),
          isNull(empreendimentos.deletedAt)
        ))
        .limit(1);

      if (!empreendimento) {
        return res.status(403).json({ message: "Empreendimento não pertence ao cliente" });
      }

      const [documento] = await db
        .insert(clienteDocumentos)
        .values({
          clienteUsuarioId: req.session.clienteUsuarioId!,
          empreendimentoId,
          nome,
          descricao,
          arquivoUrl,
          tipo,
          tamanho,
        })
        .returning();

      res.status(201).json(documento);
    } catch (error) {
      console.error("Create cliente documento error:", error);
      res.status(500).json({ message: "Erro ao criar documento" });
    }
  });

  // =============================================
  // INTERNAL ADMIN ROUTES FOR MANAGING CLIENTES
  // =============================================

  // GET /api/clientes - List all clientes (for internal users)
  app.get("/api/clientes", requireAuth, async (req, res) => {
    try {
      const unidade = req.user?.unidade;
      
      const result = await db
        .select()
        .from(clientes)
        .where(unidade ? eq(clientes.unidade, unidade) : sql`1=1`)
        .orderBy(clientes.razaoSocial);

      res.json(result);
    } catch (error) {
      console.error("Get clientes error:", error);
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  });

  // POST /api/clientes - Create new cliente (for internal users)
  app.post("/api/clientes", requireAuth, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade;
      if (!userUnidade) {
        return res.status(400).json({ message: "Unidade do usuário não definida" });
      }

      const data = insertClienteSchema.parse({
        ...req.body,
        unidade: userUnidade,
      });

      const [cliente] = await db
        .insert(clientes)
        .values(data)
        .returning();

      res.status(201).json(cliente);
    } catch (error) {
      console.error("Create cliente error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao criar cliente" });
    }
  });

  // PATCH /api/clientes/:id - Update cliente (for internal users)
  app.patch("/api/clientes/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;

      // Verify cliente exists and belongs to user's unit
      const [existing] = await db
        .select()
        .from(clientes)
        .where(and(
          eq(clientes.id, id),
          userUnidade ? eq(clientes.unidade, userUnidade) : sql`1=1`
        ))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      const { unidade: _ignored, ...bodyWithoutUnidade } = req.body;
      const data = insertClienteSchema.partial().parse(bodyWithoutUnidade);

      const [updated] = await db
        .update(clientes)
        .set({ ...data, atualizadoEm: new Date() })
        .where(eq(clientes.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Update cliente error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao atualizar cliente" });
    }
  });

  // POST /api/clientes/:id/usuarios - Create user for cliente (for internal users)
  app.post("/api/clientes/:id/usuarios", requireAuth, async (req, res) => {
    try {
      const clienteId = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;

      // Verify cliente exists and belongs to user's unit
      const [cliente] = await db
        .select()
        .from(clientes)
        .where(and(
          eq(clientes.id, clienteId),
          userUnidade ? eq(clientes.unidade, userUnidade) : sql`1=1`
        ))
        .limit(1);

      if (!cliente) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      const { password, ...userData } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres" });
      }

      // Check if email already exists
      const [existingUser] = await db
        .select()
        .from(clienteUsuarios)
        .where(eq(clienteUsuarios.email, userData.email))
        .limit(1);

      if (existingUser) {
        return res.status(400).json({ message: "E-mail já está em uso" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const data = insertClienteUsuarioSchema.parse({
        ...userData,
        clienteId,
        passwordHash,
      });

      const [usuario] = await db
        .insert(clienteUsuarios)
        .values(data)
        .returning();

      const { passwordHash: _, ...userWithoutPassword } = usuario;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create cliente usuario error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao criar usuário do cliente" });
    }
  });

  // GET /api/clientes/:id/usuarios - List users for a cliente (for internal users)
  app.get("/api/clientes/:id/usuarios", requireAuth, async (req, res) => {
    try {
      const clienteId = parseInt(req.params.id);
      const userUnidade = req.user?.unidade;

      // Verify cliente exists and belongs to user's unit
      const [cliente] = await db
        .select()
        .from(clientes)
        .where(and(
          eq(clientes.id, clienteId),
          userUnidade ? eq(clientes.unidade, userUnidade) : sql`1=1`
        ))
        .limit(1);

      if (!cliente) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }

      const usuarios = await db
        .select({
          id: clienteUsuarios.id,
          nome: clienteUsuarios.nome,
          email: clienteUsuarios.email,
          cargo: clienteUsuarios.cargo,
          telefone: clienteUsuarios.telefone,
          role: clienteUsuarios.role,
          ativo: clienteUsuarios.ativo,
          ultimoAcesso: clienteUsuarios.ultimoAcesso,
          criadoEm: clienteUsuarios.criadoEm,
        })
        .from(clienteUsuarios)
        .where(eq(clienteUsuarios.clienteId, clienteId));

      res.json(usuarios);
    } catch (error) {
      console.error("Get cliente usuarios error:", error);
      res.status(500).json({ message: "Erro ao buscar usuários do cliente" });
    }
  });

  // ======== AUDIT LOG ROUTES ========
  app.get('/api/audit-logs', requireAuth, async (req, res) => {
    try {
      const { tabela, registroId, acao, usuarioId, startDate, endDate, search, limit, offset } = req.query;
      
      const logs = await auditLogService.getHistory({
        tabela: tabela as string,
        registroId: registroId ? parseInt(String(registroId)) : undefined,
        acao: acao as string,
        usuarioId: usuarioId ? parseInt(String(usuarioId)) : undefined,
        startDate: startDate ? new Date(String(startDate)) : undefined,
        endDate: endDate ? new Date(String(endDate)) : undefined,
        search: search as string,
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0
      });
      
      res.json(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico de alterações' });
    }
  });

  app.get('/api/audit-logs/record/:tabela/:registroId', requireAuth, async (req, res) => {
    try {
      const { tabela, registroId } = req.params;
      const logs = await auditLogService.getRecordHistory(tabela, parseInt(registroId));
      res.json(logs);
    } catch (error) {
      console.error('Error fetching record history:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico do registro' });
    }
  });

  // ======== REAL-TIME NOTIFICATIONS ROUTES ========
  app.get('/api/notifications/realtime', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const notifications = await db.select()
        .from(realTimeNotifications)
        .where(eq(realTimeNotifications.usuarioId, userId))
        .orderBy(realTimeNotifications.criadoEm)
        .limit(50);
      
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
  });

  app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const count = await websocketService.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Erro ao buscar contagem de notificações' });
    }
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await websocketService.markNotificationAsRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Erro ao marcar notificação como lida' });
    }
  });

  app.post('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await websocketService.markAllAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Erro ao marcar todas notificações como lidas' });
    }
  });

  // ======== DOCUMENTS ROUTES ========
  app.get('/api/documentos', requireAuth, async (req, res) => {
    try {
      const { categoria, empreendimentoId, licencaId, lancamentoId, contratoId, equipamentoId, veiculoId } = req.query;
      
      let query = db.select().from(documentos);
      const conditions = [];
      
      if (categoria) conditions.push(eq(documentos.categoria, String(categoria)));
      if (empreendimentoId) conditions.push(eq(documentos.empreendimentoId, parseInt(String(empreendimentoId))));
      if (licencaId) conditions.push(eq(documentos.licencaId, parseInt(String(licencaId))));
      if (lancamentoId) conditions.push(eq(documentos.lancamentoId, parseInt(String(lancamentoId))));
      if (contratoId) conditions.push(eq(documentos.contratoId, parseInt(String(contratoId))));
      if (equipamentoId) conditions.push(eq(documentos.equipamentoId, parseInt(String(equipamentoId))));
      if (veiculoId) conditions.push(eq(documentos.veiculoId, parseInt(String(veiculoId))));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const docs = await query;
      res.json(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Erro ao buscar documentos' });
    }
  });

  app.post('/api/documentos', requireAuth, async (req, res) => {
    try {
      const data = insertDocumentoSchema.parse({
        ...req.body,
        uploadedBy: req.session.userId,
        uploadedByNome: req.user?.email
      });
      
      const [doc] = await db.insert(documentos).values(data).returning();
      
      await auditLogService.logCreate('documentos', doc.id, doc, req.session.userId, req.user?.email, req);
      
      res.status(201).json(doc);
    } catch (error) {
      console.error('Error creating document:', error);
      res.status(500).json({ error: 'Erro ao criar documento' });
    }
  });

  app.delete('/api/documentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(documentos).where(eq(documentos.id, id));
      
      if (!existing) {
        return res.status(404).json({ error: 'Documento não encontrado' });
      }
      
      await db.delete(documentos).where(eq(documentos.id, id));
      
      await auditLogService.logDelete('documentos', id, existing, req.session.userId, req.user?.email, req);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: 'Erro ao excluir documento' });
    }
  });

  // ======== SCHEDULED REPORTS ROUTES ========
  app.get('/api/scheduled-reports', requireAuth, async (req, res) => {
    try {
      const reports = await scheduledReportsService.getReports();
      res.json(reports);
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      res.status(500).json({ error: 'Erro ao buscar relatórios agendados' });
    }
  });

  app.post('/api/scheduled-reports', requireAuth, async (req, res) => {
    try {
      const data = insertScheduledReportSchema.parse({
        ...req.body,
        criadoPor: req.session.userId
      });
      
      const report = await scheduledReportsService.addReport(data);
      res.status(201).json(report);
    } catch (error) {
      console.error('Error creating scheduled report:', error);
      res.status(500).json({ error: 'Erro ao criar relatório agendado' });
    }
  });

  app.put('/api/scheduled-reports/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const report = await scheduledReportsService.updateReport(id, req.body);
      res.json(report);
    } catch (error) {
      console.error('Error updating scheduled report:', error);
      res.status(500).json({ error: 'Erro ao atualizar relatório agendado' });
    }
  });

  app.delete('/api/scheduled-reports/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await scheduledReportsService.deleteReport(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting scheduled report:', error);
      res.status(500).json({ error: 'Erro ao excluir relatório agendado' });
    }
  });

  app.post('/api/scheduled-reports/:id/execute', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await scheduledReportsService.executeReport(id);
      res.json({ success: true, message: 'Relatório enviado com sucesso' });
    } catch (error) {
      console.error('Error executing scheduled report:', error);
      res.status(500).json({ error: 'Erro ao executar relatório' });
    }
  });

  // ======== GESTÃO DE EQUIPE ROUTES ========
  
  // Middleware para verificar se é coordenador
  const requireCoordenador = async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.user.cargo !== 'coordenador' && req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Acesso restrito a coordenadores" });
    }
    next();
  };

  // Listar membros da equipe
  app.get('/api/equipe', requireAuth, async (req, res) => {
    try {
      const { unidade, coordenadorId, ativo } = req.query;
      
      const filters: any = {};
      if (unidade) filters.unidade = unidade as string;
      if (coordenadorId) filters.coordenadorId = parseInt(coordenadorId as string);
      if (ativo !== undefined) filters.ativo = ativo === 'true';
      
      // Se não for admin/diretor, filtrar por unidade do usuário
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        filters.unidade = req.user.unidade;
      }
      
      // Se for coordenador, mostrar apenas sua equipe
      if (req.user.cargo === 'coordenador') {
        filters.coordenadorId = req.user.id;
      }
      
      const membros = await storage.getMembrosEquipe(filters);
      res.json(membros);
    } catch (error) {
      console.error('Error fetching team members:', error);
      res.status(500).json({ error: 'Erro ao buscar membros da equipe' });
    }
  });

  // Buscar membro por ID
  app.get('/api/equipe/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const membro = await storage.getMembroEquipeById(id);
      
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      
      res.json(membro);
    } catch (error) {
      console.error('Error fetching team member:', error);
      res.status(500).json({ error: 'Erro ao buscar membro' });
    }
  });

  // Criar membro da equipe
  app.post('/api/equipe', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const data = insertMembroEquipeSchema.parse(req.body);
      
      // Se for coordenador, definir automaticamente como coordenador do membro
      if (req.user.cargo === 'coordenador') {
        data.coordenadorId = req.user.id;
        data.unidade = req.user.unidade;
      }
      
      const membro = await storage.createMembroEquipe(data);
      
      await auditLogService.logCreate('membros_equipe', membro.id, membro, req.session.userId, req.user?.email, req);
      
      res.status(201).json(membro);
    } catch (error) {
      console.error('Error creating team member:', error);
      res.status(500).json({ error: 'Erro ao criar membro da equipe' });
    }
  });

  // Atualizar membro da equipe
  app.put('/api/equipe/:id', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMembroEquipeById(id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      
      // Verificar se o coordenador tem permissão para editar este membro
      if (req.user.cargo === 'coordenador' && existing.coordenadorId !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para editar este membro' });
      }
      
      const membro = await storage.updateMembroEquipe(id, req.body);
      
      await auditLogService.logUpdate('membros_equipe', id, existing, membro, req.session.userId, req.user?.email, req);
      
      res.json(membro);
    } catch (error) {
      console.error('Error updating team member:', error);
      res.status(500).json({ error: 'Erro ao atualizar membro' });
    }
  });

  // Excluir membro da equipe
  app.delete('/api/equipe/:id', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getMembroEquipeById(id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      
      await storage.deleteMembroEquipe(id);
      
      await auditLogService.logDelete('membros_equipe', id, existing, req.session.userId, req.user?.email, req);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting team member:', error);
      res.status(500).json({ error: 'Erro ao excluir membro' });
    }
  });

  // Buscar equipe do coordenador atual
  app.get('/api/minha-equipe', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const membros = await storage.getEquipeDoCoordenador(req.user.id);
      res.json(membros);
    } catch (error) {
      console.error('Error fetching my team:', error);
      res.status(500).json({ error: 'Erro ao buscar minha equipe' });
    }
  });

  // ======== VINCULAÇÃO MEMBROS-EMPREENDIMENTOS ========

  // Listar empreendimentos vinculados a um membro (scoped by unidade)
  app.get('/api/equipe/:id/empreendimentos', requireAuth, async (req, res) => {
    try {
      const membroId = parseInt(req.params.id);
      const userUnidade = req.user.unidade;
      
      // Verify member belongs to user's unidade (unless admin/diretor)
      const membro = await storage.getMembroEquipeById(membroId);
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && membro.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para acessar este membro' });
      }
      
      const vinculacoes = await storage.getMembroEmpreendimentos(membroId);
      res.json(vinculacoes);
    } catch (error) {
      console.error('Error fetching member empreendimentos:', error);
      res.status(500).json({ error: 'Erro ao buscar empreendimentos do membro' });
    }
  });

  // Listar membros vinculados a um empreendimento (scoped by unidade)
  app.get('/api/empreendimentos/:id/equipe', requireAuth, async (req, res) => {
    try {
      const empreendimentoId = parseInt(req.params.id);
      const userUnidade = req.user.unidade;
      
      // Verify empreendimento belongs to user's unidade
      const emp = await storage.getEmpreendimento(empreendimentoId, userUnidade);
      if (!emp && req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Sem permissão para acessar este empreendimento' });
      }
      
      const membros = await storage.getMembrosDoEmpreendimento(empreendimentoId);
      res.json(membros);
    } catch (error) {
      console.error('Error fetching empreendimento team members:', error);
      res.status(500).json({ error: 'Erro ao buscar membros do empreendimento' });
    }
  });

  // Vincular membro a empreendimento (scoped by unidade)
  app.post('/api/equipe/:membroId/empreendimentos/:empreendimentoId', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const membroId = parseInt(req.params.membroId);
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const userUnidade = req.user.unidade;
      
      // Verify member belongs to user's unidade
      const membro = await storage.getMembroEquipeById(membroId);
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && membro.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para vincular este membro' });
      }
      
      // Verify empreendimento belongs to same unidade
      const emp = await storage.getEmpreendimento(empreendimentoId, membro.unidade);
      if (!emp) {
        return res.status(404).json({ error: 'Empreendimento não encontrado ou não pertence à mesma unidade' });
      }
      
      const vinculacao = await storage.vincularMembroEmpreendimento(membroId, empreendimentoId, membro.unidade);
      res.status(201).json(vinculacao);
    } catch (error) {
      console.error('Error linking member to empreendimento:', error);
      res.status(500).json({ error: 'Erro ao vincular membro ao empreendimento' });
    }
  });

  // Desvincular membro de empreendimento (scoped by unidade)
  app.delete('/api/equipe/:membroId/empreendimentos/:empreendimentoId', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const membroId = parseInt(req.params.membroId);
      const empreendimentoId = parseInt(req.params.empreendimentoId);
      const userUnidade = req.user.unidade;
      
      // Verify member belongs to user's unidade
      const membro = await storage.getMembroEquipeById(membroId);
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && membro.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para desvincular este membro' });
      }
      
      const success = await storage.desvincularMembroEmpreendimento(membroId, empreendimentoId);
      res.json({ success });
    } catch (error) {
      console.error('Error unlinking member from empreendimento:', error);
      res.status(500).json({ error: 'Erro ao desvincular membro do empreendimento' });
    }
  });

  // ======== VINCULAÇÃO MEMBROS-PROJETOS ========

  // Listar projetos vinculados a um membro (scoped by unidade)
  app.get('/api/equipe/:id/projetos', requireAuth, async (req, res) => {
    try {
      const membroId = parseInt(req.params.id);
      const userUnidade = req.user.unidade;
      
      // Verify member belongs to user's unidade
      const membro = await storage.getMembroEquipeById(membroId);
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && membro.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para acessar este membro' });
      }
      
      const vinculacoes = await storage.getMembroProjetos(membroId);
      res.json(vinculacoes);
    } catch (error) {
      console.error('Error fetching member projetos:', error);
      res.status(500).json({ error: 'Erro ao buscar projetos do membro' });
    }
  });

  // Listar membros vinculados a um projeto (scoped by unidade)
  app.get('/api/projetos/:id/equipe', requireAuth, async (req, res) => {
    try {
      const projetoId = parseInt(req.params.id);
      const userUnidade = req.user.unidade;
      
      // Verify projeto belongs to user's unidade
      const projeto = await storage.getProjetoById(projetoId);
      if (!projeto) {
        return res.status(404).json({ error: 'Projeto não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && projeto.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para acessar este projeto' });
      }
      
      const membros = await storage.getMembrosDoProjeto(projetoId);
      res.json(membros);
    } catch (error) {
      console.error('Error fetching projeto team members:', error);
      res.status(500).json({ error: 'Erro ao buscar membros do projeto' });
    }
  });

  // Vincular membro a projeto (scoped by unidade)
  app.post('/api/equipe/:membroId/projetos/:projetoId', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const membroId = parseInt(req.params.membroId);
      const projetoId = parseInt(req.params.projetoId);
      const userUnidade = req.user.unidade;
      
      // Verify member belongs to user's unidade
      const membro = await storage.getMembroEquipeById(membroId);
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && membro.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para vincular este membro' });
      }
      
      // Verify projeto belongs to same unidade
      const projeto = await storage.getProjetoById(projetoId);
      if (!projeto || projeto.unidade !== membro.unidade) {
        return res.status(404).json({ error: 'Projeto não encontrado ou não pertence à mesma unidade' });
      }
      
      const vinculacao = await storage.vincularMembroProjeto(membroId, projetoId, membro.unidade);
      res.status(201).json(vinculacao);
    } catch (error) {
      console.error('Error linking member to projeto:', error);
      res.status(500).json({ error: 'Erro ao vincular membro ao projeto' });
    }
  });

  // Desvincular membro de projeto (scoped by unidade)
  app.delete('/api/equipe/:membroId/projetos/:projetoId', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const membroId = parseInt(req.params.membroId);
      const projetoId = parseInt(req.params.projetoId);
      const userUnidade = req.user.unidade;
      
      // Verify member belongs to user's unidade
      const membro = await storage.getMembroEquipeById(membroId);
      if (!membro) {
        return res.status(404).json({ error: 'Membro não encontrado' });
      }
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && membro.unidade !== userUnidade) {
        return res.status(403).json({ error: 'Sem permissão para desvincular este membro' });
      }
      
      const success = await storage.desvincularMembroProjeto(membroId, projetoId);
      res.json({ success });
    } catch (error) {
      console.error('Error unlinking member from projeto:', error);
      res.status(500).json({ error: 'Erro ao desvincular membro do projeto' });
    }
  });

  // ======== REEMBOLSOS ROUTES ========

  // Listar pedidos de reembolso
  app.get('/api/reembolsos', requireAuth, async (req, res) => {
    try {
      const { status, solicitanteId, coordenadorPendente, financeiroPendente, diretorPendente } = req.query;
      
      const filters: any = {};
      
      // Scoping by unidade (unless diretor/admin)
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        filters.unidade = req.user.unidade;
      }
      
      // Colaboradores só veem seus próprios pedidos
      if (req.user.cargo === 'colaborador') {
        filters.solicitanteId = req.user.id;
      } else if (solicitanteId) {
        filters.solicitanteId = parseInt(solicitanteId as string);
      }
      
      if (status) filters.status = status as string;
      if (coordenadorPendente === 'true') filters.coordenadorPendente = true;
      if (financeiroPendente === 'true') filters.financeiroPendente = true;
      if (diretorPendente === 'true') filters.diretorPendente = true;
      
      const pedidos = await storage.getPedidosReembolso(filters);
      res.json(pedidos);
    } catch (error) {
      console.error('Error fetching reimbursements:', error);
      res.status(500).json({ error: 'Erro ao buscar pedidos de reembolso' });
    }
  });

  // Buscar pedido de reembolso por ID
  app.get('/api/reembolsos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pedido = await storage.getPedidoReembolsoById(id);
      
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      // Verificar permissão
      if (req.user.cargo === 'colaborador' && pedido.solicitanteId !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para ver este pedido' });
      }
      
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && pedido.unidade !== req.user.unidade) {
        return res.status(403).json({ error: 'Sem permissão para ver este pedido' });
      }
      
      res.json(pedido);
    } catch (error) {
      console.error('Error fetching reimbursement:', error);
      res.status(500).json({ error: 'Erro ao buscar pedido de reembolso' });
    }
  });

  // Criar pedido de reembolso (qualquer usuário autenticado)
  app.post('/api/reembolsos', requireAuth, async (req, res) => {
    try {
      const data = insertPedidoReembolsoSchema.parse({
        ...req.body,
        solicitanteId: req.user.id,
        unidade: req.user.unidade,
        status: 'pendente_coordenador',
      });
      
      const pedido = await storage.createPedidoReembolso(data);
      
      // Criar histórico
      await storage.createHistoricoReembolso({
        pedidoId: pedido.id,
        usuarioId: req.user.id,
        acao: 'criado',
        statusAnterior: null,
        statusNovo: 'pendente_coordenador',
      });
      
      res.status(201).json(pedido);
    } catch (error) {
      console.error('Error creating reimbursement:', error);
      res.status(500).json({ error: 'Erro ao criar pedido de reembolso' });
    }
  });

  // Atualizar pedido de reembolso (apenas solicitante e enquanto pendente_coordenador)
  app.patch('/api/reembolsos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pedido = await storage.getPedidoReembolsoById(id);
      
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      // Só o solicitante pode editar e apenas enquanto pendente_coordenador
      if (pedido.solicitanteId !== req.user.id) {
        return res.status(403).json({ error: 'Apenas o solicitante pode editar o pedido' });
      }
      
      if (pedido.status !== 'pendente_coordenador') {
        return res.status(400).json({ error: 'Pedido já está em análise e não pode ser editado' });
      }
      
      const updated = await storage.updatePedidoReembolso(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error updating reimbursement:', error);
      res.status(500).json({ error: 'Erro ao atualizar pedido de reembolso' });
    }
  });

  // Deletar pedido de reembolso (apenas solicitante e enquanto pendente_coordenador)
  app.delete('/api/reembolsos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pedido = await storage.getPedidoReembolsoById(id);
      
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      // Só o solicitante pode deletar e apenas enquanto pendente_coordenador
      if (pedido.solicitanteId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas o solicitante pode deletar o pedido' });
      }
      
      if (pedido.status !== 'pendente_coordenador') {
        return res.status(400).json({ error: 'Pedido já está em análise e não pode ser deletado' });
      }
      
      await storage.deletePedidoReembolso(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting reimbursement:', error);
      res.status(500).json({ error: 'Erro ao deletar pedido de reembolso' });
    }
  });

  // Aprovar reembolso pelo coordenador
  app.post('/api/reembolsos/:id/aprovar-coordenador', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { observacao } = req.body;
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'pendente_coordenador') {
        return res.status(400).json({ error: 'Pedido não está pendente de aprovação do coordenador' });
      }
      
      // Verificar unidade
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && pedido.unidade !== req.user.unidade) {
        return res.status(403).json({ error: 'Sem permissão para aprovar este pedido' });
      }
      
      const updated = await storage.aprovarReembolsoCoordenador(id, req.user.id, observacao);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'aprovado_coordenador',
        statusAnterior: 'pendente_coordenador',
        statusNovo: 'pendente_financeiro',
        observacao,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error approving reimbursement:', error);
      res.status(500).json({ error: 'Erro ao aprovar pedido de reembolso' });
    }
  });

  // Rejeitar reembolso pelo coordenador
  app.post('/api/reembolsos/:id/rejeitar-coordenador', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { observacao } = req.body;
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'pendente_coordenador') {
        return res.status(400).json({ error: 'Pedido não está pendente de aprovação do coordenador' });
      }
      
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && pedido.unidade !== req.user.unidade) {
        return res.status(403).json({ error: 'Sem permissão para rejeitar este pedido' });
      }
      
      const updated = await storage.rejeitarReembolsoCoordenador(id, req.user.id, observacao);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'rejeitado_coordenador',
        statusAnterior: 'pendente_coordenador',
        statusNovo: 'rejeitado_coordenador',
        observacao,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error rejecting reimbursement:', error);
      res.status(500).json({ error: 'Erro ao rejeitar pedido de reembolso' });
    }
  });

  // Aprovar reembolso pelo financeiro
  app.post('/api/reembolsos/:id/aprovar-financeiro', requireAuth, async (req, res) => {
    try {
      // Verificar se é financeiro ou diretor
      if (req.user.cargo !== 'financeiro' && req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas o financeiro pode aprovar nesta etapa' });
      }
      
      const id = parseInt(req.params.id);
      const { observacao } = req.body;
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'pendente_financeiro') {
        return res.status(400).json({ error: 'Pedido não está pendente de aprovação do financeiro' });
      }
      
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && pedido.unidade !== req.user.unidade) {
        return res.status(403).json({ error: 'Sem permissão para aprovar este pedido' });
      }
      
      const updated = await storage.aprovarReembolsoFinanceiro(id, req.user.id, observacao);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'aprovado_financeiro',
        statusAnterior: 'pendente_financeiro',
        statusNovo: 'pendente_diretor',
        observacao,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error approving reimbursement by finance:', error);
      res.status(500).json({ error: 'Erro ao aprovar pedido de reembolso' });
    }
  });

  // Rejeitar reembolso pelo financeiro
  app.post('/api/reembolsos/:id/rejeitar-financeiro', requireAuth, async (req, res) => {
    try {
      if (req.user.cargo !== 'financeiro' && req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas o financeiro pode rejeitar nesta etapa' });
      }
      
      const id = parseInt(req.params.id);
      const { observacao } = req.body;
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'pendente_financeiro') {
        return res.status(400).json({ error: 'Pedido não está pendente de aprovação do financeiro' });
      }
      
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin' && pedido.unidade !== req.user.unidade) {
        return res.status(403).json({ error: 'Sem permissão para rejeitar este pedido' });
      }
      
      const updated = await storage.rejeitarReembolsoFinanceiro(id, req.user.id, observacao);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'rejeitado_financeiro',
        statusAnterior: 'pendente_financeiro',
        statusNovo: 'rejeitado_financeiro',
        observacao,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error rejecting reimbursement by finance:', error);
      res.status(500).json({ error: 'Erro ao rejeitar pedido de reembolso' });
    }
  });

  // Aprovar reembolso pelo diretor
  app.post('/api/reembolsos/:id/aprovar-diretor', requireAuth, async (req, res) => {
    try {
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas o diretor pode dar aprovação final' });
      }
      
      const id = parseInt(req.params.id);
      const { observacao } = req.body;
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'pendente_diretor') {
        return res.status(400).json({ error: 'Pedido não está pendente de aprovação do diretor' });
      }
      
      const updated = await storage.aprovarReembolsoDiretor(id, req.user.id, observacao);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'aprovado_diretor',
        statusAnterior: 'pendente_diretor',
        statusNovo: 'aprovado_diretor',
        observacao,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error approving reimbursement by director:', error);
      res.status(500).json({ error: 'Erro ao aprovar pedido de reembolso' });
    }
  });

  // Rejeitar reembolso pelo diretor
  app.post('/api/reembolsos/:id/rejeitar-diretor', requireAuth, async (req, res) => {
    try {
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas o diretor pode rejeitar nesta etapa' });
      }
      
      const id = parseInt(req.params.id);
      const { observacao } = req.body;
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'pendente_diretor') {
        return res.status(400).json({ error: 'Pedido não está pendente de aprovação do diretor' });
      }
      
      const updated = await storage.rejeitarReembolsoDiretor(id, req.user.id, observacao);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'rejeitado_diretor',
        statusAnterior: 'pendente_diretor',
        statusNovo: 'rejeitado_diretor',
        observacao,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error rejecting reimbursement by director:', error);
      res.status(500).json({ error: 'Erro ao rejeitar pedido de reembolso' });
    }
  });

  // Marcar reembolso como pago
  app.post('/api/reembolsos/:id/pagar', requireAuth, async (req, res) => {
    try {
      if (req.user.cargo !== 'financeiro' && req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas o financeiro ou diretor pode marcar como pago' });
      }
      
      const id = parseInt(req.params.id);
      const { formaPagamento, dataPagamento } = req.body;
      
      if (!formaPagamento || !dataPagamento) {
        return res.status(400).json({ error: 'Forma de pagamento e data são obrigatórios' });
      }
      
      const pedido = await storage.getPedidoReembolsoById(id);
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      if (pedido.status !== 'aprovado_diretor') {
        return res.status(400).json({ error: 'Pedido precisa estar aprovado pelo diretor para ser pago' });
      }
      
      const updated = await storage.marcarReembolsoPago(id, formaPagamento, dataPagamento);
      
      await storage.createHistoricoReembolso({
        pedidoId: id,
        usuarioId: req.user.id,
        acao: 'pago',
        statusAnterior: 'aprovado_diretor',
        statusNovo: 'pago',
        observacao: `Pago via ${formaPagamento} em ${dataPagamento}`,
      });
      
      res.json(updated);
    } catch (error) {
      console.error('Error marking reimbursement as paid:', error);
      res.status(500).json({ error: 'Erro ao marcar pedido como pago' });
    }
  });

  // Buscar histórico do pedido
  app.get('/api/reembolsos/:id/historico', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pedido = await storage.getPedidoReembolsoById(id);
      
      if (!pedido) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }
      
      // Verificar permissão
      if (req.user.cargo === 'colaborador' && pedido.solicitanteId !== req.user.id) {
        return res.status(403).json({ error: 'Sem permissão para ver o histórico' });
      }
      
      const historico = await storage.getHistoricoReembolso(id);
      res.json(historico);
    } catch (error) {
      console.error('Error fetching reimbursement history:', error);
      res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
  });

  // Estatísticas de reembolsos
  app.get('/api/reembolsos/estatisticas', requireAuth, async (req, res) => {
    try {
      const filters: any = {};
      
      // Scoping by unidade
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        filters.unidade = req.user.unidade;
      }
      
      // Colaboradores só veem suas próprias estatísticas
      if (req.user.cargo === 'colaborador') {
        filters.solicitanteId = req.user.id;
      }
      
      const stats = await storage.getEstatisticasReembolso(filters);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching reimbursement stats:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas de reembolso' });
    }
  });

  // ======== TAREFAS ROUTES ========
  
  // Listar tarefas
  app.get('/api/tarefas', requireAuth, async (req, res) => {
    try {
      const { status, prioridade, categoria, empreendimentoId, dataInicio, dataFim } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (prioridade) filters.prioridade = prioridade as string;
      if (categoria) filters.categoria = categoria as string;
      if (empreendimentoId) filters.empreendimentoId = parseInt(empreendimentoId as string);
      if (dataInicio) filters.dataInicio = dataInicio as string;
      if (dataFim) filters.dataFim = dataFim as string;
      
      // Filtrar por usuário (responsável OU criador) - privacidade de tarefas
      // Apenas admin/diretor podem ver todas as tarefas
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        filters.userId = req.user.id;
        filters.unidade = req.user.unidade;
      }
      
      const tarefasList = await storage.getTarefas(filters);
      res.json(tarefasList);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Erro ao buscar tarefas' });
    }
  });

  // Buscar tarefa por ID
  app.get('/api/tarefas/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tarefa = await storage.getTarefaById(id);
      
      if (!tarefa) {
        return res.status(404).json({ error: 'Tarefa não encontrada' });
      }
      
      // Verificar permissão - usuário deve ser responsável, criador, ou admin/diretor
      const isOwner = tarefa.responsavelId === req.user.id || tarefa.criadoPor === req.user.id;
      const isAdmin = req.user.cargo === 'diretor' || req.user.role === 'admin';
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Sem permissão para ver esta tarefa' });
      }
      
      res.json(tarefa);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: 'Erro ao buscar tarefa' });
    }
  });

  // Criar tarefa (só coordenadores)
  app.post('/api/tarefas', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const data = insertTarefaSchema.parse({
        ...req.body,
        criadoPor: req.user.id,
        unidade: req.body.unidade || req.user.unidade
      });
      
      const tarefa = await storage.createTarefa(data);
      
      await auditLogService.logCreate('tarefas', tarefa.id, tarefa, req.session.userId, req.user?.email, req);
      
      // Enviar notificação para o responsável
      await storage.createNotification({
        tipo: 'tarefa',
        titulo: 'Nova tarefa atribuída',
        mensagem: `Você recebeu uma nova tarefa: ${tarefa.titulo}`,
        canal: 'sistema',
        status: 'pendente',
        itemId: tarefa.id,
        metadados: { tarefaId: tarefa.id, responsavelId: tarefa.responsavelId }
      });
      
      res.status(201).json(tarefa);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Erro ao criar tarefa' });
    }
  });

  // Criar tarefa pessoal (colaboradores podem criar para si mesmos)
  app.post('/api/minhas-tarefas', requireAuth, async (req, res) => {
    try {
      const data = insertTarefaSchema.parse({
        ...req.body,
        responsavelId: req.user.id, // Sempre atribuída ao próprio usuário
        criadoPor: req.user.id,
        unidade: req.user.unidade
      });
      
      const tarefa = await storage.createTarefa(data);
      
      await auditLogService.logCreate('tarefas', tarefa.id, tarefa, req.session.userId, req.user?.email, req);
      
      res.status(201).json(tarefa);
    } catch (error) {
      console.error('Error creating personal task:', error);
      res.status(500).json({ error: 'Erro ao criar tarefa pessoal' });
    }
  });

  // Atualizar tarefa
  app.put('/api/tarefas/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTarefaById(id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Tarefa não encontrada' });
      }
      
      const isAdminOrCoord = ['admin', 'diretor', 'coordenador'].includes(req.user.cargo);
      const isCreator = existing.criadoPor === req.user.id;
      const isResponsavel = existing.responsavelId === req.user.id;
      
      // Colaboradores podem editar:
      // - Status/observações/horas das tarefas atribuídas a eles
      // - Todos os campos das tarefas que eles criaram
      if (req.user.cargo === 'colaborador') {
        if (!isResponsavel && !isCreator) {
          return res.status(403).json({ error: 'Sem permissão para editar esta tarefa' });
        }
        
        let updates: any = {};
        
        if (isCreator) {
          // Criadores podem editar todos os campos
          updates = req.body;
        } else {
          // Responsáveis só podem editar campos limitados
          const allowedFields = ['status', 'observacoesColaborador', 'horasRealizadas'];
          for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
              updates[field] = req.body[field];
            }
          }
        }
        
        const tarefa = await storage.updateTarefa(id, updates);
        
        // Registrar atualização de status
        if (req.body.status && req.body.status !== existing.status) {
          await storage.createAtualizacaoTarefa({
            tarefaId: id,
            usuarioId: req.user.id,
            tipo: 'status_change',
            conteudo: `Status alterado de "${existing.status}" para "${req.body.status}"`,
            statusAnterior: existing.status,
            statusNovo: req.body.status
          });
        }
        
        await auditLogService.logUpdate('tarefas', id, existing, tarefa, req.session.userId, req.user?.email, req);
        
        return res.json(tarefa);
      }
      
      // Coordenadores/admins/diretores podem editar tudo
      const tarefa = await storage.updateTarefa(id, req.body);
      
      // Registrar atualização de status
      if (req.body.status && req.body.status !== existing.status) {
        await storage.createAtualizacaoTarefa({
          tarefaId: id,
          usuarioId: req.user.id,
          tipo: 'status_change',
          conteudo: `Status alterado de "${existing.status}" para "${req.body.status}"`,
          statusAnterior: existing.status,
          statusNovo: req.body.status
        });
      }
      
      await auditLogService.logUpdate('tarefas', id, existing, tarefa, req.session.userId, req.user?.email, req);
      
      res.json(tarefa);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Erro ao atualizar tarefa' });
    }
  });

  // Excluir tarefa (coordenadores ou criadores)
  app.delete('/api/tarefas/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getTarefaById(id);
      
      if (!existing) {
        return res.status(404).json({ error: 'Tarefa não encontrada' });
      }
      
      // Permitir exclusão se for coordenador/admin/diretor ou criador da tarefa
      const isAdminOrCoord = ['admin', 'diretor', 'coordenador'].includes(req.user.cargo);
      const isCreator = existing.criadoPor === req.user.id;
      
      if (!isAdminOrCoord && !isCreator) {
        return res.status(403).json({ error: 'Sem permissão para excluir esta tarefa' });
      }
      
      await storage.deleteTarefa(id);
      
      await auditLogService.logDelete('tarefas', id, existing, req.session.userId, req.user?.email, req);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Erro ao excluir tarefa' });
    }
  });

  // Tarefas do dia para o colaborador
  app.get('/api/minhas-tarefas-hoje', requireAuth, async (req, res) => {
    try {
      const data = req.query.data as string;
      const tarefasList = await storage.getTarefasDoDia(req.user.id, data);
      res.json(tarefasList);
    } catch (error) {
      console.error('Error fetching today tasks:', error);
      res.status(500).json({ error: 'Erro ao buscar tarefas do dia' });
    }
  });

  // Tarefas atrasadas
  app.get('/api/tarefas-atrasadas', requireAuth, async (req, res) => {
    try {
      let userId: number | undefined;
      let unidade: string | undefined;
      
      // Filtrar por usuário (responsável OU criador) - privacidade de tarefas
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        userId = req.user.id;
        unidade = req.user.unidade;
      }
      
      const tarefasList = await storage.getTarefasAtrasadas(userId, unidade);
      res.json(tarefasList);
    } catch (error) {
      console.error('Error fetching overdue tasks:', error);
      res.status(500).json({ error: 'Erro ao buscar tarefas atrasadas' });
    }
  });

  // Estatísticas de tarefas
  app.get('/api/tarefas-stats', requireAuth, async (req, res) => {
    try {
      const filters: any = {};
      
      // Filtrar por usuário (responsável OU criador) - privacidade de tarefas
      if (req.user.cargo !== 'diretor' && req.user.role !== 'admin') {
        filters.userId = req.user.id;
        filters.unidade = req.user.unidade;
      }
      
      const stats = await storage.getEstatisticasTarefas(filters);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching task stats:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  });

  // ======== ATUALIZAÇÕES DE TAREFAS ========
  
  app.get('/api/tarefas/:id/atualizacoes', requireAuth, async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      const atualizacoes = await storage.getAtualizacoesTarefa(tarefaId);
      res.json(atualizacoes);
    } catch (error) {
      console.error('Error fetching task updates:', error);
      res.status(500).json({ error: 'Erro ao buscar atualizações' });
    }
  });

  app.post('/api/tarefas/:id/atualizacoes', requireAuth, async (req, res) => {
    try {
      const tarefaId = parseInt(req.params.id);
      
      const data = insertTarefaAtualizacaoSchema.parse({
        ...req.body,
        tarefaId,
        usuarioId: req.user.id
      });
      
      const atualizacao = await storage.createAtualizacaoTarefa(data);
      res.status(201).json(atualizacao);
    } catch (error) {
      console.error('Error creating task update:', error);
      res.status(500).json({ error: 'Erro ao criar atualização' });
    }
  });

  // ======== REGISTRO DE HORAS ========
  
  app.get('/api/registro-horas', requireAuth, async (req, res) => {
    try {
      const { tarefaId, colaboradorId, dataInicio, dataFim } = req.query;
      
      const filters: any = {};
      if (tarefaId) filters.tarefaId = parseInt(tarefaId as string);
      if (colaboradorId) filters.colaboradorId = parseInt(colaboradorId as string);
      if (dataInicio) filters.dataInicio = dataInicio as string;
      if (dataFim) filters.dataFim = dataFim as string;
      
      // Colaboradores só veem seus próprios registros
      if (req.user.cargo === 'colaborador') {
        filters.colaboradorId = req.user.id;
      }
      
      const registros = await storage.getRegistrosHoras(filters);
      res.json(registros);
    } catch (error) {
      console.error('Error fetching time records:', error);
      res.status(500).json({ error: 'Erro ao buscar registros de horas' });
    }
  });

  app.post('/api/registro-horas', requireAuth, async (req, res) => {
    try {
      const data = insertRegistroHorasSchema.parse({
        ...req.body,
        colaboradorId: req.user.id
      });
      
      const registro = await storage.createRegistroHoras(data);
      res.status(201).json(registro);
    } catch (error) {
      console.error('Error creating time record:', error);
      res.status(500).json({ error: 'Erro ao criar registro de horas' });
    }
  });

  app.post('/api/registro-horas/:id/aprovar', requireAuth, requireCoordenador, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const registro = await storage.aprovarRegistroHoras(id, req.user.id);
      res.json(registro);
    } catch (error) {
      console.error('Error approving time record:', error);
      res.status(500).json({ error: 'Erro ao aprovar registro de horas' });
    }
  });

  // ======== PERFIL DO USUÁRIO ========
  
  // Obter perfil do membro da equipe atual
  app.get('/api/meu-perfil-equipe', requireAuth, async (req, res) => {
    try {
      const membro = await storage.getMembroEquipeByUserId(req.user.id);
      res.json(membro || null);
    } catch (error) {
      console.error('Error fetching my team profile:', error);
      res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
  });

  // ======== RELATÓRIO COMPLETO DA PLATAFORMA ========
  
  app.get('/api/relatorio-plataforma', requireAuth, async (req, res) => {
    try {
      console.log('Generating platform report...');
      const userUnidade = req.user.unidade;
      const userCargo = req.user.cargo;
      const userRole = req.user.role;
      
      // Only directors, coordinators, finance, and admins can access the full report
      const allowedRoles = ['diretor', 'coordenador', 'financeiro', 'rh'];
      if (userRole !== 'admin' && !allowedRoles.includes(userCargo)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas coordenadores, diretores e administradores podem acessar este relatório.' });
      }
      
      // Directors and admins can see all units, others see only their unit
      const isAdmin = userRole === 'admin' || userCargo === 'diretor';
      const unidadeFilter = isAdmin ? undefined : userUnidade;
      
      console.log('Fetching data for report...', { isAdmin, unidadeFilter });
      
      // Fetch all module data - handle errors gracefully
      let empreendimentosList: any[] = [];
      let licencasList: any[] = [];
      let demandasList: any[] = [];
      let veiculosList: any[] = [];
      let equipamentosList: any[] = [];
      let rhList: any[] = [];
      let contratosList: any[] = [];
      let campanhasList: any[] = [];
      let projetosList: any[] = [];
      let financeiroStats: any = null;
      let tarefasList: any[] = [];
      let membrosEquipeList: any[] = [];
      
      try {
        empreendimentosList = await storage.getEmpreendimentos(unidadeFilter) || [];
        console.log('Loaded empreendimentos:', empreendimentosList.length);
      } catch (e) { console.error('Error loading empreendimentos:', e); }
      
      try {
        licencasList = await storage.getLicencas(unidadeFilter) || [];
        console.log('Loaded licencas:', licencasList.length);
      } catch (e) { console.error('Error loading licencas:', e); }
      
      try {
        demandasList = await storage.getDemandas(unidadeFilter) || [];
        console.log('Loaded demandas:', demandasList.length);
      } catch (e) { console.error('Error loading demandas:', e); }
      
      try {
        veiculosList = await storage.getVeiculos(unidadeFilter) || [];
        console.log('Loaded veiculos:', veiculosList.length);
      } catch (e) { console.error('Error loading veiculos:', e); }
      
      try {
        equipamentosList = await storage.getEquipamentos(unidadeFilter) || [];
        console.log('Loaded equipamentos:', equipamentosList.length);
      } catch (e) { console.error('Error loading equipamentos:', e); }
      
      try {
        rhList = await storage.getRhRegistros(unidadeFilter) || [];
        console.log('Loaded rh:', rhList.length);
      } catch (e) { console.error('Error loading rh:', e); }
      
      try {
        contratosList = await storage.getContratos(unidadeFilter) || [];
        console.log('Loaded contratos:', contratosList.length);
      } catch (e) { console.error('Error loading contratos:', e); }
      
      try {
        campanhasList = await storage.getCampanhas(unidadeFilter) || [];
        console.log('Loaded campanhas:', campanhasList.length);
      } catch (e) { console.error('Error loading campanhas:', e); }
      
      try {
        projetosList = await storage.getProjetos(unidadeFilter) || [];
        console.log('Loaded projetos:', projetosList.length);
      } catch (e) { console.error('Error loading projetos:', e); }
      
      try {
        financeiroStats = await storage.getFinancialStats() || {};
        console.log('Loaded financeiro stats');
      } catch (e) { console.error('Error loading financeiro:', e); }
      
      try {
        const tarefasFilters: any = { unidade: unidadeFilter };
        if (userRole !== 'admin' && userCargo !== 'diretor') {
          tarefasFilters.userId = req.user.id;
        }
        tarefasList = await storage.getTarefas(tarefasFilters) || [];
        console.log('Loaded tarefas:', tarefasList.length);
      } catch (e) { console.error('Error loading tarefas:', e); }
      
      try {
        membrosEquipeList = await storage.getMembrosEquipe(unidadeFilter) || [];
        console.log('Loaded membros equipe:', membrosEquipeList.length);
      } catch (e) { console.error('Error loading membros equipe:', e); }
      
      // Calculate KPIs
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      // License KPIs
      const licencasVencidas = licencasList.filter(l => l.dataVencimento && new Date(l.dataVencimento) < now).length;
      const licencasProxVencer = licencasList.filter(l => {
        if (!l.dataVencimento) return false;
        const venc = new Date(l.dataVencimento);
        return venc >= now && venc <= thirtyDaysFromNow;
      }).length;
      const licencasVigentes = licencasList.filter(l => l.dataVencimento && new Date(l.dataVencimento) >= now).length;
      
      // Demand KPIs
      const demandasAbertas = demandasList.filter(d => d.status === 'aberta' || d.status === 'em_andamento').length;
      const demandasConcluidas = demandasList.filter(d => d.status === 'concluida').length;
      const demandasAtrasadas = demandasList.filter(d => {
        if (!d.prazo || d.status === 'concluida') return false;
        return new Date(d.prazo) < now;
      }).length;
      
      // Fleet KPIs
      const veiculosDisponiveis = veiculosList.filter(v => v.status === 'disponivel').length;
      const veiculosManutencao = veiculosList.filter(v => v.status === 'manutencao').length;
      
      // Equipment KPIs
      const equipamentosAtivos = equipamentosList.filter(e => e.status === 'ativo').length;
      const equipamentosManutencao = equipamentosList.filter(e => e.status === 'manutencao').length;
      
      // RH KPIs
      const funcionariosAtivos = rhList.filter(r => r.status === 'ativo').length;
      const funcionariosFerias = rhList.filter(r => r.status === 'ferias').length;
      
      // Contract KPIs
      const contratosAtivos = contratosList.filter(c => c.status === 'ativo').length;
      const contratosVencendo = contratosList.filter(c => {
        if (!c.dataFim || c.status !== 'ativo') return false;
        const fim = new Date(c.dataFim);
        return fim >= now && fim <= thirtyDaysFromNow;
      }).length;
      
      // Project KPIs
      const projetosEmAndamento = projetosList.filter(p => p.status === 'em_andamento').length;
      const projetosConcluidos = projetosList.filter(p => p.status === 'concluido').length;
      
      // Task KPIs
      const tarefasPendentes = tarefasList.filter(t => t.status === 'pendente' || t.status === 'em_andamento').length;
      const tarefasConcluidas = tarefasList.filter(t => t.status === 'concluida').length;
      
      // Build response
      const relatorio = {
        geradoEm: new Date().toISOString(),
        unidade: isAdmin ? 'Todas as Unidades' : userUnidade,
        
        resumoGeral: {
          totalEmpreendimentos: empreendimentosList.length,
          totalLicencas: licencasList.length,
          totalDemandas: demandasList.length,
          totalVeiculos: veiculosList.length,
          totalEquipamentos: equipamentosList.length,
          totalFuncionarios: rhList.length,
          totalContratos: contratosList.length,
          totalCampanhas: campanhasList.length,
          totalProjetos: projetosList.length,
          totalMembrosEquipe: membrosEquipeList.length,
        },
        
        licencas: {
          total: licencasList.length,
          vencidas: licencasVencidas,
          proximasVencer: licencasProxVencer,
          vigentes: licencasVigentes,
          porTipo: licencasList.reduce((acc: any, l) => {
            acc[l.tipo] = (acc[l.tipo] || 0) + 1;
            return acc;
          }, {}),
          lista: licencasList.slice(0, 20).map(l => ({
            id: l.id,
            tipo: l.tipo,
            orgaoEmissor: l.orgaoEmissor,
            dataEmissao: l.dataEmissao,
            dataVencimento: l.dataVencimento,
            status: l.status,
          })),
        },
        
        demandas: {
          total: demandasList.length,
          abertas: demandasAbertas,
          concluidas: demandasConcluidas,
          atrasadas: demandasAtrasadas,
          porPrioridade: demandasList.reduce((acc: any, d) => {
            acc[d.prioridade || 'media'] = (acc[d.prioridade || 'media'] || 0) + 1;
            return acc;
          }, {}),
          lista: demandasList.slice(0, 20).map(d => ({
            id: d.id,
            titulo: d.titulo,
            status: d.status,
            prioridade: d.prioridade,
            prazo: d.prazo,
          })),
        },
        
        frota: {
          total: veiculosList.length,
          disponiveis: veiculosDisponiveis,
          emManutencao: veiculosManutencao,
          emUso: veiculosList.filter(v => v.status === 'em_uso').length,
          lista: veiculosList.map(v => ({
            id: v.id,
            modelo: v.modelo,
            placa: v.placa,
            status: v.status,
            quilometragem: v.quilometragem,
          })),
        },
        
        equipamentos: {
          total: equipamentosList.length,
          ativos: equipamentosAtivos,
          emManutencao: equipamentosManutencao,
          porTipo: equipamentosList.reduce((acc: any, e) => {
            acc[e.tipo] = (acc[e.tipo] || 0) + 1;
            return acc;
          }, {}),
          lista: equipamentosList.slice(0, 20).map(e => ({
            id: e.id,
            nome: e.nome,
            tipo: e.tipo,
            status: e.status,
          })),
        },
        
        rh: {
          total: rhList.length,
          ativos: funcionariosAtivos,
          ferias: funcionariosFerias,
          afastados: rhList.filter(r => r.status === 'afastado').length,
          porCargo: rhList.reduce((acc: any, r) => {
            acc[r.cargo || 'outros'] = (acc[r.cargo || 'outros'] || 0) + 1;
            return acc;
          }, {}),
          lista: rhList.slice(0, 20).map(r => ({
            id: r.id,
            nome: r.nome,
            cargo: r.cargo,
            status: r.status,
          })),
        },
        
        contratos: {
          total: contratosList.length,
          ativos: contratosAtivos,
          vencendo: contratosVencendo,
          valorTotal: contratosList.reduce((sum, c) => sum + Number(c.valor || 0), 0),
          lista: contratosList.slice(0, 20).map(c => ({
            id: c.id,
            numero: c.numero,
            tipo: c.tipo,
            valor: c.valor,
            status: c.status,
            dataInicio: c.dataInicio,
            dataFim: c.dataFim,
          })),
        },
        
        campanhas: {
          total: campanhasList.length,
          ativas: campanhasList.filter(c => c.status === 'ativa').length,
          concluidas: campanhasList.filter(c => c.status === 'concluida').length,
          lista: campanhasList.slice(0, 20).map(c => ({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo,
            status: c.status,
            dataInicio: c.dataInicio,
            dataFim: c.dataFim,
          })),
        },
        
        projetos: {
          total: projetosList.length,
          emAndamento: projetosEmAndamento,
          concluidos: projetosConcluidos,
          planejamento: projetosList.filter(p => p.status === 'planejamento').length,
          atrasados: projetosList.filter(p => {
            if (!p.dataFim || p.status === 'concluido') return false;
            return new Date(p.dataFim) < now && p.status !== 'concluido';
          }).length,
          porStatus: projetosList.reduce((acc: any, p) => {
            acc[p.status || 'outros'] = (acc[p.status || 'outros'] || 0) + 1;
            return acc;
          }, {}),
          porTipo: projetosList.reduce((acc: any, p) => {
            acc[p.tipo || 'outros'] = (acc[p.tipo || 'outros'] || 0) + 1;
            return acc;
          }, {}),
          lista: projetosList.slice(0, 20).map(p => ({
            id: p.id,
            nome: p.nome,
            tipo: p.tipo,
            status: p.status,
            dataInicio: p.dataInicio,
            dataFim: p.dataFim,
          })),
        },
        
        financeiro: financeiroStats || {
          totalReceitas: 0,
          totalDespesas: 0,
          saldoAtual: 0,
          totalPendente: 0,
          porCategoria: [],
          porEmpreendimento: [],
          evolucaoMensal: [],
        },
        
        tarefas: {
          total: tarefasList.length,
          pendentes: tarefasPendentes,
          concluidas: tarefasConcluidas,
          porCategoria: tarefasList.reduce((acc: any, t) => {
            acc[t.categoria || 'outros'] = (acc[t.categoria || 'outros'] || 0) + 1;
            return acc;
          }, {}),
        },
        
        empreendimentos: {
          total: empreendimentosList.length,
          porTipo: empreendimentosList.reduce((acc: any, e) => {
            acc[e.tipo || 'outros'] = (acc[e.tipo || 'outros'] || 0) + 1;
            return acc;
          }, {}),
          lista: empreendimentosList.slice(0, 20).map(e => ({
            id: e.id,
            nome: e.nome,
            tipo: e.tipo,
            municipio: e.municipio,
            uf: e.uf,
          })),
        },
      };
      
      res.json(relatorio);
    } catch (error) {
      console.error('Error generating platform report:', error);
      res.status(500).json({ error: 'Erro ao gerar relatório da plataforma' });
    }
  });

  // ==========================================
  // CONFIGURAÇÃO DE RELATÓRIOS AUTOMÁTICOS
  // ==========================================
  
  app.get('/api/relatorios-automaticos/config', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.cargo !== 'diretor') {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      const config = getReportConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/relatorios-automaticos/config/360/emails', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.cargo !== 'diretor') {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      const { emails } = req.body;
      if (!Array.isArray(emails)) {
        return res.status(400).json({ error: 'emails deve ser um array' });
      }
      setRelatorio360Emails(emails);
      res.json({ success: true, message: 'Emails do Relatório 360° atualizados' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/relatorios-automaticos/config/financeiro/emails', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.cargo !== 'diretor') {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      const { emails } = req.body;
      if (!Array.isArray(emails)) {
        return res.status(400).json({ error: 'emails deve ser um array' });
      }
      setRelatorioFinanceiroEmails(emails);
      res.json({ success: true, message: 'Emails do Relatório Financeiro atualizados' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/relatorios-automaticos/enviar/360', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.cargo !== 'diretor') {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      await triggerRelatorio360Now();
      res.json({ success: true, message: 'Relatório 360° enviado com sucesso' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/relatorios-automaticos/enviar/financeiro', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin' && req.user.cargo !== 'diretor') {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      await triggerRelatorioFinanceiroNow();
      res.json({ success: true, message: 'Relatório Financeiro enviado com sucesso' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Register n8n webhooks (before creating HTTP server)
  registerN8nWebhooks(app);
  
  // Register Evolution API webhooks (WhatsApp)
  registerEvolutionWebhooks(app);

  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  websocketService.initialize(httpServer);
  
  // Initialize scheduled reports service
  scheduledReportsService.initialize();
  
  // Initialize automated report sender (Relatório 360 e Financeiro)
  initScheduledReportSender();
  
  return httpServer;
}
