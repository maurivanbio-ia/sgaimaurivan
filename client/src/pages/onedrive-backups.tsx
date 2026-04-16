import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Cloud, CheckCircle, CheckCircle2, XCircle, RefreshCw, Download, FileJson,
  Calendar, HardDrive, ArrowLeft, Loader2, ShieldCheck, Database, Play,
  AlertCircle, Lock, FolderOpen, Upload, User, FileUp, RotateCcw,
  FolderSync, Clock, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Types ──────────────────────────────────────────────────────────────────
interface BackupFile { key: string; lastModified: string | null; size: number; }
interface TriggerResult { success: boolean; timestamp?: string; tables?: Record<string, number>; filePath?: string; error?: string; }
interface SyncStatus { total: number; synced: number; pending: number; errors: number; lastSyncAt: string | null; }
interface SyncLogEntry {
  id: number; arquivoId: number | null; arquivoNome: string; arquivoOrigem: string | null;
  dropboxPath: string | null; status: string; errorMessage: string | null;
  fileSize: number | null; syncedAt: string | null; criadoEm: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "Data desconhecida";
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "synced") return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Sincronizado</Badge>;
  if (status === "error") return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BackupDropboxPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Backup state
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: backups, isLoading: loadingBackups, refetch: refetchBackups } = useQuery<BackupFile[]>({
    queryKey: ["/api/backups"], retry: 1,
  });

  const { data: dropboxConn, isLoading: checkingConn, refetch: refetchConn } = useQuery<{
    success: boolean; accountName?: string; email?: string; backupFolder?: string; error?: string;
  }>({ queryKey: ["/api/dropbox/test"], retry: false, staleTime: 5 * 60 * 1000 });

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/dropbox/sync-status"],
    refetchInterval: isSyncing ? 3000 : 30000,
  });

  const { data: syncLog, isLoading: loadingLog } = useQuery<SyncLogEntry[]>({
    queryKey: ["/api/dropbox/sync-log"],
    refetchInterval: isSyncing ? 3000 : 60000,
  });

  // ── Backup mutations ─────────────────────────────────────────────────────
  const triggerMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/backups/trigger", { adminPassword: password });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Erro ao executar backup"); }
      return response.json() as Promise<TriggerResult>;
    },
    onSuccess: (data) => {
      if (data.success) {
        const totalRecords = data.tables ? Object.values(data.tables).reduce((a, b) => a + b, 0) : 0;
        toast({ title: "Backup realizado com sucesso!", description: `${totalRecords.toLocaleString()} registros salvos` });
        void queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
        setShowPasswordDialog(false); setAdminPassword(""); setPasswordError("");
      } else {
        toast({ title: "Erro ao realizar backup", description: data.error, variant: "destructive" });
      }
    },
    onError: (error: unknown) => {
      const msg = error.message || "Falha ao executar backup";
      if (msg.includes("Senha") || msg.includes("password") || msg.includes("incorreta")) {
        setPasswordError("Senha incorreta. Tente novamente.");
      } else {
        toast({ title: "Erro", description: msg, variant: "destructive" });
        setShowPasswordDialog(false);
      }
    },
  });

  const dropboxBackupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dropbox/backup", {});
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Erro"); }
      return response.json();
    },
    onSuccess: (data) => toast({ title: "Backup enviado ao Dropbox!", description: data.dropboxPath ? `Salvo em: ${data.dropboxPath}` : "Enviado com sucesso" }),
    onError: (err: unknown) => toast({ title: "Erro ao enviar para Dropbox", description: err.message, variant: "destructive" }),
  });

  const handleDownload = async (fileName: string) => {
    setDownloadingFile(fileName);
    try {
      const response = await apiRequest("GET", `/api/backups/${fileName}`);
      if (!response.ok) throw new Error("Falha ao baixar arquivo");
      const content = await response.text();
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado", description: fileName });
    } catch (error: any) {
      toast({ title: "Erro no download", description: error.message, variant: "destructive" });
    } finally { setDownloadingFile(null); }
  };

  // ── Sync mutations ───────────────────────────────────────────────────────
  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dropbox/sync-files"),
    onSuccess: () => {
      setIsSyncing(true);
      toast({ title: "Sincronização iniciada", description: "Os arquivos estão sendo enviados ao Dropbox em segundo plano." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-status"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-log"] });
        setIsSyncing(false);
      }, 10000);
    },
    onError: (err: any) => toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dropbox/sync-retry"),
    onSuccess: (data: unknown) => {
      toast({ title: "Reprocessamento concluído", description: `${data.success} de ${data.retried} arquivos recuperados.` });
      queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-log"] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const foldersMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dropbox/folders/sync-all"),
    onSuccess: (data: any) => toast({ title: "Pastas criadas", description: `${data.synced} empreendimentos sincronizados no Dropbox.` }),
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // ── Computed ─────────────────────────────────────────────────────────────
  const totalSize = (backups || []).reduce((acc, f) => acc + f.size, 0);
  const latestBackup = backups?.[0];
  const syncPercent = syncStatus && syncStatus.total > 0 ? Math.round((syncStatus.synced / syncStatus.total) * 100) : 0;
  const recentLog = syncLog?.slice(0, 50) || [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <a href="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></a>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-600" />
            Backup e Sincronização Dropbox
          </h1>
          <p className="text-muted-foreground text-sm">
            Backups automáticos do banco + sincronização de arquivos com o Dropbox
          </p>
        </div>
      </div>

      {/* Connection Status Bar */}
      <Card className={`mb-5 border ${dropboxConn?.success ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10" : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10"}`}>
        <CardContent className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${dropboxConn?.success ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
            <span className="text-sm font-medium">
              {checkingConn ? "Verificando conexão..." : dropboxConn?.success
                ? `Dropbox conectado — ${dropboxConn.accountName || ""} ${dropboxConn.email ? `(${dropboxConn.email})` : ""}`
                : "Dropbox não conectado"}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchConn()} disabled={checkingConn}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${checkingConn ? "animate-spin" : ""}`} />
            Testar
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="backup">
        <TabsList className="mb-5 w-full">
          <TabsTrigger value="backup" className="flex-1 gap-2">
            <Database className="w-4 h-4" />
            Backup do Banco de Dados
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex-1 gap-2">
            <FolderSync className="w-4 h-4" />
            Sincronização de Arquivos
          </TabsTrigger>
        </TabsList>

        {/* ── ABA: BACKUP ─────────────────────────────────────────────── */}
        <TabsContent value="backup">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4 mb-5">
            <Card><CardContent className="p-4 text-center">
              <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-semibold text-green-600 text-sm">Ativo</p>
              <p className="text-xs text-muted-foreground">Todo dia 00:00</p>
            </CardContent></Card>

            <Card><CardContent className="p-4 text-center">
              <FileJson className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Total de Backups</p>
              <p className="text-2xl font-bold">{loadingBackups ? "..." : (backups?.length || 0)}</p>
            </CardContent></Card>

            <Card><CardContent className="p-4 text-center">
              <HardDrive className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Espaço Usado</p>
              <p className="text-2xl font-bold">{loadingBackups ? "..." : formatBytes(totalSize)}</p>
            </CardContent></Card>

            <Card><CardContent className="p-4 text-center">
              <Calendar className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Último Backup</p>
              <p className="text-xs font-medium mt-1">{loadingBackups ? "..." : (latestBackup ? formatDate(latestBackup.lastModified) : "Nenhum ainda")}</p>
            </CardContent></Card>
          </div>

          {/* Actions */}
          <Card className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" />Ações</CardTitle>
              <CardDescription>Os backups incluem licenças, contratos, usuários, documentos e todos os dados do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => { setAdminPassword(""); setPasswordError(""); setShowPasswordDialog(true); }}
                  disabled={triggerMutation.isPending}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  {triggerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {triggerMutation.isPending ? "Executando backup..." : "Executar Backup Agora"}
                </Button>

                {dropboxConn?.success && (
                  <Button variant="outline" onClick={() => dropboxBackupMutation.mutate()} disabled={dropboxBackupMutation.isPending} className="gap-2">
                    {dropboxBackupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Enviar Backup ao Dropbox
                  </Button>
                )}

                <Button variant="outline" onClick={() => refetchBackups()} disabled={loadingBackups} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${loadingBackups ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <span className="font-medium">Backup automático ativo:</span> todo dia às 00:00 (Brasília). Arquivos mantidos por 30 dias.
                    Quando o Dropbox está conectado, os backups são sincronizados automaticamente toda semana.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Backup List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backups Disponíveis</CardTitle>
              <CardDescription>Clique em "Baixar" para salvar qualquer backup no seu computador</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBackups ? (
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
                    const fileName = file.key.split("/").pop() || file.key;
                    const isDownloading = downloadingFile === fileName;
                    return (
                      <div key={file.key} className={`flex items-center justify-between p-3 rounded-lg border ${index === 0 ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-muted/30 border-border"}`}>
                        <div className="flex items-center gap-3">
                          <FileJson className={`h-5 w-5 flex-shrink-0 ${index === 0 ? "text-green-600" : "text-blue-500"}`} />
                          <div>
                            <p className="font-medium text-sm">{fileName}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(file.lastModified)}</span>
                              <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{formatBytes(file.size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {index === 0 && <Badge variant="secondary" className="bg-green-100 text-green-700">Mais recente</Badge>}
                          <Button size="sm" variant="outline" onClick={() => handleDownload(fileName)} disabled={isDownloading} className="gap-1">
                            {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
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
        </TabsContent>

        {/* ── ABA: SINCRONIZAÇÃO ───────────────────────────────────────── */}
        <TabsContent value="sync">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <Card><CardContent className="p-4 text-center">
              <HardDrive className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{syncStatus?.total ?? "—"}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Sincronizados</p>
              <p className="text-2xl font-bold text-green-600">{syncStatus?.synced ?? "—"}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Clock className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600">{syncStatus?.pending ?? "—"}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Com Erro</p>
              <p className="text-2xl font-bold text-red-600">{syncStatus?.errors ?? "—"}</p>
            </CardContent></Card>
          </div>

          {/* Progress */}
          {syncStatus && syncStatus.total > 0 && (
            <Card className="mb-5">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Progresso geral</span>
                  <span className="text-sm font-bold text-blue-600">{syncPercent}%</span>
                </div>
                <Progress value={syncPercent} className="h-3" />
                {syncStatus.lastSyncAt && (
                  <p className="text-xs text-slate-400 mt-2">
                    Última sync: {format(new Date(syncStatus.lastSyncAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card className="mb-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FolderSync className="w-4 h-4" />Ações de Sincronização</CardTitle>
              <CardDescription>Sync automático toda semana (domingos 02:00 Brasília). Use os botões para sincronizar manualmente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => { syncMutation.mutate(); }} disabled={syncMutation.isPending || isSyncing || !dropboxConn?.success} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  {syncMutation.isPending || isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                  {isSyncing ? "Sincronizando..." : "Sincronizar Todos os Arquivos"}
                </Button>

                <Button variant="outline" onClick={() => foldersMutation.mutate()} disabled={foldersMutation.isPending || !dropboxConn?.success} className="gap-2">
                  {foldersMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                  Criar Pastas ABNT
                </Button>

                {(syncStatus?.errors ?? 0) > 0 && (
                  <Button variant="outline" onClick={() => { retryMutation.mutate(); }} disabled={retryMutation.isPending} className="border-red-200 text-red-600 hover:bg-red-50 gap-2">
                    {retryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Reprocessar Erros ({syncStatus?.errors})
                  </Button>
                )}

                <Button variant="ghost" onClick={() => { void queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-status"] }); queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-log"] }); }} className="gap-2">
                  <RefreshCw className="w-4 h-4" />Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sync Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Sincronização</CardTitle>
              <CardDescription>Últimos 50 arquivos processados</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLog ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />Carregando...
                </div>
              ) : recentLog.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Cloud className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma sincronização realizada ainda</p>
                  <p className="text-sm mt-1">Clique em "Sincronizar Todos os Arquivos" para começar</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="text-left py-2 pr-4 font-medium">Arquivo</th>
                        <th className="text-left py-2 pr-4 font-medium">Módulo</th>
                        <th className="text-left py-2 pr-4 font-medium">Tamanho</th>
                        <th className="text-left py-2 pr-4 font-medium">Status</th>
                        <th className="text-left py-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLog.map(entry => (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="py-2 pr-4">
                            <div className="font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate" title={entry.arquivoNome}>{entry.arquivoNome}</div>
                            {entry.dropboxPath && <div className="text-xs text-slate-400 truncate max-w-xs" title={entry.dropboxPath}>{entry.dropboxPath}</div>}
                            {entry.errorMessage && <div className="text-xs text-red-400 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{entry.errorMessage}</div>}
                          </td>
                          <td className="py-2 pr-4"><Badge variant="outline" className="text-xs capitalize">{entry.arquivoOrigem || "—"}</Badge></td>
                          <td className="py-2 pr-4 text-slate-500">{formatBytes(entry.fileSize)}</td>
                          <td className="py-2 pr-4"><StatusBadge status={entry.status} /></td>
                          <td className="py-2 text-slate-500 text-xs">
                            {entry.syncedAt ? format(new Date(entry.syncedAt), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setAdminPassword(""); setPasswordError(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-amber-600" />Confirmação de Backup</DialogTitle>
            <DialogDescription>Por segurança, informe a senha de administrador para executar o backup manual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Senha de Administrador</Label>
              <Input
                id="admin-password" type="password" placeholder="Digite a senha de administrador"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { if (!adminPassword.trim()) { setPasswordError("Digite a senha."); return; } triggerMutation.mutate(adminPassword); } }}
                autoFocus
              />
              {passwordError && <p className="text-sm text-red-600 flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />{passwordError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setAdminPassword(""); setPasswordError(""); }}>Cancelar</Button>
            <Button onClick={() => { if (!adminPassword.trim()) { setPasswordError("Digite a senha."); return; } triggerMutation.mutate(adminPassword); }} disabled={triggerMutation.isPending} className="gap-2 bg-green-600 hover:bg-green-700">
              {triggerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {triggerMutation.isPending ? "Executando..." : "Confirmar Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
