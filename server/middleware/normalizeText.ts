import { Request, Response, NextFunction } from "express";

const SKIP_FIELDS = new Set([
  // Auth / Security
  "email", "senha", "password", "token", "hash", "secret", "key",
  "accessToken", "refreshToken",
  // Identifiers / Codes
  "cpf", "cnpj", "cep", "url", "contentType", "mimeType",
  // Functional enum-like fields that must stay lowercase
  "status", "tipo", "setor", "prioridade", "origem", "unidade", "cargo", "role",
  "categoria", "tipologia", "complexidade", "tipoCondicionante", "tipoOutorga",
  "tipoCampo", "tipoDocumento", "tipoContrato", "tipoEntidade",
  "recorrente", "recorrenciaCron", "recorrenciaFim",
  "variantePeriodo", "periodicidade", "frequencia",
  // Dates / Numbers stored as strings
  "dataInicio", "dataFim", "dataEntrega", "dataEmissao", "dataConclusao",
  "prazo", "validade", "dataEmissao",
  // JSON / config fields
  "config", "metadata", "metadados", "json", "tags", "anexos",
  // Coordinates
  "latitude", "longitude",
]);

const SKIP_FIELD_PATTERNS = [
  /email/i, /senha/i, /password/i, /token/i, /secret/i,
  /cnpj/i, /cpf/i, /cep/i, /url/i, /hash/i,
  /status$/i, /^tipo/i, /cron/i, /json/i, /config/i,
  /latitude/i, /longitude/i, /^data/i, /^prazo/i, /^validade/i,
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
  if (SKIP_FIELDS.has(key)) return true;
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
