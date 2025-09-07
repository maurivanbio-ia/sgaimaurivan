import { useState } from "react";
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
import { Eye, Plus, Search, QrCode, Settings, Trash2, Edit } from "lucide-react";
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

export default function Equipamentos() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<string>("");
  const [localizacaoFilter, setLocalizacaoFilter] = useState<string>("");

  const { data: equipamentos = [], isLoading } = useQuery({
    queryKey: ["/api/equipamentos", searchQuery, statusFilter, tipoFilter, localizacaoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (tipoFilter && tipoFilter !== "all") params.append("tipo", tipoFilter);
      if (localizacaoFilter && localizacaoFilter !== "all") params.append("localizacao", localizacaoFilter);
      
      const url = params.toString() 
        ? `/api/equipamentos/search?${params.toString()}`
        : "/api/equipamentos";
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch equipamentos');
      return res.json() as Promise<Equipamento[]>;
    }
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number | string | null) => {
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
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando equipamentos...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-equipamentos">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Equipamentos</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie todos os equipamentos da empresa
          </p>
        </div>
        <Button
          onClick={() => navigate("/equipamentos/novo")}
          className="gap-2"
          data-testid="button-new-equipment"
        >
          <Plus className="h-4 w-4" />
          Novo Equipamento
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pesquisar</label>
              <Input
                placeholder="Patrimônio, marca, modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Tabela de Equipamentos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Equipamentos ({equipamentos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {equipamentos.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                {searchQuery || statusFilter || tipoFilter || localizacaoFilter
                  ? "Nenhum equipamento encontrado com os filtros aplicados"
                  : "Nenhum equipamento cadastrado"}
              </div>
            </div>
          ) : (
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
                  {equipamentos.map((equipamento) => (
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
                          {equipamento.proximaManutencao ? formatDate(equipamento.proximaManutencao) : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/equipamentos/${equipamento.id}`)}
                            data-testid={`button-view-${equipamento.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/equipamentos/${equipamento.id}/editar`)}
                            data-testid={`button-edit-${equipamento.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/equipamentos/${equipamento.id}/qr`)}
                            data-testid={`button-qr-${equipamento.id}`}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}