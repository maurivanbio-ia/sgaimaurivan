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
  FolderOpen,
  FileSpreadsheet,
  FlaskConical,
  Truck,
  GraduationCap,
  BookOpen,
  Megaphone,
  Phone,
  Link2,
  Shield,
  FileSearch,
  Newspaper,
  Cloud,
  Globe,
  Bot,
  Sparkles,
  Microscope
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
        { href: "/comunicacao", label: "Comunicação Interna", icon: Megaphone, testid: "nav-comunicacao" },
        { href: "/rh", label: "RH", icon: Users, testid: "nav-rh" },
        { href: "/gamificacao", label: "Gamificação", icon: Trophy, testid: "nav-gamificacao" },
      ]
    },
    {
      label: "Financeiro",
      icon: DollarSign,
      items: [
        { href: "/financeiro", label: "Lançamentos", icon: DollarSign, testid: "nav-financeiro" },
        { href: "/propostas-comerciais", label: "Propostas Comerciais", icon: FileSpreadsheet, testid: "nav-propostas" },
      ]
    },
    {
      label: "Recursos",
      icon: Car,
      items: [
        { href: "/frota", label: "Frota", icon: Car, testid: "nav-frota" },
        { href: "/equipamentos", label: "Equipamentos", icon: Wrench, testid: "nav-equipamentos" },
        { href: "/fornecedores", label: "Fornecedores", icon: Truck, testid: "nav-fornecedores" },
        { href: "/ramais-contatos", label: "Ramais e Contatos", icon: Phone, testid: "nav-ramais-contatos" },
      ]
    },
    {
      label: "Amostras e Campo",
      icon: FlaskConical,
      items: [
        { href: "/amostras", label: "Gestão de Amostras", icon: FlaskConical, testid: "nav-amostras" },
        { href: "/campo", label: "Monitoramento de Campo", icon: Microscope, testid: "nav-campo" },
      ]
    },
    {
      label: "Capacitação",
      icon: GraduationCap,
      items: [
        { href: "/cursos-treinamentos", label: "Cursos e Treinamentos", icon: GraduationCap, testid: "nav-cursos-treinamentos" },
      ]
    },
    {
      label: "Documentos",
      icon: FolderOpen,
      items: [
        { href: "/gestao-dados", label: "Gestão de Dados", icon: Database, testid: "nav-gestao-dados" },
        { href: "/base-conhecimento", label: "Base de Conhecimento", icon: BookOpen, testid: "nav-base-conhecimento" },
        { href: "/links-uteis", label: "Links Úteis", icon: Link2, testid: "nav-links-uteis" },
      ]
    },
    {
      label: "Segurança do Trabalho",
      icon: ShieldCheck,
      items: [
        { href: "/seguranca-trabalho", label: "SST", icon: ShieldCheck, testid: "nav-seguranca-trabalho" },
      ]
    },
    {
      label: "Sistema",
      icon: Settings,
      items: [
        { href: "/ia", label: "EcoGestor AI", icon: Bot, testid: "nav-ia" },
        { href: "/conformidade-iso", label: "Conformidade ISO", icon: Shield, testid: "nav-conformidade-iso" },
        { href: "/processos-monitorados", label: "Processos SEIA", icon: FileSearch, testid: "nav-processos-monitorados" },
        { href: "/relatorios-automaticos", label: "Relatórios Auto", icon: FileText, testid: "nav-relatorios-automaticos" },
        { href: "/newsletter", label: "Newsletter", icon: Newspaper, testid: "nav-newsletter" },
        { href: "/blog-admin", label: "Blog Institucional", icon: Globe, testid: "nav-blog-admin" },
        { href: "/onedrive-backups", label: "Backup & Dropbox", icon: Cloud, testid: "nav-onedrive-backups" },
      ]
    },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn("p-2 border-b border-border", collapsed && "px-1")}>
        <Link
          href="/"
          aria-label="Ir para o início"
          className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img
            src={logoEcoBrasil}
            alt="EcoBrasil"
            className={cn("h-auto transition-all", collapsed ? "w-8" : "w-24")}
            loading="lazy"
            decoding="async"
          />
        </Link>
      </div>

      <div className={cn("px-2 py-1.5 border-b border-border", collapsed && "px-1")}>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-sm",
          collapsed && "justify-center px-1"
        )}>
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          {!collapsed && <span className="text-xs font-semibold truncate">{getNomeUnidade()}</span>}
        </div>
      </div>

      <div className={cn("px-2 py-1.5 border-b border-border", collapsed && "px-1")}>
        {!collapsed && <GlobalSearch />}
      </div>

      <nav className="flex-1 px-1 py-1 overflow-y-auto" role="navigation" aria-label="Navegação principal">
        <div className="space-y-0.5">
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
                    "w-full flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
                    hasActiveItem 
                      ? "bg-primary/10 text-primary font-semibold" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-1"
                  )}
                >
                  <CategoryIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="text-[10px] font-semibold uppercase tracking-wider flex-1 text-left">
                        {category.label}
                      </span>
                      <ChevronDown className={cn(
                        "h-3 w-3 transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    </>
                  )}
                </button>
                
                {(isExpanded || collapsed) && (
                  <div className={cn("mt-0.5 space-y-0", !collapsed && "ml-3 border-l border-border pl-1.5")}>
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      if (item.href === "/ia") {
                        return (
                          <button
                            key={item.href}
                            data-testid={item.testid}
                            className="w-full"
                            onClick={() => { setMobileOpen(false); document.dispatchEvent(new CustomEvent("open-ai-chat")); }}
                          >
                            <div className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer",
                              "text-muted-foreground hover:bg-muted hover:text-foreground",
                              collapsed && "justify-center px-1"
                            )}>
                              <Icon className="h-3.5 w-3.5 flex-shrink-0 text-violet-500" />
                              {!collapsed && <span className="text-xs">{item.label}</span>}
                            </div>
                          </button>
                        );
                      }
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          data-testid={item.testid}
                          onClick={() => setMobileOpen(false)}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 px-2 py-1 rounded-md transition-colors cursor-pointer",
                              isActive(item.href)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              collapsed && "justify-center px-1"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            {!collapsed && <span className="text-xs">{item.label}</span>}
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

      <div className={cn("px-2 py-2 border-t border-border", collapsed && "px-1")}>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-ai-chat"))}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition-all",
              "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg",
              collapsed && "justify-center px-1"
            )}
            data-testid="nav-ia-button"
          >
            <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <span className="flex items-center gap-1">
                EcoGestor AI
                <Sparkles className="h-3 w-3 text-yellow-300" />
              </span>
            )}
          </button>
      </div>

      <div className={cn("px-2 py-1.5 border-t border-border space-y-1", collapsed && "px-1")}>
        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
          <NotificationsCenter />
          <ThemeToggle />
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed && "px-1"
          )}
          data-testid="button-logout"
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-1.5 text-xs">{isLoggingOut ? "Saindo..." : "Sair"}</span>}
        </Button>
      </div>

      <div className="hidden md:block px-2 py-1 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full h-6"
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
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
