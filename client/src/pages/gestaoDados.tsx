import { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SensitivePageWrapper } from "@/components/SensitivePageWrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { Dataset, DatasetPasta, Empreendimento, User } from "@shared/schema";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  FolderPlus,
  FolderTree,
  History,
  Loader2,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
  XCircle,
  Copy,
} from "lucide-react";

/**
 * =========================
 * Melhorias aplicadas (todas no código)
 * =========================
 * . Paginação, busca, filtros e ordenação preferencialmente server-side (com fallback client-side se API ainda retornar array).
 * . Debounce na busca global e no dicionário.
 * . keepPreviousData + prefetch de próxima página (quando server-side).
 * . Ordenação (sort) e direção (asc/desc).
 * . Download robusto: usa dataURL quando existir, senão tenta /api/datasets/:id/download (signed URL) e abre.
 * . Formatters Intl memoizados (evita recriar em loops).
 * . Acessibilidade: aria-label em botões ícone.
 * . Seleção por checkbox + ações em lote (UI pronta; endpoints são tentados e exibem erro se não existirem).
 * . Botão copiar código no preview.
 * . Pequenas otimizações de re-render e utilitários centralizados.
 */

/**
 * Dicionário de siglas.
 * Ideal: carregar do backend com versão (governança). Mantido local para compatibilidade.
 */
const DICIONARIO_SIGLAS = {
  DISC: [
    { sigla: "FAU", descricao: "Fauna" },
    { sigla: "FLO", descricao: "Flora" },
    { sigla: "HID", descricao: "Hidrologia" },
    { sigla: "QUI", descricao: "Química" },
    { sigla: "GEO", descricao: "Geologia/Geomorfologia" },
    { sigla: "SOC", descricao: "Socioeconomia" },
    { sigla: "SIG", descricao: "Geoprocessamento" },
    { sigla: "ENG", descricao: "Engenharia" },
    { sigla: "JUR", descricao: "Jurídico" },
    { sigla: "ESG", descricao: "ESG/Sustentabilidade" },
    { sigla: "GPR", descricao: "Gestão de Projetos" },
  ],
  DOC: [
    { sigla: "REL", descricao: "Relatório" },
    { sigla: "NT", descricao: "Nota Técnica" },
    { sigla: "OF", descricao: "Ofício" },
    { sigla: "MEM", descricao: "Memorial" },
    { sigla: "ATA", descricao: "Ata de Reunião" },
    { sigla: "APR", descricao: "Apresentação" },
    { sigla: "MAP", descricao: "Mapa" },
    { sigla: "DAT", descricao: "Banco de Dados" },
    { sigla: "MET", descricao: "Metodologia" },
    { sigla: "LAU", descricao: "Laudo" },
  ],
  ENTREGA: [
    { sigla: "D0", descricao: "Diagnóstico Inicial" },
    { sigla: "D1", descricao: "Primeira Entrega" },
    { sigla: "D2", descricao: "Segunda Entrega (Final)" },
    { sigla: "REV", descricao: "Revisão" },
    { sigla: "RES", descricao: "Resposta a Parecer" },
    { sigla: "PROT", descricao: "Protocolado" },
  ],
  STATUS: [
    { sigla: "RASC", descricao: "Rascunho" },
    { sigla: "PRELIM", descricao: "Preliminar" },
    { sigla: "FINAL", descricao: "Final" },
    { sigla: "ASSIN", descricao: "Assinado" },
    { sigla: "PROTOC", descricao: "Protocolado" },
    { sigla: "ENVIADO", descricao: "Enviado" },
    { sigla: "ARQ", descricao: "Arquivado" },
  ],
  CLASS: [
    { sigla: "PUB", descricao: "Público" },
    { sigla: "INT", descricao: "Interno" },
    { sigla: "CONF", descricao: "Confidencial" },
    { sigla: "LGPD", descricao: "Proteção de Dados" },
  ],
  UF: [
    { sigla: "AC", descricao: "Acre" },
    { sigla: "AL", descricao: "Alagoas" },
    { sigla: "AP", descricao: "Amapá" },
    { sigla: "AM", descricao: "Amazonas" },
    { sigla: "BA", descricao: "Bahia" },
    { sigla: "CE", descricao: "Ceará" },
    { sigla: "DF", descricao: "Distrito Federal" },
    { sigla: "ES", descricao: "Espírito Santo" },
    { sigla: "GO", descricao: "Goiás" },
    { sigla: "MA", descricao: "Maranhão" },
    { sigla: "MT", descricao: "Mato Grosso" },
    { sigla: "MS", descricao: "Mato Grosso do Sul" },
    { sigla: "MG", descricao: "Minas Gerais" },
    { sigla: "PA", descricao: "Pará" },
    { sigla: "PB", descricao: "Paraíba" },
    { sigla: "PR", descricao: "Paraná" },
    { sigla: "PE", descricao: "Pernambuco" },
    { sigla: "PI", descricao: "Piauí" },
    { sigla: "RJ", descricao: "Rio de Janeiro" },
    { sigla: "RN", descricao: "Rio Grande do Norte" },
    { sigla: "RS", descricao: "Rio Grande do Sul" },
    { sigla: "RO", descricao: "Rondônia" },
    { sigla: "RR", descricao: "Roraima" },
    { sigla: "SC", descricao: "Santa Catarina" },
    { sigla: "SP", descricao: "São Paulo" },
    { sigla: "SE", descricao: "Sergipe" },
    { sigla: "TO", descricao: "Tocantins" },
  ],
} as const;

type DictionaryCategory = keyof typeof DICIONARIO_SIGLAS;
type Demandapendente = { id: number; titulo: string } | null;

type SortKey =
  | "dataUpload"
  | "tamanho"
  | "status"
  | "disciplina"
  | "classificacao"
  | "codigoArquivo"
  | "nome";

type SortDir = "desc" | "asc";

type PagedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext?: boolean;
};

function formatFileSize(bytes: number | null | undefined) {
  if (!Number.isFinite(bytes as number)) return "N/A";
  const b = bytes as number;
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function getStatusBadgeClass(status: string | null) {
  const statusColors: Record<string, string> = {
    RASC: "bg-gray-200 text-gray-800",
    PRELIM: "bg-yellow-200 text-yellow-800",
    FINAL: "bg-green-200 text-green-800",
    ASSIN: "bg-blue-200 text-blue-800",
    PROTOC: "bg-purple-200 text-purple-800",
    ENVIADO: "bg-teal-200 text-teal-800",
    ARQ: "bg-slate-200 text-slate-800",
  };
  return statusColors[status || ""] || "bg-gray-100 text-gray-600";
}

function getClassBadgeClass(classificacao: string | null) {
  const classColors: Record<string, string> = {
    PUB: "bg-green-100 text-green-700",
    INT: "bg-blue-100 text-blue-700",
    CONF: "bg-orange-100 text-orange-700",
    LGPD: "bg-red-100 text-red-700",
  };
  return classColors[classificacao || ""] || "bg-gray-100 text-gray-600";
}

function humanizeFromDict(category: DictionaryCategory, sigla?: string | null) {
  if (!sigla) return null;
  const found = (DICIONARIO_SIGLAS[category] as Array<{ sigla: string; descricao: string }>).find((x) => x.sigla === sigla);
  return found ? `${found.sigla} . ${found.descricao}` : sigla;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Confirmação destrutiva por digitação.
 */
function DestructiveConfirmDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  expectedPhrase: string;
  isPending?: boolean;
  onConfirm: () => void;
}) {
  const { open, onOpenChange, title, description, confirmText, expectedPhrase, isPending, onConfirm } = props;
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  const canConfirm = value.trim() === expectedPhrase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              Para confirmar, digite exatamente:
              <span className="ml-2 font-mono text-foreground">{expectedPhrase}</span>
            </p>
          </div>

          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={expectedPhrase}
            className="font-mono"
            autoFocus
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={!canConfirm || !!isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm && !isPending) onConfirm();
              }}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog de senha para ações protegidas no servidor.
 */
function PasswordDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  isPending?: boolean;
  onSubmit: (password: string) => void;
}) {
  const { open, onOpenChange, title, description, isPending, onSubmit } = props;
  const [pwd, setPwd] = useState("");

  useEffect(() => {
    if (!open) setPwd("");
  }, [open]);

  const canSubmit = !!pwd.trim() && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Senha</Label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Informe a senha para prosseguir"
              autoComplete="current-password"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) onSubmit(pwd);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!isPending}>
              Cancelar
            </Button>
            <Button onClick={() => onSubmit(pwd)} disabled={!canSubmit}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Nó recursivo para árvore de pastas.
 */
function FolderNode(props: {
  folder: DatasetPasta;
  childrenMap: Map<number, DatasetPasta[]>;
  expanded: Set<number>;
  onToggleExpanded: (id: number) => void;
  selectedId: number | null;
  onSelect: (f: DatasetPasta) => void;
  onCreateSubfolder: (parentId: number) => void;
  depth?: number;
}) {
  const { folder, childrenMap, expanded, onToggleExpanded, selectedId, onSelect, onCreateSubfolder, depth = 0 } = props;
  const children = childrenMap.get(folder.id) || [];
  const isExpanded = expanded.has(folder.id);
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <div
        className={[
          "group flex items-center gap-1 rounded px-2 py-1.5 transition-colors",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted",
        ].join(" ")}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <button
          type="button"
          aria-label={children.length > 0 ? (isExpanded ? "Recolher pasta" : "Expandir pasta") : "Selecionar pasta"}
          onClick={() => (children.length > 0 ? onToggleExpanded(folder.id) : onSelect(folder))}
          className="rounded p-0.5 hover:bg-muted-foreground/10"
          title={children.length > 0 ? (isExpanded ? "Recolher" : "Expandir") : "Selecionar"}
        >
          {children.length > 0 ? (
            isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="inline-block w-3" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelect(folder)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-label={`Selecionar pasta ${folder.nome}`}
        >
          <FolderOpen className={["h-4 w-4", isSelected ? "text-primary" : "text-amber-500"].join(" ")} />
          <span className="flex-1 truncate font-mono text-xs" title={folder.nome}>
            {folder.nome}
          </span>
        </button>

        <button
          type="button"
          aria-label="Criar subpasta"
          onClick={() => onCreateSubfolder(folder.id)}
          className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
          title="Criar subpasta"
        >
          <Plus className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {children.length > 0 && isExpanded && (
        <div className="space-y-0.5">
          {children
            .slice()
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map((child) => (
              <FolderNode
                key={child.id}
                folder={child}
                childrenMap={childrenMap}
                expanded={expanded}
                onToggleExpanded={onToggleExpanded}
                selectedId={selectedId}
                onSelect={onSelect}
                onCreateSubfolder={onCreateSubfolder}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function tryParseJson<T>(x: unknown): T | null {
  try {
    return x as T;
  } catch {
    return null;
  }
}

function isPagedResponse<T>(data: any): data is PagedResponse<T> {
  return data && typeof data === "object" && Array.isArray(data.items) && typeof data.total === "number";
}

async function safeFetchJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const text = await res.text();
  const json = text ? tryParseJson<any>(JSON.parse(text)) : null;
  return { res, json };
}

export default function GestaoDados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Formatters memoizados (evita recriação dentro de loops).
   */
  const fmtDateShort = useMemo(() => new Intl.DateTimeFormat("pt-BR"), []);
  const fmtDateFull = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }),
    []
  );

  /**
   * Demanda pendente.
   */
  const [demandaPendente, setDemandaPendente] = useState<Demandapendente>(null);

  useEffect(() => {
    const stored = localStorage.getItem("demandaPendenteConclusao");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (parsed?.id && parsed?.titulo) {
        setDemandaPendente(parsed);
      } else {
        localStorage.removeItem("demandaPendenteConclusao");
      }
    } catch {
      localStorage.removeItem("demandaPendenteConclusao");
    }
  }, []);

  const concluirDemandaPendente = useCallback(async () => {
    if (!demandaPendente) return;

    try {
      const res = await fetch(`/api/demandas/${demandaPendente.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "concluido" }),
      });

      if (res.ok) {
        toast({
          title: "Demanda concluída",
          description: `"${demandaPendente.titulo}" foi concluída após o cadastro do documento.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/demandas"] });
        localStorage.removeItem("demandaPendenteConclusao");
        setDemandaPendente(null);
        return;
      }

      toast({
        title: "Falha ao concluir demanda",
        description: "O documento foi cadastrado. Mas a conclusão automática falhou. Use o botão para tentar novamente.",
        variant: "destructive",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível concluir a demanda. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [demandaPendente, queryClient, toast]);

  const cancelarDemandaPendente = useCallback(() => {
    localStorage.removeItem("demandaPendenteConclusao");
    setDemandaPendente(null);
    toast({ title: "Cancelado", description: "A demanda não será concluída automaticamente." });
  }, [toast]);

  /**
   * Estado principal.
   */
  const [activeTab, setActiveTab] = useState("documentos");

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [globalSearch, setGlobalSearch] = useState("");
  const debouncedGlobalSearch = useDebouncedValue(globalSearch, 350);

  const [dictionarySearch, setDictionarySearch] = useState("");
  const debouncedDictionarySearch = useDebouncedValue(dictionarySearch, 250);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);

  /**
   * Sort e paginação.
   */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<SortKey>("dataUpload");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /**
   * Edição e preview.
   */
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editDescricao, setEditDescricao] = useState("");

  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDataset, setHistoryDataset] = useState<Dataset | null>(null);

  /**
   * Pastas e árvore.
   */
  const [selectedPasta, setSelectedPasta] = useState<DatasetPasta | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  /**
   * Criação de pasta com senha.
   */
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [parentFolderId, setParentFolderId] = useState<number | null>(null);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDialogContext, setPasswordDialogContext] = useState<{
    mode: "createFolder" | "deleteFolder";
    targetFolderId?: number;
  } | null>(null);

  /**
   * Exclusões.
   */
  const [deleteFolderConfirmOpen, setDeleteFolderConfirmOpen] = useState(false);
  const [deleteFileConfirmOpen, setDeleteFileConfirmOpen] = useState(false);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<(Dataset & { __mode?: "datasets" | "folder" }) | null>(null);

  /**
   * Seleção em lote.
   */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  /**
   * Formulário upload.
   */
  const [useAdvancedForm, setUseAdvancedForm] = useState(true);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [cliente, setCliente] = useState("");
  const [uf, setUf] = useState("");
  const [projeto, setProjeto] = useState("");
  const [subprojeto, setSubprojeto] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [entrega, setEntrega] = useState("");
  const [area, setArea] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [status, setStatus] = useState("RASC");
  const [classificacao, setClassificacao] = useState("INT");
  const [titulo, setTitulo] = useState("");

  const [codigoPreview, setCodigoPreview] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");

  /**
   * Usuário logado.
   */
  const { data: currentUser } = useQuery<User>({ queryKey: ["/api/auth/user"] });

  /**
   * Empreendimentos.
   */
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar empreendimentos");
      return res.json();
    },
  });

  /**
   * Pastas.
   */
  const { data: pastas = [], isLoading: pastasLoading, refetch: refetchPastas } = useQuery<DatasetPasta[]>({
    queryKey: ["/api/pastas"],
    queryFn: async () => {
      const res = await fetch("/api/pastas", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar pastas");
      return res.json();
    },
  });

  /**
   * Auto inicialização da estrutura macro quando vazio.
   */
  const [autoInitialized, setAutoInitialized] = useState(false);

  useEffect(() => {
    if (pastasLoading) return;
    if (pastas.length > 0) return;
    if (autoInitialized) return;

    setAutoInitialized(true);
    fetch("/api/datasets/estrutura/macro", { method: "POST", credentials: "include" })
      .then((res) => {
        if (res.ok) queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      })
      .catch(console.error);
  }, [pastasLoading, pastas.length, autoInitialized, queryClient]);

  /**
   * Estruturas memoizadas para árvore e selector.
   */
  const childrenMap = useMemo(() => {
    const map = new Map<number, DatasetPasta[]>();
    for (const p of pastas) {
      if (!p.paiId) continue;
      const arr = map.get(p.paiId) || [];
      arr.push(p);
      map.set(p.paiId, arr);
    }
    return map;
  }, [pastas]);

  const rootFolders = useMemo(
    () => pastas.filter((p) => !p.paiId).slice().sort((a, b) => a.nome.localeCompare(b.nome)),
    [pastas]
  );

  const folderSelectOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; depth: number; id: number }> = [];

    const walk = (folder: DatasetPasta, depth: number) => {
      const indent = "\u00A0\u00A0\u00A0\u00A0".repeat(depth);
      const prefix = depth > 0 ? "└─ " : "";
      options.push({ value: folder.caminho, label: `${indent}${prefix}${folder.nome}`, depth, id: folder.id });

      const kids = (childrenMap.get(folder.id) || []).slice().sort((a, b) => a.nome.localeCompare(b.nome));
      for (const k of kids) walk(k, depth + 1);
    };

    for (const r of rootFolders) walk(r, 0);
    return options;
  }, [childrenMap, rootFolders]);

  /**
   * Expansão de pastas.
   */
  const toggleFolderExpanded = useCallback((folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const expandAllFolders = useCallback(() => {
    setExpandedFolders(new Set(pastas.map((p) => p.id)));
  }, [pastas]);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  /**
   * Seleção de pasta.
   */
  const handleSelectFolder = useCallback((pasta: DatasetPasta) => {
    setSelectedPasta(pasta);
  }, []);

  /**
   * Preview do código gerado.
   */
  const generateCodePreview = useCallback(async () => {
    try {
      const extensao = file?.name?.split(".").pop() || "";
      const res = await fetch("/api/datasets/gerar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cliente,
          uf,
          projeto,
          subprojeto,
          disciplina,
          tipoDocumento,
          entrega,
          area,
          periodo,
          status,
          extensao,
          responsavel: currentUser?.email,
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      setCodigoPreview(data.codigo);
      setPastaDestino(data.pastaDestino);
    } catch (error) {
      console.error(error);
    }
  }, [area, cliente, currentUser?.email, disciplina, entrega, file, periodo, projeto, status, subprojeto, tipoDocumento, uf]);

  useEffect(() => {
    if (!useAdvancedForm) return;
    if (!(cliente || projeto || disciplina || tipoDocumento)) return;
    generateCodePreview();
  }, [cliente, uf, projeto, subprojeto, disciplina, tipoDocumento, entrega, area, periodo, status, file, useAdvancedForm, generateCodePreview]);

  /**
   * Query de Datasets com suporte a server-side.
   * . Se a API retornar {items,total,page,pageSize} usa server-side.
   * . Se retornar array, aplica fallback local (com paginação e ordenação locais) e expõe total local.
   */
  const datasetsQueryKey = useMemo(
    () => [
      "/api/datasets",
      {
        empreendimentoId: filterEmpreendimento,
        tipo: filterTipo,
        status: filterStatus,
        q: debouncedGlobalSearch,
        page,
        pageSize,
        sortKey,
        sortDir,
      },
    ],
    [debouncedGlobalSearch, filterEmpreendimento, filterStatus, filterTipo, page, pageSize, sortDir, sortKey]
  );

  const {
    data: datasetsPage,
    isLoading: isDatasetsLoading,
    isError: isDatasetsError,
    error: datasetsError,
    refetch: refetchDatasets,
  } = useQuery<PagedResponse<Dataset & { empreendimentoNome?: string }> & { __mode: "server" | "client" }>({
    queryKey: datasetsQueryKey,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      if (filterTipo !== "all") params.append("tipo", filterTipo);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (debouncedGlobalSearch.trim()) params.append("q", debouncedGlobalSearch.trim());
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));
      params.append("sortKey", sortKey);
      params.append("sortDir", sortDir);

      const res = await fetch(`/api/datasets?${params.toString()}`, { credentials: "include", signal });
      if (!res.ok) throw new Error("Erro ao carregar arquivos");

      const data = await res.json();

      if (isPagedResponse<Dataset & { empreendimentoNome?: string }>(data)) {
        return { ...data, __mode: "server" as const };
      }

      // Fallback legado: API retorna array inteiro
      const arr = Array.isArray(data) ? (data as Array<Dataset & { empreendimentoNome?: string }>) : [];
      const q = debouncedGlobalSearch.trim().toLowerCase();

      const filtered = arr
        .filter((d) => (filterStatus === "all" ? true : d.status === filterStatus))
        .filter((d) => {
          if (!q) return true;
          const hay = [
            d.codigoArquivo,
            d.nome,
            d.descricao,
            d.empreendimentoNome,
            d.disciplina,
            d.status,
            d.classificacao,
            d.tipoDocumento,
            d.periodo,
            d.usuario,
            d.versao,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });

      const sorted = filtered.slice().sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;

        const getVal = (x: any) => {
          switch (sortKey) {
            case "dataUpload":
              return new Date(x.dataUpload).getTime();
            case "tamanho":
              return x.tamanho ?? 0;
            case "status":
              return (x.status ?? "").toString();
            case "disciplina":
              return (x.disciplina ?? "").toString();
            case "classificacao":
              return (x.classificacao ?? "").toString();
            case "codigoArquivo":
              return (x.codigoArquivo ?? "").toString();
            case "nome":
              return (x.nome ?? "").toString();
            default:
              return 0;
          }
        };

        const av = getVal(a);
        const bv = getVal(b);

        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });

      const total = sorted.length;
      const start = (page - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return { items, total, page, pageSize, hasNext: start + pageSize < total, __mode: "client" as const };
    },
  });

  /**
   * Prefetch próxima página (server-side apenas).
   */
  useEffect(() => {
    if (!datasetsPage) return;
    if (datasetsPage.__mode !== "server") return;
    if (!datasetsPage.hasNext && datasetsPage.total <= page * pageSize) return;

    const nextPage = page + 1;
    queryClient.prefetchQuery({
      queryKey: [
        "/api/datasets",
        {
          empreendimentoId: filterEmpreendimento,
          tipo: filterTipo,
          status: filterStatus,
          q: debouncedGlobalSearch,
          page: nextPage,
          pageSize,
          sortKey,
          sortDir,
        },
      ],
      queryFn: async ({ signal }) => {
        const params = new URLSearchParams();
        if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
        if (filterTipo !== "all") params.append("tipo", filterTipo);
        if (filterStatus !== "all") params.append("status", filterStatus);
        if (debouncedGlobalSearch.trim()) params.append("q", debouncedGlobalSearch.trim());
        params.append("page", String(nextPage));
        params.append("pageSize", String(pageSize));
        params.append("sortKey", sortKey);
        params.append("sortDir", sortDir);

        const res = await fetch(`/api/datasets?${params.toString()}`, { credentials: "include", signal });
        if (!res.ok) throw new Error("Erro ao carregar próxima página");
        const data = await res.json();
        if (isPagedResponse<any>(data)) return { ...data, __mode: "server" as const };
        return { items: [], total: 0, page: nextPage, pageSize, __mode: "client" as const };
      },
      staleTime: 15_000,
    });
  }, [
    datasetsPage,
    queryClient,
    page,
    pageSize,
    sortKey,
    sortDir,
    filterEmpreendimento,
    filterTipo,
    filterStatus,
    debouncedGlobalSearch,
  ]);

  /**
   * Total pages.
   */
  const totalPages = useMemo(() => {
    const total = datasetsPage?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [datasetsPage?.total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedDatasets = useMemo(() => datasetsPage?.items ?? [], [datasetsPage?.items]);

  /**
   * Arquivos da pasta selecionada.
   */
  const { data: selectedFolderFiles = [], refetch: refetchFolderFiles } = useQuery<Dataset[]>({
    queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"],
    queryFn: async () => {
      if (!selectedPasta?.id) return [];
      const res = await fetch(`/api/pastas/${selectedPasta.id}/arquivos`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar arquivos da pasta");
      return res.json();
    },
    enabled: !!selectedPasta?.id,
  });

  /**
   * Inicialização manual da estrutura macro.
   */
  const initMacroMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/datasets/estrutura/macro", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao inicializar estrutura");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      toast({ title: "Sucesso", description: "Estrutura institucional inicializada." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao inicializar estrutura.", variant: "destructive" });
    },
  });

  /**
   * Mutations de pastas.
   */
  const createFolderMutation = useMutation({
    mutationFn: async (data: { nome: string; paiId?: number | null; empreendimentoId?: number; senha: string }) => {
      const { res, json } = await safeFetchJson("/api/pastas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(json?.error || "Erro ao criar pasta");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      toast({ title: "Sucesso", description: "Pasta criada com sucesso." });
      setIsCreateFolderOpen(false);
      setNewFolderName("");
      setParentFolderId(null);
      setPasswordDialogOpen(false);
      setPasswordDialogContext(null);
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message || "Falha ao criar pasta.", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (data: { id: number; senha: string }) => {
      const { res, json } = await safeFetchJson(`/api/pastas/${data.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: data.senha }),
      });
      if (!res.ok) throw new Error(json?.error || "Erro ao excluir pasta");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas"] });
      refetchPastas();
      toast({ title: "Sucesso", description: "Pasta excluída com sucesso." });
      if (selectedPasta) setSelectedPasta(null);
      setPasswordDialogOpen(false);
      setPasswordDialogContext(null);
      setDeleteFolderConfirmOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message || "Falha ao excluir pasta.", variant: "destructive" });
    },
  });

  /**
   * Exclusão de dataset e de arquivo na pasta.
   */
  const deleteDatasetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchDatasets();
      toast({ title: "Sucesso", description: "Documento excluído com sucesso." });
      setDeleteFileConfirmOpen(false);
      setPendingDeleteFile(null);
      clearSelection();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir documento.", variant: "destructive" });
    },
  });

  const deleteFileFromFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/arquivos/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchFolderFiles();
      refetchDatasets();
      toast({ title: "Sucesso", description: "Arquivo excluído com sucesso." });
      setDeleteFileConfirmOpen(false);
      setPendingDeleteFile(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir arquivo.", variant: "destructive" });
    },
  });

  /**
   * Edição.
   */
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { nome: string; descricao: string } }) => {
      const res = await fetch(`/api/datasets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar documento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      toast({ title: "Sucesso", description: "Documento atualizado com sucesso." });
      setIsEditDialogOpen(false);
      setEditingDataset(null);
      refetchDatasets();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar documento.", variant: "destructive" });
    },
  });

  /**
   * Upload avançado.
   */
  const uploadAdvancedMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets/upload-avancado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao cadastrar documento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchDatasets();
      toast({ title: "Sucesso", description: "Documento cadastrado com código padronizado." });
      setIsUploading(false);
      setIsUploadDialogOpen(false);
      resetForm();
      if (demandaPendente) concluirDemandaPendente();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao cadastrar documento.", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const uploadSimpleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao cadastrar documento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchDatasets();
      toast({ title: "Sucesso", description: "Documento cadastrado com sucesso." });
      setIsUploading(false);
      setIsUploadDialogOpen(false);
      resetForm();
      if (demandaPendente) concluirDemandaPendente();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao cadastrar documento.", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const createFileInFolderMutation = useMutation({
    mutationFn: async (data: { pastaId: number; nome: string; objectPath: string; tipo?: string; tamanho?: number; empreendimentoId: number }) => {
      const res = await fetch(`/api/pastas/${data.pastaId}/arquivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao registrar arquivo na pasta");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pastas", selectedPasta?.id, "arquivos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetchFolderFiles();
      refetchDatasets();
      toast({ title: "Sucesso", description: "Arquivo enviado e registrado com sucesso." });
      if (demandaPendente) concluirDemandaPendente();
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao registrar arquivo.", variant: "destructive" });
    },
  });

  /**
   * Upload URL para Object Storage.
   */
  const getUploadParameters = useCallback(async () => {
    const res = await fetch("/api/object-storage/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: `doc_${Date.now()}`,
        directory: ".private",
      }),
    });
    if (!res.ok) throw new Error("Falha ao obter URL de upload");
    const data = await res.json();
    return { method: "PUT" as const, url: data.uploadUrl, filePath: data.filePath };
  }, []);

  /**
   * Registro do documento após upload em Object Storage.
   */
  const handleRegisterUploadedObject = useCallback(
    async (uploaded: { filePath?: string }, originalFile: File) => {
      if (!selectedEmpreendimento) {
        toast({ title: "Erro", description: "Selecione o empreendimento.", variant: "destructive" });
        return;
      }
      if (!pastaDestino) {
        toast({ title: "Erro", description: "Selecione a pasta de destino.", variant: "destructive" });
        return;
      }
      if (!uploaded.filePath) {
        toast({ title: "Erro", description: "Falha ao obter objectPath do upload.", variant: "destructive" });
        return;
      }

      setIsUploading(true);

      const payloadBase = {
        empreendimentoId: parseInt(selectedEmpreendimento),
        nome: originalFile.name,
        descricao,
        tamanho: originalFile.size,
        tipo: originalFile.type || "outro",
        pastaDestino,
        objectPath: uploaded.filePath,
      };

      if (useAdvancedForm) {
        const extensao = originalFile.name.split(".").pop() || "";
        const advPayload = {
          ...payloadBase,
          cliente,
          uf,
          projeto,
          subprojeto,
          disciplina,
          tipoDocumento,
          entrega,
          area,
          periodo,
          status,
          classificacao,
          titulo,
          extensao,
          responsavel: currentUser?.email,
          codigoArquivo: codigoPreview || undefined,
        };

        uploadAdvancedMutation.mutate(advPayload);
        return;
      }

      const simplePayload = {
        ...payloadBase,
        nome: nome || originalFile.name,
        tipo: tipo || (originalFile.type || "outro"),
        usuario: currentUser?.email || "Usuário",
        dataUpload: new Date().toISOString(),
      };

      uploadSimpleMutation.mutate(simplePayload);
    },
    [
      area,
      classificacao,
      cliente,
      codigoPreview,
      currentUser?.email,
      descricao,
      disciplina,
      entrega,
      nome,
      pastaDestino,
      periodo,
      projeto,
      selectedEmpreendimento,
      status,
      subprojeto,
      tipo,
      tipoDocumento,
      toast,
      uf,
      uploadAdvancedMutation,
      uploadSimpleMutation,
      useAdvancedForm,
    ]
  );

  /**
   * Fallback legado (dataURL) para compatibilidade.
   */
  const handleLegacyUploadDataUrl = useCallback(() => {
    if (!selectedEmpreendimento || !file) {
      toast({ title: "Erro", description: "Selecione o empreendimento e o arquivo.", variant: "destructive" });
      return;
    }
    if (!pastaDestino) {
      toast({ title: "Erro", description: "Selecione a pasta de destino.", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;

      if (useAdvancedForm) {
        uploadAdvancedMutation.mutate({
          empreendimentoId: parseInt(selectedEmpreendimento),
          nome: file.name,
          descricao,
          tipo: file.type || "outro",
          tamanho: file.size,
          url,
          cliente,
          uf,
          projeto,
          subprojeto,
          disciplina,
          tipoDocumento,
          entrega,
          area,
          periodo,
          status,
          classificacao,
          titulo,
          pastaDestino,
        });
        return;
      }

      uploadSimpleMutation.mutate({
        empreendimentoId: parseInt(selectedEmpreendimento),
        nome: nome || file.name,
        descricao,
        tipo: tipo || "outro",
        tamanho: file.size,
        usuario: currentUser?.email || "Usuário",
        url,
        dataUpload: new Date().toISOString(),
        pastaDestino,
      });
    };

    reader.readAsDataURL(file);
  }, [
    area,
    classificacao,
    cliente,
    currentUser?.email,
    descricao,
    disciplina,
    entrega,
    file,
    nome,
    pastaDestino,
    periodo,
    projeto,
    selectedEmpreendimento,
    status,
    subprojeto,
    tipo,
    tipoDocumento,
    toast,
    uf,
    uploadAdvancedMutation,
    uploadSimpleMutation,
    useAdvancedForm,
  ]);

  /**
   * Reset do formulário.
   */
  const resetForm = useCallback(() => {
    setNome("");
    setDescricao("");
    setTipo("");
    setFile(null);

    setSelectedEmpreendimento("");
    setCliente("");
    setUf("");
    setProjeto("");
    setSubprojeto("");
    setDisciplina("");
    setTipoDocumento("");
    setEntrega("");
    setArea("");
    setPeriodo("");
    setStatus("RASC");
    setClassificacao("INT");
    setTitulo("");

    setCodigoPreview("");
    setPastaDestino("");

    setPage(1);
  }, []);

  /**
   * Ações de UI.
   */
  const handleClearFilters = useCallback(() => {
    setFilterEmpreendimento("all");
    setFilterTipo("all");
    setFilterStatus("all");
    setGlobalSearch("");
    setPage(1);
  }, []);

  const handleEdit = useCallback((dataset: Dataset) => {
    setEditingDataset(dataset);
    setEditNome(dataset.nome);
    setEditDescricao(dataset.descricao || "");
    setIsEditDialogOpen(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingDataset) return;
    editMutation.mutate({ id: editingDataset.id, data: { nome: editNome, descricao: editDescricao } });
  }, [editDescricao, editNome, editMutation, editingDataset]);

  const handlePreview = useCallback((dataset: Dataset) => {
    setPreviewDataset(dataset);
    setIsPreviewOpen(true);
  }, []);

  const handleShowHistory = useCallback((dataset: Dataset) => {
    setHistoryDataset(dataset);
    setIsHistoryOpen(true);
  }, []);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copiado", description: "Código copiado para a área de transferência." });
      } catch {
        toast({ title: "Falha ao copiar", description: "Seu navegador bloqueou a cópia automática.", variant: "destructive" });
      }
    },
    [toast]
  );

  /**
   * Download robusto.
   * 1) Se dataset.url for dataURL, baixa direto.
   * 2) Se não tiver url, tenta /api/datasets/:id/download (recomendado para objectPath/signed URL).
   */
  const handleDownload = useCallback(
    async (dataset: Dataset) => {
      const direct = dataset.url;

      if (direct && direct.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = direct;
        link.download = dataset.nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      try {
        const res = await fetch(`/api/datasets/${dataset.id}/download`, { credentials: "include" });
        if (!res.ok) throw new Error("download endpoint indisponível");

        const data = await res.json();
        const url = data?.url || data?.downloadUrl;
        if (!url) throw new Error("URL temporária ausente");

        window.open(url, "_blank", "noopener,noreferrer");
        return;
      } catch (e) {
        console.error(e);
        toast({
          title: "Download indisponível",
          description: "Este documento não possui URL direta. Implemente /api/datasets/:id/download para signed URL do object storage.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const getPreviewContent = useCallback(
    (dataset: Dataset) => {
      const isImage = dataset.url?.startsWith("data:image/");
      const isPdf = dataset.url?.startsWith("data:application/pdf");
      if (isImage) {
        return <img src={dataset.url} alt={dataset.nome} className="mx-auto max-h-[70vh] max-w-full object-contain" />;
      }
      if (isPdf) {
        return <iframe src={dataset.url} className="h-[70vh] w-full" title={dataset.nome} />;
      }
      return (
        <div className="py-8 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <p className="mb-2 text-lg font-medium">{dataset.nome}</p>
          <p className="mb-4 text-muted-foreground">Tipo: {dataset.tipoDocumento || dataset.tipo || "N/A"}</p>
          <Button onClick={() => handleDownload(dataset)}>
            <Download className="mr-2 h-4 w-4" />
            Baixar arquivo
          </Button>
        </div>
      );
    },
    [handleDownload]
  );

  /**
   * Dicionário filtrado (com debounce).
   */
  const filteredDictionary = useMemo(() => {
    const q = debouncedDictionarySearch.trim().toLowerCase();
    return (Object.entries(DICIONARIO_SIGLAS) as Array<[DictionaryCategory, Array<{ sigla: string; descricao: string }>]>)
      .map(([category, items]) => ({
        category,
        items: items.filter((item) => {
          if (!q) return true;
          return item.sigla.toLowerCase().includes(q) || item.descricao.toLowerCase().includes(q);
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [debouncedDictionarySearch]);

  /**
   * Handlers de senha e exclusão.
   */
  const openCreateFolderFlow = useCallback(() => {
    if (!newFolderName.trim()) {
      toast({ title: "Erro", description: "Nome da pasta é obrigatório.", variant: "destructive" });
      return;
    }
    setPasswordDialogContext({ mode: "createFolder" });
    setPasswordDialogOpen(true);
  }, [newFolderName, toast]);

  const openDeleteFolderFlow = useCallback(() => {
    if (!selectedPasta) return;
    setDeleteFolderConfirmOpen(true);
  }, [selectedPasta]);

  const submitPassword = useCallback(
    (password: string) => {
      const ctx = passwordDialogContext;
      if (!ctx) return;

      if (ctx.mode === "createFolder") {
        createFolderMutation.mutate({
          nome: newFolderName.trim(),
          paiId: parentFolderId,
          empreendimentoId: selectedEmpreendimento ? parseInt(selectedEmpreendimento) : undefined,
          senha: password,
        });
        return;
      }

      if (ctx.mode === "deleteFolder" && ctx.targetFolderId) {
        deleteFolderMutation.mutate({ id: ctx.targetFolderId, senha: password });
      }
    },
    [createFolderMutation, deleteFolderMutation, newFolderName, parentFolderId, passwordDialogContext, selectedEmpreendimento]
  );

  const confirmDeleteFolderTyped = useCallback(() => {
    if (!selectedPasta) return;
    setPasswordDialogContext({ mode: "deleteFolder", targetFolderId: selectedPasta.id });
    setPasswordDialogOpen(true);
  }, [selectedPasta]);

  const requestDeleteFile = useCallback((dataset: Dataset, mode: "datasets" | "folder") => {
    setPendingDeleteFile({ ...dataset, __mode: mode });
    setDeleteFileConfirmOpen(true);
  }, []);

  const confirmDeleteFileTyped = useCallback(() => {
    if (!pendingDeleteFile) return;
    if (pendingDeleteFile.__mode === "folder") {
      deleteFileFromFolderMutation.mutate(pendingDeleteFile.id);
      return;
    }
    deleteDatasetMutation.mutate(pendingDeleteFile.id);
  }, [deleteDatasetMutation, deleteFileFromFolderMutation, pendingDeleteFile]);

  /**
   * Validação mínima do submit (mantida).
   */
  const canSubmitAdvanced = useMemo(() => {
    if (!selectedEmpreendimento) return false;
    if (!pastaDestino) return false;
    if (!file) return false;
    if (!useAdvancedForm) return true;

    if (!cliente.trim()) return false;
    if (!uf.trim()) return false;
    if (!projeto.trim()) return false;
    if (!disciplina.trim()) return false;
    if (!tipoDocumento.trim()) return false;
    if (!entrega.trim()) return false;
    if (!status.trim()) return false;

    return true;
  }, [cliente, disciplina, entrega, file, pastaDestino, projeto, selectedEmpreendimento, status, tipoDocumento, uf, useAdvancedForm]);

  /**
   * Prefill a partir da pasta selecionada.
   */
  const prefillFromSelectedFolder = useCallback(() => {
    if (!selectedPasta) return;
    setPastaDestino(selectedPasta.caminho);

    const inferred = pastas.find((p) => selectedPasta.caminho.startsWith(p.caminho) && p.empreendimentoId);
    if (inferred?.empreendimentoId) setSelectedEmpreendimento(String(inferred.empreendimentoId));
  }, [pastas, selectedPasta]);

  /**
   * Seleção em lote: helpers.
   */
  const allOnPageSelected = useMemo(() => {
    if (pagedDatasets.length === 0) return false;
    return pagedDatasets.every((d) => selectedIds.has(d.id));
  }, [pagedDatasets, selectedIds]);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pagedDatasets.length === 0) return next;

      const shouldSelect = !pagedDatasets.every((d) => next.has(d.id));
      for (const d of pagedDatasets) {
        if (shouldSelect) next.add(d.id);
        else next.delete(d.id);
      }
      return next;
    });
  }, [pagedDatasets]);

  const toggleSelectOne = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /**
   * Ações em lote (tentam endpoints; se não existirem, informam).
   */
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch("/api/datasets/bulk/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Endpoint de exclusão em lote indisponível");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Itens selecionados removidos." });
      clearSelection();
      refetchDatasets();
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
    },
    onError: (e: Error) => {
      toast({
        title: "Ação em lote não disponível",
        description: e.message || "Implemente /api/datasets/bulk/delete no backend.",
        variant: "destructive",
      });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async (payload: { ids: number[]; status: string }) => {
      const res = await fetch("/api/datasets/bulk/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Endpoint de status em lote indisponível");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Status atualizado para os itens selecionados." });
      clearSelection();
      refetchDatasets();
    },
    onError: (e: Error) => {
      toast({
        title: "Ação em lote não disponível",
        description: e.message || "Implemente /api/datasets/bulk/status no backend.",
        variant: "destructive",
      });
    },
  });

  /**
   * Render.
   */
  return (
    <SensitivePageWrapper moduleName="Gestão de Dados">
      <div className="container mx-auto space-y-6 p-6">
        {/* Banner de Demanda Pendente */}
        {demandaPendente && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">Demanda aguardando conclusão</p>
                <p className="text-sm text-amber-700">"{demandaPendente.titulo}" será concluída automaticamente após o cadastro do documento.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={concluirDemandaPendente}
                className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-800"
              >
                Concluir agora
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelarDemandaPendente} className="text-amber-600 hover:text-amber-800">
                <X className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Database className="h-8 w-8 text-primary" />
              Gestão de Dados
            </h1>
            <p className="mt-1 text-muted-foreground">Sistema de gestão documental com codificação padronizada EcoBrasil.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => initMacroMutation.mutate()} disabled={initMacroMutation.isPending}>
              <FolderTree className="mr-2 h-4 w-4" />
              {initMacroMutation.isPending ? "Inicializando..." : "Inicializar estrutura"}
            </Button>

            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar documento
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
                <DialogHeader>
                  <DialogTitle>Cadastro de documento</DialogTitle>
                  <DialogDescription>
                    {useAdvancedForm
                      ? "Preencha os metadados. O código padronizado será gerado automaticamente."
                      : "Cadastro simples. Use quando não houver necessidade de codificação estruturada."}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useAdvanced"
                    checked={useAdvancedForm}
                    onChange={(e) => setUseAdvancedForm(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useAdvanced" className="cursor-pointer">
                    Usar formulário avançado com código padronizado
                  </Label>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Empreendimento *</Label>
                    <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o empreendimento" />
                      </SelectTrigger>
                      <SelectContent>
                        {empreendimentos.map((e) => (
                          <SelectItem key={e.id} value={e.id.toString()}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {useAdvancedForm ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Cliente *</Label>
                          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
                        </div>

                        <div>
                          <Label>UF *</Label>
                          <Select value={uf} onValueChange={setUf}>
                            <SelectTrigger>
                              <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.UF.map((u) => (
                                <SelectItem key={u.sigla} value={u.sigla}>
                                  {u.sigla} . {u.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Projeto *</Label>
                          <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder="Nome do projeto" />
                        </div>
                        <div>
                          <Label>Subprojeto</Label>
                          <Input value={subprojeto} onChange={(e) => setSubprojeto(e.target.value)} placeholder="Opcional" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Disciplina *</Label>
                          <Select value={disciplina} onValueChange={setDisciplina}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.DISC.map((d) => (
                                <SelectItem key={d.sigla} value={d.sigla}>
                                  {d.sigla} . {d.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Tipo de documento *</Label>
                          <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.DOC.map((d) => (
                                <SelectItem key={d.sigla} value={d.sigla}>
                                  {d.sigla} . {d.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Entrega *</Label>
                          <Select value={entrega} onValueChange={setEntrega}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.ENTREGA.map((e) => (
                                <SelectItem key={e.sigla} value={e.sigla}>
                                  {e.sigla} . {e.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Status *</Label>
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.STATUS.map((s) => (
                                <SelectItem key={s.sigla} value={s.sigla}>
                                  {s.sigla} . {s.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Área</Label>
                          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Opcional" />
                        </div>
                        <div>
                          <Label>Período</Label>
                          <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex.: CHEIA2025, 2025Q1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Classificação</Label>
                          <Select value={classificacao} onValueChange={setClassificacao}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {DICIONARIO_SIGLAS.CLASS.map((c) => (
                                <SelectItem key={c.sigla} value={c.sigla}>
                                  {c.sigla} . {c.descricao}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Título curto</Label>
                          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Opcional" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Nome *</Label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do documento" />
                      </div>
                      <div>
                        <Label>Tipo *</Label>
                        <Select value={tipo} onValueChange={setTipo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planilha">Planilha</SelectItem>
                            <SelectItem value="relatorio">Relatório</SelectItem>
                            <SelectItem value="documento">Documento</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Descrição</Label>
                    <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição opcional" />
                  </div>

                  <div>
                    <Label>Pasta de destino *</Label>
                    <Select value={pastaDestino} onValueChange={setPastaDestino}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a pasta de destino" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {folderSelectOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.value} className="font-mono text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Selecione onde o documento será armazenado na hierarquia de pastas.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Arquivo *</Label>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        Preferência recomendada. Use o upload por Object Storage, com registro do arquivo no backend.
                      </p>

                      <div className="mt-3">
                        <ObjectUploader
                          getUploadParameters={getUploadParameters}
                          onUploadComplete={(result: { uploadURL: string; filePath?: string }, f?: File) => {
                            const chosen = f || file;
                            if (!chosen) {
                              toast({
                                title: "Selecione o arquivo",
                                description: "Para registrar o upload, informe o arquivo no campo abaixo ou via ObjectUploader.",
                                variant: "destructive",
                              });
                              return;
                            }
                            handleRegisterUploadedObject({ filePath: result.filePath }, chosen);
                          }}
                        />
                      </div>

                      <Separator className="my-3" />

                      <p className="text-xs text-muted-foreground">
                        Alternativa. Caso seu backend ainda exija dataURL, use o input abaixo e clique em Enviar.
                      </p>

                      <Input
                        className="mt-2"
                        type="file"
                        accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip,.rar,.gpkg,.shp,.geojson,.qgz,.py,.r,.R,.sql,.ipynb"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>

                  {useAdvancedForm && codigoPreview && (
                    <div className="space-y-2 rounded-lg bg-muted p-4">
                      <div className="flex items-center justify-between gap-2 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Preview do código gerado
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(codigoPreview)}
                          aria-label="Copiar código"
                          title="Copiar"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>

                      <code className="block break-all rounded border bg-background p-2 text-xs">{codigoPreview}</code>

                      <div className="text-sm text-muted-foreground">
                        Destino. <span className="font-mono text-xs text-foreground">{pastaDestino}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)} disabled={isUploading}>
                      Cancelar
                    </Button>

                    <Button
                      onClick={() => {
                        if (!canSubmitAdvanced) {
                          toast({
                            title: "Campos obrigatórios",
                            description: "Preencha empreendimento, pasta de destino e arquivo. No modo avançado, complete os metadados obrigatórios.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (!file) {
                          toast({
                            title: "Selecione o arquivo",
                            description: "Use o ObjectUploader ou selecione o arquivo no input para o fallback.",
                            variant: "destructive",
                          });
                          return;
                        }
                        handleLegacyUploadDataUrl();
                      }}
                      disabled={isUploading}
                    >
                      {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isUploading ? "Enviando..." : "Enviar (fallback)"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Recomenda-se remover o fallback assim que o backend aceitar objectPath e fornecer download por URL temporária.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="estrutura">Estrutura de pastas</TabsTrigger>
          </TabsList>

          <TabsContent value="documentos" className="space-y-4">
            {/* Dicionário de Siglas */}
            <Collapsible open={isDictionaryOpen} onOpenChange={setIsDictionaryOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer transition-colors hover:bg-muted/50">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Dicionário de siglas
                      {isDictionaryOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent>
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar sigla ou descrição"
                          value={dictionarySearch}
                          onChange={(e) => setDictionarySearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <ScrollArea className="h-[300px]">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredDictionary.map(({ category, items }) => (
                          <div key={category} className="space-y-2">
                            <h4 className="text-sm font-semibold text-primary">{category}</h4>
                            <div className="space-y-1">
                              {items.map((item) => (
                                <div key={item.sigla} className="flex gap-2 text-sm">
                                  <Badge variant="outline" className="font-mono">
                                    {item.sigla}
                                  </Badge>
                                  <span className="text-muted-foreground">{item.descricao}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Filtros e Busca */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-base">Filtros e busca</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  <XCircle className="mr-1 h-4 w-4" />
                  Limpar
                </Button>
              </CardHeader>

              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div className="md:col-span-2">
                  <Label>Busca global</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={globalSearch}
                      onChange={(e) => {
                        setGlobalSearch(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10"
                      placeholder="Código, nome, descrição, disciplina, usuário, período"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Busca com debounce. Preferencialmente server-side. Se a API ainda retornar array, aplica fallback local.
                  </p>
                </div>

                <div>
                  <Label>Empreendimento</Label>
                  <Select
                    value={filterEmpreendimento}
                    onValueChange={(v) => {
                      setFilterEmpreendimento(v);
                      setPage(1);
                      clearSelection();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {empreendimentos.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          {e.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={filterTipo}
                    onValueChange={(v) => {
                      setFilterTipo(v);
                      setPage(1);
                      clearSelection();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="planilha">Planilha</SelectItem>
                      <SelectItem value="relatorio">Relatório</SelectItem>
                      <SelectItem value="documento">Documento</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => {
                      setFilterStatus(v);
                      setPage(1);
                      clearSelection();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {DICIONARIO_SIGLAS.STATUS.map((s) => (
                        <SelectItem key={s.sigla} value={s.sigla}>
                          {s.sigla} . {s.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Ordenar por</Label>
                  <Select
                    value={sortKey}
                    onValueChange={(v) => {
                      setSortKey(v as SortKey);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dataUpload">Data</SelectItem>
                      <SelectItem value="tamanho">Tamanho</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="disciplina">Disciplina</SelectItem>
                      <SelectItem value="classificacao">Classificação</SelectItem>
                      <SelectItem value="codigoArquivo">Código</SelectItem>
                      <SelectItem value="nome">Nome</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Direção</Label>
                  <Select
                    value={sortDir}
                    onValueChange={(v) => {
                      setSortDir(v as SortDir);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Desc</SelectItem>
                      <SelectItem value="asc">Asc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-6 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-end gap-2">
                    <div className="w-[180px]">
                      <Label>Tamanho da página</Label>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => {
                          setPageSize(parseInt(v));
                          setPage(1);
                          clearSelection();
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                        Anterior
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                        Próxima
                      </Button>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => refetchDatasets()} title="Recarregar">
                      Recarregar
                    </Button>

                    {isDatasetsError && (
                      <span className="text-xs text-destructive">
                        {(datasetsError as any)?.message || "Falha ao carregar"}
                      </span>
                    )}
                  </div>

                  {/* Barra de ações em lote */}
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      Selecionados. <span className="font-medium text-foreground">{selectedIds.size}</span>
                    </div>

                    <Select
                      value=""
                      onValueChange={(v) => {
                        if (selectedIds.size === 0) {
                          toast({ title: "Selecione itens", description: "Marque pelo menos um documento.", variant: "destructive" });
                          return;
                        }
                        bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: v });
                      }}
                      disabled={selectedIds.size === 0 || bulkStatusMutation.isPending}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Aplicar status em lote" />
                      </SelectTrigger>
                      <SelectContent>
                        {DICIONARIO_SIGLAS.STATUS.map((s) => (
                          <SelectItem key={s.sigla} value={s.sigla}>
                            {s.sigla} . {s.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
                      onClick={() => {
                        if (selectedIds.size === 0) return;
                        bulkDeleteMutation.mutate(Array.from(selectedIds));
                      }}
                    >
                      {bulkDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Excluir selecionados
                    </Button>

                    <Button variant="outline" size="sm" disabled={selectedIds.size === 0} onClick={clearSelection}>
                      Limpar seleção
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Documentos */}
            <Card>
              <CardHeader>
                <CardTitle>Documentos cadastrados</CardTitle>
                <CardDescription>
                  {(datasetsPage?.total ?? 0)} documento(s) encontrado(s). Página {page} de {totalPages}.{" "}
                  {datasetsPage?.__mode === "client" ? (
                    <span className="ml-2 text-xs text-muted-foreground">Modo fallback local.</span>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">Modo server-side.</span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {isDatasetsLoading ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
                    Carregando...
                  </div>
                ) : pagedDatasets.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
                    Nenhum documento encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[44px]">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={allOnPageSelected}
                                onCheckedChange={toggleSelectAllOnPage}
                                aria-label="Selecionar todos na página"
                              />
                            </div>
                          </TableHead>
                          <TableHead>Código. Nome</TableHead>
                          <TableHead>Empreendimento</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead>Versão</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {pagedDatasets.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="w-[44px]">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={selectedIds.has(d.id)}
                                  onCheckedChange={() => toggleSelectOne(d.id)}
                                  aria-label={`Selecionar documento ${d.codigoArquivo || d.nome}`}
                                />
                              </div>
                            </TableCell>

                            <TableCell className="max-w-[240px]">
                              <div className="truncate font-mono text-xs" title={d.codigoArquivo || d.nome}>
                                {d.codigoArquivo || d.nome}
                              </div>
                              {d.titulo && (
                                <div className="truncate text-xs text-muted-foreground" title={d.titulo}>
                                  {d.titulo}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>{(d as any).empreendimentoNome || `#${d.empreendimentoId}`}</TableCell>

                            <TableCell>
                              {d.disciplina ? (
                                <Badge variant="outline" title={humanizeFromDict("DISC", d.disciplina) || d.disciplina}>
                                  {d.disciplina}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge className={getStatusBadgeClass(d.status)} title={humanizeFromDict("STATUS", d.status) || d.status || "N/A"}>
                                {d.status || "N/A"}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <Badge
                                className={getClassBadgeClass(d.classificacao)}
                                title={humanizeFromDict("CLASS", d.classificacao) || d.classificacao || "N/A"}
                              >
                                {d.classificacao || "N/A"}
                              </Badge>
                            </TableCell>

                            <TableCell>{d.versao || "V0.1"}</TableCell>
                            <TableCell>{formatFileSize(d.tamanho)}</TableCell>
                            <TableCell>{fmtDateShort.format(new Date(d.dataUpload))}</TableCell>

                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handlePreview(d)}
                                  title="Visualizar"
                                  aria-label="Visualizar documento"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleShowHistory(d)}
                                  title="Histórico"
                                  aria-label="Ver histórico"
                                >
                                  <History className="h-4 w-4 text-purple-600" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEdit(d)}
                                  title="Editar"
                                  aria-label="Editar documento"
                                >
                                  <FileText className="h-4 w-4 text-orange-600" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDownload(d)}
                                  title="Baixar"
                                  aria-label="Baixar documento"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => requestDeleteFile(d, "datasets")}
                                  title="Excluir"
                                  aria-label="Excluir documento"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        Exibindo {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, datasetsPage?.total ?? 0)} de {datasetsPage?.total ?? 0}.
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                          Anterior
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                          Próxima
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="estrutura">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Sidebar: Folder Tree */}
              <Card className="lg:col-span-1">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderTree className="h-5 w-5 text-primary" />
                      Pastas
                    </CardTitle>

                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={collapseAllFolders} title="Recolher todas" className="h-7 w-7 p-0" aria-label="Recolher todas">
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      <Button size="sm" variant="ghost" onClick={expandAllFolders} title="Expandir todas" className="h-7 w-7 p-0" aria-label="Expandir todas">
                        <ChevronDown className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setParentFolderId(null);
                          setIsCreateFolderOpen(true);
                        }}
                      >
                        <FolderPlus className="mr-1 h-4 w-4" />
                        Nova
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {pastasLoading ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
                      <p className="text-sm">Carregando...</p>
                    </div>
                  ) : pastas.length === 0 ? (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      <FolderOpen className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p className="text-sm">Nenhuma pasta encontrada.</p>
                      <Button size="sm" className="mt-3" onClick={() => initMacroMutation.mutate()}>
                        <FolderPlus className="mr-1 h-4 w-4" />
                        Criar estrutura inicial
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[520px] px-2 pb-2">
                      <div className="space-y-0.5">
                        {rootFolders.map((pasta) => (
                          <FolderNode
                            key={pasta.id}
                            folder={pasta}
                            childrenMap={childrenMap}
                            expanded={expandedFolders}
                            onToggleExpanded={toggleFolderExpanded}
                            selectedId={selectedPasta?.id ?? null}
                            onSelect={handleSelectFolder}
                            onCreateSubfolder={(pid) => {
                              setParentFolderId(pid);
                              setIsCreateFolderOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Main: Selected Folder Files */}
              <Card className="lg:col-span-2">
                <CardHeader className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-primary" />
                        {selectedPasta ? selectedPasta.nome : "Selecione uma pasta"}
                      </CardTitle>
                      {selectedPasta && <CardDescription className="mt-1 text-xs">Caminho: {selectedPasta.caminho}</CardDescription>}
                    </div>

                    {selectedPasta && (
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={openDeleteFolderFlow} disabled={deleteFolderMutation.isPending}>
                          <Trash2 className="mr-1 h-4 w-4" />
                          Excluir pasta
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {!selectedPasta ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <FolderOpen className="mx-auto mb-4 h-16 w-16 opacity-30" />
                      <p>Selecione uma pasta na árvore para visualizar arquivos e cadastrar documentos.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Upload className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Cadastrar documento nesta pasta</span>
                        </div>

                        <p className="mb-3 text-xs text-muted-foreground">
                          O cadastro estruturado utiliza metadados e gera código padronizado. Isso melhora rastreabilidade, auditoria e conformidade.
                        </p>

                        <Button
                          className="w-full"
                          onClick={() => {
                            prefillFromSelectedFolder();
                            setIsUploadDialogOpen(true);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Cadastrar documento com código
                        </Button>

                        <p className="mt-2 text-center text-xs text-muted-foreground">O código será gerado automaticamente conforme os metadados.</p>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">Arquivos ({selectedFolderFiles.length})</span>
                        </div>

                        {selectedFolderFiles.length === 0 ? (
                          <div className="rounded-lg border bg-muted/20 py-8 text-center text-muted-foreground">
                            <File className="mx-auto mb-2 h-10 w-10 opacity-30" />
                            <p className="text-sm">Nenhum arquivo nesta pasta.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedFolderFiles.map((arquivo) => (
                              <div key={arquivo.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                                <FileText className="h-8 w-8 flex-shrink-0 text-blue-500" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium" title={arquivo.nome}>
                                    {arquivo.codigoArquivo || arquivo.nome}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>{formatFileSize(arquivo.tamanho)}</span>
                                    <span>•</span>
                                    <span>{fmtDateShort.format(new Date(arquivo.dataUpload))}</span>
                                    {arquivo.status && (
                                      <>
                                        <span>•</span>
                                        <Badge className={getStatusBadgeClass(arquivo.status)} variant="outline">
                                          {arquivo.status}
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handlePreview(arquivo)}
                                    title="Visualizar"
                                    aria-label="Visualizar arquivo"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={() => handleDownload(arquivo)}
                                    title="Baixar"
                                    aria-label="Baixar arquivo"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => requestDeleteFile(arquivo, "folder")}
                                    title="Excluir"
                                    aria-label="Excluir arquivo"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Rodapé Normativo */}
        <Card className="border-t-4 border-t-primary bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sistema de gestão de dados e documentos da EcoBrasil Consultoria Ambiental, estruturado com base em boas práticas e normas internacionais, incluindo.
                <strong> ISO 15489</strong>. <strong>ABNT NBR ISO 30301</strong>. <strong>ISO 9001</strong>. <strong>ISO 14001</strong>.{" "}
                <strong>ISO/IEC 27001</strong>. <strong>ISO 21502</strong>. <strong>ISO 31000</strong>. <strong>Princípios FAIR</strong>.{" "}
                <strong>LGPD (Lei nº 13.709/2018)</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dialog Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar documento</DialogTitle>
              <DialogDescription>Atualize as informações do documento.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} rows={3} />
              </div>

              {editingDataset && (
                <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
                  <p>
                    <strong>Tipo:</strong> {editingDataset.tipoDocumento || editingDataset.tipo || "N/A"}
                  </p>
                  <p>
                    <strong>Tamanho:</strong> {formatFileSize(editingDataset.tamanho)}
                  </p>
                  <p>
                    <strong>Enviado por:</strong> {editingDataset.usuario || "N/A"}
                  </p>
                  <p>
                    <strong>Data:</strong> {fmtDateFull.format(new Date(editingDataset.dataUpload))}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
                  {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Preview */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewDataset?.nome}
              </DialogTitle>
              <DialogDescription>
                {previewDataset && (
                  <span className="flex flex-wrap gap-4 text-sm">
                    <span>Tipo: {previewDataset.tipoDocumento || previewDataset.tipo || "N/A"}</span>
                    <span>Tamanho: {formatFileSize(previewDataset.tamanho)}</span>
                    <span>Por: {previewDataset.usuario || "N/A"}</span>
                    {previewDataset.versao && <span>Versão: {previewDataset.versao}</span>}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-auto">{previewDataset && getPreviewContent(previewDataset)}</div>
          </DialogContent>
        </Dialog>

        {/* Dialog Histórico */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de versões
              </DialogTitle>
              <DialogDescription>{historyDataset?.codigoArquivo || historyDataset?.nome}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">Versão atual</h4>
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <span>Versão: {historyDataset?.versao || "V0.1"}</span>
                  <span>Status: {historyDataset?.status || "N/A"}</span>
                  <span>Data: {historyDataset ? fmtDateShort.format(new Date(historyDataset.dataUpload)) : "N/A"}</span>
                  <span>Usuário: {historyDataset?.usuario || "N/A"}</span>
                </div>
              </div>

              <p className="py-4 text-center text-sm text-muted-foreground">
                Histórico de versões anteriores será exibido quando a API de versionamento estiver disponível.
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Criar Pasta */}
        <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5" />
                Criar nova pasta
              </DialogTitle>
              <DialogDescription>{parentFolderId ? "Criar subpasta dentro da pasta selecionada." : "Criar nova pasta raiz."}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome da pasta *</Label>
                <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nome da pasta" autoFocus />
              </div>

              {parentFolderId && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="text-muted-foreground">
                    Pasta pai.{" "}
                    <span className="font-medium text-foreground">{pastas.find((p) => p.id === parentFolderId)?.nome || ""}</span>
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateFolderOpen(false);
                    setNewFolderName("");
                    setParentFolderId(null);
                  }}
                  disabled={createFolderMutation.isPending}
                >
                  Cancelar
                </Button>

                <Button onClick={openCreateFolderFlow} disabled={createFolderMutation.isPending}>
                  {createFolderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Solicitar senha e criar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fluxo de senha para criar ou excluir pasta */}
        <PasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          title="Ação protegida"
          description="Esta ação exige validação de senha no servidor."
          isPending={createFolderMutation.isPending || deleteFolderMutation.isPending}
          onSubmit={submitPassword}
        />

        {/* Confirmação destrutiva para excluir pasta */}
        <DestructiveConfirmDialog
          open={deleteFolderConfirmOpen}
          onOpenChange={setDeleteFolderConfirmOpen}
          title="Excluir pasta"
          description="Esta ação remove a pasta e seus arquivos associados. Recomenda-se ter política de retenção antes de excluir permanentemente."
          confirmText="Prosseguir e informar senha"
          expectedPhrase={selectedPasta?.nome || "CONFIRMAR"}
          isPending={deleteFolderMutation.isPending}
          onConfirm={confirmDeleteFolderTyped}
        />

        {/* Confirmação destrutiva para excluir arquivo */}
        <DestructiveConfirmDialog
          open={deleteFileConfirmOpen}
          onOpenChange={setDeleteFileConfirmOpen}
          title="Excluir arquivo"
          description="Esta ação remove o arquivo. Em ambientes auditáveis, recomenda-se arquivamento ou revogação em vez de exclusão definitiva."
          confirmText="Excluir definitivamente"
          expectedPhrase={pendingDeleteFile?.nome || "CONFIRMAR"}
          isPending={deleteDatasetMutation.isPending || deleteFileFromFolderMutation.isPending}
          onConfirm={confirmDeleteFileTyped}
        />
      </div>
    </SensitivePageWrapper>
  );
}
