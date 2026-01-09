import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UnlockDialog, isModuleUnlocked } from "@/components/UnlockDialog";
import { 
  ModuleName, 
  getModuleFromPath, 
  canAccessModule, 
  hasAccess,
  UserRole,
  MODULE_LABELS
} from "@/lib/permissions";

interface User {
  id: number;
  email: string;
  cargo: string;
  unidade: string;
}

interface PermissionContextType {
  checkAccess: (module: ModuleName, action?: 'view' | 'create' | 'edit' | 'approve' | 'delete') => boolean;
  requestUnlock: (module: ModuleName) => void;
  userRole: UserRole | null;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}

interface PermissionProviderProps {
  children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const [location, setLocation] = useLocation();
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [targetModule, setTargetModule] = useState<ModuleName | null>(null);
  const [unlockedModules, setUnlockedModules] = useState<ModuleName[]>([]);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const userRole = user?.cargo as UserRole | null;

  const checkAccess = useCallback((module: ModuleName, action: 'view' | 'create' | 'edit' | 'approve' | 'delete' = 'view'): boolean => {
    if (!userRole) return false;
    
    if (hasAccess(userRole, module, action)) {
      return true;
    }
    
    if (isModuleUnlocked(module) || unlockedModules.includes(module)) {
      return true;
    }
    
    return false;
  }, [userRole, unlockedModules]);

  const requestUnlock = useCallback((module: ModuleName) => {
    setTargetModule(module);
    setUnlockDialogOpen(true);
  }, []);

  const handleUnlockSuccess = useCallback(() => {
    if (targetModule) {
      setUnlockedModules(prev => [...prev, targetModule]);
    }
    setUnlockDialogOpen(false);
    setTargetModule(null);
  }, [targetModule]);

  const handleUnlockCancel = useCallback(() => {
    setUnlockDialogOpen(false);
    setTargetModule(null);
    setLocation("/");
  }, [setLocation]);

  return (
    <PermissionContext.Provider value={{ checkAccess, requestUnlock, userRole }}>
      {children}
      {targetModule && (
        <UnlockDialog
          open={unlockDialogOpen}
          onOpenChange={setUnlockDialogOpen}
          moduleName={targetModule}
          onSuccess={handleUnlockSuccess}
          onCancel={handleUnlockCancel}
        />
      )}
    </PermissionContext.Provider>
  );
}
