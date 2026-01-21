import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Cloud, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Upload, 
  Trash2, 
  FileJson, 
  Calendar,
  HardDrive,
  ArrowLeft,
  Loader2,
  FolderOpen,
  Folder,
  File,
  FolderSync,
  ChevronRight,
  Home,
  AlertCircle,
  Mail
} from "lucide-react";
import { Link } from "wouter";

interface DropboxFile {
  name: string;
  path: string;
  size: number;
  modified: string;
}

interface DropboxEntry {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size?: number;
  modified?: string;
}

interface ConnectionStatus {
  success: boolean;
  accountName?: string;
  email?: string;
  error?: string;
}

interface BackupListResult {
  success: boolean;
  files?: DropboxFile[];
  error?: string;
}

interface FolderListResult {
  success: boolean;
  entries?: DropboxEntry[];
  error?: string;
}

export default function DropboxBackupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  const { data: connectionStatus, isLoading: isTestingConnection, refetch: retestConnection } = useQuery<ConnectionStatus>({
    queryKey: ["/api/dropbox/test"],
    retry: false,
  });

  const { data: backupsList, isLoading: isLoadingBackups, refetch: refetchBackups } = useQuery<BackupListResult>({
    queryKey: ["/api/dropbox/backups"],
    enabled: connectionStatus?.success === true,
    retry: false,
  });

  const { data: folderContents, isLoading: isLoadingFolders, refetch: refetchFolders } = useQuery<FolderListResult>({
    queryKey: ["/api/dropbox/folders", currentPath],
    enabled: connectionStatus?.success === true,
    retry: false,
  });

  const uploadBackupMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      const response = await apiRequest("POST", "/api/dropbox/backup");
      return response.json();
    },
    onSuccess: (data) => {
      setIsUploading(false);
      if (data.success) {
        toast({
          title: "Backup enviado!",
          description: `Arquivo salvo em: ${data.dropboxPath}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/dropbox/backups"] });
      } else {
        toast({
          title: "Erro ao enviar backup",
          description: data.error || "Tente novamente",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast({
        title: "Erro",
        description: error.message || "Falha ao enviar backup",
        variant: "destructive",
      });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/dropbox/cleanup?days=30");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Limpeza concluída",
          description: `${data.deleted} arquivo(s) removido(s)`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/dropbox/backups"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha na limpeza",
        variant: "destructive",
      });
    },
  });

  const initFoldersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dropbox/folders/init");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Estrutura criada!",
          description: `${data.foldersCreated} pastas criadas no Dropbox`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/dropbox/folders"] });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha ao criar estrutura",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar estrutura",
        variant: "destructive",
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dropbox/folders/sync-all");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Sincronização concluída!",
          description: `${data.synced} empreendimentos sincronizados, ${data.errors} erros`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/dropbox/folders"] });
      } else {
        toast({
          title: "Erro",
          description: data.error || "Falha na sincronização",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha na sincronização",
        variant: "destructive",
      });
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const navigateToFolder = (path: string) => {
    setCurrentPath(path);
    queryClient.invalidateQueries({ queryKey: ["/api/dropbox/folders", path] });
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    const newPath = parts.length > 0 ? '/' + parts.join('/') : '';
    setCurrentPath(newPath);
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(p => p);
  };

  const totalSize = backupsList?.files?.reduce((acc, file) => acc + file.size, 0) || 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-blue-500" />
            Dropbox - Gestão de Arquivos
          </h1>
          <p className="text-muted-foreground text-sm">
            Backups e estrutura de pastas sincronizada com o Dropbox
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status da Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            {isTestingConnection ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="text-sm">Verificando...</span>
              </div>
            ) : connectionStatus?.success ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-600">Conectado</p>
                  <p className="text-xs text-muted-foreground">{connectionStatus.accountName}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-600">Desconectado</p>
                  <p className="text-xs text-muted-foreground">{connectionStatus?.error || "Verifique a conexão"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conta Vinculada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-sm truncate">
                  {connectionStatus?.email || 'Não conectado'}
                </p>
                {connectionStatus?.email !== 'maurivan.bio@gmail.com' && connectionStatus?.success && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Reconectar para maurivan.bio
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Backups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{backupsList?.files?.length || 0}</span>
              <span className="text-sm text-muted-foreground">arquivos</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Espaço Utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">{formatFileSize(totalSize)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="folders" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="folders" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Estrutura de Pastas
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2">
            <Cloud className="h-4 w-4" />
            Backups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="folders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ações de Sincronização</CardTitle>
              <CardDescription>
                Sincronize a estrutura de pastas da plataforma com o Dropbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => initFoldersMutation.mutate()}
                  disabled={!connectionStatus?.success || initFoldersMutation.isPending}
                  className="gap-2"
                >
                  {initFoldersMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                  Criar Estrutura Institucional
                </Button>

                <Button
                  onClick={() => syncAllMutation.mutate()}
                  disabled={!connectionStatus?.success || syncAllMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  {syncAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderSync className="h-4 w-4" />
                  )}
                  Sincronizar Todos Empreendimentos
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => refetchFolders()}
                  disabled={isLoadingFolders}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingFolders ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Navegador de Pastas</CardTitle>
                  <CardDescription>
                    Pasta raiz: /ECOBRASIL_CONSULTORIA_AMBIENTAL/
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-sm mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => navigateToFolder('')}
                >
                  <Home className="h-3 w-3 mr-1" />
                  ECOBRASIL
                </Button>
                {getBreadcrumbs().map((crumb, index) => (
                  <span key={index} className="flex items-center">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => {
                        const pathParts = getBreadcrumbs().slice(0, index + 1);
                        navigateToFolder('/' + pathParts.join('/'));
                      }}
                    >
                      {crumb}
                    </Button>
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingFolders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !connectionStatus?.success ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Conecte ao Dropbox para ver as pastas</p>
                </div>
              ) : folderContents?.entries?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Pasta vazia</p>
                  <p className="text-sm">Clique em "Criar Estrutura Institucional" para começar</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {currentPath && (
                    <div
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={navigateUp}
                    >
                      <Folder className="h-5 w-5 text-amber-500" />
                      <span className="font-medium text-sm">..</span>
                      <span className="text-xs text-muted-foreground">(voltar)</span>
                    </div>
                  )}
                  {folderContents?.entries?.map((entry) => (
                    <div
                      key={entry.path}
                      className={`flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 ${
                        entry.type === 'folder' ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => {
                        if (entry.type === 'folder') {
                          const relativePath = entry.path.replace('/ECOBRASIL_CONSULTORIA_AMBIENTAL', '');
                          navigateToFolder(relativePath);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {entry.type === 'folder' ? (
                          <Folder className="h-5 w-5 text-amber-500" />
                        ) : (
                          <File className="h-5 w-5 text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{entry.name}</p>
                          {entry.type === 'file' && entry.modified && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatDate(entry.modified)}</span>
                              {entry.size && <span>{formatFileSize(entry.size)}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      {entry.type === 'folder' && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ações de Backup</CardTitle>
              <CardDescription>Gerencie seus backups no Dropbox</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => uploadBackupMutation.mutate()}
                  disabled={!connectionStatus?.success || isUploading}
                  className="gap-2"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploading ? "Enviando..." : "Criar e Enviar Backup"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    retestConnection();
                    refetchBackups();
                  }}
                  disabled={isTestingConnection || isLoadingBackups}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isTestingConnection || isLoadingBackups ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => cleanupMutation.mutate()}
                  disabled={!connectionStatus?.success || cleanupMutation.isPending || (backupsList?.files?.length || 0) === 0}
                  className="gap-2"
                >
                  {cleanupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Limpar Antigos (+30 dias)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backups Armazenados</CardTitle>
              <CardDescription>
                Pasta: /EcoGestor/BACKUPS/
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBackups ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !connectionStatus?.success ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Conecte ao Dropbox para ver os backups</p>
                </div>
              ) : backupsList?.files?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Cloud className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum backup encontrado</p>
                  <p className="text-sm">Clique em "Criar e Enviar Backup" para começar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backupsList?.files?.map((file, index) => (
                    <div
                      key={file.path}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        index === 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileJson className={`h-5 w-5 ${index === 0 ? 'text-green-600' : 'text-blue-500'}`} />
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(file.modified)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" />
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {index === 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Mais recente
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator className="my-6" />

      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>
          <strong>Estrutura de Pastas:</strong> Todos os arquivos são organizados em <strong>/ECOBRASIL_CONSULTORIA_AMBIENTAL/</strong> no seu Dropbox.
        </p>
        <p>
          Cada empreendimento tem sua própria pasta em <strong>/03_PROJETOS/</strong> com subpastas padronizadas (Gestão, Relatórios, Mapas, etc.).
        </p>
        <p className="text-amber-600 dark:text-amber-400">
          Para trocar a conta do Dropbox para maurivan.bio@gmail.com, clique em "Dropbox" nas integrações do Replit e reconecte com a conta desejada.
        </p>
      </div>
    </div>
  );
}
