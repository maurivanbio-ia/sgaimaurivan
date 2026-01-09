import { useState, useEffect } from "react";
import { useLocation, Redirect } from "wouter";
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

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [location, setLocation] = useLocation();
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [targetModule, setTargetModule] = useState<ModuleName | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const currentModule = getModuleFromPath(location);
  const userRole = user?.cargo as UserRole | undefined;

  useEffect(() => {
    if (!isLoading && user && currentModule && userRole) {
      const hasPermission = canAccessModule(userRole, currentModule);
      const unlocked = isModuleUnlocked(currentModule);
      
      if (!hasPermission && !unlocked) {
        setTargetModule(currentModule);
        setShowUnlockDialog(true);
        setIsUnlocked(false);
      } else {
        setShowUnlockDialog(false);
        setIsUnlocked(true);
      }
    }
  }, [location, user, isLoading, currentModule, userRole]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!currentModule) {
    return <>{children}</>;
  }

  const hasPermission = canAccessModule(userRole!, currentModule);
  const unlocked = isModuleUnlocked(currentModule);

  if (hasPermission || unlocked || isUnlocked) {
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
          onOpenChange={setShowUnlockDialog}
          moduleName={targetModule}
          onSuccess={() => {
            setIsUnlocked(true);
            setShowUnlockDialog(false);
          }}
          onCancel={() => {
            setLocation("/");
          }}
        />
      )}
    </>
  );
}
