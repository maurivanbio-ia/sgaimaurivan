const SKIP_TYPES = new Set([
  "email", "password", "url", "search", "number",
  "date", "datetime-local", "time", "month", "week",
  "file", "color", "range", "tel",
]);

const SKIP_NAME_PATTERNS = [
  /email/i, /senha/i, /password/i, /token/i, /secret/i,
  /cnpj/i, /cpf/i, /cep/i, /tel/i, /phone/i, /fone/i,
  /login/i,
];

export function normalizeInput(value: string): string {
  if (!value) return value;
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9\s.,\-/():\u0000-\u001F]/gi, "")
    .toUpperCase()
    .replace(/\s{2,}/g, " ");
}

export function shouldNormalizeField(
  type: string | undefined,
  name: string | undefined,
  id?: string | undefined
): boolean {
  if (type && SKIP_TYPES.has(type)) return false;
  if (name && SKIP_NAME_PATTERNS.some((p) => p.test(name))) return false;
  if (id && SKIP_NAME_PATTERNS.some((p) => p.test(id))) return false;
  return true;
}

export function normalizeObjectFields(
  obj: Record<string, any>,
  skipFields: string[] = []
): Record<string, any> {
  const skip = new Set([
    ...skipFields,
    "email", "senha", "password", "token", "hash", "url",
    "cpf", "cnpj", "cep",
  ]);

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && !skip.has(key.toLowerCase()) && !SKIP_NAME_PATTERNS.some(p => p.test(key))) {
      result[key] = normalizeInput(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
