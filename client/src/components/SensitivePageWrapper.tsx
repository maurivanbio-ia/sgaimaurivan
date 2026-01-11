import { useState, useEffect } from "react";
import { useSensitiveStatus, SensitiveUnlockDialog } from "./SensitiveUnlockDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface SensitivePageWrapperProps {
  children: React.ReactNode;
  moduleName: string;
}

export function SensitivePageWrapper({ children, moduleName }: SensitivePageWrapperProps) {
  const { data: sensitiveStatus, isLoading, error } = useSensitiveStatus();
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && sensitiveStatus && !sensitiveStatus.unlocked) {
      setShowUnlockDialog(true);
    }
  }, [isLoading, sensitiveStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Lock className="h-5 w-5" />
              Erro de Acesso
            </CardTitle>
            <CardDescription>
              Não foi possível verificar seu acesso. Tente fazer login novamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sensitiveStatus?.unlocked) {
    return (
      <>
        <div className="container mx-auto py-8">
          <Card className="max-w-md mx-auto border-orange-200 dark:border-orange-800">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-xl">Área Protegida</CardTitle>
              <CardDescription>
                O módulo <strong>{moduleName}</strong> requer autenticação adicional para acesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Esta área contém informações sensíveis e está protegida por senha.
                Clique no botão abaixo para desbloquear o acesso.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => setShowUnlockDialog(true)} className="w-full">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Desbloquear Acesso
                </Button>
                <Button variant="outline" onClick={() => setLocation("/")} className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <SensitiveUnlockDialog
          open={showUnlockDialog}
          onOpenChange={setShowUnlockDialog}
          moduleName={moduleName}
        />
      </>
    );
  }

  return <>{children}</>;
}
