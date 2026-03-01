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
import { Building, Plus, User, MapPin, Bus, Eye, Map, Trash2, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
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
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const toggleCard = (id: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = (ids: number[]) => setExpandedCards(new Set(ids));
  const collapseAll = () => setExpandedCards(new Set());
  
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
            <div className="flex justify-end mb-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => expandAll(projects?.map(p => p.id) ?? [])} className="text-xs gap-1">
                <ChevronDown className="h-3 w-3" /> Expandir todos
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs gap-1">
                <ChevronRight className="h-3 w-3" /> Recolher todos
              </Button>
            </div>
            <div className="grid gap-2">
              {projects?.map((project) => {
                const isExpanded = expandedCards.has(project.id);
                const statusLabel = project.status?.toLowerCase() === "ativo" ? "Ativo"
                  : project.status?.toLowerCase() === "inativo" ? "Inativo"
                  : project.status?.toLowerCase() === "em_planejamento" ? "Em Planejamento"
                  : project.status?.toLowerCase() === "em_execucao" ? "Em Execução"
                  : project.status?.toLowerCase() === "concluido" ? "Concluído"
                  : project.status?.toLowerCase() === "cancelado" ? "Cancelado"
                  : project.status;
                const statusClass = project.status?.toLowerCase() === "ativo"
                  ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300"
                  : project.status?.toLowerCase() === "inativo" || project.status?.toLowerCase() === "cancelado"
                  ? "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                  : project.status?.toLowerCase() === "concluido"
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300";

                return (
                  <Card key={project.id} className="shadow-sm hover:shadow-md transition-all duration-200">
                    <CardContent className="p-0">
                      {/* Collapsed header — always visible */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                        onClick={() => toggleCard(project.id)}
                      >
                        <span className="text-muted-foreground shrink-0">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                        <h3 className="flex-1 font-semibold text-sm text-card-foreground truncate" data-testid={`text-project-name-${project.id}`}>
                          {project.nome}
                        </h3>
                        <Badge variant="secondary" className={`${statusClass} shrink-0 text-xs`} data-testid={`badge-status-${project.id}`}>
                          {statusLabel}
                        </Badge>
                        {/* Quick info when collapsed */}
                        {!isExpanded && project.localizacao && (
                          <span className="hidden sm:inline text-xs text-muted-foreground shrink-0 max-w-[200px] truncate">
                            <MapPin className="inline h-3 w-3 mr-1" />{project.localizacao}
                          </span>
                        )}
                        {/* Action buttons always visible */}
                        <div className="flex gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                          <Link href={`/empreendimentos/${project.id}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" data-testid={`button-view-details-${project.id}`}>
                              <Eye className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">Ver Detalhes</span>
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClick(project)}
                            data-testid={`button-delete-${project.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Excluir</span>
                          </Button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t bg-muted/20 space-y-1.5">
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
                      )}
                    </CardContent>
                  </Card>
                );
              })}
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
