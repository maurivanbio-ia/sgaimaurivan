import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Building, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import type { LicencaAmbiental, Condicionante, Entrega } from "@shared/schema";

interface FilteredListingProps {
  title: string;
  description: string;
  apiEndpoint: string;
  type: 'licenca' | 'condicionante' | 'entrega';
  emptyMessage?: string;
}

export function FilteredListing({ title, description, apiEndpoint, type, emptyMessage }: FilteredListingProps) {
  const [, navigate] = useLocation();

  const { data: items = [], isLoading } = useQuery({
    queryKey: [apiEndpoint],
  });

  const getStatusBadge = (item: any) => {
    const hoje = new Date();
    
    if (type === 'licenca') {
      const dataVencimento = new Date(item.validade);
      const diffDays = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return <Badge variant="destructive">Vencida</Badge>;
      } else if (diffDays <= 90) {
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">A Vencer</Badge>;
      } else {
        return <Badge variant="default" className="bg-green-100 text-green-800">Ativa</Badge>;
      }
    } else if (type === 'condicionante') {
      const dataPrazo = new Date(item.prazo);
      const diffDays = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (item.cumprida) {
        return <Badge variant="default" className="bg-green-100 text-green-800">Cumprida</Badge>;
      } else if (diffDays < 0) {
        return <Badge variant="destructive">Vencida</Badge>;
      } else {
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Pendente</Badge>;
      }
    } else { // entrega
      const dataPrazo = new Date(item.prazo);
      const diffDays = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (item.entregue) {
        return <Badge variant="default" className="bg-green-100 text-green-800">Entregue</Badge>;
      } else if (diffDays < 0) {
        return <Badge variant="destructive">Atrasada</Badge>;
      } else {
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Pendente</Badge>;
      }
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'licenca': return <FileText className="h-5 w-5" />;
      case 'condicionante': return <Building className="h-5 w-5" />;
      case 'entrega': return <Package className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => navigate("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-card-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center gap-4">
              {getIcon()}
              <h3 className="text-lg font-medium text-muted-foreground">
                {emptyMessage || `Nenhum item encontrado`}
              </h3>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'item encontrado' : 'itens encontrados'}
            </p>
          </div>

          <div className="grid gap-4">
            {items.map((item: any) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getIcon()}
                        <h3 className="font-medium text-lg">
                          {type === 'licenca' ? `${item.tipo} - ${item.orgaoEmissor}` :
                           type === 'condicionante' ? item.descricao :
                           item.titulo || item.descricao}
                        </h3>
                        {getStatusBadge(item)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {type === 'licenca' && (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground">Data de Emissão</p>
                              <p className="font-medium">{formatDate(item.dataEmissao)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Validade</p>
                              <p className="font-medium">{formatDate(item.validade)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Status</p>
                              <p className="font-medium">{item.status}</p>
                            </div>
                          </>
                        )}
                        
                        {type === 'condicionante' && (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground">Prazo</p>
                              <p className="font-medium">{formatDate(item.prazo)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Periodicidade</p>
                              <p className="font-medium">{item.periodicidade}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Cumprida</p>
                              <p className="font-medium">{item.cumprida ? 'Sim' : 'Não'}</p>
                            </div>
                          </>
                        )}
                        
                        {type === 'entrega' && (
                          <>
                            <div>
                              <p className="text-xs text-muted-foreground">Prazo</p>
                              <p className="font-medium">{formatDate(item.prazo)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Responsável</p>
                              <p className="font-medium">{item.responsavel || 'Não informado'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Entregue</p>
                              <p className="font-medium">{item.entregue ? 'Sim' : 'Não'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}