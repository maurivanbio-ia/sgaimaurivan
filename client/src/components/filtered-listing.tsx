import { useQuery } from "@tanstack/react-query";
import { parseDateSafe, formatDateBR } from "@/lib/date-utils";
import { ArrowLeft, Calendar, Building, FileText, Package, Clock, CheckCircle, AlertTriangle, XCircle, MapPin, User, Hash, Mail, Tag, Activity, BarChart2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/RefreshButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: [apiEndpoint],
  });

  const getStatusInfo = (item: any) => {
    const hoje = new Date();
    
    if (type === 'licenca') {
      hoje.setHours(0, 0, 0, 0);
      const dataVencimento = parseDateSafe(item.validade);
      const diffDays = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { 
          badge: <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Vencida</Badge>,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200"
        };
      } else if (diffDays <= 90) {
        return { 
          badge: <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />A Vencer ({diffDays} dias)</Badge>,
          color: "text-amber-600",
          bgColor: "bg-amber-50 border-amber-200"
        };
      } else {
        return { 
          badge: <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Ativa</Badge>,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      }
    } else if (type === 'condicionante') {
      const dataPrazo = parseDateSafe(item.prazo);
      const diffDays = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (item.status === 'cumprida') {
        return { 
          badge: <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Cumprida</Badge>,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      } else if (item.status === 'em_andamento') {
        if (diffDays < 0) {
          return { 
            badge: <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1"><Activity className="h-3 w-3" />Em Andamento (vencida)</Badge>,
            color: "text-orange-600",
            bgColor: "bg-orange-50 border-orange-200"
          };
        }
        return { 
          badge: <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 flex items-center gap-1"><Activity className="h-3 w-3" />Em Andamento ({diffDays}d)</Badge>,
          color: "text-indigo-600",
          bgColor: "bg-indigo-50 border-indigo-200"
        };
      } else if (item.status === 'vencida' || diffDays < 0) {
        return { 
          badge: <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Vencida</Badge>,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200"
        };
      } else if (diffDays <= 30) {
        return { 
          badge: <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Vence em {diffDays}d</Badge>,
          color: "text-amber-600",
          bgColor: "bg-amber-50 border-amber-200"
        };
      } else {
        return { 
          badge: <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"><Clock className="h-3 w-3" />Pendente ({diffDays} dias)</Badge>,
          color: "text-blue-600",
          bgColor: "bg-blue-50 border-blue-200"
        };
      }
    } else { // entrega
      const dataPrazo = parseDateSafe(item.prazo);
      const diffDays = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      if (item.status === 'entregue') {
        return { 
          badge: <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Entregue</Badge>,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200"
        };
      } else if (item.status === 'atrasada' || diffDays < 0) {
        return { 
          badge: <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />Atrasada</Badge>,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200"
        };
      } else {
        return { 
          badge: <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1"><Clock className="h-3 w-3" />Pendente ({diffDays} dias)</Badge>,
          color: "text-purple-600",
          bgColor: "bg-purple-50 border-purple-200"
        };
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
    return formatDateBR(dateString);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => navigate("/")}
            className="shadow-sm border-2 hover:shadow-md transition-all"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                {getIcon()}
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            </div>
            <p className="text-gray-600">{description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {items.length} {items.length === 1 ? 'item encontrado' : 'itens encontrados'}
                  </span>
                </div>
                <RefreshButton size="sm" variant="ghost" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
            <CardContent className="text-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  {getIcon()}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {emptyMessage || `Nenhum item encontrado`}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Não há {type === 'licenca' ? 'licenças' : type === 'condicionante' ? 'condicionantes' : 'entregas'} nesta categoria no momento.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item: any) => {
              const statusInfo = getStatusInfo(item);
              return (
                <Card key={item.id} className={`shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:scale-[1.01] ${statusInfo.bgColor}`}>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                            {getIcon()}
                          </div>
                          <div className="flex-1">
                            {type === 'condicionante' ? (
                              <>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {item.codigo && (
                                    <Badge variant="outline" className="text-xs font-mono">{item.codigo}</Badge>
                                  )}
                                  {item.item && !item.codigo && (
                                    <Badge variant="outline" className="text-xs">Item {item.item}</Badge>
                                  )}
                                  {item.tipoCondicionante && (
                                    <span className="text-xs text-gray-500 capitalize">{item.tipoCondicionante.replace('_', ' ')}</span>
                                  )}
                                </div>
                                <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                                  {item.titulo || item.descricao}
                                </h3>
                                {item.titulo && (
                                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.descricao}</p>
                                )}
                              </>
                            ) : (
                              <>
                                <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                                  {type === 'licenca' ? item.tipo : item.titulo || item.descricao}
                                </h3>
                                {type === 'licenca' && (
                                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {item.orgaoEmissor}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          {statusInfo.badge}
                          {/* Ícone de email para licenças vencendo ou vencidas */}
                          {type === 'licenca' && (statusInfo.color === 'text-amber-600' || statusInfo.color === 'text-red-600') && item.empreendimentoClienteEmail && (
                            <button
                              onClick={() => {
                                const subject = `ATENÇÃO: ${statusInfo.color === 'text-red-600' ? 'Licença Vencida' : 'Licença a Vencer'} - ${item.tipo}`;
                                const body = `Prezado(a) ${item.empreendimentoCliente},\n\nInformamos que a ${item.tipo} do empreendimento ${item.empreendimentoNome} ${statusInfo.color === 'text-red-600' ? 'venceu' : 'vencerá em breve'}.\n\nDetalhes:\n- Empreendimento: ${item.empreendimentoNome}\n- Tipo de Licença: ${item.tipo}\n- Órgão Emissor: ${item.orgaoEmissor}\n- Data de Validade: ${formatDate(item.validade)}\n- Localização: ${item.empreendimentoLocalizacao}\n\nSolicitamos a renovação com urgência para manter a conformidade ambiental.\n\nAtenciosamente,\nEcoBrasil`;
                                window.location.href = `mailto:${item.empreendimentoClienteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                              }}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                              title={`Enviar email para ${item.empreendimentoClienteEmail}`}
                              data-testid={`button-email-${item.id}`}
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />
                      
                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {type === 'licenca' && (
                          <>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Building className="h-3 w-3" />
                                Empreendimento
                              </div>
                              <p className="font-semibold text-gray-900">{item.empreendimentoNome}</p>
                              <p className="text-sm text-gray-600">{item.empreendimentoCliente}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <MapPin className="h-3 w-3" />
                                Localização
                              </div>
                              <p className="font-semibold text-gray-900">{item.empreendimentoLocalizacao}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Calendar className="h-3 w-3" />
                                Data de Emissão
                              </div>
                              <p className="font-semibold text-gray-900">{formatDate(item.dataEmissao)}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Calendar className="h-3 w-3" />
                                Validade
                              </div>
                              <p className={`font-semibold ${statusInfo.color}`}>{formatDate(item.validade)}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Hash className="h-3 w-3" />
                                ID da Licença
                              </div>
                              <p className="font-mono text-sm text-gray-900">#{item.id}</p>
                            </div>
                            {(item.empreendimentoClienteEmail || item.empreendimentoClienteTelefone) && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                  <User className="h-3 w-3" />
                                  Contato do Cliente
                                </div>
                                {item.empreendimentoClienteEmail && (
                                  <p className="text-sm text-gray-900">{item.empreendimentoClienteEmail}</p>
                                )}
                                {item.empreendimentoClienteTelefone && (
                                  <p className="text-sm text-gray-900">{item.empreendimentoClienteTelefone}</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                        
                        {type === 'condicionante' && (
                          <>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Building className="h-3 w-3" />
                                Empreendimento
                              </div>
                              <p className="font-semibold text-gray-900">{item.empreendimentoNome || '—'}</p>
                              <p className="text-sm text-gray-600">{item.empreendimentoCliente}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <FileText className="h-3 w-3" />
                                Licença
                              </div>
                              <p className="font-semibold text-gray-900">{item.licencaTipo}</p>
                              {item.licencaNumero && <p className="text-xs text-gray-500">Nº {item.licencaNumero}</p>}
                              <p className="text-sm text-gray-600">{item.licencaOrgaoEmissor}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Calendar className="h-3 w-3" />
                                Prazo
                              </div>
                              <p className={`font-semibold ${statusInfo.color}`}>{formatDate(item.prazo)}</p>
                            </div>
                            {item.categoria && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                  <Tag className="h-3 w-3" />
                                  Categoria
                                </div>
                                <p className="font-semibold text-gray-900">{item.categoria}</p>
                              </div>
                            )}
                            {item.responsavelNome && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                  <User className="h-3 w-3" />
                                  Responsável
                                </div>
                                <p className="font-semibold text-gray-900">{item.responsavelNome}</p>
                              </div>
                            )}
                            {item.progresso !== undefined && item.progresso !== null && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                  <BarChart2 className="h-3 w-3" />
                                  Progresso
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-500 h-2 rounded-full"
                                      style={{ width: `${item.progresso}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-semibold text-gray-700">{item.progresso}%</span>
                                </div>
                              </div>
                            )}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <ExternalLink className="h-3 w-3" />
                                Ações
                              </div>
                              {item.licencaId && (
                                <button
                                  onClick={() => navigate(`/licenca/${item.licencaId}`)}
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver licença
                                </button>
                              )}
                              {item.empreendimentoId && (
                                <button
                                  onClick={() => navigate(`/projects/${item.empreendimentoId}`)}
                                  className="text-xs text-green-700 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver empreendimento
                                </button>
                              )}
                            </div>
                          </>
                        )}
                        
                        {type === 'entrega' && (
                          <>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Building className="h-3 w-3" />
                                Empreendimento
                              </div>
                              <p className="font-semibold text-gray-900">{item.empreendimentoNome}</p>
                              <p className="text-sm text-gray-600">{item.empreendimentoCliente}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <FileText className="h-3 w-3" />
                                Licença Relacionada
                              </div>
                              <p className="font-semibold text-gray-900">{item.licencaTipo}</p>
                              <p className="text-sm text-gray-600">{item.licencaOrgaoEmissor}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Calendar className="h-3 w-3" />
                                Prazo
                              </div>
                              <p className={`font-semibold ${statusInfo.color}`}>{formatDate(item.prazo)}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                <Hash className="h-3 w-3" />
                                ID da Entrega
                              </div>
                              <p className="font-mono text-sm text-gray-900">#{item.id}</p>
                            </div>
                            {(item.empreendimentoClienteEmail || item.empreendimentoClienteTelefone) && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-500 uppercase tracking-wide">
                                  <User className="h-3 w-3" />
                                  Contato do Cliente
                                </div>
                                {item.empreendimentoClienteEmail && (
                                  <p className="text-sm text-gray-900">{item.empreendimentoClienteEmail}</p>
                                )}
                                {item.empreendimentoClienteTelefone && (
                                  <p className="text-sm text-gray-900">{item.empreendimentoClienteTelefone}</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}