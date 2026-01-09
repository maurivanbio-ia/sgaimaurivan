import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { UnlockDialog, isModuleUnlocked } from "./UnlockDialog";
import { 
  ModuleName, 
  getModuleFromPath, 
  canAccessModule, 
  UserRole 
} from "@/lib/permissions";

interface User {
  id: number;
  email: string;
  cargo: string;
  unidade: string;
}

interface PermissionGateProps {
  children: React.ReactNode;
}

export function PermissionGate({ children }: PermissionGateProps) {
  const [location, setLocation] = useLocation();
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [targetModule, setTargetModule] = useState<ModuleName | null>(null);
  const [temporaryUnlock, setTemporaryUnlock] = useState<ModuleName[]>([]);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const currentModule = getModuleFromPath(location);
  const userRole = user?.cargo as UserRole | undefined;

  useEffect(() => {
    if (isLoading || !user || !currentModule || !userRole) {
      return;
    }

    const hasPermission = canAccessModule(userRole, currentModule);
    const isSessionUnlocked = isModuleUnlocked(currentModule);
    const isTemporaryUnlocked = temporaryUnlock.includes(currentModule);

    if (!hasPermission && !isSessionUnlocked && !isTemporaryUnlocked) {
      setTargetModule(currentModule);
      setShowUnlockDialog(true);
    } else {
      setShowUnlockDialog(false);
    }
  }, [location, user, isLoading, currentModule, userRole, temporaryUnlock]);

  const handleUnlockSuccess = () => {
    if (targetModule) {
      setTemporaryUnlock(prev => [...prev, targetModule]);
    }
    setShowUnlockDialog(false);
    setTargetModule(null);
  };

  const handleUnlockCancel = () => {
    setShowUnlockDialog(false);
    setTargetModule(null);
    setLocation("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentModule) {
    return <>{children}</>;
  }

  const hasPermission = userRole ? canAccessModule(userRole, currentModule) : false;
  const isSessionUnlocked = isModuleUnlocked(currentModule);
  const isTemporaryUnlocked = temporaryUnlock.includes(currentModule);

  if (hasPermission || isSessionUnlocked || isTemporaryUnlocked) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
      
      {targetModule && (
        <UnlockDialog
          open={showUnlockDialog}
          onOpenChange={(open) => {
            if (!open) handleUnlockCancel();
          }}
          moduleName={targetModule}
          onSuccess={handleUnlockSuccess}
          onCancel={handleUnlockCancel}
        />
      )}
    </>
  );
}
