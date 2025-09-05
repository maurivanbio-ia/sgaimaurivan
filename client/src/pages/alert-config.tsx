import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Play, Settings, Mail, MessageCircle, Calendar } from "lucide-react";
import type { AlertConfig } from "@shared/schema";

export default function AlertConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          Gerencie os alertas automáticos para WhatsApp e email
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
                Alertas automáticos configurados para <strong>(71) 98780-2223</strong> (WhatsApp) 
                e <strong>ecobrasil@ecobrasil.bio.br</strong> (email)
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Verificação executada automaticamente a cada hora
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Button */}
      <div className="mb-6">
        <Button 
          onClick={handleTestAlerts}
          disabled={testAlerts.isPending}
          className="bg-green-600 hover:bg-green-700"
          data-testid="button-test-alerts"
        >
          <Play className="mr-2 h-4 w-4" />
          {testAlerts.isPending ? "Executando..." : "Testar Alertas Agora"}
        </Button>
      </div>

      {/* Alert Configurations */}
      <div className="space-y-6">
        {Object.entries(groupedConfigs).map(([tipo, tipoConfigs]) => (
          <Card key={tipo} className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getTypeIcon(tipo)}
                <span>{getTypeLabel(tipo)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tipoConfigs
                  .sort((a, b) => a.diasAviso - b.diasAviso)
                  .map((config) => (
                    <div 
                      key={config.id}
                      className="border rounded-lg p-4 bg-card"
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
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-1">
                            <Mail className="h-3 w-3" />
                            <span>Email</span>
                          </div>
                          <Switch 
                            checked={config.enviarEmail}
                            disabled
                            data-testid={`switch-email-${config.id}`}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </div>
                          <Switch 
                            checked={config.enviarWhatsapp}
                            disabled
                            data-testid={`switch-whatsapp-${config.id}`}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-3 text-xs text-muted-foreground">
                        {config.enviarEmail && config.enviarWhatsapp 
                          ? "Email + WhatsApp"
                          : config.enviarEmail 
                          ? "Apenas email"
                          : config.enviarWhatsapp 
                          ? "Apenas WhatsApp"
                          : "Desabilitado"
                        }
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}