import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

/**
 * Extensão da tipagem do Express para incluir dados de sessão e usuário autenticado.
 * Elimina o uso de `req: any` em todo o backend.
 */

declare module "express-session" {
  interface SessionData {
    userId?: number;
    clienteUsuarioId?: number;
    clienteId?: number;
    painelUnlocked?: boolean;
    sensitiveUnlocked?: boolean;
    adminUnlocked?: boolean;
    blogUnlocked?: boolean;
  }
}

declare module "express" {
  interface Request {
    user?: User;
    clienteUsuario?: any;
    clienteId?: number;
  }
}

export type AuthenticatedRequest = Request & { user: User };

export type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export interface RouteContext {
  requireAuth: MiddlewareFn;
  requireAdmin: MiddlewareFn;
  requireAdminEdit: MiddlewareFn;
  requireSensitiveUnlock: MiddlewareFn;
  requireGestaoAcesso: MiddlewareFn;
  requireClienteAuth: MiddlewareFn;
  requireBlogAdmin: MiddlewareFn;
  requireNewsletterAdmin: MiddlewareFn;
}
