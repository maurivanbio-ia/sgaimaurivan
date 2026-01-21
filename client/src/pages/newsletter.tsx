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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Users, 
  FileText, 
  Settings, 
  Send, 
  Plus, 
  Trash2, 
  Eye,
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  Newspaper
} from "lucide-react";

interface NewsletterConfig {
  id: number;
  ativo: boolean;
  diaEnvio: number;
  horarioEnvio: string;
  assuntoTemplate: string;
  termosChave: string;
  maxNoticias: number;
  unidade: string;
}

interface Assinante {
  id: number;
  email: string;
  nome: string | null;
  ativo: boolean;
  confirmaAssinatura: boolean;
  unidade: string;
  criadoEm: string;
}

interface Edicao {
  id: number;
  numero: number;
  titulo: string;
  introducao: string;
  resumoGeral: string;
  noticias: any[];
  htmlContent: string;
  status: string;
  dataEnvio: string | null;
  totalDestinatarios: number;
  totalAberturas: number;
  criadoEm: string;
}

const diasSemana = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

export default function NewsletterPage() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedEdicao, setSelectedEdicao] = useState<Edicao | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [newAssinante, setNewAssinante] = useState({ email: "", nome: "" });

  const { data: config, isLoading: configLoading } = useQuery<NewsletterConfig>({
    queryKey: ["/api/newsletter/config"],
  });

  const { data: assinantes = [], isLoading: assinantesLoading } = useQuery<Assinante[]>({
    queryKey: ["/api/newsletter/assinantes"],
  });

  const { data: edicoes = [], isLoading: edicoesLoading } = useQuery<Edicao[]>({
    queryKey: ["/api/newsletter/edicoes"],
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<NewsletterConfig>) => 
      apiRequest("PUT", "/api/newsletter/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/config"] });
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  const addAssinanteMutation = useMutation({
    mutationFn: (data: { email: string; nome: string }) => 
      apiRequest("POST", "/api/newsletter/assinantes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/assinantes"] });
      setAddDialogOpen(false);
      setNewAssinante({ email: "", nome: "" });
      toast({ title: "Assinante adicionado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar assinante", variant: "destructive" });
    },
  });

  const removeAssinanteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/newsletter/assinantes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/assinantes"] });
      toast({ title: "Assinante removido com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao remover assinante", variant: "destructive" });
    },
  });

  const toggleAssinanteMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: number; ativo: boolean }) => 
      apiRequest("PATCH", `/api/newsletter/assinantes/${id}/toggle`, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/assinantes"] });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar assinante", variant: "destructive" });
    },
  });

  const sendNewsletterMutation = useMutation({
    mutationFn: () => 
      apiRequest("POST", "/api/newsletter/send"),
    onSuccess: async (res: Response) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/edicoes"] });
      toast({ title: data.message || "Newsletter enviada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao enviar newsletter", variant: "destructive" });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: (email: string) => 
      apiRequest("POST", "/api/newsletter/test", { email }),
    onSuccess: async (res: Response) => {
      const data = await res.json();
      toast({ title: data.message || "Email de teste enviado!" });
      setTestEmail("");
    },
    onError: () => {
      toast({ title: "Erro ao enviar email de teste", variant: "destructive" });
    },
  });

  const assinantesAtivos = assinantes.filter(a => a.ativo).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
            <Newspaper className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Newsletter Ambiental</h1>
            <p className="text-gray-500 dark:text-gray-400">Gerencie a newsletter semanal da EcoBrasil</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const email = prompt("Digite o email para teste:");
              if (email) sendTestMutation.mutate(email);
            }}
            disabled={sendTestMutation.isPending}
          >
            {sendTestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Enviar Teste
          </Button>
          <Button
            onClick={() => sendNewsletterMutation.mutate()}
            disabled={sendNewsletterMutation.isPending || assinantesAtivos === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {sendNewsletterMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar Newsletter Agora
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{assinantesAtivos}</p>
                <p className="text-sm text-gray-500">Assinantes Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{edicoes.length}</p>
                <p className="text-sm text-gray-500">Edições Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{diasSemana.find(d => d.value === String(config?.diaEnvio))?.label || "-"}</p>
                <p className="text-sm text-gray-500">Dia de Envio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{config?.horarioEnvio || "-"}</p>
                <p className="text-sm text-gray-500">Horário</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="assinantes">
            <Users className="h-4 w-4 mr-2" />
            Assinantes ({assinantes.length})
          </TabsTrigger>
          <TabsTrigger value="edicoes">
            <FileText className="h-4 w-4 mr-2" />
            Edições ({edicoes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Newsletter</CardTitle>
              <CardDescription>Defina como e quando a newsletter será enviada</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {configLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : config && (
                <>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Newsletter Ativa</Label>
                      <p className="text-sm text-gray-500">Ativar ou desativar o envio automático</p>
                    </div>
                    <Switch
                      checked={config.ativo}
                      onCheckedChange={(ativo) => updateConfigMutation.mutate({ ativo })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dia de Envio</Label>
                      <Select 
                        value={String(config.diaEnvio)} 
                        onValueChange={(value) => updateConfigMutation.mutate({ diaEnvio: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {diasSemana.map(dia => (
                            <SelectItem key={dia.value} value={dia.value}>{dia.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Horário de Envio</Label>
                      <Input
                        type="time"
                        value={config.horarioEnvio || "09:00"}
                        onChange={(e) => updateConfigMutation.mutate({ horarioEnvio: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Assunto do Email (Template)</Label>
                    <Input
                      value={config.assuntoTemplate || ""}
                      onChange={(e) => updateConfigMutation.mutate({ assuntoTemplate: e.target.value })}
                      placeholder="Newsletter Ambiental EcoBrasil - Semana {{semana}}"
                    />
                    <p className="text-xs text-gray-500">Use {"{{semana}}"} para inserir o número da semana</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Termos de Busca para Notícias</Label>
                    <Input
                      value={config.termosChave || ""}
                      onChange={(e) => updateConfigMutation.mutate({ termosChave: e.target.value })}
                      placeholder="meio ambiente, legislação ambiental, IBAMA, sustentabilidade"
                    />
                    <p className="text-xs text-gray-500">Separe os termos por vírgula</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Máximo de Notícias por Edição</Label>
                    <Input
                      type="number"
                      min={3}
                      max={20}
                      value={config.maxNoticias || 10}
                      onChange={(e) => updateConfigMutation.mutate({ maxNoticias: parseInt(e.target.value) })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assinantes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Assinantes</CardTitle>
                <CardDescription>Gerenciar lista de destinatários da newsletter</CardDescription>
              </div>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Assinante
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Novo Assinante</DialogTitle>
                    <DialogDescription>Adicione um novo destinatário para a newsletter</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={newAssinante.email}
                        onChange={(e) => setNewAssinante({ ...newAssinante, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={newAssinante.nome}
                        onChange={(e) => setNewAssinante({ ...newAssinante, nome: e.target.value })}
                        placeholder="Nome do assinante"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
                    <Button 
                      onClick={() => addAssinanteMutation.mutate(newAssinante)}
                      disabled={!newAssinante.email || addAssinanteMutation.isPending}
                    >
                      {addAssinanteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {assinantesLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : assinantes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum assinante cadastrado</p>
                  <p className="text-sm">Adicione assinantes para enviar a newsletter</p>
                </div>
              ) : (
                <div className="divide-y">
                  {assinantes.map((assinante) => (
                    <div key={assinante.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${assinante.ativo ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Mail className={`h-5 w-5 ${assinante.ativo ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{assinante.nome || assinante.email}</p>
                          {assinante.nome && <p className="text-sm text-gray-500">{assinante.email}</p>}
                          <p className="text-xs text-gray-400">
                            Cadastrado em {new Date(assinante.criadoEm).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={assinante.ativo ? "default" : "secondary"}>
                          {assinante.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                        <Switch
                          checked={assinante.ativo}
                          onCheckedChange={(ativo) => toggleAssinanteMutation.mutate({ id: assinante.id, ativo })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Remover este assinante?")) {
                              removeAssinanteMutation.mutate(assinante.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edicoes">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Edições</CardTitle>
              <CardDescription>Newsletters enviadas anteriormente</CardDescription>
            </CardHeader>
            <CardContent>
              {edicoesLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : edicoes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma edição enviada ainda</p>
                  <p className="text-sm">As edições aparecerão aqui após o envio</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {edicoes.map((edicao) => (
                    <div key={edicao.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                          <Newspaper className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Edição #{edicao.numero}</p>
                          <p className="text-sm text-gray-500">{edicao.titulo}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {edicao.dataEnvio ? new Date(edicao.dataEnvio).toLocaleDateString('pt-BR') : "-"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {edicao.totalDestinatarios} destinatários
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {Array.isArray(edicao.noticias) ? edicao.noticias.length : 0} notícias
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={edicao.status === "enviado" ? "default" : "secondary"}>
                          {edicao.status === "enviado" ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Enviado</>
                          ) : edicao.status === "rascunho" ? (
                            <><XCircle className="h-3 w-3 mr-1" /> Rascunho</>
                          ) : edicao.status}
                        </Badge>
                        <Dialog open={previewDialogOpen && selectedEdicao?.id === edicao.id} onOpenChange={(open) => {
                          setPreviewDialogOpen(open);
                          if (!open) setSelectedEdicao(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => setSelectedEdicao(edicao)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edição #{edicao.numero}</DialogTitle>
                              <DialogDescription>{edicao.titulo}</DialogDescription>
                            </DialogHeader>
                            {edicao.htmlContent && (
                              <div 
                                className="border rounded-lg overflow-hidden"
                                dangerouslySetInnerHTML={{ __html: edicao.htmlContent }}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
