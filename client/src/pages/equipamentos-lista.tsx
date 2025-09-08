import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Plus, Edit, QrCode, Search, Download, BarChart3, AlertTriangle } from "lucide-react";
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

const biomaOptions = [
  "Amazônia",
  "Cerrado", 
  "Caatinga",
  "Mata Atlântica",
  "Pantanal",
  "Pampa",
  "Marinho Costeiro"
];

const categoriaAmbientalOptions = [
  "Fauna",
  "Flora", 
  "Água",
  "Solo",
  "Ar",
  "Ruído",
  "Resíduos",
  "Outro"
];

// Função para calcular status da manutenção/calibração
const getMaintenanceStatus = (proximaManutencao: string | null) => {
  if (!proximaManutencao) return "sem_agendamento";
  
  const today = new Date();
  const maintenance = new Date(proximaManutencao);
  const diffTime = maintenance.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "vencida";
  if (diffDays <= 30) return "proxima_vencimento";
  return "em_dia";
};

const maintenanceStatusColors = {
  em_dia: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  proxima_vencimento: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  vencida: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  sem_agendamento: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100"
};

const maintenanceStatusLabels = {
  em_dia: "Em dia",
  proxima_vencimento: "Próxima ao vencimento",
  vencida: "Vencida",
  sem_agendamento: "Sem agendamento"
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
  const [biomaFilter, setBiomaFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState<string>("all");
  const [maintenanceFilter, setMaintenanceFilter] = useState<string>("all");
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
        equipamento.modelo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        equipamento.nome?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || equipamento.status === statusFilter;
      const matchesTipo = tipoFilter === "all" || equipamento.tipoEquipamento === tipoFilter;
      const matchesBioma = biomaFilter === "all" || (equipamento as any).bioma === biomaFilter;
      const matchesCategoria = categoriaFilter === "all" || (equipamento as any).categoriaAmbiental === categoriaFilter;
      const matchesEmpreendimento = empreendimentoFilter === "all" || (equipamento as any).empreendimentoId?.toString() === empreendimentoFilter;
      
      const maintenanceStatus = getMaintenanceStatus(equipamento.proximaManutencao);
      const matchesMaintenance = maintenanceFilter === "all" || maintenanceStatus === maintenanceFilter;

      return matchesSearch && matchesStatus && matchesTipo && matchesBioma && matchesCategoria && matchesEmpreendimento && matchesMaintenance;
    });
  }, [equipamentos, searchQuery, statusFilter, tipoFilter, biomaFilter, categoriaFilter, empreendimentoFilter, maintenanceFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredEquipamentos.length / pageSize);
  const currentPageEquipamentos = filteredEquipamentos.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, tipoFilter, biomaFilter, categoriaFilter, empreendimentoFilter, maintenanceFilter]);

  // Calculate alerts
  const maintenanceAlerts = useMemo(() => {
    const vencidas = equipamentos.filter(eq => getMaintenanceStatus(eq.proximaManutencao) === "vencida").length;
    const proximasVencimento = equipamentos.filter(eq => getMaintenanceStatus(eq.proximaManutencao) === "proxima_vencimento").length;
    return { vencidas, proximasVencimento };
  }, [equipamentos]);

  // Export to CSV function
  const exportToCSV = () => {
    const headers = [
      "Patrimônio",
      "Nome", 
      "Tipo",
      "Marca",
      "Modelo",
      "Status",
      "Localização",
      "Responsável",
      "Data Aquisição",
      "Valor Aquisição",
      "Próxima Manutenção",
      "Status Manutenção"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredEquipamentos.map(eq => [
        `"${eq.numeroPatrimonio || ""}"`,
        `"${eq.nome || ""}"`,
        `"${eq.tipoEquipamento || ""}"`,
        `"${eq.marca || ""}"`,
        `"${eq.modelo || ""}"`,
        `"${statusLabels[eq.status as keyof typeof statusLabels] || ""}"`,
        `"${localizacaoLabels[eq.localizacaoAtual as keyof typeof localizacaoLabels] || ""}"`,
        `"${eq.responsavelAtual || ""}"`,
        `"${formatDate(eq.dataAquisicao)}"`,
        `"${formatCurrency(eq.valorAquisicao)}"`,
        `"${formatDate(eq.proximaManutencao)}"`,
        `"${maintenanceStatusLabels[getMaintenanceStatus(eq.proximaManutencao) as keyof typeof maintenanceStatusLabels]}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `equipamentos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          
          {/* Alertas de Manutenção */}
          {(maintenanceAlerts.vencidas > 0 || maintenanceAlerts.proximasVencimento > 0) && (
            <div className="mt-3 flex items-center gap-4">
              {maintenanceAlerts.vencidas > 0 && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">{maintenanceAlerts.vencidas} equipamentos com manutenção vencida</span>
                </div>
              )}
              {maintenanceAlerts.proximasVencimento > 0 && (
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">{maintenanceAlerts.proximasVencimento} equipamentos próximos do vencimento (≤30 dias)</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/equipamentos/painel">
              <BarChart3 className="h-4 w-4" />
              Painel ESG
            </Link>
          </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pesquisar</label>
              <Input
                placeholder="Patrimônio, nome, marca, modelo..."
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
            <div>
              <label className="text-sm font-medium mb-2 block">Status da Manutenção</label>
              <Select value={maintenanceFilter} onValueChange={setMaintenanceFilter}>
                <SelectTrigger data-testid="select-maintenance-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="em_dia">Em dia</SelectItem>
                  <SelectItem value="proxima_vencimento">Próxima ao vencimento</SelectItem>
                  <SelectItem value="vencida">Vencida</SelectItem>
                  <SelectItem value="sem_agendamento">Sem agendamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Segunda linha de filtros ambientais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Bioma</label>
              <Select value={biomaFilter} onValueChange={setBiomaFilter}>
                <SelectTrigger data-testid="select-bioma-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os biomas</SelectItem>
                  {biomaOptions.map(bioma => (
                    <SelectItem key={bioma} value={bioma}>{bioma}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Categoria Ambiental</label>
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger data-testid="select-categoria-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categoriaAmbientalOptions.map(categoria => (
                    <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Empreendimento</label>
              <Select value={empreendimentoFilter} onValueChange={setEmpreendimentoFilter}>
                <SelectTrigger data-testid="select-empreendimento-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os empreendimentos</SelectItem>
                  {/* Aqui seria carregado da API de empreendimentos */}
                  <SelectItem value="1">Empreendimento A</SelectItem>
                  <SelectItem value="2">Empreendimento B</SelectItem>
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
                      <TableHead>Manutenção</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Aquisição</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageEquipamentos.map((equipamento) => {
                      const maintenanceStatus = getMaintenanceStatus(equipamento.proximaManutencao);
                      const isDadosSensiveis = (equipamento as any).categoriaAmbiental === "Fauna" || (equipamento as any).dadosSensiveis;
                      
                      return (
                        <TableRow key={equipamento.id} data-testid={`row-equipment-${equipamento.id}`}>
                          <TableCell>
                            <div className="font-medium">{equipamento.numeroPatrimonio}</div>
                            <div className="text-sm text-muted-foreground">{equipamento.marca}</div>
                            {isDadosSensiveis && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                🔒 Dados Sensíveis
                              </Badge>
                            )}
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
                            <Badge
                              className={maintenanceStatusColors[maintenanceStatus]}
                              data-testid={`badge-maintenance-${maintenanceStatus}`}
                            >
                              {maintenanceStatusLabels[maintenanceStatus]}
                            </Badge>
                            {equipamento.proximaManutencao && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatDate(equipamento.proximaManutencao)}
                              </div>
                            )}
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