// src/lib/mockApi.ts

type Json = any;

function loadJSON<T = any>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeeds() {
  // semente mínima para testes
  const empreendimentos = loadJSON("empreendimentos", null);
  if (!empreendimentos) {
    const seed = [
      {
        id: 1,
        nome: "Projeto Xingu",
        cliente: "Norte Energia",
        localizacao: "Altamira - PA",
        responsavelInterno: "Equipe Xingu",
      },
      {
        id: 2,
        nome: "UHE Garibaldi",
        cliente: "Eletrosul",
        localizacao: "SC",
        responsavelInterno: "Equipe Sul",
      },
    ];
    saveJSON("empreendimentos", seed);
  }

  const licencas = loadJSON("licencas", null);
  if (!licencas) {
    const seed = [
      {
        id: 10,
        empreendimentoId: 1,
        tipo: "LP",
        status: "valida",
        orgaoEmissor: "SEMAS/PA",
        dataEmissao: "2025-01-10",
        validade: "2028-01-10",
        arquivoPdf: "",
      },
      {
        id: 11,
        empreendimentoId: 1,
        tipo: "LI",
        status: "valida",
        orgaoEmissor: "SEMAS/PA",
        dataEmissao: "2025-03-01",
        validade: "2027-03-01",
        arquivoPdf: "",
      },
    ];
    saveJSON("licencas", seed);
  }

  const condicionantes = loadJSON("condicionantes", null);
  if (!condicionantes) {
    const seed = [
      {
        id: 100,
        licencaId: 10,
        descricao: "Apresentar relatório anual de fauna",
        prazo: "2025-12-31",
        status: "pendente",
        observacoes: "",
      },
      {
        id: 101,
        licencaId: 10,
        descricao: "Implantar programa de monitoramento",
        prazo: "2025-10-30",
        status: "cumprida",
        observacoes: "Execução fase 1 concluída",
      },
    ];
    saveJSON("condicionantes", seed);
  }
}
ensureSeeds();

// Utilitário de resposta "parecida" com fetch()
function makeResponse(data: Json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
  };
}

function notFound() {
  return makeResponse({ message: "Not found" }, 404);
}
function error500(message = "Internal server error") {
  return makeResponse({ message }, 500);
}

// Roteador simples por método/caminho
export async function apiRequest(method: string, path: string, body?: any) {
  try {
    // Normaliza
    const clean = path.replace(/\?.*$/, "");

    // ---------------------------
    // EMPREENDIMENTOS
    // ---------------------------
    if (method === "GET" && clean === "/api/empreendimentos") {
      const list = loadJSON("empreendimentos", []);
      return makeResponse(list, 200);
    }

    if (method === "GET" && /^\/api\/empreendimentos\/\d+$/.test(clean)) {
      const id = Number(clean.split("/").pop());
      const empreendimentos = loadJSON<any[]>("empreendimentos", []);
      const licencas = loadJSON<any[]>("licencas", []);
      const emp = empreendimentos.find((e) => e.id === id);
      if (!emp) return notFound();

      const licencasDoEmp = licencas.filter((l) => l.empreendimentoId === id);
      // Opcionalmente, agregue condicionantes em cada licença (se precisar)
      return makeResponse({ ...emp, licencas: licencasDoEmp }, 200);
    }

    if (method === "DELETE" && /^\/api\/empreendimentos\/\d+$/.test(clean)) {
      const id = Number(clean.split("/").pop());
      let empreendimentos = loadJSON<any[]>("empreendimentos", []);
      let licencas = loadJSON<any[]>("licencas", []);
      let condicionantes = loadJSON<any[]>("condicionantes", []);

      // Apaga condicionantes ligadas às licenças do empreendimento
      const licencasIds = licencas.filter(l => l.empreendimentoId === id).map(l => l.id);
      condicionantes = condicionantes.filter(c => !licencasIds.includes(c.licencaId));
      saveJSON("condicionantes", condicionantes);

      // Apaga licenças do empreendimento
      licencas = licencas.filter(l => l.empreendimentoId !== id);
      saveJSON("licencas", licencas);

      // Apaga o empreendimento
      const before = empreendimentos.length;
      empreendimentos = empreendimentos.filter(e => e.id !== id);
      saveJSON("empreendimentos", empreendimentos);

      return makeResponse({}, before === empreendimentos.length ? 404 : 204);
    }

    // ---------------------------
    // CONDICIONANTES (por licença)
    // GET /api/licencas/:licenseId/condicionantes  (sua queryKey provavelmente mapeia para isso)
    // ---------------------------
    if (method === "GET" && /^\/api\/licencas\/\d+\/condicionantes$/.test(clean)) {
      const licenseId = Number(clean.split("/")[3]);
      const condicionantes = loadJSON<any[]>("condicionantes", []);
      const data = condicionantes.filter(c => c.licencaId === licenseId);
      return makeResponse(data, 200);
    }

    // ---------------------------
    // CONDICIONANTES CRUD
    // ---------------------------
    if (method === "POST" && clean === "/api/condicionantes") {
      const { descricao, prazo, status, observacoes, licencaId } = body || {};
      if (!descricao || !prazo || !status || !licencaId) {
        return makeResponse({ message: "Dados inválidos" }, 400);
      }
      const condicionantes = loadJSON<any[]>("condicionantes", []);
      const nextId = condicionantes.length ? Math.max(...condicionantes.map(c => c.id)) + 1 : 1;
      const novo = { id: nextId, descricao, prazo, status, observacoes: observacoes ?? "", licencaId: Number(licencaId) };
      condicionantes.push(novo);
      saveJSON("condicionantes", condicionantes);
      return makeResponse(novo, 201);
    }

    if (method === "PUT" && /^\/api\/condicionantes\/\d+$/.test(clean)) {
      const id = Number(clean.split("/").pop());
      const condicionantes = loadJSON<any[]>("condicionantes", []);
      const idx = condicionantes.findIndex(c => c.id === id);
      if (idx === -1) return notFound();
      condicionantes[idx] = { ...condicionantes[idx], ...(body || {}) };
      saveJSON("condicionantes", condicionantes);
      return makeResponse(condicionantes[idx], 200);
    }

    if (method === "DELETE" && /^\/api\/condicionantes\/\d+$/.test(clean)) {
      const id = Number(clean.split("/").pop());
      let condicionantes = loadJSON<any[]>("condicionantes", []);
      const before = condicionantes.length;
      condicionantes = condicionantes.filter(c => c.id !== id);
      saveJSON("condicionantes", condicionantes);
      return makeResponse({}, before === condicionantes.length ? 404 : 204);
    }

    // ---------------------------
    // STATS (opcional, caso sua UI busque)
    // ---------------------------
    if (method === "GET" && clean === "/api/stats/condicionantes") {
      const condicionantes = loadJSON<any[]>("condicionantes", []);
      const stats = {
        total: condicionantes.length,
        pendentes: condicionantes.filter(c => c.status === "pendente").length,
        cumpridas: condicionantes.filter(c => c.status === "cumprida").length,
        vencidas: condicionantes.filter(c => c.status === "vencida").length,
      };
      return makeResponse(stats, 200);
    }

    // Se nada casou:
    return notFound();
  } catch (e: any) {
    console.error("mockApi error:", e);
    return error500(e?.message);
  }
}
