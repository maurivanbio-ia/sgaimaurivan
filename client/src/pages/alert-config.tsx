import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Play, Settings, Mail, MessageCircle, Calendar, ChevronDown, ChevronRight, Bell, Send, Trash2, Phone, Users, Wifi } from "lucide-react";
import type { AlertConfig } from "@shared/schema";

interface WhatsappDemandaConfig {
  id?: number;
  unidade: string;
  groupJid: string;
  groupName?: string;
  notifyNovaDemanda: boolean;
  notifyResumeSemanal: boolean;
  diaResumoSemanal: number;
  horaResumoSemanal: string;
  enabled: boolean;
}

// Converte número de telefone ou JID bruto para o formato WhatsApp
function normalizeJidPreview(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

function isPhoneNumber(input: string): boolean {
  return !input.trim().includes("@");
}

const DIAS_SEMANA = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

export default function AlertConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [wpForm, setWpForm] = useState<Partial<WhatsappDemandaConfig>>({
    groupJid: "", groupName: "", notifyNovaDemanda: true,
    notifyResumeSemanal: true, diaResumoSemanal: 1, horaResumoSemanal: "08:00", enabled: true,
  });

  const { data: configs = [], isLoading } = useQuery<AlertConfig[]>({
    queryKey: ["/api/alerts/configs"],
  });

  const { data: wpConfig, isLoading: wpLoading } = useQuery<WhatsappDemandaConfig | null>({
    queryKey: ["/api/whatsapp/demanda-config"],
    staleTime: 0,
  });

  // Sync form when config loads
  const [wpFormSynced, setWpFormSynced] = useState(false);
  if (wpConfig && !wpFormSynced) {
    setWpFormSynced(true);
    setWpForm({
      groupJid: wpConfig.groupJid,
      groupName: wpConfig.groupName || "",
      notifyNovaDemanda: wpConfig.notifyNovaDemanda,
      notifyResumeSemanal: wpConfig.notifyResumeSemanal,
      diaResumoSemanal: wpConfig.diaResumoSemanal,
      horaResumoSemanal: wpConfig.horaResumoSemanal,
      enabled: wpConfig.enabled,
    });
  }

  const saveWpConfig = useMutation({
    mutationFn: async (data: Partial<WhatsappDemandaConfig>) => {
      const method = wpConfig?.id ? "PUT" : "POST";
      const res = await apiRequest(method, "/api/whatsapp/demanda-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/demanda-config"] });
      setWpFormSynced(false);
      toast({ title: "Configuração salva com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar configuração", variant: "destructive" }),
  });

  const deleteWpConfig = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/whatsapp/demanda-config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/demanda-config"] });
      setWpFormSynced(false);
      setWpForm({ groupJid: "", groupName: "", notifyNovaDemanda: true, notifyResumeSemanal: true, diaResumoSemanal: 1, horaResumoSemanal: "08:00", enabled: true });
      toast({ title: "Configuração removida" });
    },
    onError: () => toast({ title: "Erro ao remover configuração", variant: "destructive" }),
  });

  const enviarResumo = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/whatsapp/demanda-config/enviar-resumo", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar resumo");
      return data;
    },
    onSuccess: (data) => toast({ title: data.message || "Resumo enviado!" }),
    onError: (err: any) => toast({ title: err.message || "Erro ao enviar resumo", variant: "destructive" }),
  });

  const testarConexaoWp = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/whatsapp/diagnostico", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error("Falha ao verificar");
      return data;
    },
    onSuccess: (data) => {
      const lines = [
        `URL configurada: ${data.instanceUrlConfigured ? "✅ Sim" : "❌ Não"}`,
        `Chave API: ${data.apiKeyConfigured ? "✅ Sim" : "❌ Não"}`,
        `Contém /instances/ na URL: ${data.hasInstancesInUrl ? "✅ Sim" : "⚠️ Não"}`,
        `Base URL: ${data.parsedBaseUrl}`,
        `Instance name: ${data.parsedInstanceName}`,
        `Endpoint gerado: ${data.endpointGerado}`,
      ];
      toast({ title: "Diagnóstico Evolution API", description: lines.join("\n") });
    },
    onError: () => toast({ title: "Erro ao verificar diagnóstico", variant: "destructive" }),
  });

  const testAlerts = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/alerts/test");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao executar teste de alertas. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleTestAlerts = () => {
    testAlerts.mutate();
  };

  const testeNotificacaoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/test");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Notificação criada",
        description: data.message || "Notificação de teste criada com sucesso!",
      });
      // Refresh notificações na nav
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar notificação de teste",
        variant: "destructive",
      });
    },
  });

  const handleTestNotificacao = () => {
    testeNotificacaoMutation.mutate();
  };

  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<AlertConfig> }) => {
      const response = await apiRequest("PUT", `/api/alerts/configs/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configs"] });
      toast({
        title: "Sucesso",
        description: "Configuração atualizada com sucesso!",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar configuração. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleToggleExpanded = (tipo: string) => {
    setExpandedTypes(prev => ({
      ...prev,
      [tipo]: !prev[tipo]
    }));
  };

  const handleEmailToggle = (config: AlertConfig) => {
    updateConfigMutation.mutate({
      id: config.id,
      updates: { enviarEmail: !config.enviarEmail }
    });
  };

  const handleWhatsAppToggle = (config: AlertConfig) => {
    // WhatsApp desabilitado - não faz nada
    return;
  };

  const getTypeLabel = (tipo: string) => {
    switch (tipo) {
      case 'licenca': return 'Licenças';
      case 'condicionante': return 'Condicionantes';
      case 'entrega': return 'Entregas';
      default: return tipo;
    }
  };

  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'licenca': return <Settings className="h-4 w-4" />;
      case 'condicionante': return <Calendar className="h-4 w-4" />;
      case 'entrega': return <Calendar className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.tipo]) {
      acc[config.tipo] = [];
    }
    acc[config.tipo].push(config);
    return acc;
  }, {} as Record<string, AlertConfig[]>);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando configurações de alertas...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Configurações de Alertas</h2>
        <p className="text-muted-foreground mt-2">
          Gerencie os alertas automáticos por email
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-500 text-white p-2 rounded-full flex-shrink-0">
              <Settings className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Sistema de Alertas Ativo
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Alertas automáticos configurados e funcionando
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Verificação executada automaticamente a cada hora
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Buttons */}
      <div className="mb-6 flex gap-4">
        <Button 
          onClick={handleTestAlerts}
          disabled={testAlerts.isPending}
          className="bg-green-600 hover:bg-green-700"
          data-testid="button-test-alerts"
        >
          <Play className="mr-2 h-4 w-4" />
          {testAlerts.isPending ? "Executando..." : "Testar Alertas por Email"}
        </Button>
        
        <Button 
          onClick={handleTestNotificacao}
          disabled={testeNotificacaoMutation.isPending}
          variant="outline"
          className="border-blue-200 text-blue-700 hover:bg-blue-50"
          data-testid="button-test-notification"
        >
          <Bell className="mr-2 h-4 w-4" />
          {testeNotificacaoMutation.isPending ? "Criando..." : "Criar Notificação de Teste"}
        </Button>
      </div>

      {/* WhatsApp Group Config */}
      <Card className="mb-6 border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Notificações de Demandas via WhatsApp
            {wpConfig?.enabled && (
              <Badge className="bg-green-100 text-green-700 border-green-300 ml-2">Ativo</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure um grupo do WhatsApp para receber avisos automáticos de novas demandas e resumos semanais.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {wpLoading ? (
            <p className="text-sm text-muted-foreground">Carregando configuração...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="groupJid" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Número ou ID do Grupo WhatsApp *
                  </Label>
                  <Input
                    id="groupJid"
                    placeholder="Ex: (62) 99428-5690  ou  120363...@g.us"
                    value={wpForm.groupJid || ""}
                    onChange={e => setWpForm(f => ({ ...f, groupJid: e.target.value }))}
                  />
                  {wpForm.groupJid && (
                    <p className="text-xs font-mono bg-muted rounded px-2 py-1 text-muted-foreground">
                      {isPhoneNumber(wpForm.groupJid)
                        ? <>📱 Número individual → <span className="text-green-700 dark:text-green-400">{normalizeJidPreview(wpForm.groupJid)}</span></>
                        : <>👥 Grupo → <span className="text-blue-700 dark:text-blue-400">{wpForm.groupJid}</span></>
                      }
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Digite um número brasileiro (ex: 62994285690) <em>ou</em> o JID de grupo (<code>@g.us</code>).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="groupName" className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Nome do Destinatário (exibição)
                  </Label>
                  <Input
                    id="groupName"
                    placeholder="Ex: ECO/Escritório BA"
                    value={wpForm.groupName || ""}
                    onChange={e => setWpForm(f => ({ ...f, groupName: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome usado apenas para identificação no sistema.
                  </p>
                </div>
              </div>

              {/* Atalho rápido — ECO/Escritório BA */}
              {!wpConfig?.id && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                  <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-green-800 dark:text-green-200">Configuração rápida:</span>
                    <span className="text-green-700 dark:text-green-300 ml-1">ECO/Escritório BA — (62) 99428-5690</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 flex-shrink-0"
                    onClick={() => setWpForm(f => ({
                      ...f,
                      groupJid: "62994285690",
                      groupName: "ECO/Escritório BA",
                    }))}
                  >
                    Usar
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Notificar nova demanda</p>
                    <p className="text-xs text-muted-foreground">Envia mensagem no grupo a cada demanda cadastrada</p>
                  </div>
                  <Switch
                    checked={wpForm.notifyNovaDemanda ?? true}
                    onCheckedChange={v => setWpForm(f => ({ ...f, notifyNovaDemanda: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Resumo semanal</p>
                    <p className="text-xs text-muted-foreground">Envia um resumo das demandas da semana no dia/hora configurados</p>
                  </div>
                  <Switch
                    checked={wpForm.notifyResumeSemanal ?? true}
                    onCheckedChange={v => setWpForm(f => ({ ...f, notifyResumeSemanal: v }))}
                  />
                </div>
              </div>

              {wpForm.notifyResumeSemanal && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Dia do resumo</Label>
                    <Select
                      value={String(wpForm.diaResumoSemanal ?? 1)}
                      onValueChange={v => setWpForm(f => ({ ...f, diaResumoSemanal: Number(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIAS_SEMANA.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hora">Horário (BRT)</Label>
                    <Input
                      id="hora"
                      type="time"
                      value={wpForm.horaResumoSemanal || "08:00"}
                      onChange={e => setWpForm(f => ({ ...f, horaResumoSemanal: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Ativar integração</p>
                  <Switch
                    checked={wpForm.enabled ?? true}
                    onCheckedChange={v => setWpForm(f => ({ ...f, enabled: v }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    disabled={testarConexaoWp.isPending}
                    onClick={() => testarConexaoWp.mutate()}
                    title="Verificar configuração da Evolution API"
                  >
                    <Wifi className="h-3.5 w-3.5 mr-1.5" />
                    {testarConexaoWp.isPending ? "..." : "Diagnóstico"}
                  </Button>
                  {wpConfig?.id && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        disabled={enviarResumo.isPending}
                        onClick={() => enviarResumo.mutate()}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        {enviarResumo.isPending ? "Enviando..." : "Enviar resumo agora"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={deleteWpConfig.isPending}
                        onClick={() => deleteWpConfig.mutate()}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={saveWpConfig.isPending || !wpForm.groupJid?.trim()}
                    onClick={() => saveWpConfig.mutate(wpForm)}
                  >
                    {saveWpConfig.isPending ? "Salvando..." : wpConfig?.id ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Alert Configurations */}
      <div className="space-y-4">
        {Object.entries(groupedConfigs).map(([tipo, tipoConfigs]) => (
          <Collapsible 
            key={tipo} 
            open={expandedTypes[tipo]} 
            onOpenChange={() => handleToggleExpanded(tipo)}
          >
            <Card className="shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(tipo)}
                      <span>{getTypeLabel(tipo)}</span>
                    </div>
                    {expandedTypes[tipo] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tipoConfigs
                      .sort((a, b) => a.diasAviso - b.diasAviso)
                      .map((config) => (
                        <div 
                          key={config.id}
                          className="border rounded-lg p-4 bg-card/50"
                          data-testid={`config-${config.tipo}-${config.diasAviso}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <Badge 
                                variant={config.diasAviso <= 7 ? "destructive" : 
                                       config.diasAviso <= 15 ? "default" : "secondary"}
                              >
                                {config.diasAviso} dias
                              </Badge>
                              {config.ativo ? (
                                <Badge variant="outline" className="text-green-600 border-green-300">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Inativo
                                </Badge>
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
                                checked={config.enviarEmail}
                                onCheckedChange={() => handleEmailToggle(config)}
                                disabled={updateConfigMutation.isPending}
                                data-testid={`switch-email-${config.id}`}
                              />
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <MessageCircle className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-500">WhatsApp (Desabilitado)</span>
                              </div>
                              <Switch 
                                checked={false}
                                onCheckedChange={() => {}}
                                disabled={true}
                                data-testid={`switch-whatsapp-${config.id}`}
                              />
                            </div>
                          </div>
                          
                          <div className="mt-3 text-xs text-muted-foreground">
                            {config.enviarEmail 
                              ? "Ativo (Email)"
                              : "Desabilitado"
                            }
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

    </div>
  );
}