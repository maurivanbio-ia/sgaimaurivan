import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FileText, Send, Clock, Mail, Plus, X, Loader2, CheckCircle, Calendar, RefreshCw } from "lucide-react";
import { z } from "zod";

/**
 * Melhorias aplicadas:
 * . validação forte de email (zod). dedupe e trim. impedir Enter causar double submit.
 * . estados de loading por ação. feedback mais claro.
 * . toggle enabled por relatório (se suportado pelo backend). fallback se não suportar.
 * . edição de cronExpression (se suportado). mostrando valor atual e botão salvar.
 * . UX. acessibilidade. disabled quando config ainda não carregou.
 */

interface ReportConfig {
  relatorio360: {
    enabled: boolean;
    cronExpression: string;
    emails: string[];
    unidades: string[];
  };
  relatorioFinanceiro: {
    enabled: boolean;
    cronExpression: string;
    emails: string[];
    unidades: string[];
  };
}

const emailSchema = z.string().email("Email inválido");

const normalizeEmail = (v: string) => v.trim().toLowerCase();

const dedupe = (arr: string[]) => Array.from(new Set(arr));

const prettyUnidade = (u: string) => u.replace(/_/g, " ");

type ReportKey = "relatorio360" | "relatorioFinanceiro";

export default function RelatoriosAutomaticosPage() {
  const { toast } = useToast();
  const [newEmail360, setNewEmail360] = useState("");
  const [newEmailFinanceiro, setNewEmailFinanceiro] = useState("");

  const [cron360, setCron360] = useState("");
  const [cronFin, setCronFin] = useState("");

  const { data: config, isLoading, isError, error, refetch, isFetching } = useQuery<ReportConfig>({
    queryKey: ["/api/relatorios-automaticos/config"],
  });

  useEffect(() => {
    if (!config) return;
    setCron360(config.relatorio360.cronExpression || "");
    setCronFin(config.relatorioFinanceiro.cronExpression || "");
  }, [config]);

  const updateEmails360 = useMutation({
    mutationFn: async (emails: string[]) =>
      apiRequest("POST", "/api/relatorios-automaticos/config/360/emails", { emails }),
    onSuccess: () => {
      toast({ title: "Emails atualizados", description: "Lista de emails do Relatório 360° atualizada" });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const updateEmailsFinanceiro = useMutation({
    mutationFn: async (emails: string[]) =>
      apiRequest("POST", "/api/relatorios-automaticos/config/financeiro/emails", { emails }),
    onSuccess: () => {
      toast({ title: "Emails atualizados", description: "Lista de emails do Relatório Financeiro atualizada" });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e?.message, variant: "destructive" }),
  });

  const updateEnabled = useMutation({
    mutationFn: async ({ key, enabled }: { key: ReportKey; enabled: boolean }) => {
      const path =
        key === "relatorio360"
          ? "/api/relatorios-automaticos/config/360/enabled"
          : "/api/relatorios-automaticos/config/financeiro/enabled";
      return apiRequest("POST", path, { enabled });
    },
    onSuccess: () => {
      toast({ title: "Configuração atualizada", description: "Status de envio automático atualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
    onError: (e: any) => {
      toast({
        title: "Não foi possível atualizar",
        description: e?.message || "Seu backend pode não suportar este endpoint ainda",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
  });

  const updateCron = useMutation({
    mutationFn: async ({ key, cronExpression }: { key: ReportKey; cronExpression: string }) => {
      const path =
        key === "relatorio360"
          ? "/api/relatorios-automaticos/config/360/cron"
          : "/api/relatorios-automaticos/config/financeiro/cron";
      return apiRequest("POST", path, { cronExpression });
    },
    onSuccess: () => {
      toast({ title: "Agendamento atualizado", description: "CRON atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
    onError: (e: any) => {
      toast({
        title: "Não foi possível atualizar o agendamento",
        description: e?.message || "Seu backend pode não suportar este endpoint ainda",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
  });

  const sendRelatorio360 = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/relatorios-automaticos/enviar/360"),
    onSuccess: () => toast({ title: "Relatório enviado!", description: "O Relatório 360° foi gerado e enviado por email" }),
    onError: (e: any) => toast({ title: "Erro ao enviar", description: e?.message, variant: "destructive" }),
  });

  const sendRelatorioFinanceiro = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/relatorios-automaticos/enviar/financeiro"),
    onSuccess: () =>
      toast({ title: "Relatório enviado!", description: "O Relatório Financeiro foi gerado e enviado por email" }),
    onError: (e: any) => toast({ title: "Erro ao enviar", description: e?.message, variant: "destructive" }),
  });

  const cfg360 = config?.relatorio360;
  const cfgFin = config?.relatorioFinanceiro;

  const busyAny =
    updateEmails360.isPending ||
    updateEmailsFinanceiro.isPending ||
    updateEnabled.isPending ||
    updateCron.isPending ||
    sendRelatorio360.isPending ||
    sendRelatorioFinanceiro.isPending ||
    isLoading;

  const validateAndNormalizeList = useCallback((current: string[], candidate: string) => {
    const normalized = normalizeEmail(candidate);
    const parsed = emailSchema.safeParse(normalized);
    if (!parsed.success) {
      toast({ title: "Email inválido", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return null;
    }
    const merged = dedupe([...current.map(normalizeEmail), normalized]);
    return merged;
  }, [toast]);

  const handleAddEmail360 = () => {
    if (!cfg360) return;
    const next = validateAndNormalizeList(cfg360.emails || [], newEmail360);
    if (!next) return;

    updateEmails360.mutate(next);
    setNewEmail360("");
  };

  const handleRemoveEmail360 = (email: string) => {
    if (!cfg360) return;
    const next = (cfg360.emails || []).filter((e) => normalizeEmail(e) !== normalizeEmail(email));
    updateEmails360.mutate(next);
  };

  const handleAddEmailFinanceiro = () => {
    if (!cfgFin) return;
    const next = validateAndNormalizeList(cfgFin.emails || [], newEmailFinanceiro);
    if (!next) return;

    updateEmailsFinanceiro.mutate(next);
    setNewEmailFinanceiro("");
  };

  const handleRemoveEmailFinanceiro = (email: string) => {
    if (!cfgFin) return;
    const next = (cfgFin.emails || []).filter((e) => normalizeEmail(e) !== normalizeEmail(email));
    updateEmailsFinanceiro.mutate(next);
  };

  const toggleEnabled360 = (enabled: boolean) => updateEnabled.mutate({ key: "relatorio360", enabled });
  const toggleEnabledFin = (enabled: boolean) => updateEnabled.mutate({ key: "relatorioFinanceiro", enabled });

  const saveCron360 = () => {
    const value = cron360.trim();
    if (!value) {
      toast({ title: "CRON inválido", description: "Informe uma expressão CRON.", variant: "destructive" });
      return;
    }
    updateCron.mutate({ key: "relatorio360", cronExpression: value });
  };

  const saveCronFin = () => {
    const value = cronFin.trim();
    if (!value) {
      toast({ title: "CRON inválido", description: "Informe uma expressão CRON.", variant: "destructive" });
      return;
    }
    updateCron.mutate({ key: "relatorioFinanceiro", cronExpression: value });
  };

  const summary = useMemo(() => {
    const emails360 = cfg360?.emails?.length ?? 0;
    const emailsFin = cfgFin?.emails?.length ?? 0;
    const un360 = cfg360?.unidades?.length ?? 0;
    const unFin = cfgFin?.unidades?.length ?? 0;

    return { emails360, emailsFin, un360, unFin };
  }, [cfg360, cfgFin]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-6 space-y-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Falha ao carregar configuração</CardTitle>
            <CardDescription>{(error as any)?.message || "Erro desconhecido"}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const RenderEmails = ({
    emails,
    onRemove,
  }: {
    emails: string[];
    onRemove: (email: string) => void;
  }) => {
    if (!emails || emails.length === 0) {
      return (
        <span className="text-sm text-muted-foreground">
          Nenhum email configurado. Será enviado para diretores e admins.
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {emails.map((email) => (
          <Badge key={email} variant="outline" className="flex items-center gap-1">
            {email}
            <button
              type="button"
              onClick={() => onRemove(email)}
              className="ml-1 hover:text-red-500"
              aria-label={`Remover ${email}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-green-600" />
            Relatórios Automáticos
          </h1>
          <p className="text-muted-foreground mt-1">Configure o envio automático de relatórios por email</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">360°. {summary.un360} unidade(s). {summary.emails360} email(s)</Badge>
            <Badge variant="secondary">Financeiro. {summary.unFin} unidade(s). {summary.emailsFin} email(s)</Badge>
          </div>
        </div>

        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* =======================
            Relatório 360
        ======================= */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Relatório 360°
                </CardTitle>
                <CardDescription>Relatório completo da plataforma</CardDescription>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Agendado
                </Badge>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ativo</span>
                  <Switch
                    checked={!!cfg360?.enabled}
                    onCheckedChange={toggleEnabled360}
                    disabled={busyAny || !cfg360}
                    aria-label="Ativar ou desativar relatório 360"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Unidades incluídas
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {cfg360?.unidades?.map((u) => (
                  <Badge key={u} variant="secondary">
                    {prettyUnidade(u)}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Agendamento (CRON)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={cron360}
                  onChange={(e) => setCron360(e.target.value)}
                  placeholder="0 8 * * 1"
                  disabled={busyAny}
                />
                <Button variant="outline" onClick={saveCron360} disabled={busyAny || !cron360.trim()}>
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exemplo. 0 8 * * 1. Segunda. 08.00. Ajuste conforme padrão CRON do seu scheduler.
              </p>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails de destino
              </Label>

              <RenderEmails emails={cfg360?.emails || []} onRemove={handleRemoveEmail360} />

              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="novo@email.com"
                  value={newEmail360}
                  onChange={(e) => setNewEmail360(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmail360();
                    }
                  }}
                  disabled={busyAny}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddEmail360}
                  disabled={busyAny || !newEmail360.trim()}
                  aria-label="Adicionar email no Relatório 360"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => sendRelatorio360.mutate()}
              disabled={busyAny || sendRelatorio360.isPending || !cfg360?.enabled}
              title={!cfg360?.enabled ? "Ative o relatório para permitir envio manual" : "Enviar agora"}
            >
              {sendRelatorio360.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Agora
            </Button>

            {!cfg360?.enabled ? (
              <p className="text-xs text-muted-foreground">
                O relatório está desativado. Ative o toggle para habilitar envio automático e manual.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* =======================
            Relatório Financeiro
        ======================= */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Relatório Financeiro
                </CardTitle>
                <CardDescription>Resumo financeiro mensal</CardDescription>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Agendado
                </Badge>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Ativo</span>
                  <Switch
                    checked={!!cfgFin?.enabled}
                    onCheckedChange={toggleEnabledFin}
                    disabled={busyAny || !cfgFin}
                    aria-label="Ativar ou desativar relatório financeiro"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Unidades incluídas
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {cfgFin?.unidades?.map((u) => (
                  <Badge key={u} variant="secondary">
                    {prettyUnidade(u)}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Agendamento (CRON)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={cronFin}
                  onChange={(e) => setCronFin(e.target.value)}
                  placeholder="0 17 * * 5"
                  disabled={busyAny}
                />
                <Button variant="outline" onClick={saveCronFin} disabled={busyAny || !cronFin.trim()}>
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exemplo. 0 17 * * 5. Sexta. 17.00. Ajuste conforme padrão CRON do seu scheduler.
              </p>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails de destino
              </Label>

              <RenderEmails emails={cfgFin?.emails || []} onRemove={handleRemoveEmailFinanceiro} />

              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="novo@email.com"
                  value={newEmailFinanceiro}
                  onChange={(e) => setNewEmailFinanceiro(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmailFinanceiro();
                    }
                  }}
                  disabled={busyAny}
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddEmailFinanceiro}
                  disabled={busyAny || !newEmailFinanceiro.trim()}
                  aria-label="Adicionar email no Relatório Financeiro"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => sendRelatorioFinanceiro.mutate()}
              disabled={busyAny || sendRelatorioFinanceiro.isPending || !cfgFin?.enabled}
              title={!cfgFin?.enabled ? "Ative o relatório para permitir envio manual" : "Enviar agora"}
            >
              {sendRelatorioFinanceiro.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Agora
            </Button>

            {!cfgFin?.enabled ? (
              <p className="text-xs text-muted-foreground">
                O relatório está desativado. Ative o toggle para habilitar envio automático e manual.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Como funciona</h3>
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                <li>Os relatórios são gerados automaticamente conforme CRON configurado</li>
                <li>Se nenhum email estiver configurado, o envio pode cair no fallback de diretores e admins</li>
                <li>Cada unidade recebe um relatório separado, conforme a lista de unidades do relatório</li>
                <li>O botão "Enviar Agora" é útil para validar templates e SMTP</li>
              </ul>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                Se os endpoints /enabled e /cron ainda não existirem no backend, o frontend continuará funcional para emails e envio manual.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
