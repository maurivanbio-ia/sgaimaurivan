import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Plus, Search, QrCode, Edit } from "lucide-react";
import type { Equipamento } from "@shared/schema";

// Cores/estilos por status
const statusColors = {
  funcionando: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100",
  com_defeito: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100",
  em_manutencao: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100",
  descartado: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
} as const;

const statusLabels = {
  funcionando: "Funcionando",
  com_defeito: "Com Defeito",
  em_manutencao: "Em Manutenção",
  descartado: "Descartado"
} as const;

const localizacaoLabels = {
  escritorio: "Escritório",
  cliente: "Cliente",
  colaborador: "Colaborador"
} as const;

type StatusKey = keyof typeof statusLabels;
type LocalizacaoKey = keyof typeof localizacaoLabels;

export default function Equipamentos() {
  const [, navigate] = useLocation();

  // Filtros/Busca
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // será atualizado via debounce
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<string>("");
  const [localizacaoFilter, setLocalizacaoFilter] = useState<string>("");

  // Paginação cliente
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce para busca (evita refetch a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: equipamentos = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["/api/equipamentos", searchQuery, statusFilter, tipoFilter, localizacaoFilter],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (tipoFilter && tipoFilter !== "all") params.append("tipo", tipoFilter);
      if (localizacaoFilter && localizacaoFilter !== "all") params.append("localizacao", localizacaoFilter);

      const url = params.toString()
        ? `/api/equipamentos/search?${params.toString()}`
        : "/api/equipamentos";

      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error("Não foi possível carregar os equipamentos.");
      return (await res.json()) as Equipamento[];
    }
  });

  // Quando filtros mudarem, voltar para a primeira página
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, tipoFilter, localizacaoFilter]);

  // Paginação cliente (em cima do array retornado)
  const total = equipamentos.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const pagedData = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return equipamentos.slice(start, start + pageSize);
  }, [equipamentos, pageSafe, pageSize]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === "") return "-";
    const numValue = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numValue)) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(numValue);
  };

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Equipamentos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todos os equipamentos da empresa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-page-size">
              <SelectValue placeholder="Itens/pág." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / pág.</SelectItem>
              <SelectItem value="20">20 / pág.</SelectItem>
              <SelectItem value="50">50 / pág.</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => navigate("/equipamentos/novo")}
            className="gap-2"
            data-testid="button-new-equipment"
          >
            <Plus className="h-4 w-4" />
            Novo Equipamento
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Pesquisa
            {isFetching && (
              <span className="text-xs text-muted-foreground ml-2">(atualizando...)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pesquisar</label>
              <Input
                placeholder="Patrimônio, marca, modelo..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="funcionando">Funcionando</SelectItem>
                  <SelectItem value="com_defeito">Com Defeito</SelectItem>
                  <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger data-testid="select-tipo">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="Notebook">Notebook</SelectItem>
                  <SelectItem value="Desktop">Desktop</SelectItem>
                  <SelectItem value="Monitor">Monitor</SelectItem>
                  <SelectItem value="Impressora">Impressora</SelectItem>
                  <SelectItem value="Tablet">Tablet</SelectItem>
                  <SelectItem value="Smartphone">Smartphone</SelectItem>
                  <SelectItem value="Equipamento de Campo">Equipamento de Campo</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Localização</label>
              <Select value={localizacaoFilter} onValueChange={setLocalizacaoFilter}>
                <SelectTrigger data-testid="select-localizacao">
                  <SelectValue placeholder="Todas as localizações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as localizações</SelectItem>
                  <SelectItem value="escritorio">Escritório</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estados de carregamento/erro */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600 dark:text-red-400 mb-4">
              {(error as Error)?.message || "Erro ao carregar os dados."}
            </div>
            <Button onClick={() => refetch()} variant="outline">Tentar novamente</Button>
          </CardContent>
        </Card>
      ) : (
        // Tabela
        <Card>
          <CardHeader>
            <CardTitle>
              Equipamentos ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchQuery || statusFilter || tipoFilter || localizacaoFilter
                    ? "Nenhum equipamento encontrado com os filtros aplicados"
                    : "Nenhum equipamento cadastrado"}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patrimônio</TableHead>
                        <TableHead>Tipo/Modelo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Aquisição</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Manutenção</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedData.map((equipamento) => (
                        <TableRow key={equipamento.id} data-testid={`row-equipment-${equipamento.id}`}>
                          <TableCell>
                            <div className="font-medium">{equipamento.numeroPatrimonio}</div>
                            <div className="text-sm text-muted-foreground">{equipamento.marca}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{equipamento.tipoEquipamento}</div>
                            <div className="text-sm text-muted-foreground">{equipamento.modelo}</div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                statusColors[(equipamento.status as StatusKey) ?? "funcionando"]
                              }
                              data-testid={`badge-status-${equipamento.status}`}
                            >
                              {statusLabels[(equipamento.status as StatusKey) ?? "funcionando"]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {localizacaoLabels[(equipamento.localizacaoAtual as LocalizacaoKey) ?? "escritorio"]}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {equipamento.responsavelAtual || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(equipamento.dataAquisicao)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatCurrency(equipamento.valorAquisicao)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(equipamento.proximaManutencao)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/equipamentos/${equipamento.id}`)}
                                data-testid={`button-view-${equipamento.id}`}
                                title="Visualizar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/equipamentos/${equipamento.id}/editar`)}
                                data-testid={`button-edit-${equipamento.id}`}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/equipamentos/${equipamento.id}/qr`)}
                                data-testid={`button-qr-${equipamento.id}`}
                                title="QR Code"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Paginação */}
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Página {pageSafe} de {totalPages} • {total} itens
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pageSafe <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={pageSafe >= totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
