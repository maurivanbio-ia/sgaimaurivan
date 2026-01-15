import { Suspense, lazy, useEffect, useMemo } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { useAuth } from "./lib/auth";

import Sidebar from "./components/layout/sidebar";
import ColaboradorLayout from "./components/layout/colaborador-layout";
import ClienteSidebar from "./components/layout/cliente-sidebar";
import { PermissionGate } from "./components/PermissionGate";

import NotFound from "@/pages/not-found";

// ======= loaders padrão =======
function FullScreenLoader({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {sidebar}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 transition-all duration-300" id="main">
        {children}
      </main>
    </div>
  );
}

// ======= lazy pages (exemplos, converta o resto) =======
const Login = lazy(() => import("./pages/login"));
const Register = lazy(() => import("./pages/register"));
const SelecionarUnidade = lazy(() => import("./pages/selecionar-unidade"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const DashboardExecutivo = lazy(() => import("./pages/dashboard-executivo"));
const DashboardCoordenador = lazy(() => import("./pages/dashboard-coordenador"));
const EcoAssistente = lazy(() => import("./pages/ecoassistente"));
const Projects = lazy(() => import("./pages/projects"));
const NewProject = lazy(() => import("./pages/new-project"));
const EditProject = lazy(() => import("./pages/edit-project"));
const ProjectDetail = lazy(() => import("./pages/project-detail"));
const NewLicense = lazy(() => import("./pages/new-license"));
const EditLicense = lazy(() => import("./pages/edit-license"));
const AlertConfig = lazy(() => import("./pages/alert-config"));
const LicencasAtivas = lazy(() => import("./pages/licencas-ativas"));
const LicencasVencer = lazy(() => import("./pages/licencas-vencer"));
const LicencasVencidas = lazy(() => import("./pages/licencas-vencidas"));
const CondicionantesPendentes = lazy(() => import("./pages/condicionantes-pendentes"));
const EntregasMes = lazy(() => import("./pages/entregas-mes"));
const Demandas = lazy(() => import("./pages/demandas"));
const Financeiro = lazy(() => import("./pages/financeiro"));
const Frota = lazy(() => import("./pages/frota"));
const Equipamentos = lazy(() => import("./pages/equipamentos"));
const Amostras = lazy(() => import("./pages/amostras"));
const Fornecedores = lazy(() => import("./pages/fornecedores"));
const Rh = lazy(() => import("./pages/rh"));
const Treinamentos = lazy(() => import("./pages/treinamentos"));
const Projetos = lazy(() => import("./pages/projetos"));
const GestaoDados = lazy(() => import("./pages/gestaoDados"));
const SegurancaTrabalho = lazy(() => import("./pages/segurancaTrabalho"));
const RelatoriosAutomaticos = lazy(() => import("./pages/relatorios-automaticos"));
const PainelIntegrado = lazy(() => import("./pages/painel-integrado"));
const MapaEmpreendimentos = lazy(() => import("./pages/mapa"));
const Calendario = lazy(() => import("./pages/calendario"));
const Cronograma = lazy(() => import("./pages/cronograma"));
const GestaoEquipe = lazy(() => import("./pages/gestao-equipe"));
const Gamificacao = lazy(() => import("./pages/gamificacao"));
const PortalColaborador = lazy(() => import("./pages/portal-colaborador"));
const MinhasTarefasSimples = lazy(() => import("./pages/minhas-tarefas-simples"));
const PropostasComerciais = lazy(() => import("./pages/propostas-comerciais"));
const BaseConhecimento = lazy(() => import("./pages/base-conhecimento"));
const Comunicacao = lazy(() => import("./pages/comunicacao"));
const ConformidadeISO = lazy(() => import("./pages/conformidade-iso"));
const RamaisContatos = lazy(() => import("./pages/ramais-contatos"));
const LinksUteis = lazy(() => import("./pages/links-uteis"));
const ProcessosMonitorados = lazy(() => import("./pages/processos-monitorados"));
const Newsletter = lazy(() => import("./pages/newsletter"));

// Portal cliente
const ClienteLogin = lazy(() => import("./pages/cliente/login"));
const ClienteDashboard = lazy(() => import("./pages/cliente/dashboard"));
const ClienteEmpreendimentoDetail = lazy(() => import("./pages/cliente/empreendimento-detail"));
const ClienteDocumentos = lazy(() => import("./pages/cliente/documentos"));

// ======= registro de rotas =======
type AppRoute = { path: string; component: React.ComponentType<any> };

const ADMIN_ROUTES: AppRoute[] = [
  { path: "/", component: Dashboard },
  { path: "/dashboard", component: Dashboard },
  { path: "/dashboard-executivo", component: DashboardExecutivo },
  { path: "/dashboard-coordenador", component: DashboardCoordenador },
  { path: "/ia", component: EcoAssistente },
  { path: "/mapa", component: MapaEmpreendimentos },
  { path: "/calendario", component: Calendario },
  { path: "/cronograma", component: Cronograma },
  { path: "/empreendimentos", component: Projects },
  { path: "/empreendimentos/novo", component: NewProject },
  { path: "/empreendimentos/:id/editar", component: EditProject },
  { path: "/empreendimentos/:id", component: ProjectDetail },
  { path: "/empreendimentos/:id/licencas/nova", component: NewLicense },
  { path: "/licencas/:id/editar", component: EditLicense },
  { path: "/alertas", component: AlertConfig },
  { path: "/licencas/ativas", component: LicencasAtivas },
  { path: "/licencas/vencer", component: LicencasVencer },
  { path: "/licencas/vencidas", component: LicencasVencidas },
  { path: "/condicionantes/pendentes", component: CondicionantesPendentes },
  { path: "/entregas/mes", component: EntregasMes },
  { path: "/painel", component: PainelIntegrado },
  { path: "/demandas", component: Demandas },
  { path: "/financeiro", component: Financeiro },
  { path: "/frota", component: Frota },
  { path: "/equipamentos", component: Equipamentos },
  { path: "/amostras", component: Amostras },
  { path: "/fornecedores", component: Fornecedores },
  { path: "/ramais-contatos", component: RamaisContatos },
  { path: "/links-uteis", component: LinksUteis },
  { path: "/rh", component: Rh },
  { path: "/treinamentos", component: Treinamentos },
  { path: "/projetos", component: Projetos },
  { path: "/gestao-dados", component: GestaoDados },
  { path: "/seguranca-trabalho", component: SegurancaTrabalho },
  { path: "/relatorios-automaticos", component: RelatoriosAutomaticos },
  { path: "/gestao-equipe", component: GestaoEquipe },
  { path: "/gamificacao", component: Gamificacao },
  { path: "/minhas-tarefas", component: PortalColaborador },
  { path: "/propostas-comerciais", component: PropostasComerciais },
  { path: "/base-conhecimento", component: BaseConhecimento },
  { path: "/comunicacao", component: Comunicacao },
  { path: "/conformidade-iso", component: ConformidadeISO },
  { path: "/processos-monitorados", component: ProcessosMonitorados },
  { path: "/newsletter", component: Newsletter },
];

const CLIENTE_ROUTES: AppRoute[] = [
  { path: "/cliente", component: ClienteDashboard },
  { path: "/cliente/empreendimentos/:id", component: ClienteEmpreendimentoDetail },
  { path: "/cliente/documentos", component: ClienteDocumentos },
];

// ======= routers por portal =======
function ClienteRouter() {
  const [location] = useLocation();

  if (location === "/cliente/login") {
    return <ClienteLogin />;
  }

  // se você tiver auth do cliente, valide aqui e redirecione para /cliente/login
  return (
    <AppShell sidebar={<ClienteSidebar />}>
      <Switch>
        {CLIENTE_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} component={r.component} />
        ))}
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function AdminRouter() {
  return (
    <AppShell sidebar={<Sidebar />}>
      <PermissionGate>
        <Switch>
          <Route path="/selecionar-unidade" component={SelecionarUnidade} />
          {ADMIN_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} component={r.component} />
          ))}
          <Route component={NotFound} />
        </Switch>
      </PermissionGate>
    </AppShell>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // opcional. focar main a cada navegação (acessibilidade)
  useEffect(() => {
    const el = document.getElementById("main");
    if (el) el.focus?.();
  }, [location]);

  if (isLoading) return <FullScreenLoader label="Carregando sessão..." />;

  // portal cliente
  if (location.startsWith("/cliente")) return <ClienteRouter />;

  // rotas públicas
  if (!isAuthenticated) {
    if (location === "/login") return <Login />;
    if (location === "/register") return <Register />;
    // canonical. força login
    return <Login />;
  }

  // sessão autenticada mas user ainda não carregou
  if (!user) return <FullScreenLoader label="Carregando perfil..." />;

  // colaborador
  if (user.cargo === "colaborador") {
    return (
      <ColaboradorLayout>
        <MinhasTarefasSimples />
      </ColaboradorLayout>
    );
  }

  // opcional. normalizar /dashboard -> /
  if (location === "/dashboard") {
    setLocation("/");
    return null;
  }

  return <AdminRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="licenca-facil-theme">
        <UnidadeProvider>
          <PermissionProvider>
            <TooltipProvider>
              <Toaster />
              <Suspense fallback={<FullScreenLoader />}>
                <Router />
              </Suspense>
            </TooltipProvider>
          </PermissionProvider>
        </UnidadeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
