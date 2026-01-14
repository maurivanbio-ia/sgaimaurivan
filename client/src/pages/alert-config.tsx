import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription as DialogDesc,
  DialogFooter,
  DialogHeader as DialogHead,
  DialogTitle as DialogTtl,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import {
  Play,
  Settings,
  Mail,
  MessageCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Bell,
  AlertTriangle,
  RefreshCcw,
  Activity,
  Clock,
  ListChecks,
  Eye,
  Users,
  RotateCcw,
} from "lucide-react";

import type { AlertConfig } from "@shared/schema";

/* =========================
   Utilitários
   ========================= */

type AlertTipo = "licenca" | "condicionante" | "entrega" | string;

type AlertsHealth = {
  ok?: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  durationMs?: number;
  evaluatedRules?: number;
  generatedAlerts?: number;
  failures?: number;
  message?: string;
};

type AlertLogItem = {
  id: string | number;
  createdAt: string;
  channel: "email" | "whatsapp" | string;
  status: "sent" | "failed" | "queued" | "skipped" | string;
  to?: string[];
  subject?: string;
  related?: string;
  error?: string;
};

function getTypeLabel(tipo: AlertTipo) {
  switch (tipo) {
    case "licenca":
      return "Licenças";
    case "condicionante":
      return "Condicionantes";
    case "entrega":
      return "Entregas";
    default:
      return tipo || "Outros";
  }
}

function getTypeIcon(tipo: AlertTipo) {
  switch (tipo) {
    case "licenca":
      return <Settings className="h-4 w-4" />;
    case "condicionante":
      return <Calendar className="h-4 w-4" />;
    case "entrega":
      return <Calendar className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
}

function badgeVariantByDias(diasAviso: number): "destructive" | "default" | "secondary" {
  if (diasAviso <= 7) return "destructive";
  if (diasAviso <= 15) return "default";
  return "secondary";
}

function tipoOrderKey(tipo: string) {
  const fixed = ["licenca", "condicionante", "entrega", "outros"];
  const idx = fixed.indexOf(tipo);
  if (idx >= 0) return `0${idx}`;
  return `1_${tipo.toLowerCase()}`;
}

function safeText(s: unknown, max = 350) {
  const v = typeof s === "string" ? s : String(s ?? "");
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return { message: txt };
  }
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function msToHuman(ms?: number) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return `${m} min ${rs} s`;
}

function normalizeEmails(raw: string) {
  return raw
    .split(/[\n,; ]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

/* =========================
   Constantes
   ========================= */

const STORAGE_EXPANDED_KEY = "alerts.expandedTypes.v1";
const STORAGE_FILTERS_KEY = "alerts.filters.v1";

/* =========================
   Componente
   ========================= */

export default function AlertConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [onlyEmailEnabled, setOnlyEmailEnabled] = useState(false);
  const [onlyCritical, setOnlyCritical] = useState(false);

  const [logsOpen, setLogsOpen] = useState(false);
  const [logsConfig, setLogsConfig] = useState<AlertConfig | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<AlertConfig | null>(null);

  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [recipientsConfig, setRecipientsConfig] = useState<AlertConfig | null>(null);
  const [recipientsDraft, setRecipientsDraft] = useState("");

  /* =========================
     Queries
     ========================= */

  const configsQuery = useQuery<AlertConfig[]>({
    queryKey: ["/api/alerts/configs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts/configs");
      return (await res.json()) as AlertConfig[];
    },
    staleTime: 30_000,
    retry: 2,
  });

  const healthQuery = useQuery<AlertsHealth>({
    queryKey: ["/api/alerts/health"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts/health");
      if (!res.ok) {
        const data = await safeJson(res);
        return { ok: false, message: data?.message || "Saúde indisponível." };
      }
      return (await res.json()) as AlertsHealth;
    },
    staleTime: 15_000,
    retry: 0,
  });

  const logsQuery = useQuery<AlertLogItem[]>({
    queryKey: ["/api/alerts/logs", logsConfig?.id],
    enabled: !!logsConfig?.id && logsOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/alerts/logs?configId=${logsConfig!.id}`);
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message || "Falha ao carregar logs.");
      }
      return (await res.json()) as AlertLogItem[];
    },
    staleTime: 10_000,
    retry: 0,
  });

  const previewQuery = useQuery<{ subject?: string; html?: string; text?: string; message?: string }>({
    queryKey: ["/api/alerts/preview", previewConfig?.id],
    enabled: !!previewConfig?.id && previewOpen,
    queryFn: async () => {
      const res = await apiRequest("POST", `/api/alerts/preview`, { configId: previewConfig!.id });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao gerar prévia.");
      return data as any;
    },
    staleTime: 0,
    retry: 0,
  });

  const configs = configsQuery.data ?? [];

  /* =========================
     Persistência local
     ========================= */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_EXPANDED_KEY);
      if (raw) setExpandedTypes(JSON.parse(raw));
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FILTERS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as any;
      setQ(obj.q ?? "");
      setOnlyActive(!!obj.onlyActive);
      setOnlyEmailEnabled(!!obj.onlyEmailEnabled);
      setOnlyCritical(!!obj.onlyCritical);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(expandedTypes));
    } catch {
      /* noop */
    }
  }, [expandedTypes]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_FILTERS_KEY,
        JSON.stringify({ q, onlyActive, onlyEmailEnabled, onlyCritical }),
      );
    } catch {
      /* noop */
    }
  }, [q, onlyActive, onlyEmailEnabled, onlyCritical]);

  /* =========================
     Filtragem e agrupamento
     ========================= */

  const filteredConfigs = useMemo(() => {
    const term = q.trim().toLowerCase();
    return configs.filter((c) => {
      if (onlyActive && !c.ativo) return false;
      if (onlyEmailEnabled && !c.enviarEmail) return false;
      if (onlyCritical && !(c.diasAviso <= 7)) return false;

      if (!term) return true;

      const t = (c.tipo ?? "").toLowerCase();
      const dias = String(c.diasAviso ?? "");
      const status = c.ativo ? "ativo" : "inativo";
      const email = c.enviarEmail ? "email" : "sem email";
      const hay = `${t} ${dias} ${status} ${email}`.toLowerCase();
      return hay.includes(term);
    });
  }, [configs, q, onlyActive, onlyEmailEnabled, onlyCritical]);

  const groupedConfigs = useMemo(() => {
    const grouped: Record<string, AlertConfig[]> = {};
    for (const c of filteredConfigs) {
      const key = (c.tipo ?? "outros") as string;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key].slice().sort((a, b) => a.diasAviso - b.diasAviso);
    }

    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      const ka = tipoOrderKey(a);
      const kb = tipoOrderKey(b);
      return ka.localeCompare(kb);
    });

    const ordered: Record<string, AlertConfig[]> = {};
    for (const k of orderedKeys) ordered[k] = grouped[k];
    return ordered;
  }, [filteredConfigs]);

  useEffect(() => {
    if (!configs.length) return;
    if (Object.keys(expandedTypes).length > 0) return;

    const tipos = Object.keys(groupedConfigs);
    if (!tipos.length) return;

    const prefer = tipos.includes("licenca") ? "licenca" : tipos[0];
    setExpandedTypes({ [prefer]: true });
  }, [configs.length, groupedConfigs, expandedTypes]);

  const toggleExpanded = (tipo: string) => {
    setExpandedTypes((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const isAllVisibleSelected = useMemo(() => {
    if (!filteredConfigs.length) return false;
    return filteredConfigs.every((c) => selectedIds.has(c.id));
  }, [filteredConfigs, selectedIds]);

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        for (const c of filteredConfigs) next.delete(c.id);
        return next;
      }
      for (const c of filteredConfigs) next.add(c.id);
      return next;
    });
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* =========================
     Mutações
     ========================= */

  const testAlertsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/alerts/test");
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao executar teste de alertas.");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso", description: safeText(data.message || "Teste de alertas executado.") });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/health"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: safeText(err?.message || "Erro ao executar teste de alertas. Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/test");
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao criar notificação de teste.");
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Notificação criada",
        description: safeText(data.message || "Notificação de teste criada com sucesso!"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: safeText(err?.message || "Falha ao criar notificação de teste"),
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<AlertConfig> }) => {
      const res = await apiRequest("PUT", `/api/alerts/configs/${id}`, updates);
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao atualizar configuração.");
      return data as AlertConfig;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/alerts/configs"] });

      const previous = queryClient.getQueryData<AlertConfig[]>(["/api/alerts/configs"]) ?? [];
      const previousItem = previous.find((c) => c.id === id);

      setPendingIds((prev) => new Set(prev).add(id));

      queryClient.setQueryData<AlertConfig[]>(["/api/alerts/configs"], (old) => {
        const curr = old ?? [];
        return curr.map((c) => (c.id === id ? { ...c, ...updates } : c));
      });

      return { previousItem, id };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previousItem) {
        queryClient.setQueryData<AlertConfig[]>(["/api/alerts/configs"], (old) => {
          const curr = old ?? [];
          return curr.map((c) => (c.id === ctx.id ? ctx.previousItem : c));
        });
      }
      toast({
        title: "Erro",
        description: safeText(err?.message || "Erro ao atualizar configuração. Tente novamente."),
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Configuração atualizada com sucesso." });
    },
    onSettled: (_d, _e, vars) => {
      if (vars?.id) {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(vars.id);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/health"] });
    },
  });

  const batchUpdateMutation = useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: number[];
      updates: Partial<AlertConfig>;
    }) => {
      const res = await apiRequest("POST", `/api/alerts/configs/batch`, { ids, updates });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao atualizar em lote.");
      return data;
    },
    onMutate: async ({ ids, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/alerts/configs"] });

      const previous = queryClient.getQueryData<AlertConfig[]>(["/api/alerts/configs"]) ?? [];

      setPendingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });

      queryClient.setQueryData<AlertConfig[]>(["/api/alerts/configs"], (old) => {
        const curr = old ?? [];
        return curr.map((c) => (ids.includes(c.id) ? { ...c, ...updates } : c));
      });

      return { previous, ids };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/alerts/configs"], ctx.previous);
      toast({
        title: "Erro",
        description: safeText(err?.message || "Erro ao atualizar em lote."),
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso", description: safeText(data?.message || "Atualização em lote concluída.") });
      clearSelection();
    },
    onSettled: (_d, _e, vars) => {
      const ids = vars?.ids ?? [];
      setPendingIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/health"] });
    },
  });

  const saveRecipientsMutation = useMutation({
    mutationFn: async ({ id, recipients }: { id: number; recipients: string[] }) => {
      const res = await apiRequest("PUT", `/api/alerts/configs/${id}/recipients`, { recipients });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao salvar destinatários.");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Sucesso", description: safeText(data?.message || "Destinatários atualizados.") });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configs"] });
      setRecipientsOpen(false);
      setRecipientsConfig(null);
      setRecipientsDraft("");
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: safeText(err?.message || "Falha ao salvar destinatários."),
        variant: "destructive",
      });
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async ({ configId }: { configId: number }) => {
      const res = await apiRequest("POST", "/api/alerts/reprocess", { configId });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Falha ao reprocessar.");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Reprocessamento", description: safeText(data?.message || "Solicitação enviada.") });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/health"] });
      if (logsConfig?.id) queryClient.invalidateQueries({ queryKey: ["/api/alerts/logs", logsConfig.id] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: safeText(err?.message || "Falha ao reprocessar."),
        variant: "destructive",
      });
    },
  });

  const toggleEmail = (config: AlertConfig) => {
    updateConfigMutation.mutate({ id: config.id, updates: { enviarEmail: !config.enviarEmail } });
  };

  const toggleActive = (config: AlertConfig) => {
    updateConfigMutation.mutate({ id: config.id, updates: { ativo: !config.ativo } });
  };

  const openLogs = (config: AlertConfig) => {
    setLogsConfig(config);
    setLogsOpen(true);
  };

  const openPreview = (config: AlertConfig) => {
    setPreviewConfig(config);
    setPreviewOpen(true);
  };

  const openRecipients = (config: AlertConfig) => {
    setRecipientsConfig(config);
    const current = ((config as any).recipients as string[] | undefined) ?? ((config as any).destinatarios as string[] | undefined) ?? [];
    setRecipientsDraft(current.join("\n"));
    setRecipientsOpen(true);
  };

  const applyBatch = (updates: Partial<AlertConfig>) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast({ title: "Seleção vazia", description: "Selecione ao menos uma regra para aplicar ações em lote." });
      return;
    }
    batchUpdateMutation.mutate({ ids, updates });
  };

  /* =========================
     Loading e error states
     ========================= */

  if (configsQuery.isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-80" />
        </div>
        <Skeleton className="h-28 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (configsQuery.isError) {
    const msg = (configsQuery.error as any)?.message || "Falha ao carregar configurações.";
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mt-1" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Erro ao carregar</h3>
                <p className="text-sm text-muted-foreground">{safeText(msg)}</p>
                <Button onClick={() => configsQuery.refetch()} className="gap-2" data-testid="button-retry-configs">
                  <RefreshCcw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* =========================
     Derivados
     ========================= */

  const totalRules = configs.length;
  const totalFiltered = filteredConfigs.length;
  const totalSelected = selectedIds.size;

  const criticalCount = useMemo(() => configs.filter((c) => c.diasAviso <= 7).length, [configs]);
  const emailEnabledCount = useMemo(() => configs.filter((c) => !!c.enviarEmail).length, [configs]);
  const activeCount = useMemo(() => configs.filter((c) => !!c.ativo).length, [configs]);

  const health = healthQuery.data;

  /* =========================
     Render
     ========================= */

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col gap-3">
        <div>
          <h2 className="text-3xl font-bold text-card-foreground">Configurações de Alertas</h2>
          <p className="text-muted-foreground mt-2">
            Gerencie regras e canais de alertas. Configure e valide a operação com rastreabilidade.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Saúde do sistema
              </CardTitle>
              <CardDescription>Execução real do job e indicadores operacionais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={health?.ok ? "default" : "secondary"} className="gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {health?.ok ? "Operando" : "Indisponível"}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <ListChecks className="h-3.5 w-3.5" />
                  Avaliadas: {health?.evaluatedRules ?? "—"}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Bell className="h-3.5 w-3.5" />
                  Geradas: {health?.generatedAlerts ?? "—"}
                </Badge>
                <Badge variant={typeof health?.failures === "number" && health.failures > 0 ? "destructive" : "outline"}>
                  Falhas: {health?.failures ?? "—"}
                </Badge>
              </div>

              <div className="grid gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Última execução</span>
                  <span className="text-foreground">{fmtDateTime(health?.lastRunAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Próxima execução</span>
                  <span className="text-foreground">{fmtDateTime(health?.nextRunAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Duração</span>
                  <span className="text-foreground">{msToHuman(health?.durationMs)}</span>
                </div>
                {!!health?.message && <div className="text-xs">{safeText(health.message)}</div>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => healthQuery.refetch()}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-refresh-health"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar saúde
                </Button>

                <Button
                  onClick={() => testAlertsMutation.mutate()}
                  disabled={testAlertsMutation.isPending}
                  className="gap-2"
                  data-testid="button-test-alerts"
                >
                  <Play className="h-4 w-4" />
                  {testAlertsMutation.isPending ? "Executando…" : "Rodar varredura manual"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Cobertura e criticidade
              </CardTitle>
              <CardDescription>Visão rápida das regras cadastradas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Regras: {totalRules}</Badge>
                <Badge variant="outline">Ativas: {activeCount}</Badge>
                <Badge variant="outline">Email habilitado: {emailEnabledCount}</Badge>
                <Badge variant={criticalCount > 0 ? "destructive" : "secondary"}>Críticas (≤ 7 dias): {criticalCount}</Badge>
              </div>

              <div className="text-sm text-muted-foreground">
                Regras críticas são alertas com antecedência de 7 dias ou menos. Ajuste conforme sua política interna.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => testNotificationMutation.mutate()}
                  disabled={testNotificationMutation.isPending}
                  variant="outline"
                  className="gap-2"
                  data-testid="button-test-notification"
                >
                  <Bell className="h-4 w-4" />
                  {testNotificationMutation.isPending ? "Criando…" : "Criar notificação de teste"}
                </Button>

                <Button
                  onClick={() => {
                    setQ("");
                    setOnlyActive(false);
                    setOnlyEmailEnabled(false);
                    setOnlyCritical(false);
                    toast({ title: "Filtros limpos", description: "Os filtros foram resetados." });
                  }}
                  variant="outline"
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Limpar filtros
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pesquisa e filtros</CardTitle>
          <CardDescription>Refine a lista. A seleção em lote respeita o resultado filtrado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="alerts-search">Buscar</Label>
              <Input
                id="alerts-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ex.: licenca, 7, ativo, email"
              />
            </div>

            <div className="space-y-2">
              <Label>Filtros</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} id="f-only-active" />
                  <Label htmlFor="f-only-active" className="text-sm font-normal cursor-pointer">
                    Apenas regras ativas
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={onlyEmailEnabled}
                    onCheckedChange={(v) => setOnlyEmailEnabled(!!v)}
                    id="f-only-email"
                  />
                  <Label htmlFor="f-only-email" className="text-sm font-normal cursor-pointer">
                    Apenas com email habilitado
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={onlyCritical} onCheckedChange={(v) => setOnlyCritical(!!v)} id="f-only-critical" />
                  <Label htmlFor="f-only-critical" className="text-sm font-normal cursor-pointer">
                    Apenas críticas (≤ 7 dias)
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Seleção em lote</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Filtradas: <span className="text-foreground">{totalFiltered}</span>. Selecionadas:{" "}
                    <span className="text-foreground">{totalSelected}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isAllVisibleSelected}
                      onCheckedChange={() => toggleSelectAllVisible()}
                      id="select-all-visible"
                    />
                    <Label htmlFor="select-all-visible" className="text-sm font-normal cursor-pointer">
                      Selecionar todas
                    </Label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => applyBatch({ ativo: true })}
                    disabled={batchUpdateMutation.isPending}
                  >
                    Ativar regras
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => applyBatch({ ativo: false })}
                    disabled={batchUpdateMutation.isPending}
                  >
                    Inativar regras
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => applyBatch({ enviarEmail: true })}
                    disabled={batchUpdateMutation.isPending}
                  >
                    Habilitar email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => applyBatch({ enviarEmail: false })}
                    disabled={batchUpdateMutation.isPending}
                  >
                    Desabilitar email
                  </Button>
                  <Button type="button" variant="ghost" onClick={clearSelection} disabled={!totalSelected}>
                    Limpar seleção
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Se o endpoint de lote não existir no backend, implemente <code>/api/alerts/configs/batch</code>.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.keys(groupedConfigs).length === 0 ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground">Nenhuma configuração encontrada para os filtros atuais.</CardContent>
          </Card>
        ) : (
          Object.entries(groupedConfigs).map(([tipo, tipoConfigs]) => {
            const open = !!expandedTypes[tipo];
            const count = tipoConfigs.length;

            return (
              <Collapsible key={tipo} open={open} onOpenChange={() => toggleExpanded(tipo)}>
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(tipo)}
                        <div className="flex flex-col">
                          <CardTitle className="text-base">{getTypeLabel(tipo)}</CardTitle>
                          <CardDescription>
                            Regras de {getTypeLabel(tipo).toLowerCase()}. Alertar {`X`} dias antes do prazo aplicável.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {count}
                        </Badge>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(tipo)}
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted transition-colors"
                        aria-expanded={open}
                        aria-controls={`collapsible-${tipo}`}
                      >
                        <span className="text-sm text-muted-foreground">{open ? "Recolher" : "Expandir"}</span>
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>
                  </CardHeader>

                  <CollapsibleContent id={`collapsible-${tipo}`}>
                    <CardContent className="pt-0">
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {tipoConfigs.map((config) => {
                          const isPending = pendingIds.has(config.id);

                          const recipients =
                            ((config as any).recipients as string[] | undefined) ??
                            ((config as any).destinatarios as string[] | undefined) ??
                            [];

                          const recipientsCount = recipients?.length ?? 0;

                          return (
                            <div
                              key={config.id}
                              className="border rounded-lg p-4 bg-card/50"
                              data-testid={`config-${config.id}`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={selectedIds.has(config.id)}
                                    onCheckedChange={() => toggleSelectOne(config.id)}
                                    aria-label="Selecionar regra"
                                  />

                                  <Badge variant={badgeVariantByDias(config.diasAviso)}>{config.diasAviso} dias</Badge>

                                  {config.ativo ? (
                                    <Badge variant="outline" className="text-green-700 border-green-300">
                                      Ativa
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">Inativa</Badge>
                                  )}

                                  {isPending && (
                                    <Badge variant="outline" className="text-muted-foreground">
                                      Salvando…
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="gap-2"
                                    onClick={() => openPreview(config)}
                                    disabled={isPending}
                                    aria-label="Pré-visualizar email"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="gap-2"
                                    onClick={() => openLogs(config)}
                                    disabled={isPending}
                                    aria-label="Ver logs"
                                  >
                                    <ListChecks className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Regra ativa</span>
                                  </div>
                                  <Switch
                                    checked={!!config.ativo}
                                    onCheckedChange={() => toggleActive(config)}
                                    disabled={isPending}
                                    aria-label={`Alternar ativação da regra de ${getTypeLabel(config.tipo)} em ${config.diasAviso} dias`}
                                    data-testid={`switch-active-${config.id}`}
                                  />
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Email</span>
                                  </div>
                                  <Switch
                                    checked={!!config.enviarEmail}
                                    onCheckedChange={() => toggleEmail(config)}
                                    disabled={isPending || !config.ativo}
                                    aria-label={`Alternar envio por email para ${getTypeLabel(config.tipo)} em ${config.diasAviso} dias`}
                                    data-testid={`switch-email-${config.id}`}
                                  />
                                </div>

                                <div className="flex items-center justify-between opacity-70">
                                  <div className="flex items-center gap-2">
                                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">WhatsApp (Em breve)</span>
                                  </div>
                                  <Switch checked={false} disabled aria-label="WhatsApp indisponível" />
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Destinatários</span>
                                  </div>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => openRecipients(config)}
                                    disabled={isPending}
                                  >
                                    {recipientsCount ? `${recipientsCount}` : "Configurar"}
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3 text-xs text-muted-foreground">
                                {config.ativo ? (
                                  <>
                                    {config.enviarEmail ? "Ativa. Email habilitado." : "Ativa. Email desabilitado."}{" "}
                                    Aviso {config.diasAviso} dias antes do prazo.
                                  </>
                                ) : (
                                  <>Regra inativa. Canais indisponíveis até ativação.</>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => reprocessMutation.mutate({ configId: config.id })}
                                  disabled={isPending || reprocessMutation.isPending}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Reprocessar
                                </Button>

                                <div className="text-xs text-muted-foreground flex items-center">
                                  Reprocessa alertas vinculados a esta regra, se suportado pelo backend.
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>

      {/* Modal de logs */}
      <Dialog open={logsOpen} onOpenChange={(v) => setLogsOpen(v)}>
        <DialogContent className="max-w-3xl">
          <DialogHead>
            <DialogTtl>Log de envios</DialogTtl>
            <DialogDesc>
              Histórico por regra. Se o endpoint não existir, implemente <code>/api/alerts/logs?configId=</code>.
            </DialogDesc>
          </DialogHead>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Regra: <span className="text-foreground">{logsConfig ? `${getTypeLabel(logsConfig.tipo)} . ${logsConfig.diasAviso} dias` : "—"}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => logsQuery.refetch()}
                disabled={logsQuery.isFetching}
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
            </div>

            {logsQuery.isFetching ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : logsQuery.isError ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {safeText((logsQuery.error as any)?.message || "Falha ao carregar logs.")}
                </CardContent>
              </Card>
            ) : (logsQuery.data ?? []).length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">Nenhum registro encontrado.</CardContent>
              </Card>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-muted px-3 py-2 text-xs font-medium">
                  <div className="col-span-3">Data</div>
                  <div className="col-span-2">Canal</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-5">Detalhes</div>
                </div>
                {(logsQuery.data ?? []).map((item) => (
                  <div key={String(item.id)} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs border-t">
                    <div className="col-span-3 text-muted-foreground">{fmtDateTime(item.createdAt)}</div>
                    <div className="col-span-2">{item.channel}</div>
                    <div className="col-span-2">
                      <Badge variant={item.status === "failed" ? "destructive" : "outline"}>{item.status}</Badge>
                    </div>
                    <div className="col-span-5 text-muted-foreground">
                      {item.subject ? <span className="text-foreground">{safeText(item.subject, 80)}</span> : null}
                      {item.related ? <> . {safeText(item.related, 110)}</> : null}
                      {item.error ? <> . Erro: {safeText(item.error, 120)}</> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLogsOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de pré-visualização */}
      <Dialog open={previewOpen} onOpenChange={(v) => setPreviewOpen(v)}>
        <DialogContent className="max-w-3xl">
          <DialogHead>
            <DialogTtl>Pré-visualização do email</DialogTtl>
            <DialogDesc>
              Gera uma prévia do conteúdo. Se o endpoint não existir, implemente <code>/api/alerts/preview</code>.
            </DialogDesc>
          </DialogHead>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Regra:{" "}
              <span className="text-foreground">
                {previewConfig ? `${getTypeLabel(previewConfig.tipo)} . ${previewConfig.diasAviso} dias` : "—"}
              </span>
            </div>

            {previewQuery.isFetching ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : previewQuery.isError ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {safeText((previewQuery.error as any)?.message || "Falha ao gerar prévia.")}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Assunto.</span>{" "}
                    <span className="text-foreground">{safeText(previewQuery.data?.subject || "—")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Conteúdo em texto. HTML pode ser exibido no cliente de email.
                  </div>
                  <div className="border rounded-md p-3 whitespace-pre-wrap text-sm">
                    {safeText(previewQuery.data?.text || previewQuery.data?.message || "Prévia indisponível.")}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de destinatários */}
      <Dialog open={recipientsOpen} onOpenChange={(v) => setRecipientsOpen(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHead>
            <DialogTtl>Destinatários</DialogTtl>
            <DialogDesc>
              Configure emails por regra. Separe por linha, vírgula ou ponto e vírgula. O backend deve suportar{" "}
              <code>/api/alerts/configs/:id/recipients</code>.
            </DialogDesc>
          </DialogHead>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Regra:{" "}
              <span className="text-foreground">
                {recipientsConfig ? `${getTypeLabel(recipientsConfig.tipo)} . ${recipientsConfig.diasAviso} dias` : "—"}
              </span>
            </div>

            <Textarea
              value={recipientsDraft}
              onChange={(e) => setRecipientsDraft(e.target.value)}
              placeholder={"exemplo@dominio.com\njuridico@dominio.com\ncoordenacao@dominio.com"}
              className="min-h-[180px]"
            />

            <div className="text-xs text-muted-foreground">
              Dica. Use listas diferentes por regra quando o fluxo envolver áreas distintas. Jurídico. Coordenação. Financeiro.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRecipientsOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!recipientsConfig?.id) return;
                const emails = normalizeEmails(recipientsDraft);
                if (!emails.length) {
                  toast({ title: "Lista vazia", description: "Informe ao menos um email para salvar." });
                  return;
                }
                saveRecipientsMutation.mutate({ id: recipientsConfig.id, recipients: emails });
              }}
              disabled={saveRecipientsMutation.isPending}
              className="gap-2"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rodapé de observações */}
      <div className="mt-10 text-xs text-muted-foreground space-y-2">
        <div>
          Observação. Alguns recursos dependem de endpoints adicionais. Logs. Prévia. Lote. Destinatários. Reprocessamento.
        </div>
        <div>
          Recomenda-se adicionar trilha de auditoria no backend. Usuário responsável. Timestamp. Valores anterior e novo.
        </div>
      </div>
    </div>
  );
}
