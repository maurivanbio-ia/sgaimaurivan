import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Loader2
} from "lucide-react";
import { Link } from "wouter";

interface DropboxFile {
  name: string;
  path: string;
  size: number;
  modified: string;
}

interface ConnectionStatus {
  success: boolean;
  accountName?: string;
  error?: string;
}

interface BackupListResult {
  success: boolean;
  files?: DropboxFile[];
  error?: string;
}

export default function DropboxBackupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { data: connectionStatus, isLoading: isTestingConnection, refetch: retestConnection } = useQuery<ConnectionStatus>({
    queryKey: ["/api/dropbox/test"],
    retry: false,
  });

  const { data: backupsList, isLoading: isLoadingBackups, refetch: refetchBackups } = useQuery<BackupListResult>({
    queryKey: ["/api/dropbox/backups"],
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
            Backups no Dropbox
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie seus backups armazenados no Dropbox
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-6">
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ações</CardTitle>
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
            Pasta: /EcoGestor-Backups/
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
                    index === 0 ? 'bg-green-50 border-green-200' : 'bg-muted/30'
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
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Mais recente
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <div className="text-center text-sm text-muted-foreground">
        <p>Os backups são armazenados automaticamente na pasta <strong>/EcoGestor-Backups/</strong> do seu Dropbox.</p>
        <p>Backups com mais de 30 dias são removidos automaticamente durante a limpeza.</p>
      </div>
    </div>
  );
}
