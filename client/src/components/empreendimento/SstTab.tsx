import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, Plus, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import type { Colaborador, SegDocumentoColaborador } from "@shared/schema";

export interface SstTabProps {
  empreendimentoId: number;
}

export function SstTab({ empreendimentoId }: SstTabProps) {
  const { data: colaboradores = [], isLoading: isLoadingColaboradores } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/colaboradores?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar colaboradores");
      return res.json();
    },
  });

  const { data: documentos = [], isLoading: isLoadingDocumentos } = useQuery<SegDocumentoColaborador[]>({
    queryKey: ["/api/seg-documentos", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/seg-documentos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar documentos");
      return res.json();
    },
  });

  const colaboradoresAtivos = colaboradores.filter((c) => c.status === "ativo");
  const documentosValidos = documentos.filter((d) => d.status === "valido");
  const documentosVencidos = documentos.filter((d) => d.status === "vencido");
  const documentosAVencer = documentos.filter((d) => d.status === "a_vencer");

  if (isLoadingColaboradores || isLoadingDocumentos) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando informações de SST...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Segurança e Saúde do Trabalho</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Colaboradores e documentos de SST deste empreendimento
          </p>
        </div>
        <Link href="/sst">
          <Button data-testid="button-manage-sst">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar SST
          </Button>
        </Link>
      </div>

      {/* Resumo estatístico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Colaboradores</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-sst-colaboradores">{colaboradores.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Docs Válidos</p>
                <p className="text-2xl font-bold text-green-700" data-testid="stat-sst-docs-validos">{documentosValidos.length}</p>
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
                <p className="text-2xl font-bold text-yellow-700" data-testid="stat-sst-docs-a-vencer">{documentosAVencer.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-700" data-testid="stat-sst-docs-vencidos">{documentosVencidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colaboradores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Colaboradores ({colaboradores.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {colaboradores.length === 0 ? (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Nenhum colaborador cadastrado
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {colaboradores.slice(0, 10).map((colaborador) => (
                  <div
                    key={colaborador.id}
                    className="border rounded-lg p-3 hover:shadow-sm transition-shadow"
                    data-testid={`card-colaborador-${colaborador.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{colaborador.nome}</h4>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p><span className="font-medium">CPF:</span> {colaborador.cpf}</p>
                          <p><span className="font-medium">Cargo:</span> {colaborador.cargo}</p>
                          <p><span className="font-medium">Setor:</span> {colaborador.setor}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          colaborador.status === "ativo"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }`}
                      >
                        {colaborador.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Documentos SST ({documentos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentos.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Nenhum documento cadastrado
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {documentos.slice(0, 10).map((documento) => (
                  <div
                    key={documento.id}
                    className="border rounded-lg p-3 hover:shadow-sm transition-shadow"
                    data-testid={`card-documento-${documento.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{documento.tipoDocumento}</h4>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p className="line-clamp-1">{documento.descricao}</p>
                          {documento.dataValidade && (
                            <p>
                              <span className="font-medium">Validade:</span>{" "}
                              {new Date(documento.dataValidade).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ml-2 ${
                          documento.status === "valido"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : documento.status === "a_vencer"
                            ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }`}
                      >
                        {documento.status === "valido" ? "Válido" :
                         documento.status === "a_vencer" ? "A Vencer" : "Vencido"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
