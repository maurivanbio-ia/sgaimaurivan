import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Cloud,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Trash2,
  FileJson,
  Calendar,
  HardDrive,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Database,
  Play,
  AlertCircle,
  Lock,
} from "lucide-react";

interface BackupFile {
  key: string;
  lastModified: string | null;
  size: number;
}

interface TriggerResult {
  success: boolean;
  timestamp?: string;
  tables?: Record<string, number>;
  filePath?: string;
  error?: string;
}

export default function BackupsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { data: backups, isLoading, refetch } = useQuery<BackupFile[]>({
    queryKey: ["/api/backups"],
    retry: 1,
  });

  const triggerMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/backups/trigger", { adminPassword: password });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Erro ao executar backup");
      }
      return response.json() as Promise<TriggerResult>;
    },
    onSuccess: (data) => {
      if (data.success) {
        const totalRecords = data.tables ? Object.values(data.tables).reduce((a, b) => a + b, 0) : 0;
        toast({
          title: "Backup realizado com sucesso!",
          description: `${totalRecords.toLocaleString()} registros salvos em ${data.timestamp}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
        setShowPasswordDialog(false);
        setAdminPassword("");
        setPasswordError("");
      } else {
        toast({
          title: "Erro ao realizar backup",
          description: data.error || "Tente novamente",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const msg = error.message || "Falha ao executar backup";
      if (msg.includes("Senha") || msg.includes("password") || msg.includes("incorreta")) {
        setPasswordError("Senha de administrador incorreta. Tente novamente.");
      } else {
        toast({
          title: "Erro",
          description: msg,
          variant: "destructive",
        });
        setShowPasswordDialog(false);
      }
    },
  });

  const handleBackupConfirm = () => {
    if (!adminPassword.trim()) {
      setPasswordError("Digite a senha de administrador.");
      return;
    }
    setPasswordError("");
    triggerMutation.mutate(adminPassword);
  };

  const handleDownload = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const response = await apiRequest("GET", `/api/backups/${fileName}`);
      if (!response.ok) {
        throw new Error("Falha ao baixar arquivo");
      }
      const content = await response.text();
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado", description: fileName });
    } catch (error: any) {
      toast({
        title: "Erro no download",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Data desconhecida";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFileNameFromKey = (key: string) => {
    return key.split("/").pop() || key;
  };

  const totalSize = (backups || []).reduce((acc, f) => acc + f.size, 0);
  const latestBackup = backups?.[0];

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center gap-4 mb-6">
        <a href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </a>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            Backup e Segurança de Dados
          </h1>
          <p className="text-muted-foreground text-sm">
            Backups automáticos diários do banco de dados — armazenados com segurança
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-green-600 text-sm">Ativo</p>
                <p className="text-xs text-muted-foreground">Backup diário 00:00</p>
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
              <span className="text-2xl font-bold">{isLoading ? "..." : (backups?.length || 0)}</span>
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
              <span className="text-2xl font-bold">{isLoading ? "..." : formatFileSize(totalSize)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Último Backup</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-500" />
              <p className="text-xs font-medium">
                {isLoading ? "..." : (latestBackup ? formatDate(latestBackup.lastModified) : "Nenhum ainda")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Ações de Backup
          </CardTitle>
          <CardDescription>
            Os backups incluem todos os dados do sistema: licenças, contratos, usuários, documentos e muito mais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => { setAdminPassword(""); setPasswordError(""); setShowPasswordDialog(true); }}
              disabled={triggerMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {triggerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {triggerMutation.isPending ? "Executando backup..." : "Executar Backup Agora"}
            </Button>

            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar Lista
            </Button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium">Backup automático configurado</p>
                <p className="text-xs mt-1">
                  O sistema realiza backup automático todo dia às 00:00 (horário de Brasília). 
                  Os arquivos são mantidos por 30 dias. Quando o Dropbox estiver conectado, 
                  os backups também são sincronizados automaticamente.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backups Disponíveis</CardTitle>
          <CardDescription>
            Clique em "Baixar" para fazer download de qualquer backup para o seu computador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando backups...</span>
            </div>
          ) : !backups || backups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Cloud className="h-16 w-16 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhum backup encontrado</p>
              <p className="text-sm mt-1">Clique em "Executar Backup Agora" para criar o primeiro backup</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((file, index) => {
                const fileName = getFileNameFromKey(file.key);
                const isDownloading = downloadingFile === fileName;
                return (
                  <div
                    key={file.key}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      index === 0
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileJson className={`h-5 w-5 flex-shrink-0 ${index === 0 ? "text-green-600" : "text-blue-500"}`} />
                      <div>
                        <p className="font-medium text-sm">{fileName}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(file.lastModified)}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Mais recente
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(fileName)}
                        disabled={isDownloading}
                        className="gap-1"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Baixar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Cloud className="h-5 w-5" />
            Sincronização com Dropbox
          </CardTitle>
          <CardDescription>
            Conecte o Dropbox para sincronizar backups automaticamente na nuvem toda semana
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <XCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400 text-sm">Dropbox não conectado</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Para ativar a sincronização automática semanal com o Dropbox, acesse o painel do Replit → 
                Tools → Connectors → Dropbox e faça login com sua conta.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Password Dialog for Backup */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setAdminPassword(""); setPasswordError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Confirmação de Backup
            </DialogTitle>
            <DialogDescription>
              Por segurança, informe a senha de administrador para executar o backup manual do banco de dados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Senha de Administrador</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Digite a senha de administrador"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleBackupConfirm(); }}
                noNormalize
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  {passwordError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setAdminPassword(""); setPasswordError(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleBackupConfirm}
              disabled={triggerMutation.isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {triggerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {triggerMutation.isPending ? "Executando..." : "Confirmar Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
