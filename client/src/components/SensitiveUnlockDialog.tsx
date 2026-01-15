import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SensitiveUnlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  moduleName?: string;
}

export function SensitiveUnlockDialog({
  open,
  onOpenChange,
  onSuccess,
  moduleName = "esta área",
}: SensitiveUnlockDialogProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const unlockMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/auth/unlock-sensitive", { password });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Acesso liberado",
          description: "Você agora tem acesso às áreas protegidas.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/sensitive-status"] });
        setPassword("");
        onOpenChange(false);
        onSuccess?.();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Senha incorreta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      unlockMutation.mutate(password);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-500" />
            Área Protegida
          </DialogTitle>
          <DialogDescription>
            O acesso a {moduleName} requer autenticação adicional. 
            Digite a senha para continuar.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sensitive-password">Senha de Acesso</Label>
            <div className="relative">
              <Input
                id="sensitive-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha..."
                className="pr-10"
                autoFocus
                disabled={unlockMutation.isPending}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={unlockMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || unlockMutation.isPending}
            >
              {unlockMutation.isPending ? (
                "Verificando..."
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Desbloquear
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useSensitiveStatus() {
  return useQuery<{ unlocked: boolean; modules: string[] } | null>({
    queryKey: ["/api/auth/sensitive-status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}
