import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useContractUnlock, unlockContractValues } from "@/hooks/useContractUnlock";

interface ContractValueLockProps {
  value: string;
  className?: string;
}

export function ContractValueLock({ value, className = "" }: ContractValueLockProps) {
  const { unlocked } = useContractUnlock();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleUnlock = () => {
    if (unlockContractValues(password)) {
      setDialogOpen(false);
      setPassword("");
      setError("");
    } else {
      setError("Senha incorreta. Tente novamente.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleUnlock();
  };

  if (unlocked) {
    return <span className={className}>{value}</span>;
  }

  return (
    <>
      <span
        className={`inline-flex items-center gap-1 cursor-pointer select-none group ${className}`}
        onClick={() => setDialogOpen(true)}
        title="Clique para visualizar o valor"
      >
        <Lock className="h-3 w-3 text-muted-foreground group-hover:text-amber-600 transition-colors" />
        <span className="text-muted-foreground tracking-widest group-hover:text-amber-600 transition-colors">
          ••••••
        </span>
      </span>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setPassword(""); setError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-600" />
              Valores Protegidos
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Digite a senha para visualizar os valores de contratos e aditivos.
            </p>
            <div className="space-y-1">
              <Label htmlFor="contract-pwd">Senha</Label>
              <div className="relative">
                <Input
                  id="contract-pwd"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite a senha"
                  autoFocus
                  className={error ? "border-red-500" : ""}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setPassword(""); setError(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleUnlock} disabled={!password}>
              Desbloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
