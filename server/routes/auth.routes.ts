/**
 * Auth Routes — autenticação, sessão e controle de acesso
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, rhRegistros } from "@shared/schema";
import type { MiddlewareFn } from "../middleware/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  unidade: z.enum(["goiania", "salvador", "luiz-eduardo-magalhaes"]),
  cargo: z.enum(["coordenador", "diretor", "rh", "financeiro", "colaborador", "sst"]),
});

const PAINEL_UNLOCK_PASSWORD = process.env.PAINEL_UNLOCK_PASSWORD || "";
const ADMIN_UNLOCK_PASSWORD = process.env.ADMIN_UNLOCK_PASSWORD || "";
const SENSITIVE_UNLOCK_PASSWORD = process.env.SENSITIVE_UNLOCK_PASSWORD || "";

const SENSITIVE_MODULES = [
  "financeiro",
  "propostas",
  "gestao-dados",
  "pastas",
  "documentos-institucionais",
];

interface AuthRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
}

export function registerAuthRoutes(app: Express, { storage, requireAuth }: AuthRoutesContext) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos" });

      const isValidPassword = await storage.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) return res.status(401).json({ message: "Usuário ou senha inválidos" });

      req.session.userId = user.id;
      res.json({ message: "Login successful", user: { id: user.id, email: user.email, role: user.role, unidade: user.unidade } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { nome, email, password, unidade, cargo } = registerSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) return res.status(400).json({ message: "Este e-mail já está cadastrado" });

      const newUser = await storage.createUser({ email, passwordHash: password, role: "colaborador", cargo, unidade });

      try {
        const existingRh = await db.select({ id: rhRegistros.id })
          .from(rhRegistros).where(eq(rhRegistros.contatoEmail, email)).limit(1);

        if (existingRh.length === 0) {
          const displayName = nome?.trim() ||
            email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
          await db.insert(rhRegistros).values({
            nomeColaborador: displayName, cargo: cargo || null,
            contatoEmail: email, unidade: unidade || "salvador", status: "ativo",
          });
        }
      } catch (rhErr) {
        console.error("[Register] Falha ao criar registro RH:", rhErr);
      }

      req.session.userId = newUser.id;
      res.json({ message: "Registro bem-sucedido", user: { id: newUser.id, email: newUser.email, role: newUser.role, cargo: newUser.cargo, unidade: newUser.unidade } });
    } catch (error) {
      console.error("Register error:", error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Could not log out" });
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        id: user.id, email: user.email, role: user.role,
        unidade: user.unidade, cargo: user.cargo,
        painelUnlocked: req.session.painelUnlocked || false,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/painel/unlock", requireAuth, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || typeof password !== "string") return res.status(400).json({ message: "Senha é obrigatória" });
      if (!PAINEL_UNLOCK_PASSWORD) return res.status(500).json({ message: "Configuração de desbloqueio não disponível" });
      if (password === PAINEL_UNLOCK_PASSWORD) {
        req.session.painelUnlocked = true;
        console.log(`Painel desbloqueado por usuário ${req.session.userId}`);
        return res.json({ success: true, message: "Painel desbloqueado com sucesso" });
      }
      console.log(`Tentativa de desbloqueio falhou para usuário ${req.session.userId}`);
      return res.status(401).json({ message: "Senha incorreta" });
    } catch (error) {
      console.error("Painel unlock error:", error);
      res.status(500).json({ message: "Erro ao desbloquear painel" });
    }
  });

  app.get("/api/painel/unlock-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const isCoordenador = user?.cargo === "coordenador" || user?.cargo === "diretor";
      const isUnlocked = isCoordenador || req.session.painelUnlocked === true;
      res.json({ unlocked: isUnlocked, isCoordenador, cargo: user?.cargo });
    } catch (error) {
      console.error("Get unlock status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/unlock-module", requireAuth, async (req: Request, res: Response) => {
    try {
      const { password, module } = req.body;
      if (!password || typeof password !== "string") return res.status(400).json({ success: false, message: "Senha é obrigatória" });
      if (!module || typeof module !== "string") return res.status(400).json({ success: false, message: "Módulo é obrigatório" });
      if (!ADMIN_UNLOCK_PASSWORD) return res.status(500).json({ success: false, message: "Configuração de desbloqueio não disponível" });

      if (password === ADMIN_UNLOCK_PASSWORD) {
        console.log(`Módulo '${module}' desbloqueado por usuário ${req.session.userId}`);
        return res.json({ success: true, message: "Módulo desbloqueado com sucesso" });
      }
      console.log(`Tentativa de desbloqueio do módulo '${module}' falhou para usuário ${req.session.userId}`);
      return res.json({ success: false, message: "Senha incorreta" });
    } catch (error) {
      console.error("Module unlock error:", error);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/auth/unlock-sensitive", requireAuth, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || typeof password !== "string") return res.status(400).json({ success: false, message: "Senha é obrigatória" });
      if (!SENSITIVE_UNLOCK_PASSWORD) return res.status(500).json({ success: false, message: "Configuração de desbloqueio não disponível" });

      if (password === SENSITIVE_UNLOCK_PASSWORD) {
        req.session.sensitiveUnlocked = true;
        console.log(`Áreas sensíveis desbloqueadas por usuário ${req.session.userId}`);
        return res.json({ success: true, message: "Acesso liberado com sucesso" });
      }
      console.log(`Tentativa de desbloqueio de áreas sensíveis falhou para usuário ${req.session.userId}`);
      return res.status(401).json({ success: false, message: "Senha incorreta" });
    } catch (error) {
      console.error("Sensitive unlock error:", error);
      res.status(500).json({ success: false, message: "Erro ao desbloquear acesso" });
    }
  });

  app.get("/api/auth/sensitive-status", requireAuth, async (req: Request, res: Response) => {
    try {
      res.json({ unlocked: req.session.sensitiveUnlocked === true, modules: SENSITIVE_MODULES });
    } catch (error) {
      console.error("Get sensitive status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/verify-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || password !== ADMIN_UNLOCK_PASSWORD) return res.status(401).json({ success: false, message: "Senha incorreta" });
      (req.session as any).adminUnlocked = true;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: "Erro interno" });
    }
  });

  app.post("/api/auth/promote-admin", requireAuth, async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || password !== ADMIN_UNLOCK_PASSWORD) return res.status(401).json({ success: false, message: "Senha incorreta" });
      const userId = req.session.userId!;
      await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
      console.log(`[Auth] Usuário ${req.user?.email} promovido a admin via promote-admin`);
      res.json({ success: true, message: "Role atualizado para admin com sucesso. Faça logout e login novamente." });
    } catch (error) {
      console.error("Promote admin error:", error);
      res.status(500).json({ success: false, message: "Erro ao atualizar role" });
    }
  });
}
