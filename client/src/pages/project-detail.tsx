import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, getStatusLabel, getStatusClass } from "@/lib/date-utils";
import { Plus, ArrowLeft, Edit, FileText, Calendar, Building, Download, Trash2 } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import type { EmpreendimentoWithLicencas } from "@shared/schema";

export default function ProjectDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: project, isLoading } = useQuery<EmpreendimentoWithLicencas>({
    queryKey: ["/api/empreendimentos", id],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/empreendimentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      toast({
        title: "Empreendimento excluído",
        description: "O empreendimento foi excluído com sucesso.",
      });
      setLocation("/empreendimentos");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o empreendimento.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirm(`Tem certeza que deseja excluir o empreendimento "${project?.nome}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando detalhes do empreendimento...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Empreendimento não encontrado</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-card-foreground" data-testid="text-project-name">
            {project.nome}
          </h2>
          <p className="text-muted-foreground mt-2">Licenças Ambientais</p>
        </div>
        <div className="flex space-x-2">
          <ExportButton entity="licencas" entityId={parseInt(id!)} variant="outline" />
          <Link href={`/empreendimentos/${id}/licencas/nova`}>
            <Button className="font-medium" data-testid="button-new-license">
              <Plus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </Link>
          <Link href={`/empreendimentos/${id}/editar`}>
            <Button variant="outline" className="font-medium" data-testid="button-edit-project">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="font-medium"
            data-testid="button-delete-project"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/empreendimentos")}
            className="font-medium"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Project Info Card */}
      <Card className="shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cliente</p>
              <p className="text-card-foreground" data-testid="text-client">{project.cliente}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Localização</p>
              <p className="text-card-foreground" data-testid="text-location">{project.localizacao}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Responsável</p>
              <p className="text-card-foreground" data-testid="text-responsible">{project.responsavelInterno}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Licenses List */}
      {project.licencas && project.licencas.length > 0 ? (
        <div className="space-y-4">
          {project.licencas.map((license) => (
            <Card key={license.id} className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-semibold text-card-foreground mr-3" data-testid={`text-license-type-${license.id}`}>
                        {license.tipo}
                      </h3>
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
                  <div className="ml-4 flex flex-col space-y-2">
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
          <Link href={`/empreendimentos/${id}/licencas/nova`}>
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
