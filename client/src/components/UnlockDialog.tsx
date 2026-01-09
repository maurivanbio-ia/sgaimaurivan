import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ModuleName, MODULE_LABELS } from "@/lib/permissions";

interface UnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleName: ModuleName;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UnlockDialog({ 
  open, 
  onOpenChange, 
  moduleName, 
  onSuccess, 
  onCancel 
}: UnlockDialogProps) {
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const unlockMutation = useMutation({
    mutationFn: async (data: { password: string; module: string }) => {
      const response = await apiRequest("POST", "/api/auth/unlock-module", data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const unlocked = JSON.parse(sessionStorage.getItem("unlockedModules") || "[]");
        if (!unlocked.includes(moduleName)) {
          unlocked.push(moduleName);
          sessionStorage.setItem("unlockedModules", JSON.stringify(unlocked));
        }
        toast({
          title: "Acesso liberado",
          description: `Você agora tem acesso ao módulo ${MODULE_LABELS[moduleName]}.`,
        });
        setPassword("");
        onSuccess();
      } else {
        toast({
          title: "Senha incorreta",
          description: "A senha informada não está correta.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao verificar a senha.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      unlockMutation.mutate({ password, module: moduleName });
    }
  };

  const handleClose = () => {
    setPassword("");
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            <DialogTitle>Acesso Restrito</DialogTitle>
          </div>
          <DialogDescription>
            Você não tem permissão para acessar o módulo <strong>{MODULE_LABELS[moduleName]}</strong>.
            Digite a senha de administrador para desbloquear temporariamente.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unlock-password">Senha de Desbloqueio</Label>
            <Input
              id="unlock-password"
              type="password"
              placeholder="Digite a senha..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              data-testid="input-unlock-password"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={unlockMutation.isPending || !password.trim()}
              className="gap-2"
            >
              {unlockMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Desbloquear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function isModuleUnlocked(moduleName: ModuleName): boolean {
  const unlocked = JSON.parse(sessionStorage.getItem("unlockedModules") || "[]");
  return unlocked.includes(moduleName);
}

export function clearUnlockedModules(): void {
  sessionStorage.removeItem("unlockedModules");
}
