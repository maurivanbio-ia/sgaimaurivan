import { Request, Response, NextFunction } from "express";

const SKIP_FIELDS = new Set([
  "email", "senha", "password", "token", "hash", "url",
  "cpf", "cnpj", "cep", "secret", "key", "accessToken",
  "refreshToken", "contentType", "mimeType",
]);

const SKIP_FIELD_PATTERNS = [
  /email/i, /senha/i, /password/i, /token/i, /secret/i,
  /cnpj/i, /cpf/i, /cep/i, /url/i, /hash/i,
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s.,\-/():\u0000-\u001F]/gi, "")
    .toUpperCase()
    .replace(/\s{2,}/g, " ")
    .trim();
}

function shouldSkip(key: string): boolean {
  if (SKIP_FIELDS.has(key.toLowerCase())) return true;
  if (SKIP_FIELD_PATTERNS.some(p => p.test(key))) return true;
  return false;
}

function normalizeObject(obj: any): any {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return obj;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (shouldSkip(key)) {
      result[key] = value;
    } else if (typeof value === "string") {
      result[key] = normalizeText(value);
    } else if (typeof value === "object" && value !== null) {
      result[key] = normalizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function textNormalizationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const method = req.method.toUpperCase();

  if (
    (method === "POST" || method === "PUT" || method === "PATCH") &&
    req.body &&
    typeof req.body === "object" &&
    !req.path.includes("/auth/") &&
    !req.path.includes("/ai/") &&
    !req.path.includes("/newsletter") &&
    !req.path.includes("/base-conhecimento") &&
    !req.path.includes("/blog")
  ) {
    req.body = normalizeObject(req.body);
  }

  next();
}
