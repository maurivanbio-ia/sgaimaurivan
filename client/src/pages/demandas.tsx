/**
 * MELHORIAS APLICADAS (o que corrigir/otimizar)
 * 1. Tipagem forte no react-query (evita `any`, melhora DX e segurança).
 * 2. Unificação do fetch (remover fetch direto em /api/empreendimentos e usar apiRequest + ensureArray).
 * 3. Normalização de status e labels (reutilizar STATUS_LABEL no card e no histórico, evita divergência).
 * 4. Drag and drop: suportar reordenação dentro da mesma coluna + mover entre colunas com `arrayMove`.
 * 5. Evitar múltiplos invalidates repetidos: helper `invalidateDemandas()`.
 * 6. “Optimistic update” ao mover card (UI responde instantaneamente, rollback em erro).
 * 7. Formulário: validação mínima e consistência (responsável obrigatório, data obrigatória, trim).
 * 8. Performance: `useMemo` para listas filtradas (colaboradores) e para colunas; handlers com `useCallback`.
 *
 * Abaixo, mostro patches práticos (copie/cole por blocos).
 */

/* =========================
   1) TIPOS AUXILIARES
========================= */

type ApiList<T> = T[] | { data: T[] };

type Empreendimento = { id: number; nome: string };

/* =========================
   2) apiRequest melhorado
   - adiciona AbortSignal
   - melhor mensagem de erro
========================= */

async function apiRequest<T>(
  method: string,
  url: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  const tryJson = () => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };
  const json = tryJson();

  if (!res.ok) {
    const messageFromApi =
      (json && (json.message || json.error)) ||
      (typeof json === "string" ? json : null) ||
      text ||
      "Erro desconhecido";
    throw new Error(`${res.status} ${res.statusText}: ${messageFromApi}`);
  }

  return (json ?? null) as T;
}

function ensureArray<T>(data: ApiList<T> | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).data)) return (data as any).data;
  return [];
}

/* =========================
   3) NORMALIZAÇÃO DE STATUS
========================= */

const ALL_STATUS: Status[] = [
  "a_fazer",
  "em_andamento",
  "em_revisao",
  "concluido",
  "cancelado",
];

function normalizeStatus(input: unknown): Status {
  const s = String(input ?? "").trim();
  return (ALL_STATUS.includes(s as Status) ? (s as Status) : "a_fazer");
}

/* =========================
   4) INVALIDATE HELPER
========================= */

function useInvalidateDemandas() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/demandas"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/demandas/historico/all"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/licencas/calendar"], exact: false }),
    ]);
  };
}

/* =========================
   5) DEMANDAFORM: usar apiRequest + tipagem + validação simples
   - remove fetch direto
   - garante responsável e data
   - usa colaboradores filtrados em memo
========================= */

// dentro de DemandaForm:

// Substitua o query de empreendimentos por:
const { data: empreendimentosRaw = [] } = useQuery<ApiList<Empreendimento>>({
  queryKey: ["/api/empreendimentos"],
  queryFn: ({ signal }) => apiRequest("GET", "/api/empreendimentos", undefined, signal),
});
const empreendimentos = useMemo(
  () => ensureArray<Empreendimento>(empreendimentosRaw),
  [empreendimentosRaw]
);

// Colaboradores com queryFn explícita (evita depender de defaults)
const { data: colaboradoresRaw = [] } = useQuery<ApiList<Colaborador>>({
  queryKey: ["/api/colaboradores"],
  queryFn: ({ signal }) => apiRequest("GET", "/api/colaboradores", undefined, signal),
});
const colaboradores = useMemo(
  () => ensureArray<Colaborador>(colaboradoresRaw),
  [colaboradoresRaw]
);

const colaboradoresUsuarios = useMemo(
  () => colaboradores.filter((c) => c.tipo === "user" && Boolean(c.id)),
  [colaboradores]
);

// Na mutationFn do DemandaForm, antes de montar payload:
const titulo = form.titulo.trim();
const descricao = form.descricao.trim();

if (!titulo) throw new Error("Título é obrigatório.");
if (!descricao) throw new Error("Descrição é obrigatória.");
if (!form.dataEntrega) throw new Error("Data de entrega é obrigatória.");
if (!form.responsavelId) throw new Error("Selecione um responsável.");

// use form.responsavelId sempre, evite depender de string:
const payload: any = {
  titulo,
  descricao,
  setor: form.setor,
  prioridade: form.prioridade,
  complexidade: form.complexidade,
  categoria: form.categoria,
  responsavelId: form.responsavelId,
  dataEntrega: form.dataEntrega,
  status: form.status,
  empreendimentoId: form.empreendimentoId ? Number(form.empreendimentoId) : undefined,
};

// e no CommandGroup troque `colaboradores.filter...` por `colaboradoresUsuarios.map(...)`


/* =========================
   6) DRAG and DROP: reordenação + mover entre colunas
   - exige ordenar por "ordem" no backend? se não tiver, dá para manter localmente.
   - aqui fica local (optimistic) e persiste apenas status (como você já faz).
   - se quiser persistir ordem, adicione endpoint PATCH com { status, ordem }.
========================= */

import { arrayMove } from "@dnd-kit/sortable";

// No DemandasPage, crie estado local para ordenar (só UI)
const [localDemandas, setLocalDemandas] = useState<Demanda[]>([]);
useEffect(() => {
  setLocalDemandas(demandas); // sincroniza sempre que vier do servidor
}, [demandas]);

// Use localDemandas no lugar de demandas nos cálculos e buscas:
const columns = useMemo(() => {
  const grouped: Record<Status, Demanda[]> = {
    a_fazer: [],
    em_andamento: [],
    em_revisao: [],
    concluido: [],
    cancelado: [],
  };
  localDemandas.forEach((d) => grouped[normalizeStatus(d.status)].push(d));
  return grouped;
}, [localDemandas]);

const findById = (id: number) => localDemandas.find((x) => x.id === id);

// onDragStart:
const onDragStart = (e: any) => {
  const id = Number(e.active.id);
  const d = findById(id);
  if (d) setActiveDemanda(d);
};

// Melhor: usar over.id podendo ser coluna OU card.
//  - Se over.id for Status, move para coluna.
//  - Se over.id for number (card), reordena dentro da coluna de destino.
const onDragEnd = (e: DragEndEvent) => {
  const { active, over } = e;
  setActiveDemanda(null);
  if (!over) return;

  const activeId = Number(active.id);
  const overId = over.id;

  const activeItem = findById(activeId);
  if (!activeItem) return;

  const overIsColumn = ALL_STATUS.includes(String(overId) as Status);
  const overItem = !overIsColumn ? findById(Number(overId)) : null;

  const nextStatus: Status = overIsColumn
    ? (String(overId) as Status)
    : normalizeStatus(overItem?.status);

  // 6.1 Optimistic update: status
  setLocalDemandas((prev) =>
    prev.map((d) => (d.id === activeId ? { ...d, status: nextStatus } : d))
  );

  // 6.2 Reorder se soltou sobre outro card
  if (overItem && overItem.id !== activeId) {
    setLocalDemandas((prev) => {
      const activeIndex = prev.findIndex((d) => d.id === activeId);
      const overIndex = prev.findIndex((d) => d.id === overItem.id);
      return arrayMove(prev, activeIndex, overIndex);
    });
  }

  // 6.3 Persistir status se mudou
  const changed = normalizeStatus(activeItem.status) !== nextStatus;
  if (changed) moveMutation.mutate({ id: activeId, status: nextStatus });
};

/* =========================
   7) MOVE MUTATION COM OPTIMISTIC + ROLLBACK
========================= */

const invalidateDemandas = useInvalidateDemandas();

const moveMutation = useMutation({
  mutationFn: async ({ id, status }: { id: number; status: Status }) =>
    apiRequest("PATCH", `/api/demandas/${id}`, { status }),
  onMutate: async ({ id, status }) => {
    // cancela queries em voo
    await queryClient.cancelQueries({ queryKey: ["/api/demandas"] });

    const previous = queryClient.getQueryData<any>(["/api/demandas"]);
    // atualiza cache (se seu backend retorna array direto, funciona bem)
    queryClient.setQueryData<any>(["/api/demandas"], (old: any) => {
      const arr = ensureArray<Demanda>(old);
      return arr.map((d) => (d.id === id ? { ...d, status } : d));
    });

    return { previous };
  },
  onError: (e: any, _vars, ctx) => {
    // rollback cache
    if (ctx?.previous) queryClient.setQueryData(["/api/demandas"], ctx.previous);
    toast({
      title: "Falha ao mover demanda",
      description: e?.message ?? "Erro desconhecido",
      variant: "destructive",
    });
  },
  onSuccess: async () => {
    await invalidateDemandas();
    toast({ title: "Demanda movida com sucesso!" });
  },
});

/* =========================
   8) DEMANDACARD: reduzir duplicação de labels
========================= */

// dentro de DemandaCard, substitua statusLabel e categoriaLabel por:
const statusLabel = STATUS_LABEL[normalizeStatus(demanda.status)];

const CATEGORIA_LABEL: Record<Categoria, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.value, c.label])
) as any;

const categoriaLabel = CATEGORIA_LABEL[(demanda.categoria ?? "geral") as Categoria];

/* =========================
   9) HISTÓRICO: mostrar labels bonitos
========================= */

// na tabela do histórico, no lugar de h.statusAnterior e h.statusNovo cru:
const prevLabel = STATUS_LABEL[normalizeStatus(h.statusAnterior)];
const nextLabel = STATUS_LABEL[normalizeStatus(h.statusNovo)];

/* =========================
   10) PEQUENAS CORREÇÕES DE QUALIDADE
========================= */

// A) evitar confirm() para UX melhor: trocar por Dialog de confirmação.
// B) remover imports não usados: wildlifeBg, Tag duplicado? RefreshCw etc.
// C) acessibilidade: botão de arrasto com aria-label.
// D) datas: proteger parseISO quando dataEntrega vier vazia.
function safeFormatDate(iso: string, fmt: string) {
  try {
    return formatDate(parseISO(iso), fmt, { locale: ptBR });
  } catch {
    return "-";
  }
}
