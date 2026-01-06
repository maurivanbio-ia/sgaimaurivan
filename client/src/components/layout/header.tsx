// src/components/Header.tsx
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsCenter } from "@/components/notifications-center";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";

export default function Header() {
  const [location] = useLocation();
  const logout = useLogout();
  const { toast } = useToast();
  const { getNomeUnidade } = useUnidade();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout.mutateAsync();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      // App.tsx deve redirecionar ao detectar !isAuthenticated
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message ?? "Erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const NAV = [
    { href: "/", label: "Dashboard", testid: "nav-dashboard" },
    // { href: "/dashboard-executivo", label: "Dashboard Executivo", testid: "nav-dashboard-executivo" }, // Standby
    { href: "/empreendimentos", label: "Empreendimentos", testid: "nav-projects" },
    { href: "/demandas", label: "Demandas", testid: "nav-demandas" },
    { href: "/financeiro", label: "Financeiro", testid: "nav-financeiro" },
    { href: "/frota", label: "Frota", testid: "nav-frota" },
    { href: "/equipamentos", label: "Equipamentos", testid: "nav-equipamentos" },
    { href: "/rh", label: "RH", testid: "nav-rh" },
    { href: "/gestao-dados", label: "Gestão de Dados", testid: "nav-gestao-dados" },
    { href: "/seguranca-trabalho", label: "SST", testid: "nav-seguranca-trabalho" },
  ];

  return (
    <header className="bg-card border-b border-border shadow-sm">
      {/* A11y: Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-primary text-primary-foreground rounded px-3 py-1"
      >
        Pular para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo como link simples (sem button dentro) e com asset seguro */}
          <Link
            href="/"
            aria-label="Ir para o início"
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity -ml-2"
          >
            <img
              src={logoEcoBrasil}
              alt="EcoBrasil"
              className="h-auto w-40"
              loading="lazy"
              decoding="async"
            />
          </Link>

          {/* Busca desktop */}
          <div className="hidden md:flex items-center space-x-4">
            <GlobalSearch />
          </div>

          {/* Unidade do usuário (fixa) */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-bold">{getNomeUnidade()}</span>
            </div>
          </div>

          {/* Navegação desktop */}
          <nav
            className="hidden md:flex space-x-2"
            role="navigation"
            aria-label="Navegação principal"
          >
            {NAV.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={cn(
                  "px-1 py-4 text-sm font-medium",
                  isActive(item.href)
                    ? "text-primary border-b-2 border-primary bg-transparent hover:bg-transparent"
                    : "text-muted-foreground hover:text-primary"
                )}
                data-testid={item.testid}
              >
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </Button>
            ))}

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive px-1 py-4 text-sm font-medium"
              data-testid="button-logout"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Saindo..." : "Sair"}
            </Button>
          </nav>

          {/* Ações (sempre visíveis) + Menu mobile */}
          <div className="flex items-center space-x-2">
            <NotificationsCenter />
            <ThemeToggle />

            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Abrir menu"
                aria-controls="mobile-menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Busca mobile */}
        <div className="md:hidden py-2">
          <GlobalSearch />
        </div>

        {/* Unidade do usuário - Mobile (fixa) */}
        <div className="md:hidden py-2 border-t border-border">
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md">
              <Building2 className="h-4 w-4" />
              <span className="text-sm font-bold">{getNomeUnidade()}</span>
            </div>
          </div>
        </div>

        {/* Menu mobile colapsável (sem libs extras) */}
        <div
          id="mobile-menu"
          className={cn(
            "md:hidden border-t border-border",
            mobileOpen ? "block" : "hidden"
          )}
        >
          <nav className="py-2 flex flex-col space-y-1" aria-label="Menu móvel">
            {NAV.map((item) => (
              <Button
                key={item.href}
                variant={isActive(item.href) ? "secondary" : "ghost"}
                asChild
                className="justify-start"
                data-testid={`${item.testid}-mobile`}
                onClick={() => setMobileOpen(false)}
              >
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </Button>
            ))}

            <Button
              variant="ghost"
              className="justify-start text-destructive"
              onClick={() => {
                setMobileOpen(false);
                void handleLogout();
              }}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Saindo..." : "Sair"}
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
