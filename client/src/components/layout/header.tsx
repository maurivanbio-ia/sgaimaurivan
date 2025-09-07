import { Link, useLocation } from "wouter";
import { useLogout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsCenter } from "@/components/notifications-center";

export default function Header() {
  const [location, navigate] = useLocation(); // << agora temos navigate
  const logout = useLogout();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      // O redirecionamento para login será automático devido ao App.tsx
      // que redireciona quando !isAuthenticated
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <img 
              src="http://ecobrasil.bio.br/wp-content/uploads/2017/02/Logo-padrao-a.png" 
              alt="EcoBrasil Logo" 
              className="h-8 mr-4"
            />
            <h1 className="text-xl font-semibold text-primary">LicençaFácil</h1>
          </div>

          <div className="flex items-center space-x-4">
            <GlobalSearch />
          </div>

          <nav className="hidden md:flex space-x-8">
            
            <Link href="/empreendimentos">
              <Button
                variant="ghost"
                className={`px-1 py-4 text-sm font-medium ${
                  isActive("/empreendimentos")
                    ? "text-primary border-b-2 border-primary bg-transparent hover:bg-transparent"
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-projects"
              >
                Empreendimentos
              </Button>
            </Link>
            <Link href="/equipamentos">
              <Button
                variant="ghost"
                className={`px-1 py-4 text-sm font-medium ${
                  isActive("/equipamentos")
                    ? "text-primary border-b-2 border-primary bg-transparent hover:bg-transparent"
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-equipamentos"
              >
                Equipamentos
              </Button>
            </Link>
            <Link href="/equipamentos/painel">
              <Button
                variant="ghost"
                className={`px-1 py-4 text-sm font-medium ${
                  isActive("/equipamentos/painel")
                    ? "text-primary border-b-2 border-primary bg-transparent hover:bg-transparent"
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-painel-equipamentos"
              >
                Painel
              </Button>
            </Link>
            <Link href="/alertas">
              <Button
                variant="ghost"
                className={`px-1 py-4 text-sm font-medium ${
                  isActive("/alertas")
                    ? "text-primary border-b-2 border-primary bg-transparent hover:bg-transparent"
                    : "text-muted-foreground hover:text-primary"
                }`}
                data-testid="nav-alerts"
              >
                Alertas
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive px-1 py-4 text-sm font-medium"
              data-testid="button-logout"
            >
              Sair
            </Button>
          </nav>

          <div className="flex items-center space-x-2">
            <NotificationsCenter />
            <ThemeToggle />
          </div>

          <div className="md:hidden">
            <Button variant="ghost" size="sm">
              <i className="fas fa-bars" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
