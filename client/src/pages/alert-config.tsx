import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Play, Settings, Mail, MessageCircle, Calendar, ChevronDown, ChevronRight, Bell, AlertTriangle, RefreshCcw } from "lucide-react";
import type { AlertConfig } from "@shared/schema";

/* =========================
   Utilitários
   ========================= */

type AlertTipo = "licenca" | "condicionante" | "entrega" | string;

function getTypeLabel(tipo: AlertTipo) {
  switch (tipo) {
    case "licenca":
      return "Licenças";
    case "condicionante":
      return "Condicionantes";
    case "entrega":
      return "Entregas";
    default:
      return tipo;
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

async function safeJson(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return { message: txt };
  }
}

/* =========================
   Componente
   ========================= */

export default function AlertConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const configsQuery = useQuery<AlertConfig[]>({
    queryKey: ["/api/alerts/configs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts/configs");
      return (await res.json()) as AlertConfig[];
    },
    staleTime: 30_000,
    retry: 2,
  });

  const configs = configsQuery.data ?? [];

  const groupedConfigs = useMemo(() => {
    const grouped: Record<string, AlertConfig[]> = {};
    for (const c of configs) {
      const key = c.tipo ?? "outros";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    }
    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key].slice().sort((a, b) => a.diasAviso - b.diasAviso);
    }
    return grouped;
  }, [configs]);

  // Opcional. Abre automaticamente o primeiro tipo quando carregar.
  useEffect(() => {
    if (!configs.length) return;
    const tipos = Object.keys(groupedConfigs);
    if (tipos.length === 0) return;

    setExpandedTypes((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return { [tipos[0]]: true };
    });
  }, [configs.length, groupedConfigs]);

  const toggleExpanded = (tipo: string) => {
    setExpandedTypes((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
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
      toast({ title: "Sucesso", description: data.message || "Teste de alertas executado." });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err?.message || "Erro ao executar teste de alertas. Tente novamente.",
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
        description: data.message || "Notificação de teste criada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err?.message || "Falha ao criar notificação de teste",
        variant: "destructive",
      });
    },
  });

  // Atualização otimista para toggles
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

      queryClient.setQueryData<AlertConfig[]>(["/api/alerts/configs"], (old) => {
        const curr = old ?? [];
        return curr.map((c) => (c.id === id ? { ...c, ...updates } : c));
      });

      return { previous };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["/api/alerts/configs"], ctx.previous);
      }
      toast({
        title: "Erro",
        description: err?.message || "Erro ao atualizar configuração. Tente novamente.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Configuração atualizada com sucesso!" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configs"] });
    },
  });

  const toggleEmail = (config: AlertConfig) => {
    updateConfigMutation.mutate({
      id: config.id,
      updates: { enviarEmail: !config.enviarEmail },
    });
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
                <p className="text-sm text-muted-foreground">{msg}</p>
                <Button
                  onClick={() => configsQuery.refetch()}
                  className="gap-2"
                  data-testid="button-retry-configs"
                >
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
     Render
     ========================= */

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Configurações de Alertas</h2>
        <p className="text-muted-foreground mt-2">Gerencie os alertas automáticos por email</p>
      </div>

      <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-500 text-white p-2 rounded-full flex-shrink-0">
              <Settings className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Sistema de Alertas Ativo</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Alertas automáticos configurados e funcionando</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">Verificação executada automaticamente a cada hora</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 flex flex-wrap gap-4">
        <Button
          onClick={() => testAlertsMutation.mutate()}
          disabled={testAlertsMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
          data-testid="button-test-alerts"
        >
          <Play className="mr-2 h-4 w-4" />
          {testAlertsMutation.isPending ? "Executando..." : "Testar Alertas por Email"}
        </Button>

        <Button
          onClick={() => testNotificationMutation.mutate()}
          disabled={testNotificationMutation.isPending}
          variant="outline"
          className="border-blue-200 text-blue-700 hover:bg-blue-50"
          data-testid="button-test-notification"
        >
          <Bell className="mr-2 h-4 w-4" />
          {testNotificationMutation.isPending ? "Criando..." : "Criar Notificação de Teste"}
        </Button>
      </div>

      <div className="space-y-4">
        {Object.keys(groupedConfigs).length === 0 ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              Nenhuma configuração encontrada.
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedConfigs).map(([tipo, tipoConfigs]) => (
            <Collapsible key={tipo} open={!!expandedTypes[tipo]} onOpenChange={() => toggleExpanded(tipo)}>
              <Card className="shadow-sm">
                <CollapsibleTrigger asChild>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    aria-label={`Abrir configurações de ${getTypeLabel(tipo)}`}
                  >
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(tipo)}
                        <span>{getTypeLabel(tipo)}</span>
                        <Badge variant="outline" className="ml-2">
                          {tipoConfigs.length}
                        </Badge>
                      </div>
                      {expandedTypes[tipo] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {tipoConfigs.map((config) => (
                        <div
                          key={config.id}
                          className="border rounded-lg p-4 bg-card/50"
                          data-testid={`config-${config.id}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Badge variant={badgeVariantByDias(config.diasAviso)}>{config.diasAviso} dias</Badge>

                              {config.ativo ? (
                                <Badge variant="outline" className="text-green-600 border-green-300">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium">Email</span>
                              </div>
                              <Switch
                                checked={!!config.enviarEmail}
                                onCheckedChange={() => toggleEmail(config)}
                                disabled={updateConfigMutation.isPending}
                                aria-label={`Alternar envio por email para ${getTypeLabel(config.tipo)} em ${config.diasAviso} dias`}
                                data-testid={`switch-email-${config.id}`}
                              />
                            </div>

                            <div className="flex items-center justify-between opacity-70">
                              <div className="flex items-center space-x-2">
                                <MessageCircle className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-500">WhatsApp (Desabilitado)</span>
                              </div>
                              <Switch checked={false} disabled aria-label="WhatsApp desabilitado" data-testid={`switch-whatsapp-${config.id}`} />
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-muted-foreground">
                            {config.enviarEmail ? "Ativo (Email)" : "Desabilitado"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        )}
      </div>
    </div>
  );
}
