import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building, FileText, ClipboardList, MapPin, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EmpreendimentoDetail {
  id: number;
  nome: string;
  localizacao: string;
  status: string;
  municipio: string;
  uf: string;
  descricao: string;
  responsavelInterno: string;
  dataInicio: string;
  dataFimPrevista: string;
  licencasCount: number;
  demandasCount: number;
}

interface Licenca {
  id: number;
  numero: string;
  tipo: string;
  orgaoEmissor: string;
  dataEmissao: string;
  validade: string;
  status: string;
}

interface Demanda {
  id: number;
  titulo: string;
  descricao: string;
  status: string;
  prioridade: string;
  dataCriacao: string;
  dataLimite: string;
}

export default function ClienteEmpreendimentoDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const empreendimentoId = parseInt(params.id || "0");

  const { data: empreendimento, isLoading } = useQuery<EmpreendimentoDetail>({
    queryKey: ['/api/cliente/empreendimentos', empreendimentoId],
    enabled: !!empreendimentoId,
  });

  const { data: licencas = [] } = useQuery<Licenca[]>({
    queryKey: ['/api/cliente/empreendimentos', empreendimentoId, 'licencas'],
    enabled: !!empreendimentoId,
  });

  const { data: demandas = [] } = useQuery<Demanda[]>({
    queryKey: ['/api/cliente/empreendimentos', empreendimentoId, 'demandas'],
    enabled: !!empreendimentoId,
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!empreendimento) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Empreendimento não encontrado</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'ativo': 'bg-green-100 text-green-800',
      'vigente': 'bg-green-100 text-green-800',
      'em_execucao': 'bg-blue-100 text-blue-800',
      'pendente': 'bg-yellow-100 text-yellow-800',
      'concluido': 'bg-gray-100 text-gray-800',
      'concluida': 'bg-gray-100 text-gray-800',
      'vencido': 'bg-red-100 text-red-800',
      'vencida': 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cliente')} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{empreendimento.nome}</h1>
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {empreendimento.municipio}, {empreendimento.uf}
          </p>
        </div>
        <Badge 
          className={getStatusBadge(empreendimento.status)}
          variant="outline"
        >
          {empreendimento.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Responsável</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <User className="h-4 w-4 text-green-600" />
            <span>{empreendimento.responsavelInterno}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Licenças</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-2xl font-bold">{empreendimento.licencasCount || licencas.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Demandas</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-orange-600" />
            <span className="text-2xl font-bold">{empreendimento.demandasCount || demandas.length}</span>
          </CardContent>
        </Card>
      </div>

      {empreendimento.descricao && (
        <Card>
          <CardHeader>
            <CardTitle>Descrição</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{empreendimento.descricao}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="licencas">
        <TabsList>
          <TabsTrigger value="licencas" data-testid="tab-licencas">
            <FileText className="h-4 w-4 mr-2" />
            Licenças ({licencas.length})
          </TabsTrigger>
          <TabsTrigger value="demandas" data-testid="tab-demandas">
            <ClipboardList className="h-4 w-4 mr-2" />
            Demandas ({demandas.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="licencas">
          <Card>
            <CardHeader>
              <CardTitle>Licenças Ambientais</CardTitle>
              <CardDescription>Acompanhe o status das licenças do empreendimento</CardDescription>
            </CardHeader>
            <CardContent>
              {licencas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma licença encontrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Órgão Emissor</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licencas.map((licenca) => (
                      <TableRow key={licenca.id} data-testid={`licenca-row-${licenca.id}`}>
                        <TableCell className="font-medium">{licenca.numero}</TableCell>
                        <TableCell>{licenca.tipo}</TableCell>
                        <TableCell>{licenca.orgaoEmissor}</TableCell>
                        <TableCell>
                          {licenca.validade ? format(new Date(licenca.validade), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(licenca.status)}>
                            {licenca.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demandas">
          <Card>
            <CardHeader>
              <CardTitle>Demandas</CardTitle>
              <CardDescription>Acompanhe as demandas e solicitações do projeto</CardDescription>
            </CardHeader>
            <CardContent>
              {demandas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma demanda encontrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Data Limite</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demandas.map((demanda) => (
                      <TableRow key={demanda.id} data-testid={`demanda-row-${demanda.id}`}>
                        <TableCell className="font-medium">{demanda.titulo}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={
                              demanda.prioridade === 'alta' || demanda.prioridade === 'urgente' ? 'bg-red-100 text-red-800' :
                              demanda.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }
                          >
                            {demanda.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {demanda.dataLimite ? format(new Date(demanda.dataLimite), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(demanda.status)}>
                            {demanda.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
