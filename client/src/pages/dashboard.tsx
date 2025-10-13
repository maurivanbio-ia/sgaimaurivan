import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrazoEvento {
  id: number;
  tipo: string;
  titulo: string;
  prazo: string;
  status: string;
  empreendimento?: string;
  orgaoEmissor?: string;
}

export default function Dashboard() {
  const { data: agenda, isLoading } = useQuery<PrazoEvento[]>({
    queryKey: ["/api/agenda/prazos"],
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ativo':
        return 'bg-green-500';
      case 'a vencer':
        return 'bg-yellow-500';
      case 'vencido':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ativo':
        return <CheckCircle className="h-4 w-4" />;
      case 'a vencer':
        return <Clock className="h-4 w-4" />;
      case 'vencido':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'Licença':
        return 'bg-blue-500';
      case 'Condicionante':
        return 'bg-yellow-600';
      case 'Entrega':
        return 'bg-green-600';
      case 'Fiscalização':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Agenda de Prazos</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const sortedAgenda = [...(agenda || [])].sort((a, b) => {
    return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
  });

  return (
    <div className="container mx-auto p-6">
      <Card className="shadow-sm border border-border/40">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Agenda de Prazos
          </CardTitle>
          <CardDescription>Acompanhe todos os prazos importantes de licenças e condicionantes</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedAgenda.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum prazo cadastrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedAgenda.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                  data-testid={`prazo-item-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getTipoColor(item.tipo)}>
                          {item.tipo}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getStatusIcon(item.status)}
                          {item.status}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-1" data-testid={`prazo-titulo-${item.id}`}>
                        {item.titulo}
                      </h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {item.empreendimento && (
                          <p data-testid={`prazo-empreendimento-${item.id}`}>
                            <strong>Empreendimento:</strong> {item.empreendimento}
                          </p>
                        )}
                        {item.orgaoEmissor && (
                          <p data-testid={`prazo-orgao-${item.id}`}>
                            <strong>Órgão Emissor:</strong> {item.orgaoEmissor}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold" data-testid={`prazo-data-${item.id}`}>
                          {format(new Date(item.prazo), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-border">
            <span className="text-sm font-medium text-muted-foreground">Legenda:</span>
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              Ativo
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              A Vencer
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              Vencido
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              Licença
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-600" />
              Condicionante
            </Badge>
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-600" />
              Entrega
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
