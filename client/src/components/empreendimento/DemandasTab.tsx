import { useQuery } from "@tanstack/react-query";
import { formatDateBR } from "@/lib/date-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Clock, FileText, Plus } from "lucide-react";
import { Link } from "wouter";

export interface DemandasTabProps {
  empreendimentoId: number;
}

type Status = "a_fazer" | "em_andamento" | "em_revisao" | "concluido" | "cancelado";
type Prioridade = "baixa" | "media" | "alta";

type Demanda = {
  id: number;
  titulo: string;
  descricao: string;
  setor: string;
  prioridade: Prioridade;
  responsavel: string;
  dataEntrega: string;
  status: Status;
  empreendimentoId?: number;
};

const STATUS_LABEL: Record<Status, string> = {
  a_fazer: "A Fazer",
  em_andamento: "Em Andamento",
  em_revisao: "Em Revisão",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<Status, string> = {
  a_fazer: "bg-slate-100 text-slate-800 border-slate-300",
  em_andamento: "bg-blue-100 text-blue-800 border-blue-300",
  em_revisao: "bg-yellow-100 text-yellow-800 border-yellow-300",
  concluido: "bg-green-100 text-green-800 border-green-300",
  cancelado: "bg-red-100 text-red-800 border-red-300",
};

const PRIORIDADE_COLORS: Record<Prioridade, string> = {
  baixa: "bg-gray-100 text-gray-800",
  media: "bg-orange-100 text-orange-800",
  alta: "bg-red-100 text-red-800",
};

export function DemandasTab({ empreendimentoId }: DemandasTabProps) {
  const { data: demandas = [], isLoading } = useQuery<Demanda[]>({
    queryKey: ["/api/demandas", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/demandas?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar demandas");
      return res.json();
    },
  });

  // Agrupar por status
  const demandasPorStatus = demandas.reduce((acc, demanda) => {
    if (!acc[demanda.status]) acc[demanda.status] = [];
    acc[demanda.status].push(demanda);
    return acc;
  }, {} as Record<Status, Demanda[]>);

  const statusCounts = {
    a_fazer: demandasPorStatus.a_fazer?.length || 0,
    em_andamento: demandasPorStatus.em_andamento?.length || 0,
    em_revisao: demandasPorStatus.em_revisao?.length || 0,
    concluido: demandasPorStatus.concluido?.length || 0,
    cancelado: demandasPorStatus.cancelado?.length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando demandas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Demandas do Empreendimento</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe todas as demandas relacionadas a este empreendimento
          </p>
        </div>
        <Link href="/demandas">
          <Button data-testid="button-manage-demandas">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar Demandas
          </Button>
        </Link>
      </div>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-xs text-muted-foreground">A Fazer</p>
                <p className="text-2xl font-bold text-slate-700" data-testid="stat-demandas-a-fazer">{statusCounts.a_fazer}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-demandas-em-andamento">{statusCounts.em_andamento}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Revisão</p>
                <p className="text-2xl font-bold text-yellow-700" data-testid="stat-demandas-em-revisao">{statusCounts.em_revisao}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Concluído</p>
                <p className="text-2xl font-bold text-green-700" data-testid="stat-demandas-concluido">{statusCounts.concluido}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Cancelado</p>
                <p className="text-2xl font-bold text-red-700" data-testid="stat-demandas-cancelado">{statusCounts.cancelado}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {demandas.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma demanda encontrada</h3>
              <p className="text-muted-foreground mb-4">
                Este empreendimento ainda não possui demandas cadastradas.
              </p>
              <Link href="/demandas">
                <Button data-testid="button-add-first-demanda">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeira Demanda
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {demandas.slice(0, 9).map((demanda) => (
            <Card key={demanda.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-demanda-${demanda.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{demanda.titulo}</CardTitle>
                  <Badge variant="outline" className={`text-xs ml-2 ${PRIORIDADE_COLORS[demanda.prioridade]}`}>
                    {demanda.prioridade}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{demanda.descricao}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Setor:</span> {demanda.setor}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Responsável:</span> {demanda.responsavel}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Entrega:</span>{" "}
                    {formatDateBR(demanda.dataEntrega)}
                  </span>
                </div>

                <Badge variant="outline" className={`w-full justify-center border ${STATUS_COLORS[demanda.status]}`}>
                  {STATUS_LABEL[demanda.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {demandas.length > 9 && (
        <div className="text-center">
          <Link href="/demandas">
            <Button variant="outline" data-testid="button-view-all-demandas">
              Ver todas as {demandas.length} demandas
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
