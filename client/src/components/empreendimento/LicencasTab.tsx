import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Calendar, Building, Download, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { formatDate, getStatusLabel, getStatusClass } from "@/lib/date-utils";
import type { LicencaAmbiental } from "@shared/schema";
import { ExportButton } from "@/components/ExportButton";

interface LicencasTabProps {
  empreendimentoId: number;
}

export function LicencasTab({ empreendimentoId }: LicencasTabProps) {
  const { data: licencas = [], isLoading } = useQuery<LicencaAmbiental[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "licencas"],
  });

  const licencasAtivas = licencas.filter(l => l.status === 'ativa');
  const licencasVencidas = licencas.filter(l => l.status === 'vencida');
  const licencasAVencer = licencas.filter(l => l.status === 'a_vencer');

  if (isLoading) {
    return <div className="text-center py-8">Carregando licenças...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Licenças Ambientais
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {licencas.length} licença{licencas.length !== 1 ? 's' : ''} vinculada{licencas.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton entity="licencas" entityId={empreendimentoId} variant="outline" />
          <Link href="/licencas">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Gerenciar Licenças
            </Button>
          </Link>
        </div>
      </div>

      {/* Aviso informativo */}
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-green-900 dark:text-green-100">
                Gestão de Licenças
              </p>
              <p className="text-green-700 dark:text-green-300 mt-1">
                O cadastro e edição de licenças é feito no módulo principal de <strong>Licenças</strong>.
                Aqui você visualiza as licenças vinculadas a este empreendimento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{licencas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-green-700">{licencasAtivas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">A Vencer</p>
                <p className="text-2xl font-bold text-yellow-700">{licencasAVencer.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold text-red-700">{licencasVencidas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {licencas.length > 0 ? (
        <div className="space-y-4">
          {licencas.map((license) => (
            <Card key={license.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h4 className="text-lg font-semibold text-card-foreground mr-3" data-testid={`text-license-type-${license.id}`}>
                        {license.tipo}
                      </h4>
                      <span className={`status-badge ${getStatusClass(license.status)}`} data-testid={`text-license-status-${license.id}`}>
                        {getStatusLabel(license.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          <Building className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Órgão Emissor:</span> 
                          <span data-testid={`text-issuer-${license.id}`}> {license.orgaoEmissor}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Calendar className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Data de Emissão:</span> 
                          <span data-testid={`text-issue-date-${license.id}`}> {formatDate(license.dataEmissao)}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Calendar className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Validade:</span> 
                          <span data-testid={`text-validity-${license.id}`}> {formatDate(license.validade)}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <FileText className="inline mr-2 h-4 w-4" />
                          {license.arquivoPdf ? (
                            <a 
                              href={license.arquivoPdf} 
                              className="text-primary hover:underline"
                              data-testid={`link-download-${license.id}`}
                            >
                              <Download className="inline mr-1 h-3 w-3" />
                              Baixar PDF
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sem arquivo</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhuma licença vinculada
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui licenças ambientais cadastradas.
              O cadastro de licenças é feito no módulo principal de Licenças.
            </p>
            <Link href="/licencas">
              <Button variant="default" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ir para Licenças
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
