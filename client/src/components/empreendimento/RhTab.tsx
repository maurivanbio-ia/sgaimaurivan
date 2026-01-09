import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Calendar, Building, Briefcase, Users, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export interface RhTabProps {
  empreendimentoId: number;
}

type RhRegistro = {
  id: number;
  fornecedor: string | null;
  nomeColaborador: string;
  cpf: string | null;
  rg: string | null;
  cnh: string | null;
  cargo: string | null;
  departamento: string | null;
  status: string | null;
  seguroNumero: string | null;
  valorTipo: string | null;
  valor: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-800" },
  inativo: { label: "Inativo", color: "bg-gray-100 text-gray-800" },
  ferias: { label: "Férias", color: "bg-blue-100 text-blue-800" },
  afastado: { label: "Afastado", color: "bg-yellow-100 text-yellow-800" },
};

export function RhTab({ empreendimentoId }: RhTabProps) {
  // Buscar colaboradores vinculados a este empreendimento
  const { data: registros = [], isLoading } = useQuery<RhRegistro[]>({
    queryKey: ["/api/rh", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/rh?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar registros de RH");
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando colaboradores vinculados...</div>;
  }

  // Agrupar por departamento ou cargo
  const porDepartamento = registros.reduce((acc, reg) => {
    const dept = reg.departamento || reg.cargo || "Geral";
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(reg);
    return acc;
  }, {} as Record<string, RhRegistro[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Colaboradores Vinculados
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {registros.length} colaborador{registros.length !== 1 ? 'es' : ''} vinculado{registros.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Link href="/rh">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Gerenciar no RH
          </Button>
        </Link>
      </div>

      {/* Aviso informativo */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Building className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Vinculação de Colaboradores
              </p>
              <p className="text-blue-700 dark:text-blue-300 mt-1">
                Os colaboradores exibidos aqui foram vinculados a este empreendimento pela equipe de RH.
                Para adicionar ou remover colaboradores, acesse o módulo de <strong>Recursos Humanos</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {registros.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {registros.map((reg) => {
            const statusConfig = STATUS_CONFIG[reg.status || 'ativo'];
            
            return (
              <Card key={reg.id} className="hover:shadow-md transition-shadow" data-testid={`card-rh-${reg.id}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate" data-testid={`text-nome-${reg.id}`}>
                          {reg.nomeColaborador}
                        </h4>
                        {statusConfig && (
                          <Badge variant="secondary" className={`${statusConfig.color} text-xs`}>
                            {statusConfig.label}
                          </Badge>
                        )}
                      </div>
                      
                      {(reg.cargo || reg.departamento) && (
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {reg.cargo}{reg.cargo && reg.departamento && ' • '}{reg.departamento}
                        </p>
                      )}
                      
                      {reg.fornecedor && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fornecedor: {reg.fornecedor}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {reg.contatoEmail && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate" data-testid={`text-email-${reg.id}`}>{reg.contatoEmail}</span>
                      </div>
                    )}
                    
                    {reg.contatoTelefone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span data-testid={`text-telefone-${reg.id}`}>{reg.contatoTelefone}</span>
                      </div>
                    )}
                    
                    {(reg.dataInicio || reg.dataFim) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {reg.dataInicio && formatDate(reg.dataInicio)}
                          {reg.dataInicio && reg.dataFim && ' - '}
                          {reg.dataFim && formatDate(reg.dataFim)}
                        </span>
                      </div>
                    )}
                  </div>

                  {reg.valor && reg.valorTipo && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm font-medium text-primary" data-testid={`text-valor-${reg.id}`}>
                        R$ {Number(reg.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / {reg.valorTipo}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhum colaborador vinculado
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui colaboradores vinculados.
              O cadastro e vinculação de colaboradores é feito exclusivamente pelo módulo de Recursos Humanos.
            </p>
            <Link href="/rh">
              <Button variant="default" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ir para Recursos Humanos
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
