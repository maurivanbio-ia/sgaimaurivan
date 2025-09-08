import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Plus, Edit, QrCode, Search } from "lucide-react";
import type { Equipamento } from "@shared/schema";

const statusColors = {
  funcionando: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100",
  com_defeito: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100", 
  em_manutencao: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100",
  descartado: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
};

const statusLabels = {
  funcionando: "Funcionando",
  com_defeito: "Com Defeito", 
  em_manutencao: "Em Manutenção",
  descartado: "Descartado"
};

const localizacaoLabels = {
  escritorio: "Escritório",
  cliente: "Cliente", 
  colaborador: "Colaborador"
};

async function fetchEquipamentos(): Promise<Equipamento[]> {
  const res = await fetch("/api/equipamentos");
  if (!res.ok) {
    throw new Error("Erro ao buscar equipamentos");
  }
  return res.json();
}

export default function EquipamentosLista() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: equipamentos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/equipamentos"],
    queryFn: fetchEquipamentos,
  });

  // Filter equipment based on search and filters
  const filteredEquipamentos = useMemo(() => {
    return equipamentos.filter(equipamento => {
      const matchesSearch = !searchQuery || 
        equipamento.numeroPatrimonio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        equipamento.marca?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        equipamento.modelo?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || equipamento.status === statusFilter;
      const matchesTipo = tipoFilter === "all" || equipamento.tipoEquipamento === tipoFilter;

      return matchesSearch && matchesStatus && matchesTipo;
    });
  }, [equipamentos, searchQuery, statusFilter, tipoFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredEquipamentos.length / pageSize);
  const currentPageEquipamentos = filteredEquipamentos.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, tipoFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return "-";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Carregando equipamentos...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Erro ao carregar equipamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-600">{(error as Error).message}</p>
            <Button onClick={() => refetch()}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Equipamentos</h1>
          <p className="text-muted-foreground mt-2">Gerencie todos os equipamentos da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / pág.</SelectItem>
              <SelectItem value="20">20 / pág.</SelectItem>
              <SelectItem value="50">50 / pág.</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild className="gap-2" data-testid="button-new-equipment">
            <Link href="/equipamentos/novo">
              <Plus className="h-4 w-4" />
              Novo Equipamento
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
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
                <SelectTrigger data-testid="select-tipo-filter">
                  <SelectValue />
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
          </div>
        </CardContent>
      </Card>

      {/* Equipment Table */}
      <Card>
        <CardHeader>
          <CardTitle>Equipamentos ({filteredEquipamentos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEquipamentos.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || tipoFilter !== "all"
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
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageEquipamentos.map((equipamento) => (
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
                            className={statusColors[equipamento.status as keyof typeof statusColors]}
                            data-testid={`badge-status-${equipamento.status}`}
                          >
                            {statusLabels[equipamento.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {localizacaoLabels[equipamento.localizacaoAtual as keyof typeof localizacaoLabels]}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{equipamento.responsavelAtual || "-"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatDate(equipamento.dataAquisicao)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatCurrency(equipamento.valorAquisicao)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              data-testid={`button-view-${equipamento.id}`}
                            >
                              <Link href={`/equipamentos/${equipamento.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              data-testid={`button-edit-${equipamento.id}`}
                            >
                              <Link href={`/equipamentos/${equipamento.id}/editar`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              data-testid={`button-qr-${equipamento.id}`}
                            >
                              <Link href={`/equipamentos/${equipamento.id}/qr`}>
                                <QrCode className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Página {page} de {totalPages} • {filteredEquipamentos.length} itens
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}