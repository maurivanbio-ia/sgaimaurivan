import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, FileText, Calendar, Building, Download } from "lucide-react";
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

  if (isLoading) {
    return <div className="text-center py-8">Carregando licenças...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Licenças Ambientais</h3>
        <div className="flex gap-2">
          <ExportButton entity="licencas" entityId={empreendimentoId} variant="outline" />
          <Link href={`/empreendimentos/${empreendimentoId}/licencas/nova`}>
            <Button data-testid="button-new-license">
              <Plus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </Link>
        </div>
      </div>

      {licencas.length > 0 ? (
        <div className="space-y-4">
          {licencas.map((license) => (
            <Card key={license.id} className="shadow-sm">
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
                  <div className="ml-4">
                    <Link href={`/licencas/${license.id}/editar`}>
                      <Button variant="outline" size="sm" data-testid={`button-edit-license-${license.id}`}>
                        <Edit className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhuma licença cadastrada para este empreendimento
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece cadastrando a primeira licença ambiental
          </p>
          <Link href={`/empreendimentos/${empreendimentoId}/licencas/nova`}>
            <Button data-testid="button-new-license-empty">
              <Plus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
