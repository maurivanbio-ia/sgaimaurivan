import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
  Globe,
  MessageSquare,
  Edit,
  ExternalLink,
  Send,
  Upload,
  Image,
  Link2,
  Lock,
  Unlock
} from "lucide-react";

interface BlogArtigo {
  id: number;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  conteudo: string;
  tipo: string;
  status: string;
  autorNome: string | null;
  visualizacoes: number;
  curtidas: number;
  publicadoEm: string | null;
  criadoEm: string;
}

interface Comentario {
  id: number;
  artigoId: number;
  autorNome: string;
  conteudo: string;
  aprovado: boolean;
  criadoEm: string;
}

const tipoOptions = [
  { value: "projeto", label: "Projeto" },
  { value: "tecnico", label: "Artigo Técnico" },
  { value: "comunicado", label: "Comunicado" },
  { value: "noticia", label: "Notícia" },
];

const statusColors: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-700",
  publicado: "bg-green-100 text-green-700",
};

export default function BlogAdminPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedArtigo, setSelectedArtigo] = useState<BlogArtigo | null>(null);
  const [newArticle, setNewArticle] = useState({
    titulo: "",
    descricao: "",
    tipo: "projeto",
    imagemCapaUrl: "",
  });
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Access control states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Check access status on mount
  const { data: unlockStatus, isLoading: checkingAccess } = useQuery<{ unlocked: boolean; hasRole: boolean }>({
    queryKey: ["/api/blog/unlock-status"],
  });

  useEffect(() => {
    if (unlockStatus) {
      setIsUnlocked(unlockStatus.unlocked);
      if (!unlockStatus.unlocked) {
        setUnlockDialogOpen(true);
      }
    }
  }, [unlockStatus]);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      const res = await apiRequest("POST", "/api/blog/unlock", { senha: unlockPassword });
      const data = await res.json();
      if (data.success) {
        setIsUnlocked(true);
        setUnlockDialogOpen(false);
        setUnlockPassword("");
        toast({ title: "Acesso liberado!" });
        queryClient.invalidateQueries({ queryKey: ["/api/blog/unlock-status"] });
      } else {
        toast({ title: data.message || "Senha incorreta", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro ao desbloquear", variant: "destructive" });
    } finally {
      setIsUnlocking(false);
    }
  };

  const { data: artigos = [], isLoading } = useQuery<BlogArtigo[]>({
    queryKey: ["/api/blog"],
    enabled: isUnlocked,
  });

  const { data: comentariosPendentes = [] } = useQuery<(Comentario & { artigoTitulo: string })[]>({
    queryKey: ["/api/blog/comentarios-pendentes"],
    enabled: isUnlocked,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return newArticle.imagemCapaUrl || null;
    
    setIsUploading(true);
    try {
      // Get presigned URL
      const urlResponse = await apiRequest("POST", "/api/blog/upload-imagem", {
        name: selectedFile.name,
        contentType: selectedFile.type,
      });
      const { uploadURL, publicUrl } = await urlResponse.json();
      
      // Upload file directly to Object Storage
      await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });
      
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: "Erro ao fazer upload da imagem", variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (publishImmediately: boolean) => {
      // Upload image first if selected
      let imagemCapaUrl = newArticle.imagemCapaUrl;
      if (imageMode === "upload" && selectedFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imagemCapaUrl = uploadedUrl;
        }
      }
      
      const endpoint = publishImmediately ? "/api/blog/criar-e-publicar" : "/api/blog";
      const res = await apiRequest("POST", endpoint, { ...newArticle, imagemCapaUrl });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Artigo criado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      setCreateDialogOpen(false);
      setNewArticle({ titulo: "", descricao: "", tipo: "projeto", imagemCapaUrl: "" });
      setSelectedFile(null);
      setImagePreview(null);
    },
    onError: (error: Error) => {
      console.error("Erro ao criar artigo:", error);
      toast({ 
        title: "Erro ao criar artigo", 
        description: error?.message || "Verifique os logs para mais detalhes",
        variant: "destructive" 
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/blog/${id}/publicar`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Artigo publicado!" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
    },
    onError: () => {
      toast({ title: "Erro ao publicar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/blog/${id}`),
    onSuccess: () => {
      toast({ title: "Artigo excluído" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
    },
    onError: () => {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    },
  });

  const approveCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/blog/comentarios/${id}/aprovar`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Comentário aprovado" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/comentarios-pendentes"] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/blog/comentarios/${id}`),
    onSuccess: () => {
      toast({ title: "Comentário excluído" });
      queryClient.invalidateQueries({ queryKey: ["/api/blog/comentarios-pendentes"] });
    },
  });

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  // Show loading state while checking access
  if (checkingAccess) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <span className="ml-2 text-gray-600">Verificando acesso...</span>
        </div>
      </div>
    );
  }

  // Show unlock dialog when not unlocked
  if (!isUnlocked) {
    return (
      <div className="container mx-auto p-6">
        <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Acesso Restrito
              </DialogTitle>
              <DialogDescription>
                Para gerenciar o Blog Institucional, digite a senha de administrador.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Senha de Administrador</Label>
                <Input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Digite a senha..."
                  onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => window.history.back()}>
                Cancelar
              </Button>
              <Button 
                onClick={handleUnlock} 
                disabled={isUnlocking || !unlockPassword}
                className="bg-green-600 hover:bg-green-700"
              >
                {isUnlocking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Desbloquear
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex flex-col items-center justify-center h-64">
          <Lock className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Blog Institucional</h2>
          <p className="text-gray-500 mt-2">Acesso restrito. Por favor, digite a senha de administrador.</p>
          <Button 
            className="mt-4 bg-green-600 hover:bg-green-700" 
            onClick={() => setUnlockDialogOpen(true)}
          >
            <Unlock className="h-4 w-4 mr-2" />
            Desbloquear Acesso
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <Globe className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Blog Institucional</h1>
            <p className="text-gray-500 dark:text-gray-400">Gerencie artigos e publicações da EcoBrasil</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open("/blog", "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver Blog
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Novo Artigo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  Criar Artigo com IA
                </DialogTitle>
                <DialogDescription>
                  Preencha as informações básicas e a IA gerará o conteúdo completo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título do Projeto/Tema</Label>
                  <Input
                    value={newArticle.titulo}
                    onChange={(e) => setNewArticle({ ...newArticle, titulo: e.target.value })}
                    placeholder="Ex: Monitoramento de Quelônios no Rio São Francisco"
                  />
                </div>
                <div>
                  <Label>Descrição/Contexto</Label>
                  <Textarea
                    value={newArticle.descricao}
                    onChange={(e) => setNewArticle({ ...newArticle, descricao: e.target.value })}
                    placeholder="Descreva o projeto, resultados alcançados, metodologia utilizada..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Tipo de Publicação</Label>
                  <Select
                    value={newArticle.tipo}
                    onValueChange={(v) => setNewArticle({ ...newArticle, tipo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block">Imagem de Capa (opcional)</Label>
                  <div className="flex gap-2 mb-3">
                    <Button
                      type="button"
                      variant={imageMode === "upload" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImageMode("upload")}
                      className={imageMode === "upload" ? "bg-[#0099A8] hover:bg-[#038EA1]" : ""}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                    <Button
                      type="button"
                      variant={imageMode === "url" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setImageMode("url")}
                      className={imageMode === "url" ? "bg-[#0099A8] hover:bg-[#038EA1]" : ""}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      URL
                    </Button>
                  </div>
                  
                  {imageMode === "upload" ? (
                    <div className="space-y-3">
                      <div 
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-[#0099A8] transition-colors"
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        {imagePreview ? (
                          <div className="relative">
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="max-h-40 mx-auto rounded-lg object-cover"
                            />
                            <p className="text-sm text-gray-500 mt-2">{selectedFile?.name}</p>
                          </div>
                        ) : (
                          <div className="py-4">
                            <Image className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500">
                              Clique para selecionar uma imagem
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              JPG, PNG ou WebP
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                  ) : (
                    <Input
                      value={newArticle.imagemCapaUrl}
                      onChange={(e) => setNewArticle({ ...newArticle, imagemCapaUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  )}
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => createMutation.mutate(false)}
                  disabled={!newArticle.titulo || !newArticle.descricao || createMutation.isPending || isUploading}
                >
                  {(createMutation.isPending || isUploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isUploading ? "Enviando imagem..." : "Salvar Rascunho"}
                </Button>
                <Button
                  onClick={() => createMutation.mutate(true)}
                  disabled={!newArticle.titulo || !newArticle.descricao || createMutation.isPending || isUploading}
                  className="bg-[#0099A8] hover:bg-[#038EA1]"
                >
                  {(createMutation.isPending || isUploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {isUploading ? "Enviando..." : "Criar e Publicar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{artigos.length}</p>
                <p className="text-sm text-gray-500">Total de Artigos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{artigos.filter(a => a.status === "publicado").length}</p>
                <p className="text-sm text-gray-500">Publicados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <Edit className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{artigos.filter(a => a.status === "rascunho").length}</p>
                <p className="text-sm text-gray-500">Rascunhos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <MessageSquare className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{comentariosPendentes.length}</p>
                <p className="text-sm text-gray-500">Comentários Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="artigos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="artigos">Artigos</TabsTrigger>
          <TabsTrigger value="comentarios">
            Comentários
            {comentariosPendentes.length > 0 && (
              <Badge variant="destructive" className="ml-2">{comentariosPendentes.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artigos">
          <Card>
            <CardHeader>
              <CardTitle>Artigos do Blog</CardTitle>
              <CardDescription>Gerencie todas as publicações</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : artigos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum artigo ainda. Clique em "Novo Artigo" para começar.
                </div>
              ) : (
                <div className="space-y-3">
                  {artigos.map((artigo) => (
                    <div key={artigo.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{artigo.titulo}</h4>
                          <Badge className={statusColors[artigo.status]}>
                            {artigo.status === "publicado" ? "Publicado" : "Rascunho"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{formatDate(artigo.publicadoEm || artigo.criadoEm)}</span>
                          <span>{artigo.visualizacoes} visualizações</span>
                          <span>{artigo.curtidas} curtidas</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {artigo.status === "publicado" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/blog/${artigo.slug}`, "_blank")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {artigo.status === "rascunho" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => publishMutation.mutate(artigo.id)}
                            disabled={publishMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Publicar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm("Deseja excluir este artigo?")) {
                              deleteMutation.mutate(artigo.id);
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

        <TabsContent value="comentarios">
          <Card>
            <CardHeader>
              <CardTitle>Moderação de Comentários</CardTitle>
              <CardDescription>Aprove ou exclua comentários dos leitores</CardDescription>
            </CardHeader>
            <CardContent>
              {comentariosPendentes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum comentário pendente de aprovação.
                </div>
              ) : (
                <div className="space-y-3">
                  {comentariosPendentes.map((comentario) => (
                    <div key={comentario.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{comentario.autorNome}</span>
                            <span className="text-sm text-gray-500">{formatDate(comentario.criadoEm)}</span>
                          </div>
                          <span className="text-xs text-gray-400">Artigo: {comentario.artigoTitulo}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveCommentMutation.mutate(comentario.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500"
                            onClick={() => deleteCommentMutation.mutate(comentario.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{comentario.conteudo}</p>
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
