import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { useAuth } from "./lib/auth";
import Login from "./pages/login";
import Register from "./pages/register";
import SelecionarUnidade from "./pages/selecionar-unidade";
import Dashboard from "./pages/dashboard";
import DashboardExecutivo from "./pages/dashboard-executivo";
import DashboardCoordenador from "./pages/dashboard-coordenador";
import EcoAssistente from "./pages/ecoassistente";
import Projects from "./pages/projects";
import NewProject from "./pages/new-project";
import EditProject from "./pages/edit-project";
import ProjectDetail from "./pages/project-detail";
import NewLicense from "./pages/new-license";
import EditLicense from "./pages/edit-license";
import AlertConfig from "./pages/alert-config";
import LicencasAtivas from "./pages/licencas-ativas";
import LicencasVencer from "./pages/licencas-vencer";
import LicencasVencidas from "./pages/licencas-vencidas";
import CondicionantesPendentes from "./pages/condicionantes-pendentes";
import EntregasMes from "./pages/entregas-mes";
import Demandas from "./pages/demandas";
import Financeiro from "./pages/financeiro";
import Frota from "./pages/frota";
import Equipamentos from "./pages/equipamentos";
import Amostras from "./pages/amostras";
import Fornecedores from "./pages/fornecedores";
import Rh from "./pages/rh";
import Treinamentos from "./pages/treinamentos";
import Projetos from "./pages/projetos";
import GestaoDados from "./pages/gestaoDados";
import SegurancaTrabalho from "./pages/segurancaTrabalho";
import RelatoriosAutomaticos from "./pages/relatorios-automaticos";
import PainelIntegrado from "./pages/painel-integrado";
import MapaEmpreendimentos from "./pages/mapa";
import Calendario from "./pages/calendario";
import Cronograma from "./pages/cronograma";
import GestaoEquipe from "./pages/gestao-equipe";
import Gamificacao from "./pages/gamificacao";
import PortalColaborador from "./pages/portal-colaborador";
import MinhasTarefasSimples from "./pages/minhas-tarefas-simples";
import PropostasComerciais from "./pages/propostas-comerciais";
import BaseConhecimento from "./pages/base-conhecimento";
import Comunicacao from "./pages/comunicacao";
import ConformidadeISO from "./pages/conformidade-iso";
import RamaisContatos from "./pages/ramais-contatos";
import LinksUteis from "./pages/links-uteis";
import ProcessosMonitorados from "./pages/processos-monitorados";
import Newsletter from "./pages/newsletter";
import OneDriveBackups from "./pages/onedrive-backups";
import BlogPublic from "./pages/blog-public";
import BlogArtigo from "./pages/blog-artigo";
import BlogAdmin from "./pages/blog-admin";
import Sidebar from "./components/layout/sidebar";
import ColaboradorLayout from "./components/layout/colaborador-layout";
import { PermissionGate } from "./components/PermissionGate";
import ClienteSidebar from "./components/layout/cliente-sidebar";
import ClienteLogin from "./pages/cliente/login";
import ClienteDashboard from "./pages/cliente/dashboard";
import ClienteEmpreendimentoDetail from "./pages/cliente/empreendimento-detail";
import ClienteDocumentos from "./pages/cliente/documentos";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Portal do Cliente - rotas públicas e autenticadas separadas
  if (location.startsWith("/cliente")) {
    if (location === "/cliente/login") {
      return <ClienteLogin />;
    }
    // Rotas autenticadas do portal do cliente
    return (
      <div className="flex min-h-screen">
        <ClienteSidebar />
        <main className="flex-1 md:ml-64 pt-16 md:pt-0 transition-all duration-300">
          <Switch>
            <Route path="/cliente" component={ClienteDashboard} />
            <Route path="/cliente/empreendimentos/:id" component={ClienteEmpreendimentoDetail} />
            <Route path="/cliente/documentos" component={ClienteDocumentos} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    );
  }

  // Páginas públicas do blog (acessíveis sem autenticação)
  if (location === "/blog" || location.startsWith("/blog/")) {
    return (
      <Switch>
        <Route path="/blog" component={BlogPublic} />
        <Route path="/blog/:slug" component={BlogArtigo} />
      </Switch>
    );
  }

  // Permite acesso às páginas de login e registro sem autenticação
  if (!isAuthenticated && (location === "/login" || location === "/register")) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
      </Switch>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Aguarda carregar dados do usuário para verificar cargo
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Portal exclusivo para colaboradores - layout simplificado
  const isColaborador = user.cargo === "colaborador";
  
  if (isColaborador) {
    return (
      <ColaboradorLayout>
        <MinhasTarefasSimples />
      </ColaboradorLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Switch>
        <Route path="/selecionar-unidade" component={SelecionarUnidade} />
        <Route>
          {() => (
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 md:ml-64 pt-16 md:pt-0 transition-all duration-300" id="main">
                <PermissionGate>
                  <Switch>
                    <Route path="/" component={Dashboard} />
                    <Route path="/dashboard" component={Dashboard} />
                    <Route path="/dashboard-executivo" component={DashboardExecutivo} />
                    <Route path="/dashboard-coordenador" component={DashboardCoordenador} />
                    <Route path="/ia" component={EcoAssistente} />
                    <Route path="/mapa" component={MapaEmpreendimentos} />
                    <Route path="/calendario" component={Calendario} />
                    <Route path="/cronograma" component={Cronograma} />
                    <Route path="/empreendimentos" component={Projects} />
                    <Route path="/empreendimentos/novo" component={NewProject} />
                    <Route path="/empreendimentos/:id/editar" component={EditProject} />
                    <Route path="/empreendimentos/:id" component={ProjectDetail} />
                    <Route path="/empreendimentos/:id/licencas/nova" component={NewLicense} />
                    <Route path="/licencas/:id/editar" component={EditLicense} />
                    <Route path="/alertas" component={AlertConfig} />
                    <Route path="/licencas/ativas" component={LicencasAtivas} />
                    <Route path="/licencas/vencer" component={LicencasVencer} />
                    <Route path="/licencas/vencidas" component={LicencasVencidas} />
                    <Route path="/condicionantes/pendentes" component={CondicionantesPendentes} />
                    <Route path="/entregas/mes" component={EntregasMes} />
                    <Route path="/painel" component={PainelIntegrado} />
                    <Route path="/demandas" component={Demandas} />
                    <Route path="/financeiro" component={Financeiro} />
                    <Route path="/frota" component={Frota} />
                    <Route path="/equipamentos" component={Equipamentos} />
                    <Route path="/amostras" component={Amostras} />
                    <Route path="/fornecedores" component={Fornecedores} />
                    <Route path="/ramais-contatos" component={RamaisContatos} />
                    <Route path="/links-uteis" component={LinksUteis} />
                    <Route path="/rh" component={Rh} />
                    <Route path="/treinamentos" component={Treinamentos} />
                    <Route path="/projetos" component={Projetos} />
                    <Route path="/gestao-dados" component={GestaoDados} />
                    <Route path="/seguranca-trabalho" component={SegurancaTrabalho} />
                    <Route path="/relatorios-automaticos" component={RelatoriosAutomaticos} />
                    <Route path="/gestao-equipe" component={GestaoEquipe} />
                    <Route path="/gamificacao" component={Gamificacao} />
                    <Route path="/minhas-tarefas" component={PortalColaborador} />
                    <Route path="/propostas-comerciais" component={PropostasComerciais} />
                    <Route path="/base-conhecimento" component={BaseConhecimento} />
                    <Route path="/comunicacao" component={Comunicacao} />
                    <Route path="/conformidade-iso" component={ConformidadeISO} />
                    <Route path="/processos-monitorados" component={ProcessosMonitorados} />
                    <Route path="/newsletter" component={Newsletter} />
                    <Route path="/blog-admin" component={BlogAdmin} />
                    <Route path="/onedrive-backups" component={OneDriveBackups} />
                    <Route component={NotFound} />
                  </Switch>
                </PermissionGate>
              </main>
            </div>
          )}
        </Route>
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="licenca-facil-theme">
        <UnidadeProvider>
          <PermissionProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </PermissionProvider>
        </UnidadeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
