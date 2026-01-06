import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, FileText, ClipboardList, Clock, CheckCircle, AlertTriangle } from "lucide-react";

interface ClienteUser {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  cliente: {
    id: number;
    razaoSocial: string;
    nomeFantasia: string;
  };
}

interface Empreendimento {
  id: number;
  nome: string;
  localizacao: string;
  status: string;
  municipio: string;
  uf: string;
}

export default function ClienteDashboard() {
  const [, navigate] = useLocation();

  const { data: user, isLoading: userLoading } = useQuery<ClienteUser>({
    queryKey: ['/api/cliente-auth/me'],
  });

  const { data: empreendimentos = [], isLoading: empLoading } = useQuery<Empreendimento[]>({
    queryKey: ['/api/cliente/empreendimentos'],
    enabled: !!user,
  });

  const statusCounts = empreendimentos.reduce((acc, emp) => {
    acc[emp.status] = (acc[emp.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (userLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Olá, {user?.nome?.split(' ')[0] || 'Cliente'}!
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Portal do Cliente - {user?.cliente?.razaoSocial}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-green-500" data-testid="card-empreendimentos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Empreendimentos
            </CardTitle>
            <Building className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{empreendimentos.length}</div>
            <p className="text-xs text-muted-foreground">projetos ativos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500" data-testid="card-ativos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Execução
            </CardTitle>
            <Clock className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statusCounts['em_execucao'] || 0}</div>
            <p className="text-xs text-muted-foreground">projetos em andamento</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500" data-testid="card-concluidos">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídos
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{statusCounts['concluido'] || 0}</div>
            <p className="text-xs text-muted-foreground">projetos finalizados</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-projetos-lista">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-green-600" />
            Seus Empreendimentos
          </CardTitle>
          <CardDescription>
            Clique em um empreendimento para ver detalhes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {empLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : empreendimentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum empreendimento encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {empreendimentos.map((emp) => (
                <Card 
                  key={emp.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-200"
                  onClick={() => navigate(`/cliente/empreendimentos/${emp.id}`)}
                  data-testid={`emp-card-${emp.id}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{emp.nome}</CardTitle>
                    <CardDescription>
                      {emp.municipio}, {emp.uf}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge 
                      variant="outline"
                      className={
                        emp.status === 'ativo' ? 'bg-green-100 text-green-800 border-green-200' :
                        emp.status === 'em_execucao' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        emp.status === 'concluido' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                        'bg-yellow-100 text-yellow-800 border-yellow-200'
                      }
                    >
                      {emp.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
