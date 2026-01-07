import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building, Plus, User, MapPin, Bus, Eye, Map, Trash2 } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { RefreshButton } from "@/components/RefreshButton";
import MapComponent from "@/components/MapComponent";
import type { Empreendimento } from "@shared/schema";
import { useUnidade } from "@/contexts/UnidadeContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const { unidadeSelecionada } = useUnidade();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Empreendimento | null>(null);
  
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const initialTab = urlParams.get("tab") === "map" ? "map" : "list";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  useEffect(() => {
    const newTab = urlParams.get("tab") === "map" ? "map" : "list";
    setActiveTab(newTab);
  }, [search]);
  
  const { data: projects, isLoading } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos", unidadeSelecionada],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unidadeSelecionada) {
        params.set("unidade", unidadeSelecionada);
      }
      const response = await fetch(`/api/empreendimentos?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch projects");
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/empreendimentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      toast({
        title: "Empreendimento excluído",
        description: "O empreendimento foi removido com sucesso.",
      });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error?.message || "Não foi possível excluir o empreendimento.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (project: Empreendimento) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando empreendimentos...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-card-foreground">Empreendimentos</h2>
          <p className="text-muted-foreground mt-2">Gerencie os empreendimentos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <RefreshButton />
          <ExportButton entity="empreendimentos" />
          <Link href="/empreendimentos/novo">
            <Button className="font-medium" data-testid="button-new-project">
              <Plus className="mr-2 h-4 w-4" />
              Novo Empreendimento
            </Button>
          </Link>
        </div>
      </div>

      {projects && projects.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">
              <Building className="mr-2 h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="map">
              <Map className="mr-2 h-4 w-4" />
              Mapa
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="mt-6">
            <div className="grid gap-6">
              {projects.map((project) => (
                <Card key={project.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-card-foreground" data-testid={`text-project-name-${project.id}`}>
                            {project.nome}
                          </h3>
                          <Badge 
                            variant={project.status === "ativo" ? "default" : "secondary"}
                            className={project.status === "ativo" 
                              ? "bg-green-100 text-green-800 hover:bg-green-100" 
                              : "bg-gray-100 text-gray-600 hover:bg-gray-100"}
                            data-testid={`badge-status-${project.id}`}
                          >
                            {project.status === "ativo" ? "Ativo" : 
                             project.status === "inativo" ? "Inativo" :
                             project.status === "em_planejamento" ? "Em Planejamento" :
                             project.status === "em_execucao" ? "Em Execução" :
                             project.status === "concluido" ? "Concluído" : project.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            <User className="inline mr-2 h-4 w-4" />
                            <span className="font-medium">Cliente:</span> 
                            <span data-testid={`text-client-${project.id}`}> {project.cliente}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <MapPin className="inline mr-2 h-4 w-4" />
                            <span className="font-medium">Localização:</span> 
                            <span data-testid={`text-location-${project.id}`}> {project.localizacao}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <Bus className="inline mr-2 h-4 w-4" />
                            <span className="font-medium">Responsável:</span> 
                            <span data-testid={`text-responsible-${project.id}`}> {project.responsavelInterno}</span>
                          </p>
                          {project.latitude && project.longitude && (
                            <p className="text-xs text-muted-foreground">
                              <MapPin className="inline mr-2 h-3 w-3" />
                              <span className="font-medium">Coordenadas:</span> 
                              <span data-testid={`text-coordinates-${project.id}`}>
                                {parseFloat(project.latitude).toFixed(4)}, {parseFloat(project.longitude).toFixed(4)}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <Link href={`/empreendimentos/${project.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-details-${project.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            Ver Detalhes
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteClick(project)}
                          data-testid={`button-delete-${project.id}`}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="map" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="mr-2 h-5 w-5" />
                  Localização dos Empreendimentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MapComponent empreendimentos={projects} className="h-[500px]" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12">
          <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhum empreendimento cadastrado ainda
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece cadastrando seu primeiro empreendimento
          </p>
          <Link href="/empreendimentos/novo">
            <Button data-testid="button-new-project-empty">
              <Plus className="mr-2 h-4 w-4" />
              Novo Empreendimento
            </Button>
          </Link>
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o empreendimento{" "}
              <strong>{projectToDelete?.nome}</strong>? Esta ação não pode ser desfeita
              e todos os dados relacionados (licenças, demandas, etc.) serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
