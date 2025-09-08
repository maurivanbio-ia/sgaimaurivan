import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EquipamentosLista from "./equipamentos-lista";
import NovoEquipamento from "./equipamentos-novo";
import VerEquipamento from "./equipamentos-ver";
import EditarEquipamento from "./equipamentos-editar";
import QREquipamento from "./equipamentos-qr";

// Create a separate query client for the equipamentos module
const equipamentosQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function EquipamentosRoutes() {
  return (
    <Switch>
      {/* Most specific routes first */}
      <Route path="/equipamentos/novo" component={NovoEquipamento} />
      <Route path="/equipamentos/:id/editar" component={EditarEquipamento} />
      <Route path="/equipamentos/:id/qr" component={QREquipamento} />
      <Route path="/equipamentos/:id" component={VerEquipamento} />
      <Route path="/equipamentos" component={EquipamentosLista} />
      {/* Fallback route */}
      <Route>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
            <p className="text-muted-foreground">A página que você está procurando não existe.</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default function EquipamentosMain() {
  return (
    <QueryClientProvider client={equipamentosQueryClient}>
      <EquipamentosRoutes />
    </QueryClientProvider>
  );
}