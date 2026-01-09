import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Settings, History, CheckCircle2, XCircle, Loader2, Phone, Bell, RefreshCw } from "lucide-react";

export default function WhatsAppConfigPage() {
  const { toast } = useToast();
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste de mensagem do EcoGestor - Sistema de Gestão Ambiental");

  const { data: whatsappStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<{ connected: boolean; state?: string; error?: string }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 30000,
  });

  const { data: messageLogs, isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/whatsapp/message-logs"],
  });

  const sendTestMutation = useMutation({
    mutationFn: async (data: { phone: string; message: string }) => {
      return apiRequest("POST", "/api/whatsapp/send", data);
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada",
        description: "A mensagem de teste foi enviada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/message-logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    },
  });

  const handleSendTest = () => {
    if (!testPhone) {
      toast({
        title: "Telefone obrigatório",
        description: "Informe um número de telefone para enviar o teste",
        variant: "destructive",
      });
      return;
    }
    sendTestMutation.mutate({ phone: testPhone, message: testMessage });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <MessageCircle className="h-8 w-8 text-green-600" />
            Integração WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure alertas e notificações via WhatsApp usando Evolution API
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchStatus()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar Status
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status da Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Verificando...</span>
              </div>
            ) : whatsappStatus?.connected ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-600">Conectado</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium text-red-500">Desconectado</span>
              </div>
            )}
            {whatsappStatus?.state && (
              <p className="text-xs text-muted-foreground mt-1">Estado: {whatsappStatus.state}</p>
            )}
            {whatsappStatus?.error && (
              <p className="text-xs text-red-500 mt-1">{whatsappStatus.error}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messageLogs?.filter(log => {
                const today = new Date().toDateString();
                return new Date(log.createdAt).toDateString() === today;
              }).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Enviadas nas últimas 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messageLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Mensagens registradas</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="test" className="space-y-4">
        <TabsList>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar Teste
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Configurar Alertas
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensagem de Teste</CardTitle>
              <CardDescription>
                Envie uma mensagem de teste para verificar se a integração está funcionando
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Telefone</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="Ex: 71987802223"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Apenas números, com DDD. O prefixo 55 será adicionado automaticamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Input
                    id="message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={handleSendTest} 
                disabled={sendTestMutation.isPending || !testPhone}
              >
                {sendTestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensagem de Teste
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Alertas Automáticos</CardTitle>
              <CardDescription>
                Configure quais alertas devem ser enviados via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">Licenças Vencendo</div>
                    <div className="text-sm text-muted-foreground">
                      Receber alertas quando licenças ambientais estiverem próximas do vencimento
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">Condicionantes Pendentes</div>
                    <div className="text-sm text-muted-foreground">
                      Receber alertas sobre condicionantes com prazo próximo
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">Novas Tarefas</div>
                    <div className="text-sm text-muted-foreground">
                      Notificar quando uma nova tarefa for atribuída a você
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">Novas Demandas</div>
                    <div className="text-sm text-muted-foreground">
                      Notificar quando uma nova demanda for criada para seu setor
                    </div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">Revisão de Veículos</div>
                    <div className="text-sm text-muted-foreground">
                      Alertas sobre manutenção e revisão de veículos da frota
                    </div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">Manutenção de Equipamentos</div>
                    <div className="text-sm text-muted-foreground">
                      Alertas sobre manutenção preventiva de equipamentos
                    </div>
                  </div>
                  <Switch />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="text-base font-medium">Telefone para Alertas</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Número que receberá os alertas automáticos do sistema
                </p>
                <div className="flex gap-2 max-w-md">
                  <Input placeholder="71987802223" />
                  <Button>Salvar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Mensagens</CardTitle>
              <CardDescription>
                Últimas mensagens enviadas e recebidas via WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : messageLogs && messageLogs.length > 0 ? (
                <div className="space-y-2">
                  {messageLogs.slice(0, 20).map((log: any) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        log.direction === "outgoing" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.direction === "outgoing" ? "default" : "secondary"}>
                            {log.direction === "outgoing" ? "Enviada" : "Recebida"}
                          </Badge>
                          <span className="text-sm font-medium">{log.phone}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {log.content}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mensagem registrada ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Settings className="h-5 w-5" />
            Configuração do Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-green-800">
          <p className="mb-2">
            Para receber mensagens no sistema, configure o webhook da Evolution API com a seguinte URL:
          </p>
          <code className="block bg-white p-2 rounded border text-xs overflow-x-auto">
            {window.location.origin}/api/webhooks/evolution/messages
          </code>
          <p className="mt-2 text-xs">
            Eventos suportados: messages.upsert, messages.update, connection.update
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
