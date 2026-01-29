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
  Newspaper,
  Star,
  Sparkles,
  Image,
  Link as LinkIcon,
  Edit
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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

interface Destaque {
  id: number;
  titulo: string;
  descricao: string;
  descricaoMelhorada: string | null;
  imagemUrl: string | null;
  imagemLegenda: string | null;
  logoClienteUrl: string | null;
  nomeCliente: string | null;
  link: string | null;
  empreendimentoId: number | null;
  ativo: boolean;
  ordem: number;
  unidade: string;
  criadoEm: string;
  atualizadoEm: string;
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
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [selectedEdicao, setSelectedEdicao] = useState<Edicao | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [newAssinante, setNewAssinante] = useState({ email: "", nome: "" });
  const [destaqueDialogOpen, setDestaqueDialogOpen] = useState(false);
  const [editingDestaque, setEditingDestaque] = useState<Destaque | null>(null);
  const [newDestaque, setNewDestaque] = useState({
    titulo: "",
    descricao: "",
    descricaoMelhorada: "",
    imagemUrl: "",
    imagemLegenda: "",
    logoClienteUrl: "",
    nomeCliente: "",
    link: "",
  });
  const [melhorandoTexto, setMelhorandoTexto] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery<NewsletterConfig>({
    queryKey: ["/api/newsletter/config"],
  });

  const { data: assinantes = [], isLoading: assinantesLoading } = useQuery<Assinante[]>({
    queryKey: ["/api/newsletter/assinantes"],
  });

  const { data: edicoes = [], isLoading: edicoesLoading } = useQuery<Edicao[]>({
    queryKey: ["/api/newsletter/edicoes"],
  });

  const { data: destaques = [], isLoading: destaquesLoading } = useQuery<Destaque[]>({
    queryKey: ["/api/newsletter/destaques"],
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

  const deleteEdicaoMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/newsletter/edicoes/${id}`),
    onSuccess: () => {
      toast({ title: "Edição excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/edicoes"] });
    },
    onError: () => {
      toast({ title: "Erro ao excluir edição", variant: "destructive" });
    },
  });

  const generatePreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/newsletter/preview");
      return res.json();
    },
    onSuccess: (data: { html: string }) => {
      setPreviewHtml(data.html);
      setFullPreviewOpen(true);
    },
    onError: () => {
      toast({ title: "Erro ao gerar preview", variant: "destructive" });
    },
  });

  // Mutations para destaques
  const addDestaqueMutation = useMutation({
    mutationFn: (data: typeof newDestaque) => 
      apiRequest("POST", "/api/newsletter/destaques", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/destaques"] });
      setDestaqueDialogOpen(false);
      setNewDestaque({ titulo: "", descricao: "", descricaoMelhorada: "", imagemUrl: "", imagemLegenda: "", logoClienteUrl: "", nomeCliente: "", link: "" });
      toast({ title: "Destaque adicionado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar destaque", variant: "destructive" });
    },
  });

  const updateDestaqueMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Destaque>) => 
      apiRequest("PUT", `/api/newsletter/destaques/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/destaques"] });
      setDestaqueDialogOpen(false);
      setEditingDestaque(null);
      setNewDestaque({ titulo: "", descricao: "", descricaoMelhorada: "", imagemUrl: "", imagemLegenda: "", logoClienteUrl: "", nomeCliente: "", link: "" });
      toast({ title: "Destaque atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar destaque", variant: "destructive" });
    },
  });

  const deleteDestaqueMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/newsletter/destaques/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/destaques"] });
      toast({ title: "Destaque excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir destaque", variant: "destructive" });
    },
  });

  const toggleDestaqueMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("PATCH", `/api/newsletter/destaques/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/newsletter/destaques"] });
    },
    onError: () => {
      toast({ title: "Erro ao alternar destaque", variant: "destructive" });
    },
  });

  const melhorarTexto = async () => {
    if (!newDestaque.descricao.trim()) {
      toast({ title: "Digite uma descrição primeiro", variant: "destructive" });
      return;
    }
    
    setMelhorandoTexto(true);
    try {
      const res = await apiRequest("POST", "/api/newsletter/destaques/melhorar-texto", {
        texto: newDestaque.descricao,
        titulo: newDestaque.titulo,
      });
      const data = await res.json();
      setNewDestaque(prev => ({ ...prev, descricaoMelhorada: data.textoMelhorado }));
      toast({ title: data.fallback ? "Texto mantido (IA indisponível)" : "Texto melhorado com IA!" });
    } catch (error) {
      toast({ title: "Erro ao melhorar texto", variant: "destructive" });
    } finally {
      setMelhorandoTexto(false);
    }
  };

  const assinantesAtivos = assinantes.filter(a => a.ativo).length;
  const destaquesAtivos = destaques.filter(d => d.ativo).length;

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
            onClick={() => generatePreviewMutation.mutate()}
            disabled={generatePreviewMutation.isPending}
          >
            {generatePreviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            Visualizar
          </Button>
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
          <TabsTrigger value="destaques">
            <Star className="h-4 w-4 mr-2" />
            Destaques ({destaquesAtivos})
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

        <TabsContent value="destaques">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Destaques de Projetos</CardTitle>
                <CardDescription>Adicione projetos da EcoBrasil para aparecer na newsletter</CardDescription>
              </div>
              <Dialog open={destaqueDialogOpen} onOpenChange={(open) => {
                setDestaqueDialogOpen(open);
                if (!open) {
                  setEditingDestaque(null);
                  setNewDestaque({ titulo: "", descricao: "", descricaoMelhorada: "", imagemUrl: "", imagemLegenda: "", logoClienteUrl: "", nomeCliente: "", link: "" });
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Destaque
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingDestaque ? "Editar Destaque" : "Novo Destaque de Projeto"}</DialogTitle>
                    <DialogDescription>Adicione informações sobre o projeto. A IA pode melhorar o texto para você.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-2">
                      <Label>Título do Projeto *</Label>
                      <Input
                        placeholder="Ex: Monitoramento Ambiental na Fazenda XYZ"
                        value={newDestaque.titulo}
                        onChange={(e) => setNewDestaque(prev => ({ ...prev, titulo: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Descrição Original *</Label>
                      <Textarea
                        placeholder="Descreva o projeto com suas palavras. Pode ser um resumo simples que a IA vai melhorar."
                        value={newDestaque.descricao}
                        onChange={(e) => setNewDestaque(prev => ({ ...prev, descricao: e.target.value }))}
                        rows={4}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={melhorarTexto}
                        disabled={melhorandoTexto || !newDestaque.descricao.trim()}
                        className="mt-2"
                      >
                        {melhorandoTexto ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Melhorar com IA
                      </Button>
                    </div>

                    {newDestaque.descricaoMelhorada && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-green-600" />
                          Texto Melhorado pela IA
                        </Label>
                        <Textarea
                          value={newDestaque.descricaoMelhorada}
                          onChange={(e) => setNewDestaque(prev => ({ ...prev, descricaoMelhorada: e.target.value }))}
                          rows={4}
                          className="bg-green-50 dark:bg-green-900/20 border-green-200"
                        />
                        <p className="text-xs text-gray-500">Você pode editar o texto melhorado antes de salvar</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Imagem do Projeto (opcional)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={uploadingImage}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            setUploadingImage(true);
                            try {
                              console.log('[Newsletter] Uploading image:', file.name);
                              
                              // Upload direto via FormData
                              const formData = new FormData();
                              formData.append('imagem', file);
                              
                              const uploadResponse = await fetch('/api/newsletter/destaques/imagem/upload', {
                                method: 'POST',
                                body: formData,
                                credentials: 'include'
                              });
                              
                              if (!uploadResponse.ok) {
                                const errorData = await uploadResponse.json();
                                console.error('[Newsletter] Upload failed:', errorData);
                                throw new Error(errorData.error || 'Falha no upload da imagem');
                              }
                              
                              const { filePath } = await uploadResponse.json();
                              console.log('[Newsletter] Image uploaded successfully:', filePath);
                              setNewDestaque(prev => ({ ...prev, imagemUrl: filePath }));
                              toast({ title: "Imagem enviada com sucesso!" });
                            } catch (error) {
                              console.error('[Newsletter] Image upload error:', error);
                              toast({ title: "Erro ao enviar imagem", description: error instanceof Error ? error.message : "Tente novamente", variant: "destructive" });
                            } finally {
                              setUploadingImage(false);
                              e.target.value = '';
                            }
                          }}
                          className="flex-1"
                        />
                        {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-green-600" />}
                      </div>
                      {newDestaque.imagemUrl && (
                        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700 dark:text-green-400 flex-1 truncate">{newDestaque.imagemUrl}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setNewDestaque(prev => ({ ...prev, imagemUrl: "" }))}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Faça upload de uma imagem ou deixe em branco</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Legenda da Imagem (opcional)
                      </Label>
                      <Input
                        placeholder="Ex: Equipe da EcoBrasil em visita técnica ao empreendimento"
                        value={newDestaque.imagemLegenda}
                        onChange={(e) => setNewDestaque(prev => ({ ...prev, imagemLegenda: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500">Descreva brevemente a imagem para os leitores</p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Image className="h-4 w-4" />
                        <span className="font-medium">Logo do Cliente (opcional)</span>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Nome da Empresa Cliente</Label>
                        <Input
                          placeholder="Ex: Norte Energia S.A."
                          value={newDestaque.nomeCliente}
                          onChange={(e) => setNewDestaque(prev => ({ ...prev, nomeCliente: e.target.value }))}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Logo do Cliente</Label>
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            disabled={uploadingLogo}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              setUploadingLogo(true);
                              try {
                                console.log('[Newsletter] Uploading logo:', file.name);
                                
                                // Upload direto via FormData
                                const formData = new FormData();
                                formData.append('imagem', file);
                                
                                const uploadResponse = await fetch('/api/newsletter/destaques/imagem/upload', {
                                  method: 'POST',
                                  body: formData,
                                  credentials: 'include'
                                });
                                
                                if (!uploadResponse.ok) {
                                  const errorData = await uploadResponse.json();
                                  console.error('[Newsletter] Logo upload failed:', errorData);
                                  throw new Error(errorData.error || 'Falha no upload do logo');
                                }
                                
                                const { filePath } = await uploadResponse.json();
                                console.log('[Newsletter] Logo uploaded successfully:', filePath);
                                setNewDestaque(prev => ({ ...prev, logoClienteUrl: filePath }));
                                toast({ title: "Logo enviado com sucesso!" });
                              } catch (error) {
                                console.error('[Newsletter] Logo upload error:', error);
                                toast({ title: "Erro ao enviar logo", description: error instanceof Error ? error.message : "Tente novamente", variant: "destructive" });
                              } finally {
                                setUploadingLogo(false);
                                e.target.value = '';
                              }
                            }}
                            className="flex-1"
                          />
                          {uploadingLogo && <Loader2 className="h-5 w-5 animate-spin text-slate-600" />}
                        </div>
                        {newDestaque.logoClienteUrl && (
                          <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{newDestaque.logoClienteUrl}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setNewDestaque(prev => ({ ...prev, logoClienteUrl: "" }))}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">A logo aparecerá de forma discreta no canto do card</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Link para mais informações (opcional)
                      </Label>
                      <Input
                        placeholder="https://ecobrasil.bio.br/projetos/xyz"
                        value={newDestaque.link}
                        onChange={(e) => setNewDestaque(prev => ({ ...prev, link: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDestaqueDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={!newDestaque.titulo.trim() || !newDestaque.descricao.trim() || uploadingImage || uploadingLogo || addDestaqueMutation.isPending || updateDestaqueMutation.isPending}
                      onClick={() => {
                        if (editingDestaque) {
                          updateDestaqueMutation.mutate({
                            id: editingDestaque.id,
                            titulo: newDestaque.titulo,
                            descricao: newDestaque.descricao,
                            descricaoMelhorada: newDestaque.descricaoMelhorada || null,
                            imagemUrl: newDestaque.imagemUrl || null,
                            imagemLegenda: newDestaque.imagemLegenda || null,
                            logoClienteUrl: newDestaque.logoClienteUrl || null,
                            nomeCliente: newDestaque.nomeCliente || null,
                            link: newDestaque.link || null,
                          });
                        } else {
                          addDestaqueMutation.mutate(newDestaque);
                        }
                      }}
                    >
                      {(addDestaqueMutation.isPending || updateDestaqueMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingDestaque ? "Atualizar" : "Adicionar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {destaquesLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : destaques.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum destaque cadastrado</p>
                  <p className="text-sm">Adicione projetos para destacar na próxima newsletter</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {destaques.map((destaque) => (
                    <div
                      key={destaque.id}
                      className={`p-4 rounded-lg border ${destaque.ativo ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-gray-50 dark:bg-gray-800 border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-lg">{destaque.titulo}</h4>
                            <Badge variant={destaque.ativo ? "default" : "secondary"} className={destaque.ativo ? "bg-green-600" : ""}>
                              {destaque.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {destaque.descricaoMelhorada || destaque.descricao}
                          </p>
                          {destaque.imagemUrl && (
                            <p className="text-xs text-blue-600 flex items-center gap-1">
                              <Image className="h-3 w-3" /> Imagem anexada
                            </p>
                          )}
                          {destaque.link && (
                            <a href={destaque.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                              <LinkIcon className="h-3 w-3" /> {destaque.link}
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={destaque.ativo}
                            onCheckedChange={() => toggleDestaqueMutation.mutate(destaque.id)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingDestaque(destaque);
                              setNewDestaque({
                                titulo: destaque.titulo,
                                descricao: destaque.descricao,
                                descricaoMelhorada: destaque.descricaoMelhorada || "",
                                imagemUrl: destaque.imagemUrl || "",
                                imagemLegenda: destaque.imagemLegenda || "",
                                logoClienteUrl: destaque.logoClienteUrl || "",
                                nomeCliente: destaque.nomeCliente || "",
                                link: destaque.link || "",
                              });
                              setDestaqueDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={() => {
                              if (confirm(`Deseja excluir o destaque "${destaque.titulo}"?`)) {
                                deleteDestaqueMutation.mutate(destaque.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          onClick={() => {
                            if (confirm(`Deseja excluir a Edição #${edicao.numero}?`)) {
                              deleteEdicaoMutation.mutate(edicao.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Preview Completo */}
      <Dialog open={fullPreviewOpen} onOpenChange={setFullPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview da Newsletter
            </DialogTitle>
            <DialogDescription>
              Visualize como a newsletter será exibida antes de enviar
            </DialogDescription>
          </DialogHeader>
          {previewHtml ? (
            <div 
              className="border rounded-lg overflow-hidden bg-white"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setFullPreviewOpen(false)}>
              Fechar
            </Button>
            <Button 
              onClick={() => {
                const email = prompt("Digite o email para enviar teste:");
                if (email) {
                  sendTestMutation.mutate(email);
                  setFullPreviewOpen(false);
                }
              }}
              disabled={sendTestMutation.isPending}
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
