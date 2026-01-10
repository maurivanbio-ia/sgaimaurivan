import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationsCenter } from "@/components/notifications-center";
import { useUnidade } from "@/contexts/UnidadeContext";
import { 
  Building2, 
  LayoutDashboard, 
  User, 
  Building, 
  ClipboardList, 
  DollarSign, 
  Car, 
  Wrench, 
  Users, 
  Database,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Calendar,
  CalendarDays,
  UserCog,
  CheckSquare,
  MessageCircle,
  Trophy,
  FileText,
  Settings,
  Briefcase,
  FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoEcoBrasil from "@assets/Logo-padrao-a_1760382841154.png";

interface NavCategory {
  label: string;
  icon: any;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  testid: string;
}

export default function Sidebar() {
  const [location] = useLocation();
  const logout = useLogout();
  const { toast } = useToast();
  const { getNomeUnidade } = useUnidade();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout.mutateAsync();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
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

  const [expandedCategories, setExpandedCategories] = useState<string[]>(["dashboard", "projetos", "equipe"]);

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const NAV_CATEGORIES: NavCategory[] = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      items: [
        { href: "/", label: "Visão Geral", icon: LayoutDashboard, testid: "nav-dashboard" },
        { href: "/dashboard-coordenador", label: "Meu Painel", icon: User, testid: "nav-dashboard-coordenador" },
        { href: "/mapa", label: "Mapa", icon: MapPin, testid: "nav-mapa" },
      ]
    },
    {
      label: "Projetos",
      icon: Briefcase,
      items: [
        { href: "/empreendimentos", label: "Empreendimentos", icon: Building, testid: "nav-projects" },
        { href: "/demandas", label: "Demandas", icon: ClipboardList, testid: "nav-demandas" },
        { href: "/calendario", label: "Calendário", icon: Calendar, testid: "nav-calendario" },
        { href: "/cronograma", label: "Cronograma", icon: CalendarDays, testid: "nav-cronograma" },
      ]
    },
    {
      label: "Equipe",
      icon: Users,
      items: [
        { href: "/gestao-equipe", label: "Gestão de Equipe", icon: UserCog, testid: "nav-gestao-equipe" },
        { href: "/minhas-tarefas", label: "Minhas Tarefas", icon: CheckSquare, testid: "nav-minhas-tarefas" },
        { href: "/rh", label: "RH", icon: Users, testid: "nav-rh" },
        { href: "/gamificacao", label: "Gamificação", icon: Trophy, testid: "nav-gamificacao" },
      ]
    },
    {
      label: "Financeiro",
      icon: DollarSign,
      items: [
        { href: "/financeiro", label: "Lançamentos", icon: DollarSign, testid: "nav-financeiro" },
      ]
    },
    {
      label: "Recursos",
      icon: Car,
      items: [
        { href: "/frota", label: "Frota", icon: Car, testid: "nav-frota" },
        { href: "/equipamentos", label: "Equipamentos", icon: Wrench, testid: "nav-equipamentos" },
      ]
    },
    {
      label: "Documentos",
      icon: FolderOpen,
      items: [
        { href: "/gestao-dados", label: "Gestão de Dados", icon: Database, testid: "nav-gestao-dados" },
      ]
    },
    {
      label: "Sistema",
      icon: Settings,
      items: [
        { href: "/seguranca-trabalho", label: "SST", icon: ShieldCheck, testid: "nav-seguranca-trabalho" },
        { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, testid: "nav-whatsapp" },
        { href: "/relatorios-automaticos", label: "Relatórios Auto", icon: FileText, testid: "nav-relatorios-automaticos" },
      ]
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
        <Link
          href="/"
          aria-label="Ir para o início"
          className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img
            src={logoEcoBrasil}
            alt="EcoBrasil"
            className={cn("h-auto transition-all", collapsed ? "w-10" : "w-32")}
            loading="lazy"
            decoding="async"
          />
        </Link>
      </div>

      <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
          collapsed && "justify-center px-2"
        )}>
          <Building2 className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-bold truncate">{getNomeUnidade()}</span>}
        </div>
      </div>

      <div className={cn("p-4 border-b border-border", collapsed && "px-2")}>
        {!collapsed && <GlobalSearch />}
      </div>

      <nav className="flex-1 p-2 overflow-y-auto" role="navigation" aria-label="Navegação principal">
        <div className="space-y-1">
          {NAV_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            const categoryKey = category.label.toLowerCase().replace(/\s/g, '-');
            const isExpanded = expandedCategories.includes(categoryKey);
            const hasActiveItem = category.items.some(item => isActive(item.href));
            
            return (
              <div key={categoryKey}>
                <button
                  onClick={() => toggleCategory(categoryKey)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    hasActiveItem 
                      ? "bg-primary/10 text-primary font-semibold" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <CategoryIcon className="h-4 w-4 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="text-xs font-semibold uppercase tracking-wider flex-1 text-left">
                        {category.label}
                      </span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </>
                  )}
                </button>
                
                {(isExpanded || collapsed) && (
                  <div className={cn("mt-1 space-y-0.5", !collapsed && "ml-4 border-l border-border pl-2")}>
                    {category.items.map((item) => {
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
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer",
                              isActive(item.href)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              collapsed && "justify-center px-2"
                            )}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {!collapsed && <span className="text-sm">{item.label}</span>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className={cn("p-4 border-t border-border space-y-2", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
          <NotificationsCenter />
          <ThemeToggle />
        </div>
        
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "px-2"
          )}
          data-testid="button-logout"
          disabled={isLoggingOut}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-2">{isLoggingOut ? "Saindo..." : "Sair"}</span>}
        </Button>
      </div>

      <div className="hidden md:block p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
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
          <Link href="/" className="flex items-center">
            <img src={logoEcoBrasil} alt="EcoBrasil" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <NotificationsCenter />
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
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
