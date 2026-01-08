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

// Import new controllers
import * as contratoController from "./controllers/contratoController";
import * as arquivoController from "./controllers/arquivoController";

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
  }
}

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
      res.json({ id: user.id, email: user.email, role: user.role, unidade: user.unidade });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
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
      
      const events = [
        ...licencas.map((l: any) => ({ ...l, tipo: 'licenca', eventType: 'licenca' })),
        ...demandas.map((d: any) => ({ 
          id: d.id, 
          tipo: d.setor, 
          validade: d.dataEntrega, 
          empreendimentoNome: d.titulo, 
          orgaoEmissor: d.responsavel,
          eventType: 'demanda'
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
        // Despesas
        { nome: 'Combustível', tipo: 'despesa', cor: '#ef4444', descricao: 'Gastos com combustível para veículos' },
        { nome: 'Hospedagem', tipo: 'despesa', cor: '#f97316', descricao: 'Gastos com hotéis e pousadas' },
        { nome: 'Alimentação', tipo: 'despesa', cor: '#eab308', descricao: 'Gastos com refeições e alimentação' },
        { nome: 'Transporte', tipo: 'despesa', cor: '#22c55e', descricao: 'Gastos com passagens e deslocamentos' },
        { nome: 'Material de Campo', tipo: 'despesa', cor: '#14b8a6', descricao: 'EPIs, equipamentos e materiais de campo' },
        { nome: 'Equipamentos', tipo: 'despesa', cor: '#06b6d4', descricao: 'Compra e aluguel de equipamentos' },
        { nome: 'Serviços Terceirizados', tipo: 'despesa', cor: '#3b82f6', descricao: 'Consultoria e serviços externos' },
        { nome: 'Taxas e Impostos', tipo: 'despesa', cor: '#8b5cf6', descricao: 'Taxas ambientais e impostos' },
        { nome: 'Manutenção', tipo: 'despesa', cor: '#d946ef', descricao: 'Manutenção de veículos e equipamentos' },
        { nome: 'Comunicação', tipo: 'despesa', cor: '#ec4899', descricao: 'Telefone, internet e comunicação' },
        { nome: 'Material de Escritório', tipo: 'despesa', cor: '#f43f5e', descricao: 'Papelaria e materiais de escritório' },
        { nome: 'Locação', tipo: 'despesa', cor: '#64748b', descricao: 'Aluguel de espaços e veículos' },
        { nome: 'Salários e Benefícios', tipo: 'despesa', cor: '#475569', descricao: 'Folha de pagamento e benefícios' },
        { nome: 'Outros Gastos', tipo: 'despesa', cor: '#94a3b8', descricao: 'Despesas diversas não categorizadas' },
        // Receitas
        { nome: 'Contrato de Serviço', tipo: 'receita', cor: '#22c55e', descricao: 'Receita de contratos firmados' },
        { nome: 'Consultoria', tipo: 'receita', cor: '#10b981', descricao: 'Receita de serviços de consultoria' },
        { nome: 'Licenciamento', tipo: 'receita', cor: '#059669', descricao: 'Receita de processos de licenciamento' },
        { nome: 'Monitoramento', tipo: 'receita', cor: '#047857', descricao: 'Receita de serviços de monitoramento' },
        { nome: 'Estudos Ambientais', tipo: 'receita', cor: '#065f46', descricao: 'Receita de estudos e relatórios' },
        { nome: 'Outras Receitas', tipo: 'receita', cor: '#14532d', descricao: 'Receitas diversas não categorizadas' },
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
  app.get('/api/empreendimentos/:empreendimentoId/contratos', requireAuth, contratoController.getContratosByEmpreendimento);
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

  const httpServer = createServer(app);
  return httpServer;
}
