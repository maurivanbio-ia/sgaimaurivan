import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "./lib/auth";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
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
// Lazy loading for equipamentos module
const EquipamentosModule = lazy(() => import("./pages/equipamentos-main"));

function LazyEquipamentosWrapper() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mx-auto mb-4"></div>
            <div className="h-4 bg-muted rounded w-96 mx-auto"></div>
          </div>
        </div>
      </div>
    }>
      <EquipamentosModule />
    </Suspense>
  );
}
import EquipmentDashboard from "./pages/equipment-dashboard";
import Demandas from "./pages/demandas";
import Financeiro from "./pages/financeiro";
import Frota from "./pages/frota";
import PainelIntegrado from "./pages/painel-integrado";
import Header from "./components/layout/header";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Switch>
        <Route path="/" component={Dashboard} />
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
        <Route path="/equipamentos/:rest*" component={LazyEquipamentosWrapper} />
        <Route path="/demandas" component={Demandas} />
        <Route path="/financeiro" component={Financeiro} />
        <Route path="/frota" component={Frota} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="licenca-facil-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
