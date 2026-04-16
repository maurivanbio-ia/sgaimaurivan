import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { FileText, Send, Clock, Mail, Plus, X, Loader2, CheckCircle, Calendar } from "lucide-react";

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

export default function RelatoriosAutomaticosPage() {
  const { toast } = useToast();
  const [newEmail360, setNewEmail360] = useState("");
  const [newEmailFinanceiro, setNewEmailFinanceiro] = useState("");

  const { data: config, isLoading } = useQuery<ReportConfig>({
    queryKey: ["/api/relatorios-automaticos/config"],
  });

  const updateEmails360 = useMutation({
    mutationFn: async (emails: string[]) => {
      return apiRequest("POST", "/api/relatorios-automaticos/config/360/emails", { emails });
    },
    onSuccess: () => {
      toast({ title: "Emails atualizados", description: "Lista de emails do Relatório 360° atualizada" });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const updateEmailsFinanceiro = useMutation({
    mutationFn: async (emails: string[]) => {
      return apiRequest("POST", "/api/relatorios-automaticos/config/financeiro/emails", { emails });
    },
    onSuccess: () => {
      toast({ title: "Emails atualizados", description: "Lista de emails do Relatório Financeiro atualizada" });
      queryClient.invalidateQueries({ queryKey: ["/api/relatorios-automaticos/config"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const sendRelatorio360 = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/relatorios-automaticos/enviar/360");
    },
    onSuccess: () => {
      toast({ title: "Relatório enviado!", description: "O Relatório 360° foi gerado e enviado por email" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const sendRelatorioFinanceiro = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/relatorios-automaticos/enviar/financeiro");
    },
    onSuccess: () => {
      toast({ title: "Relatório enviado!", description: "O Relatório Financeiro foi gerado e enviado por email" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    },
  });

  const handleAddEmail360 = () => {
    if (!newEmail360 || !newEmail360.includes("@")) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    const emails = [...(config?.relatorio360.emails || []), newEmail360];
    updateEmails360.mutate(emails);
    setNewEmail360("");
  };

  const handleRemoveEmail360 = (email: string) => {
    const emails = (config?.relatorio360.emails || []).filter(e => e !== email);
    updateEmails360.mutate(emails);
  };

  const handleAddEmailFinanceiro = () => {
    if (!newEmailFinanceiro || !newEmailFinanceiro.includes("@")) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    const emails = [...(config?.relatorioFinanceiro.emails || []), newEmailFinanceiro];
    updateEmailsFinanceiro.mutate(emails);
    setNewEmailFinanceiro("");
  };

  const handleRemoveEmailFinanceiro = (email: string) => {
    const emails = (config?.relatorioFinanceiro.emails || []).filter(e => e !== email);
    updateEmailsFinanceiro.mutate(emails);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8 text-green-600" />
          Relatórios Automáticos
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure o envio automático de relatórios por email
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Relatório 360°
                </CardTitle>
                <CardDescription>Relatório completo da plataforma</CardDescription>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Clock className="h-3 w-3 mr-1" />
                Segunda 8h
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Unidades incluídas
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {config?.relatorio360.unidades.map(unidade => (
                  <Badge key={unidade} variant="secondary">
                    {unidade.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails de destino
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {config?.relatorio360.emails.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Nenhum email configurado (será enviado para diretores)
                  </span>
                ) : (
                  config?.relatorio360.emails.map(email => (
                    <Badge key={email} variant="outline" className="flex items-center gap-1">
                      {email}
                      <button onClick={() => handleRemoveEmail360(email)} className="ml-1 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="novo@email.com"
                  value={newEmail360}
                  onChange={(e) => setNewEmail360(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmail360()}
                />
                <Button size="icon" variant="outline" onClick={handleAddEmail360}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <Button 
              className="w-full bg-green-600 hover:bg-green-700" 
              onClick={() => sendRelatorio360.mutate()}
              disabled={sendRelatorio360.isPending}
            >
              {sendRelatorio360.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Agora
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Relatório Financeiro
                </CardTitle>
                <CardDescription>Resumo financeiro mensal</CardDescription>
              </div>
              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Clock className="h-3 w-3 mr-1" />
                Sexta 17h
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Unidades incluídas
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {config?.relatorioFinanceiro.unidades.map(unidade => (
                  <Badge key={unidade} variant="secondary">
                    {unidade.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails de destino
              </Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {config?.relatorioFinanceiro.emails.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Nenhum email configurado (será enviado para diretores)
                  </span>
                ) : (
                  config?.relatorioFinanceiro.emails.map(email => (
                    <Badge key={email} variant="outline" className="flex items-center gap-1">
                      {email}
                      <button onClick={() => handleRemoveEmailFinanceiro(email)} className="ml-1 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="novo@email.com"
                  value={newEmailFinanceiro}
                  onChange={(e) => setNewEmailFinanceiro(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmailFinanceiro()}
                />
                <Button size="icon" variant="outline" onClick={handleAddEmailFinanceiro}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={() => sendRelatorioFinanceiro.mutate()}
              disabled={sendRelatorioFinanceiro.isPending}
            >
              {sendRelatorioFinanceiro.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Agora
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Como funciona</h3>
              <ul className="text-sm text-amber-800 dark:text-amber-200 mt-2 space-y-1">
                <li>Os relatórios são gerados automaticamente nos horários configurados</li>
                <li>Se nenhum email estiver configurado, os relatórios são enviados para todos os diretores e admins</li>
                <li>Cada unidade recebe um relatório separado</li>
                <li>Use o botão "Enviar Agora" para testar o envio imediatamente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
