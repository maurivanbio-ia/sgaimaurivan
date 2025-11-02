import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Plus, User, MapPin, Bus, Eye, Map } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { RefreshButton } from "@/components/RefreshButton";
import MapComponent from "@/components/MapComponent";
import type { Empreendimento } from "@shared/schema";
import { useUnidade } from "@/contexts/UnidadeContext";

export default function Projects() {
  const { unidadeSelecionada } = useUnidade();
  
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
        <Tabs defaultValue="list" className="w-full">
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
                        <h3 className="text-lg font-semibold text-card-foreground mb-2" data-testid={`text-project-name-${project.id}`}>
                          {project.nome}
                        </h3>
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
                      <div className="ml-4">
                        <Link href={`/empreendimentos/${project.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-view-details-${project.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            Ver Detalhes
                          </Button>
                        </Link>
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
    </div>
  );
}
