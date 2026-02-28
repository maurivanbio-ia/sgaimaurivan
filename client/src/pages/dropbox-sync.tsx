import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Cloud,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FolderSync,
  Clock,
  AlertTriangle,
  FileUp,
  ArrowLeft,
  Loader2,
  RotateCcw,
  HardDrive,
  FolderOpen,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncStatus {
  total: number;
  synced: number;
  pending: number;
  errors: number;
  lastSyncAt: string | null;
}

interface SyncLogEntry {
  id: number;
  arquivoId: number | null;
  arquivoNome: string;
  arquivoOrigem: string | null;
  dropboxPath: string | null;
  status: string;
  errorMessage: string | null;
  fileSize: number | null;
  syncedAt: string | null;
  criadoEm: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "synced") return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Sincronizado</Badge>;
  if (status === "error") return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
}

export default function DropboxSyncPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: status, isLoading: loadingStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/dropbox/sync-status"],
    refetchInterval: isSyncing ? 3000 : 30000,
  });

  const { data: connectionTest } = useQuery<{ success: boolean; accountName?: string; email?: string; error?: string }>({
    queryKey: ["/api/dropbox/test"],
    retry: false,
  });

  const { data: syncLog, isLoading: loadingLog } = useQuery<SyncLogEntry[]>({
    queryKey: ["/api/dropbox/sync-log"],
    refetchInterval: isSyncing ? 3000 : 60000,
  });

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
    onError: (err: any) => {
      toast({ title: "Erro ao sincronizar", description: err.message, variant: "destructive" });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dropbox/sync-retry"),
    onSuccess: (data: any) => {
      toast({ title: "Reprocessamento concluído", description: `${data.success} de ${data.retried} arquivos recuperados.` });
      queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-log"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const foldersMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/dropbox/folders/sync-all"),
    onSuccess: (data: any) => {
      toast({ title: "Pastas criadas", description: `${data.synced} empreendimentos sincronizados no Dropbox.` });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const syncPercent = status && status.total > 0
    ? Math.round((status.synced / status.total) * 100)
    : 0;

  const recentLog = syncLog?.slice(0, 50) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/onedrive-backups">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FolderSync className="w-6 h-6 text-blue-600" />
              Sincronização Dropbox
            </h1>
            <p className="text-slate-500 text-sm">Backup e sincronização de todos os arquivos da plataforma com o Dropbox</p>
          </div>
        </div>

        {/* Connection Status */}
        <Card className="mb-6 border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-500" />
              Status da Conexão Dropbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connectionTest?.success ? (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium text-green-700 dark:text-green-400">Conectado</span>
                {connectionTest.accountName && (
                  <span className="text-slate-500 text-sm">— {connectionTest.accountName} ({connectionTest.email})</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium text-red-700">Desconectado</span>
                {connectionTest?.error && <span className="text-slate-400 text-sm">{connectionTest.error}</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-slate-700 dark:text-slate-200">{status?.total ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><HardDrive className="w-3 h-3" />Total de arquivos</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{status?.synced ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Sincronizados</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-yellow-600">{status?.pending ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3 text-yellow-500" />Pendentes</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{status?.errors ?? "—"}</div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1"><XCircle className="w-3 h-3 text-red-500" />Com erro</div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        {status && status.total > 0 && (
          <Card className="mb-6 border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Progresso da sincronização</span>
                <span className="text-sm font-bold text-blue-600">{syncPercent}%</span>
              </div>
              <Progress value={syncPercent} className="h-3" />
              {status.lastSyncAt && (
                <p className="text-xs text-slate-400 mt-2">
                  Última sincronização: {format(new Date(status.lastSyncAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isSyncing || !connectionTest?.success}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {syncMutation.isPending || isSyncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4 mr-2" />
            )}
            {isSyncing ? "Sincronizando..." : "Sincronizar Todos os Arquivos"}
          </Button>

          <Button
            variant="outline"
            onClick={() => foldersMutation.mutate()}
            disabled={foldersMutation.isPending || !connectionTest?.success}
          >
            {foldersMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderOpen className="w-4 h-4 mr-2" />}
            Criar Pastas dos Empreendimentos
          </Button>

          {(status?.errors ?? 0) > 0 && (
            <Button
              variant="outline"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {retryMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reprocessar Erros ({status?.errors})
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-status"] });
              queryClient.invalidateQueries({ queryKey: ["/api/dropbox/sync-log"] });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Sync Log Table */}
        <Card className="border-0 shadow-md">
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
                      <th className="text-left py-2 font-medium">Sincronizado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLog.map(entry => (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="py-2 pr-4">
                          <div className="font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate" title={entry.arquivoNome}>
                            {entry.arquivoNome}
                          </div>
                          {entry.dropboxPath && (
                            <div className="text-xs text-slate-400 truncate max-w-xs" title={entry.dropboxPath}>
                              {entry.dropboxPath}
                            </div>
                          )}
                          {entry.errorMessage && (
                            <div className="text-xs text-red-400 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />{entry.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="text-xs capitalize">{entry.arquivoOrigem || "—"}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-slate-500">{formatBytes(entry.fileSize)}</td>
                        <td className="py-2 pr-4"><StatusBadge status={entry.status} /></td>
                        <td className="py-2 text-slate-500 text-xs">
                          {entry.syncedAt
                            ? format(new Date(entry.syncedAt), "dd/MM/yy HH:mm", { locale: ptBR })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How it works info */}
        <Card className="mt-6 border-0 shadow-md bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-5">
            <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Como funciona a sincronização</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-400">
              <div>
                <p className="font-medium mb-1">Automático</p>
                <p>Todo arquivo enviado à plataforma é automaticamente copiado ao Dropbox na pasta correta do projeto.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Estrutura ABNT</p>
                <p>Arquivos são organizados por empreendimento com nomenclatura padrão ECB-CODIGO-TIPO-DATA.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Pastas por módulo</p>
                <p>Licenças → Entregas/Licenças, Relatórios → Relatórios/Versões Finais, Mapas → Mapas/Geospatial, etc.</p>
              </div>
              <div>
                <p className="font-medium mb-1">Backup semanal</p>
                <p>Todo domingo às 2h da manhã (Brasília) é feita uma sincronização completa automática.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
