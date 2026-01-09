import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Plus, FileText, Download } from "lucide-react";
import { Link } from "wouter";

export interface GestaoDadosTabProps {
  empreendimentoId: number;
}

type Dataset = {
  id: number;
  nome: string;
  descricao: string;
  empreendimentoId: number;
  tipo: string;
  tipoDocumento?: string;
  tamanho: number;
  formato?: string;
  dataUpload: string;
  usuario: string;
  url: string;
  codigoArquivo?: string;
};

export function GestaoDadosTab({ empreendimentoId }: GestaoDadosTabProps) {
  const { data: datasets = [], isLoading } = useQuery<Dataset[]>({
    queryKey: ["/api/datasets", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/datasets?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar datasets");
      return res.json();
    },
  });

  // Agrupar por tipo
  const datasetsPorTipo = datasets.reduce((acc, dataset) => {
    if (!acc[dataset.tipo]) acc[dataset.tipo] = [];
    acc[dataset.tipo].push(dataset);
    return acc;
  }, {} as Record<string, Dataset[]>);

  const tipos = Object.keys(datasetsPorTipo);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Gestão de Dados</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Datasets e arquivos relacionados a este empreendimento
          </p>
        </div>
        <Link href="/gestao-dados">
          <Button data-testid="button-manage-datasets">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar Dados
          </Button>
        </Link>
      </div>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Datasets</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-datasets-total">{datasets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Tipos</p>
                <p className="text-2xl font-bold text-green-700" data-testid="stat-datasets-tipos">{tipos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Tamanho Total</p>
                <p className="text-lg font-bold text-purple-700" data-testid="stat-datasets-tamanho-total">
                  {formatFileSize(datasets.reduce((acc, d) => acc + d.tamanho, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Formatos</p>
                <p className="text-2xl font-bold text-orange-700" data-testid="stat-datasets-formatos">
                  {new Set(datasets.map(d => d.formato)).size}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {datasets.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum dataset encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Este empreendimento ainda não possui dados cadastrados.
              </p>
              <Link href="/gestao-dados">
                <Button data-testid="button-add-first-dataset">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Dataset
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {datasets.slice(0, 8).map((dataset) => (
            <Card key={dataset.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-dataset-${dataset.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {dataset.nome}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs ml-2">
                    {dataset.formato}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{dataset.descricao}</p>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Tipo:</span> {dataset.tipoDocumento || dataset.tipo || "N/A"}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(dataset.tamanho)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Upload:</span>{" "}
                    {new Date(dataset.dataUpload).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Por:</span> {dataset.usuario || "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {datasets.length > 8 && (
        <div className="text-center">
          <Link href="/gestao-dados">
            <Button variant="outline" data-testid="button-view-all-datasets">
              Ver todos os {datasets.length} datasets
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
