import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Play, Settings, Mail, MessageCircle, Calendar, ChevronDown, ChevronRight, Bell } from "lucide-react";
import type { AlertConfig } from "@shared/schema";

export default function AlertConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const { data: configs = [], isLoading } = useQuery<AlertConfig[]>({
    queryKey: ["/api/alerts/configs"],
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