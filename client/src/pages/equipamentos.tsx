import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Wrench,
  Loader2,
  Camera,
  Image as ImageIcon,
  Upload,
  XCircle,
  Download,
  ChevronsUpDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";

/**
 * Melhorias aplicadas neste arquivo.
 * 1. Refatoração leve por componentes internos e hooks locais.
 * 2. Tratamento completo de erro do React Query e indicador de atualização (isFetching).
 * 3. Evita flicker com placeholderData.
 * 4. EMPTY_FORM_VALUES centralizado, remove duplicações.
 * 5. Badge de manutenção vencida, filtro “Somente vencidos”.
 * 6. Ordenação client side por colunas (sem depender do backend).
 * 7. Paginação client side.
 * 8. Seleção em lote, atualização em lote de status, localização e responsável (calls sequenciais ao endpoint PUT existente).
 * 9. Exportação CSV do resultado filtrado e ordenado.
 * 10. Upload múltiplo com fila sequencial, validação e feedback melhor.
 * 11. Invalidação de cache com granularidade mais adequada.
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const equipamentoSchema = z.object({
  id: z.number().optional(),
  nome: z.string().min(1, "Nome obrigatório"),
  tipo: z.string().min(1, "Selecione o tipo"),
  status: z.string().min(1, "Status obrigatório"),
  localizacaoAtual: z.string().min(1, "Selecione a localização"),
  responsavel: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroPatrimonio: z.string().optional(),
  dataAquisicao: z.string().optional(),
  ultimaManutencao: z.string().optional(),
  proximaManutencao: z.string().optional(),
  valorAquisicao: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional())
    .optional(),
  observacoes: z.string().optional(),
  empreendimentoId: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().optional())
    .optional(),
});

type Equipamento = z.infer<typeof equipamentoSchema>;

type EmpreendimentoListItem = {
  id: number;
  nome: string;
};

type ImagemDano = {
  filePath: string;
  descricao?: string;
  dataUpload: string;
  signedUrl?: string;
};

const EQUIPMENT_TYPES = [
  "Veículo",
  "GPS",
  "Drone",
  "Armadilha Fotográfica",
  "Estação Meteorológica",
  "Equipamento de Campo",
  "Notebook",
  "Tablet",
  "Smartphone",
  "Outro",
];

const STATUS_OPTIONS = [
  { value: "disponivel", label: "Disponível", color: "bg-green-500" },
  { value: "em_uso", label: "Em Uso", color: "bg-blue-500" },
  { value: "manutencao", label: "Manutenção", color: "bg-yellow-500" },
] as const;

const LOCATION_OPTIONS = [
  "Escritório Central",
  "Almoxarifado",
  "Em Campo",
  "Cliente",
  "Colaborador",
  "Em Manutenção Externa",
  "Outro",
];

const EMPTY_FORM_VALUES: Equipamento = {
  nome: "",
  tipo: "",
  status: "disponivel",
  localizacaoAtual: "",
  responsavel: "",
  marca: "",
  modelo: "",
  numeroPatrimonio: "",
  dataAquisicao: "",
  ultimaManutencao: "",
  proximaManutencao: "",
  valorAquisicao: undefined,
  observacoes: "",
  empreendimentoId: undefined,
};

function extractErrorMessage(err: unknown, fallback: string) {
  if (!err) return fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}

function isAllowedImageType(mime: string) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return allowed.includes(mime);
}

/**
 * Data pura (YYYY-MM-DD).
 * Evita problemas de timezone em datas “sem hora”.
 */
function formatDateOnlyBR(dateStr?: string) {
  if (!dateStr) return "Não informado";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return "Não informado";
  return dt.toLocaleDateString("pt-BR");
}

function startOfTodayMs() {
  const t = new Date();
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return d.getTime();
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (m) {
      const [_, y, mo, d] = m;
      const parsed = new Date(Number(y), Number(mo) - 1, Number(d));
      return parsed.getTime() < startOfTodayMs();
    }
    return false;
  }
  return dt.getTime() < startOfTodayMs();
}

type SortKey =
  | "id"
  | "nome"
  | "tipo"
  | "status"
  | "localizacaoAtual"
  | "responsavel"
  | "ultimaManutencao"
  | "proximaManutencao";

type SortDir = "asc" | "desc";

function safeLower(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function compareValues(a: Equipamento, b: Equipamento, key: SortKey, dir: SortDir) {
  const mult = dir === "asc" ? 1 : -1;

  const getDateMs = (v?: string) => {
    if (!v) return Number.POSITIVE_INFINITY;
    const dt = new Date(v);
    if (!Number.isNaN(dt.getTime())) return dt.getTime();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return Number.POSITIVE_INFINITY;
    const [_, y, mo, d] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d)).getTime();
  };

  if (key === "id") return ((a.id ?? 0) - (b.id ?? 0)) * mult;

  if (key === "ultimaManutencao") return (getDateMs(a.ultimaManutencao) - getDateMs(b.ultimaManutencao)) * mult;

  if (key === "proximaManutencao") return (getDateMs(a.proximaManutencao) - getDateMs(b.proximaManutencao)) * mult;

  const av = safeLower((a as any)[key]);
  const bv = safeLower((b as any)[key]);
  if (av < bv) return -1 * mult;
  if (av > bv) return 1 * mult;
  return 0;
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsvRow(values: string[]) {
  return values
    .map((v) => {
      const s = v ?? "";
      const escaped = String(s).replaceAll('"', '""');
      return `"${escaped}"`;
    })
    .join(",");
}

/**
 * Hook. Lista de equipamentos.
 */
function useEquipamentos(filters: Record<string, string>) {
  return useQuery<Equipamento[]>({
    queryKey: ["/api/equipamentos", filters],
    queryFn: async () => {
      const qs = new URLSearchParams(filters).toString();
      const res = await apiRequest("GET", `/api/equipamentos${qs ? `?${qs}` : ""}`);
      return res.json();
    },
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Hook. Lista de empreendimentos.
 */
function useEmpreendimentos() {
  return useQuery<EmpreendimentoListItem[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/empreendimentos");
      return res.json();
    },
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Hook. Imagens de dano.
 */
function useImagensDano(equipamentoId: number | null, open: boolean) {
  return useQuery<ImagemDano[]>({
    queryKey: ["/api/equipamentos", equipamentoId, "imagens"],
    queryFn: async () => {
      if (!equipamentoId) return [];
      const res = await apiRequest("GET", `/api/equipamentos/${equipamentoId}/imagens`);
      return res.json();
    },
    enabled: !!equipamentoId && open,
    staleTime: 0,
    gcTime: 2 * 60_000,
  });
}

function StatusBadge({ status }: { status: string }) {
  const map = useMemo(() => {
    const m = new Map<string, { label: string; color: string }>();
    for (const s of STATUS_OPTIONS) m.set(s.value, { label: s.label, color: s.color });
    return m;
  }, []);

  const s = map.get(status);
  if (!s) return <Badge className="bg-gray-400">Indefinido</Badge>;
  return <Badge className={s.color}>{s.label}</Badge>;
}

function OverdueBadge({ dateStr }: { dateStr?: string }) {
  if (!isOverdue(dateStr)) return null;
  return (
    <Badge className="bg-red-500">
      <AlertTriangle className="h-3 w-3 mr-1" />
      Vencida
    </Badge>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:underline"
      aria-label={`Ordenar por ${label}`}
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      <ChevronsUpDown className={`h-4 w-4 ${active ? "opacity-100" : "opacity-40"}`} />
      {active ? <span className="sr-only">{dir === "asc" ? "Ascendente" : "Descendente"}</span> : null}
    </button>
  );
}

export default function EquipamentosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);

  const [tipoFilter, setTipoFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localizacaoFilter, setLocalizacaoFilter] = useState("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [equipamentoToDelete, setEquipamentoToDelete] = useState<number | null>(null);

  const [imagensDialogOpen, setImagensDialogOpen] = useState(false);
  const [imagensEquipamentoId, setImagensEquipamentoId] = useState<number | null>(null);
  const [imagensEquipamentoNome, setImagensEquipamentoNome] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDescricao, setImageDescricao] = useState("");

  const [imageDeleteDialogOpen, setImageDeleteDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("none");
  const [bulkLocalizacao, setBulkLocalizacao] = useState<string>("none");
  const [bulkResponsavel, setBulkResponsavel] = useState<string>("");

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (tipoFilter !== "all") params.tipo = tipoFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    if (localizacaoFilter !== "all") params.localizacaoAtual = localizacaoFilter;
    return params;
  }, [debouncedSearch, tipoFilter, statusFilter, localizacaoFilter]);

  const {
    data: equipamentosRaw = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useEquipamentos(filters);

  const { data: empreendimentos = [] } = useEmpreendimentos();

  const { data: imagensDano = [], refetch: refetchImagens } = useImagensDano(imagensEquipamentoId, imagensDialogOpen);

  const form = useForm<Equipamento>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: EMPTY_FORM_VALUES,
  });

  const invalidateEquipamentos = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/equipamentos"] });
  }, [queryClient]);

  const invalidateImagens = useCallback(
    (id: number | null) => {
      if (!id) return;
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos", id, "imagens"] });
    },
    [queryClient],
  );

  const createMutation = useMutation({
    mutationFn: async (data: Equipamento) => apiRequest("POST", "/api/equipamentos", data),
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Equipamento cadastrado com sucesso." });
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      form.reset(EMPTY_FORM_VALUES);
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha ao cadastrar equipamento."),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Equipamento }) =>
      apiRequest("PUT", `/api/equipamentos/${id}`, data),
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Equipamento atualizado." });
      setIsDialogOpen(false);
      setEditingEquipamento(null);
      form.reset(EMPTY_FORM_VALUES);
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha ao atualizar equipamento."),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/equipamentos/${id}`),
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Equipamento removido." });
      setDeleteDialogOpen(false);
      setEquipamentoToDelete(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(equipamentoToDelete ?? -1);
        return next;
      });
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha ao excluir equipamento."),
        variant: "destructive",
      });
    },
  });

  const confirmDelete = useCallback(() => {
    if (equipamentoToDelete) deleteMutation.mutate(equipamentoToDelete);
  }, [deleteMutation, equipamentoToDelete]);

  const onSubmit = useCallback(
    (data: Equipamento) => {
      if (editingEquipamento?.id) {
        updateMutation.mutate({ id: editingEquipamento.id, data });
        return;
      }
      createMutation.mutate(data);
    },
    [createMutation, editingEquipamento?.id, updateMutation],
  );

  const openFormDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeFormDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingEquipamento(null);
    form.reset(EMPTY_FORM_VALUES);
  }, [form]);

  const handleNew = useCallback(() => {
    setEditingEquipamento(null);
    form.reset(EMPTY_FORM_VALUES);
    openFormDialog();
  }, [form, openFormDialog]);

  const handleEdit = useCallback(
    (equipamento: Equipamento) => {
      setEditingEquipamento(equipamento);
      form.reset({
        ...EMPTY_FORM_VALUES,
        ...equipamento,
        dataAquisicao: equipamento.dataAquisicao || "",
        ultimaManutencao: equipamento.ultimaManutencao || "",
        proximaManutencao: equipamento.proximaManutencao || "",
      });
      openFormDialog();
    },
    [form, openFormDialog],
  );

  const handleDelete = useCallback((id: number) => {
    setEquipamentoToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setTipoFilter("all");
    setStatusFilter("all");
    setLocalizacaoFilter("all");
    setOnlyOverdue(false);
    setPage(1);
  }, []);

  const handleOpenImagens = useCallback((equipamento: Equipamento) => {
    if (!equipamento.id) return;
    setImagensEquipamentoId(equipamento.id);
    setImagensEquipamentoNome(equipamento.nome);
    setImageDescricao("");
    setImageToDelete(null);
    setImageDeleteDialogOpen(false);
    setImagensDialogOpen(true);
  }, []);

  const closeImagensDialog = useCallback(() => {
    setImagensDialogOpen(false);
    setImagensEquipamentoId(null);
    setImagensEquipamentoNome("");
    setImageDescricao("");
    setUploadingImage(false);
    setImageToDelete(null);
    setImageDeleteDialogOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const validateImageFile = useCallback(
    (file: File) => {
      if (!isAllowedImageType(file.type)) {
        toast({
          title: "Arquivo inválido",
          description: "Envie uma imagem JPG, PNG, WebP ou GIF.",
          variant: "destructive",
        });
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast({
          title: "Arquivo muito grande",
          description: "Tamanho máximo permitido é 10MB.",
          variant: "destructive",
        });
        return false;
      }
      return true;
    },
    [toast],
  );

  /**
   * Upload sequencial (fila). Aceita múltiplos arquivos.
   */
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());

  const uploadOneImage = useCallback(
    async (file: File) => {
      if (!imagensEquipamentoId) return;
      if (!validateImageFile(file)) return;

      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

      const urlRes = await apiRequest("POST", `/api/equipamentos/${imagensEquipamentoId}/imagens/upload-url`, {
        extension,
        contentType: file.type,
        filename: file.name,
      });

      const { uploadUrl, filePath } = await urlRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        throw new Error("Falha ao enviar arquivo.");
      }

      const registerRes = await apiRequest("POST", `/api/equipamentos/${imagensEquipamentoId}/imagens`, {
        filePath,
        descricao: imageDescricao?.trim() ? imageDescricao.trim() : undefined,
      });

      if (!registerRes.ok) {
        const msg = await registerRes.text().catch(() => "");
        throw new Error(msg || "Falha ao registrar imagem.");
      }
    },
    [imageDescricao, imagensEquipamentoId, validateImageFile],
  );

  const handleUploadImages = useCallback(
    async (files: File[]) => {
      if (!imagensEquipamentoId) return;
      if (!files.length) return;

      setUploadingImage(true);

      uploadQueueRef.current = uploadQueueRef.current
        .then(async () => {
          let ok = 0;
          let fail = 0;

          for (const f of files) {
            try {
              await uploadOneImage(f);
              ok += 1;
            } catch (err) {
              fail += 1;
              toast({
                title: "Erro no upload",
                description: extractErrorMessage(err, `Falha ao enviar ${f.name}.`),
                variant: "destructive",
              });
            }
          }

          if (ok > 0) {
            toast({
              title: "Sucesso",
              description: ok === 1 ? "Imagem enviada com sucesso." : `Imagens enviadas com sucesso: ${ok}.`,
            });
            setImageDescricao("");
            invalidateEquipamentos();
            invalidateImagens(imagensEquipamentoId);
            await refetchImagens();
          }

          if (fail > 0) {
            toast({
              title: "Atenção",
              description: `Falhas no envio: ${fail}.`,
              variant: "destructive",
            });
          }

          if (fileInputRef.current) fileInputRef.current.value = "";
        })
        .finally(() => {
          setUploadingImage(false);
        });

      await uploadQueueRef.current;
    },
    [imagensEquipamentoId, invalidateEquipamentos, invalidateImagens, refetchImagens, toast, uploadOneImage],
  );

  const requestDeleteImage = useCallback((filePath: string) => {
    setImageToDelete(filePath);
    setImageDeleteDialogOpen(true);
  }, []);

  const confirmDeleteImage = useCallback(async () => {
    if (!imagensEquipamentoId || !imageToDelete) return;

    try {
      const res = await apiRequest("DELETE", `/api/equipamentos/${imagensEquipamentoId}/imagens`, {
        filePath: imageToDelete,
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Falha ao excluir imagem.");
      }

      toast({ title: "Sucesso", description: "Imagem removida." });
      setImageDeleteDialogOpen(false);
      setImageToDelete(null);

      invalidateEquipamentos();
      invalidateImagens(imagensEquipamentoId);
      await refetchImagens();
    } catch (error) {
      toast({
        title: "Erro",
        description: extractErrorMessage(error, "Falha ao excluir imagem."),
        variant: "destructive",
      });
    }
  }, [imageToDelete, imagensEquipamentoId, invalidateEquipamentos, invalidateImagens, refetchImagens, toast]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(searchTerm) || tipoFilter !== "all" || statusFilter !== "all" || localizacaoFilter !== "all" || onlyOverdue;
  }, [localizacaoFilter, onlyOverdue, searchTerm, statusFilter, tipoFilter]);

  /**
   * Pós filtro local. “Somente vencidos” depende de data de próxima manutenção, então é feito no client.
   */
  const equipamentosFiltered = useMemo(() => {
    const base = equipamentosRaw ?? [];
    const withOverdue = onlyOverdue ? base.filter((e) => isOverdue(e.proximaManutencao)) : base;
    return withOverdue;
  }, [equipamentosRaw, onlyOverdue]);

  /**
   * Ordenação client side.
   */
  const equipamentosSorted = useMemo(() => {
    const arr = [...equipamentosFiltered];
    arr.sort((a, b) => compareValues(a, b, sortKey, sortDir));
    return arr;
  }, [equipamentosFiltered, sortDir, sortKey]);

  /**
   * Paginação client side.
   */
  const totalItems = equipamentosSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const equipamentosPage = useMemo(() => {
    const start = (page - 1) * pageSize;
    return equipamentosSorted.slice(start, start + pageSize);
  }, [equipamentosSorted, page]);

  /**
   * Seleção em lote.
   */
  const toggleSelected = useCallback((id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const allVisibleSelected = useMemo(() => {
    if (!equipamentosPage.length) return false;
    return equipamentosPage.every((e) => (e.id ? selectedIds.has(e.id) : false));
  }, [equipamentosPage, selectedIds]);

  const toggleSelectAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const e of equipamentosPage) {
          if (!e.id) continue;
          if (checked) next.add(e.id);
          else next.delete(e.id);
        }
        return next;
      });
    },
    [equipamentosPage],
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { ids: number[]; patch: Partial<Equipamento> }) => {
      const { ids, patch } = payload;

      for (const id of ids) {
        const res = await apiRequest("PUT", `/api/equipamentos/${id}`, patch);
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          throw new Error(msg || `Falha ao atualizar equipamento ${id}.`);
        }
      }
    },
    onSuccess: async () => {
      invalidateEquipamentos();
      toast({ title: "Sucesso", description: "Atualização em lote concluída." });
      setBulkStatus("none");
      setBulkLocalizacao("none");
      setBulkResponsavel("");
      clearSelection();
    },
    onError: (e) => {
      toast({
        title: "Erro",
        description: extractErrorMessage(e, "Falha na atualização em lote."),
        variant: "destructive",
      });
    },
  });

  const applyBulkUpdate = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast({ title: "Atenção", description: "Selecione pelo menos um equipamento." });
      return;
    }

    const patch: Partial<Equipamento> = {};

    if (bulkStatus !== "none") patch.status = bulkStatus;
    if (bulkLocalizacao !== "none") patch.localizacaoAtual = bulkLocalizacao;
    if (bulkResponsavel.trim()) patch.responsavel = bulkResponsavel.trim();

    if (!Object.keys(patch).length) {
      toast({ title: "Atenção", description: "Defina pelo menos um campo para atualizar em lote." });
      return;
    }

    bulkUpdateMutation.mutate({ ids, patch });
  }, [bulkLocalizacao, bulkResponsavel, bulkStatus, bulkUpdateMutation, selectedIds, toast]);

  /**
   * Exportação CSV do conjunto filtrado e ordenado (não apenas da página).
   */
  const exportCsv = useCallback(() => {
    const header = [
      "ID",
      "Nome",
      "Tipo",
      "Marca",
      "Modelo",
      "Status",
      "Localização",
      "Responsável",
      "Nº Patrimônio",
      "Data Aquisição",
      "Última Manutenção",
      "Próxima Manutenção",
      "Valor Aquisição",
      "Empreendimento ID",
      "Observações",
    ];

    const rows = equipamentosSorted.map((e) =>
      toCsvRow([
        String(e.id ?? ""),
        e.nome ?? "",
        e.tipo ?? "",
        e.marca ?? "",
        e.modelo ?? "",
        e.status ?? "",
        e.localizacaoAtual ?? "",
        e.responsavel ?? "",
        e.numeroPatrimonio ?? "",
        e.dataAquisicao ?? "",
        e.ultimaManutencao ?? "",
        e.proximaManutencao ?? "",
        e.valorAquisicao === undefined || e.valorAquisicao === null ? "" : String(e.valorAquisicao),
        e.empreendimentoId === undefined || e.empreendimentoId === null ? "" : String(e.empreendimentoId),
        e.observacoes ?? "",
      ]),
    );

    const csv = [toCsvRow(header), ...rows].join("\n");
    const name = `equipamentos_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadTextFile(name, csv, "text/csv;charset=utf-8");
    toast({ title: "Exportação", description: "Arquivo CSV gerado com sucesso." });
  }, [equipamentosSorted, toast]);

  const setSort = useCallback(
    (key: SortKey) => {
      setPage(1);
      setSortKey((prevKey) => {
        if (prevKey === key) {
          setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
          return prevKey;
        }
        setSortDir("asc");
        return key;
      });
    },
    [],
  );

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Gestão de Equipamentos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie equipamentos ambientais e operacionais utilizados nos projetos.
          </p>
          {isFetching && !isLoading ? <p className="text-xs text-muted-foreground mt-1">Atualizando lista.</p> : null}
        </div>

        <div className="flex gap-2">
          <RefreshButton />
          <Button variant="outline" onClick={exportCsv} aria-label="Exportar CSV">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={handleNew} data-testid="button-novo-equipamento">
            <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, marca, modelo."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
                data-testid="input-search-equipamentos"
                aria-label="Buscar equipamentos"
              />
            </div>

            <Select
              value={tipoFilter}
              onValueChange={(v) => {
                setTipoFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger data-testid="select-tipo-filter" aria-label="Filtro por tipo">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {EQUIPMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger data-testid="select-status-filter" aria-label="Filtro por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={localizacaoFilter}
              onValueChange={(v) => {
                setLocalizacaoFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger data-testid="select-localizacao-filter" aria-label="Filtro por localização">
                <SelectValue placeholder="Localização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Localizações</SelectItem>
                {LOCATION_OPTIONS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => {
                  setOnlyOverdue(e.target.checked);
                  setPage(1);
                }}
                aria-label="Filtrar apenas manutenção vencida"
              />
              Somente vencidos (próxima manutenção)
            </label>

            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
                aria-label="Limpar filtros"
              >
                <X className="h-4 w-4 mr-2" /> Limpar filtros
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center justify-between gap-4 flex-wrap">
            <span>Inventário</span>
            <span className="text-sm text-muted-foreground">
              Total. {totalItems} . Página. {page} de {totalPages}
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">{extractErrorMessage(error, "Falha ao carregar equipamentos.")}</p>
              <Button onClick={() => refetch()} aria-label="Tentar novamente">
                Tentar novamente
              </Button>
            </div>
          ) : equipamentosSorted.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum equipamento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters ? "Ajuste os filtros para encontrar equipamentos." : "Comece cadastrando seu primeiro equipamento."}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters} aria-label="Limpar filtros">
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={handleNew} aria-label="Cadastrar primeiro equipamento">
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar Primeiro Equipamento
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  Selecionados. {selectedIds.size}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger aria-label="Atualização em lote de status" className="w-[180px]">
                      <SelectValue placeholder="Status em lote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Status em lote</SelectItem>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={bulkLocalizacao} onValueChange={setBulkLocalizacao}>
                    <SelectTrigger aria-label="Atualização em lote de localização" className="w-[220px]">
                      <SelectValue placeholder="Localização em lote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Localização em lote</SelectItem>
                      {LOCATION_OPTIONS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    value={bulkResponsavel}
                    onChange={(e) => setBulkResponsavel(e.target.value)}
                    placeholder="Responsável em lote (opcional)"
                    className="w-[240px]"
                    aria-label="Responsável em lote"
                  />

                  <Button
                    variant="outline"
                    onClick={clearSelection}
                    disabled={selectedIds.size === 0}
                    aria-label="Limpar seleção"
                  >
                    Limpar seleção
                  </Button>

                  <Button
                    onClick={applyBulkUpdate}
                    disabled={bulkUpdateMutation.isPending || selectedIds.size === 0}
                    aria-label="Aplicar atualização em lote"
                  >
                    {bulkUpdateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Aplicar em lote
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table aria-label="Tabela de equipamentos cadastrados">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[44px]">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                          aria-label="Selecionar todos da página"
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="ID"
                          active={sortKey === "id"}
                          dir={sortDir}
                          onClick={() => setSort("id")}
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Nome"
                          active={sortKey === "nome"}
                          dir={sortDir}
                          onClick={() => setSort("nome")}
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Tipo"
                          active={sortKey === "tipo"}
                          dir={sortDir}
                          onClick={() => setSort("tipo")}
                        />
                      </TableHead>

                      <TableHead>Marca. Modelo</TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Status"
                          active={sortKey === "status"}
                          dir={sortDir}
                          onClick={() => setSort("status")}
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Localização"
                          active={sortKey === "localizacaoAtual"}
                          dir={sortDir}
                          onClick={() => setSort("localizacaoAtual")}
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Responsável"
                          active={sortKey === "responsavel"}
                          dir={sortDir}
                          onClick={() => setSort("responsavel")}
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Última Manutenção"
                          active={sortKey === "ultimaManutencao"}
                          dir={sortDir}
                          onClick={() => setSort("ultimaManutencao")}
                        />
                      </TableHead>

                      <TableHead>
                        <SortableHeader
                          label="Próxima Manutenção"
                          active={sortKey === "proximaManutencao"}
                          dir={sortDir}
                          onClick={() => setSort("proximaManutencao")}
                        />
                      </TableHead>

                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {equipamentosPage.map((e) => {
                      const id = e.id ?? 0;
                      const marcaModelo = [e.marca, e.modelo].filter(Boolean).join(" . ");
                      const checked = e.id ? selectedIds.has(e.id) : false;

                      return (
                        <TableRow key={id} data-testid={`row-equipamento-${id}`}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(ev) => {
                                if (!e.id) return;
                                toggleSelected(e.id, ev.target.checked);
                              }}
                              aria-label={`Selecionar equipamento ${id}`}
                            />
                          </TableCell>

                          <TableCell className="font-medium">{e.id}</TableCell>

                          <TableCell>
                            <div>
                              <p className="font-medium">{e.nome}</p>
                              {e.numeroPatrimonio ? <p className="text-xs text-muted-foreground">#{e.numeroPatrimonio}</p> : null}
                            </div>
                          </TableCell>

                          <TableCell>{e.tipo || "Não informado"}</TableCell>
                          <TableCell>{marcaModelo ? marcaModelo : "Não informado"}</TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={e.status} />
                            </div>
                          </TableCell>

                          <TableCell>{e.localizacaoAtual || "Não informado"}</TableCell>
                          <TableCell>{e.responsavel ? e.responsavel : "Não informado"}</TableCell>

                          <TableCell>{formatDateOnlyBR(e.ultimaManutencao)}</TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{formatDateOnlyBR(e.proximaManutencao)}</span>
                              <OverdueBadge dateStr={e.proximaManutencao} />
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                aria-label="Ver e adicionar imagens de dano"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenImagens(e)}
                                title="Ver. Adicionar imagens de dano"
                              >
                                <Camera className="h-4 w-4 text-orange-500" />
                              </Button>

                              <Button aria-label="Editar equipamento" variant="ghost" size="sm" onClick={() => handleEdit(e)}>
                                <Edit className="h-4 w-4" />
                              </Button>

                              <Button
                                aria-label="Excluir equipamento"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(e.id!)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                <div className="text-sm text-muted-foreground">
                  Exibindo. {(page - 1) * pageSize + 1} . {Math.min(page * pageSize, totalItems)} de {totalItems}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    Anterior
                  </Button>

                  <span className="text-sm">
                    Página {page} de {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Próxima página"
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog();
            return;
          }
          setIsDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEquipamento ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
            <DialogDescription>
              {editingEquipamento ? "Atualize os dados do equipamento." : "Preencha as informações para cadastrar."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="nome"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input {...field} aria-label="Nome do equipamento" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="tipo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Tipo do equipamento">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EQUIPMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="marca"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Marca" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="modelo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Modelo" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Status do equipamento">
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="localizacaoAtual"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização Atual *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger aria-label="Localização atual do equipamento">
                            <SelectValue placeholder="Selecione a localização" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LOCATION_OPTIONS.map((l) => (
                            <SelectItem key={l} value={l}>
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="responsavel"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Responsável" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="empreendimentoId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empreendimento</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "none" ? undefined : Number(v))}
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-empreendimento" aria-label="Empreendimento associado">
                            <SelectValue placeholder="Selecione (opcional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {empreendimentos.map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>
                              {e.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="numeroPatrimonio"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nº Patrimônio</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} aria-label="Número de patrimônio" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="dataAquisicao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Aquisição</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} aria-label="Data de aquisição" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="ultimaManutencao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Última Manutenção</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} aria-label="Última manutenção" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="proximaManutencao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próxima Manutenção</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} aria-label="Próxima manutenção" />
                      </FormControl>
                      {isOverdue(field.value || "") ? (
                        <p className="text-xs text-red-500 mt-1">Atenção. A data informada está vencida.</p>
                      ) : null}
                    </FormItem>
                  )}
                />

                <FormField
                  name="valorAquisicao"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor de Aquisição (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          value={field.value === undefined || field.value === null ? "" : String(field.value)}
                          onChange={(e) => {
                            const v = e.target.value;
                            field.onChange(v === "" ? undefined : Number(v));
                          }}
                          placeholder="0.00"
                          aria-label="Valor de aquisição"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                name="observacoes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} rows={3} aria-label="Observações" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeFormDialog} aria-label="Cancelar">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  aria-label="Salvar equipamento"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {editingEquipamento ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={imagensDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeImagensDialog();
            return;
          }
          setImagensDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-orange-500" />
              Imagens de dano . {imagensEquipamentoNome}
            </DialogTitle>
            <DialogDescription>Registre fotos de danos, avarias ou problemas do equipamento para acompanhamento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <Card className="border-dashed border-2 border-orange-300 bg-orange-50 dark:bg-orange-900/10">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Descrição do dano (opcional)</label>
                    <Input
                      placeholder="Ex: Arranhão na lateral, Tela trincada."
                      value={imageDescricao}
                      onChange={(e) => setImageDescricao(e.target.value)}
                      aria-label="Descrição do dano"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length) handleUploadImages(files);
                        }}
                        disabled={uploadingImage || !imagensEquipamentoId}
                      />

                      <div
                        className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          uploadingImage || !imagensEquipamentoId
                            ? "border-gray-200 opacity-60 cursor-not-allowed"
                            : "border-gray-300 hover:border-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/20"
                        }`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(ev) => {
                          if (uploadingImage || !imagensEquipamentoId) return;
                          if (ev.key === "Enter" || ev.key === " ") fileInputRef.current?.click();
                        }}
                        onClick={() => {
                          if (uploadingImage || !imagensEquipamentoId) return;
                          fileInputRef.current?.click();
                        }}
                        aria-label="Selecionar imagens para upload"
                      >
                        {uploadingImage ? (
                          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                        ) : (
                          <Upload className="h-5 w-5 text-orange-500" />
                        )}
                        <span className="text-sm font-medium">
                          {uploadingImage ? "Enviando." : "Clique para selecionar imagens"}
                        </span>
                      </div>
                    </label>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos. JPG, PNG, GIF, WebP. Tamanho máximo. 10MB por arquivo.
                  </p>
                </div>
              </CardContent>
            </Card>

            {imagensDano.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma imagem de dano registrada.</p>
                <p className="text-sm text-muted-foreground">Use o botão acima para adicionar fotos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imagensDano.map((img, index) => (
                  <Card key={`${img.filePath}-${index}`} className="overflow-hidden">
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                      {img.signedUrl ? (
                        <img
                          src={img.signedUrl}
                          alt={img.descricao || `Imagem de dano ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => requestDeleteImage(img.filePath)}
                        aria-label="Excluir imagem"
                        title="Excluir imagem"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>

                    <CardContent className="p-3">
                      {img.descricao ? <p className="text-sm font-medium mb-1">{img.descricao}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        Enviado em.{" "}
                        {new Date(img.dataUpload).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImagensDialog} aria-label="Fechar">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={imageDeleteDialogOpen} onOpenChange={setImageDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem</AlertDialogTitle>
            <AlertDialogDescription>Deseja realmente remover esta imagem de dano? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setImageDeleteDialogOpen(false);
                setImageToDelete(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteImage}
              className="bg-red-500 hover:bg-red-600"
              disabled={!imageToDelete}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
