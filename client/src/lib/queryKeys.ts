/**
 * Query Key Factory centralizado para o TanStack Query.
 * Garante que invalidações de cache via WebSocket sejam precisas e sem erros de digitação.
 */

export const empreendimentoKeys = {
  all: ["empreendimentos"] as const,
  lists: () => [...empreendimentoKeys.all, "list"] as const,
  detail: (id: number) => [...empreendimentoKeys.all, "detail", id] as const,
  licencas: (empId: number) =>
    [...empreendimentoKeys.detail(empId), "licencas"] as const,
  condicionantes: (empId: number) =>
    [...empreendimentoKeys.detail(empId), "condicionantes"] as const,
  demandas: (empId: number) =>
    [...empreendimentoKeys.detail(empId), "demandas"] as const,
  equipamentos: (empId: number) =>
    [...empreendimentoKeys.detail(empId), "equipamentos"] as const,
  cronograma: (empId: number) =>
    [...empreendimentoKeys.detail(empId), "cronograma"] as const,
};

export const licencaKeys = {
  all: ["licencas"] as const,
  lists: () => [...licencaKeys.all, "list"] as const,
  detail: (id: number) => [...licencaKeys.all, "detail", id] as const,
  condicionantes: (licId: number) =>
    [...licencaKeys.detail(licId), "condicionantes"] as const,
};

export const demandaKeys = {
  all: ["demandas"] as const,
  lists: () => [...demandaKeys.all, "list"] as const,
  detail: (id: number) => [...demandaKeys.all, "detail", id] as const,
  byEmpreendimento: (empId: number) =>
    [...demandaKeys.all, "empreendimento", empId] as const,
};

export const equipamentoKeys = {
  all: ["equipamentos"] as const,
  lists: () => [...equipamentoKeys.all, "list"] as const,
  detail: (id: number) => [...equipamentoKeys.all, "detail", id] as const,
  imagens: (id: number) => [...equipamentoKeys.detail(id), "imagens"] as const,
};

export const frotaKeys = {
  all: ["frota"] as const,
  lists: () => [...frotaKeys.all, "list"] as const,
  detail: (id: number) => [...frotaKeys.all, "detail", id] as const,
};

export const dashboardKeys = {
  executivo: ["dashboard", "executivo"] as const,
  coordenador: (unidade: string) =>
    ["dashboard", "coordenador", unidade] as const,
};

export const contratoKeys = {
  all: ["contratos"] as const,
  lists: () => [...contratoKeys.all, "list"] as const,
  detail: (id: number) => [...contratoKeys.all, "detail", id] as const,
  byEmpreendimento: (empId: number) =>
    [...contratoKeys.all, "empreendimento", empId] as const,
};

export const documentoKeys = {
  all: ["documentos"] as const,
  lists: () => [...documentoKeys.all, "list"] as const,
  byEmpreendimento: (empId: number) =>
    [...documentoKeys.all, "empreendimento", empId] as const,
};

/**
 * Mapa de entidade WebSocket → query keys a invalidar.
 * Usado pelo hook useNotifications para invalidações automáticas.
 */
export const wsEntityKeyMap: Record<string, readonly unknown[]> = {
  empreendimentos: empreendimentoKeys.all,
  licencas: licencaKeys.all,
  condicionantes: licencaKeys.all,
  demandas: demandaKeys.all,
  equipamentos: equipamentoKeys.all,
  frota: frotaKeys.all,
  contratos: contratoKeys.all,
  documentos: documentoKeys.all,
  dashboard: dashboardKeys.executivo,
};
