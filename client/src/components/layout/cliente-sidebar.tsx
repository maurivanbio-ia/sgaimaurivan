import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  LayoutDashboard, 
  Building, 
  FileText,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface ClienteUser {
  id: number;
  nome: string;
  email: string;
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia: string;
  };
}

export default function ClienteSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: user } = useQuery<ClienteUser>({
    queryKey: ['/api/cliente-auth/me'],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/cliente-auth/logout");
    },
    onSuccess: () => {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      window.location.href = "/cliente/login";
    },
  });

  const isActive = (path: string) => {
    if (path === "/cliente" && location === "/cliente") return true;
    if (path !== "/cliente" && location.startsWith(path)) return true;
    return false;
  };

  const NAV = [
    { href: "/cliente", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
    { href: "/cliente/empreendimentos", label: "Empreendimentos", icon: Building, testid: "nav-empreendimentos" },
    { href: "/cliente/documentos", label: "Documentos", icon: FileText, testid: "nav-documentos" },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
        <Link
          href="/cliente"
          className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <span className={cn("font-extrabold tracking-tight text-foreground transition-all", collapsed ? "text-xs" : "text-base")}>SGAI</span>
        </Link>
      </div>

      <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md",
          collapsed && "justify-center px-2"
        )}>
          <Building2 className="h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-bold truncate">
              {user?.cliente?.nomeFantasia || user?.cliente?.razaoSocial || 'Cliente'}
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        <div className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testid}
                onClick={() => setMobileOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
                    isActive(item.href)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={cn("p-4 border-t border-border space-y-2", collapsed && "px-2")}>
        {!collapsed && user && (
          <div className="text-sm text-muted-foreground px-2 mb-2">
            <p className="font-medium text-foreground">{user.nome}</p>
            <p className="text-xs truncate">{user.email}</p>
          </div>
        )}
        
        <Button
          variant="ghost"
          onClick={() => logoutMutation.mutate()}
          className={cn(
            "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "px-2"
          )}
          data-testid="button-logout"
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-2">{logoutMutation.isPending ? "Saindo..." : "Sair"}</span>}
        </Button>
      </div>

      <div className="hidden md:block p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside 
        className={cn(
          "hidden md:flex flex-col h-screen bg-card border-r border-border fixed left-0 top-0 z-40 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Link href="/cliente" className="flex items-center">
            <span className="text-base font-extrabold tracking-tight text-foreground">SGAI</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <aside 
            className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-16">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
