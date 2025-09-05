import { Switch, Route } from "wouter";
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
