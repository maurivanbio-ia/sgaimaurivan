import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, Filter, FileText, Building, Receipt, RefreshCw,
  CheckCircle, Clock, XCircle, DollarSign, Pencil, Trash2, FileCheck,
  ArrowUpIcon, ArrowDownIcon,
} from "lucide-react";
import { formatServerDate, parseServerDate } from "./types";
import type { FinanceiroLancamento } from "@shared/schema";

const STATUS_CONFIG = {
  aguardando: { label: "Aguardando", color: "bg-yellow-500" },
  aprovado: { label: "Aprovado", color: "bg-blue-500" },
  pago: { label: "Pago", color: "bg-green-500" },
  recusado: { label: "Recusado", color: "bg-red-500" },
};

const TIPO_CONFIG = {
  receita: { label: "Receita", color: "bg-green-100 text-green-700" },
  despesa: { label: "Despesa", color: "bg-red-100 text-red-700" },
  reembolso: { label: "Reembolso", color: "bg-blue-100 text-blue-700" },
  solicitacao_recurso: { label: "Solicitação", color: "bg-purple-100 text-purple-700" },
};

const UNIDADES_CONFIG: Record<string, { label: string; sigla: string }> = {
  salvador: { label: "Salvador (BA)", sigla: "BA" },
  goiania: { label: "Goiânia (GO)", sigla: "GO" },
  lem: { label: "Luís Eduardo Magalhães (LEM)", sigla: "LEM" },
};

export interface LancamentosFilters {
  tipo: string;
  status: string;
  empreendimento: string;
  search: string;
  unidade: string;
}

interface Props {
  lancamentos: FinanceiroLancamento[];
  filters: LancamentosFilters;
  setFilters: (f: LancamentosFilters) => void;
  recibosLancamentoIds: Set<number>;
  empMap: Map<number | null, string>;
  onUpdateStatus: (id: number, status: string) => void;
  onEmitirRecibo: (lancamento: FinanceiroLancamento) => void;
  onEdit: (lancamento: FinanceiroLancamento) => void;
  onDelete: (id: number) => void;
  isUpdatingStatus?: boolean;
}

export function LancamentosTabContent({
  lancamentos,
  filters,
  setFilters,
  recibosLancamentoIds,
  empMap,
  onUpdateStatus,
  onEmitirRecibo,
  onEdit,
  onDelete,
}: Props) {
  function clearFilters() {
    setFilters({ tipo: "todos", status: "todos", empreendimento: "", search: "", unidade: "todas" });
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar lançamentos..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
                data-testid="filter-search"
              />
            </div>

            <Select value={filters.tipo} onValueChange={(v) => setFilters({ ...filters, tipo: v })}>
              <SelectTrigger data-testid="filter-tipo"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="reembolso">Reembolso</SelectItem>
                <SelectItem value="solicitacao_recurso">Solicitação</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="recusado">Recusado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.unidade} onValueChange={(v) => setFilters({ ...filters, unidade: v })}>
              <SelectTrigger data-testid="filter-unidade"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Unidades</SelectItem>
                <SelectItem value="salvador">Salvador (BA)</SelectItem>
                <SelectItem value="goiania">Goiânia (GO)</SelectItem>
                <SelectItem value="lem">Luís Eduardo Magalhães (LEM)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Empreendimento"
              value={filters.empreendimento}
              onChange={(e) => setFilters({ ...filters, empreendimento: e.target.value })}
              data-testid="filter-empreendimento"
            />

            <Button onClick={clearFilters} variant="outline" data-testid="button-clear-filters">
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Financial Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Lançamentos Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lancamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum lançamento encontrado</p>
              <p className="text-sm">Comece criando seu primeiro lançamento financeiro clicando no botão "Novo Lançamento"</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Data</th>
                    <th className="text-left p-4">Vencimento</th>
                    <th className="text-left p-4">Pagamento</th>
                    <th className="text-left p-4">Tipo</th>
                    <th className="text-left p-4">Descrição</th>
                    <th className="text-left p-4">Valor</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Unidade</th>
                    <th className="text-left p-4">Empreendimento</th>
                    <th className="text-left p-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((lancamento) => {
                    const tipoConfig = TIPO_CONFIG[lancamento.tipo as keyof typeof TIPO_CONFIG];
                    const statusConfig = STATUS_CONFIG[lancamento.status as keyof typeof STATUS_CONFIG];
                    const vencimentoDate = parseServerDate(lancamento.dataVencimento ?? null);
                    const vencimentoVencido = vencimentoDate && vencimentoDate < new Date() && lancamento.status !== "pago";

                    return (
                      <tr key={lancamento.id} className="border-b hover:bg-muted/50" data-testid={`row-lancamento-${lancamento.id}`}>
                        <td className="p-4">{formatServerDate(lancamento.data)}</td>
                        <td className="p-4 text-sm">
                          {lancamento.dataVencimento ? (
                            <span className={vencimentoVencido ? "text-red-600 font-medium" : ""}>
                              {formatServerDate(lancamento.dataVencimento)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          {lancamento.dataPagamento ? formatServerDate(lancamento.dataPagamento) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge className={tipoConfig?.color}>{tipoConfig?.label}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="max-w-xs truncate">{lancamento.descricao}</div>
                        </td>
                        <td className="p-4 font-medium">
                          <span className={lancamento.tipo === "receita" ? "text-green-600" : "text-red-600"}>
                            {lancamento.tipo === "receita" ? "+" : "-"}R$ {Number(lancamento.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`${statusConfig?.color} text-white border-transparent w-fit`}>
                              {statusConfig?.label}
                            </Badge>
                            {recibosLancamentoIds.has(lancamento.id) && (
                              <Badge variant="outline" className="bg-violet-600 text-white border-transparent w-fit text-xs">
                                <FileCheck className="h-3 w-3 mr-1" />Recibo
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="secondary" className="text-xs">
                            {UNIDADES_CONFIG[lancamento.unidade as string]?.sigla || lancamento.unidade || "BA"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className={`text-sm ${lancamento.empreendimentoId === null ? "font-medium text-blue-600" : ""}`}>
                              {empMap.get(lancamento.empreendimentoId) || (lancamento.empreendimentoId ? `#${lancamento.empreendimentoId}` : "Escritório")}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-${lancamento.id}`}>
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => onUpdateStatus(lancamento.id, "aprovado")}
                                disabled={lancamento.status === "aprovado"}
                                data-testid={`action-approve-${lancamento.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onUpdateStatus(lancamento.id, "aguardando")}
                                disabled={lancamento.status === "aguardando"}
                                data-testid={`action-pending-${lancamento.id}`}
                              >
                                <Clock className="h-4 w-4 mr-2 text-yellow-500" />Aguardando
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onUpdateStatus(lancamento.id, "pago")}
                                disabled={lancamento.status === "pago"}
                                data-testid={`action-paid-${lancamento.id}`}
                              >
                                <DollarSign className="h-4 w-4 mr-2 text-blue-500" />Marcar como Pago
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onEmitirRecibo(lancamento)}
                                disabled={recibosLancamentoIds.has(lancamento.id)}
                              >
                                <FileCheck className="h-4 w-4 mr-2 text-violet-500" />
                                {recibosLancamentoIds.has(lancamento.id) ? "Recibo Emitido ✓" : "Emitir Recibo"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onUpdateStatus(lancamento.id, "cancelado")}
                                disabled={lancamento.status === "cancelado"}
                                data-testid={`action-cancel-${lancamento.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2 text-red-500" />Cancelar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onEdit(lancamento)}
                                data-testid={`action-edit-${lancamento.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2 text-gray-500" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDelete(lancamento.id)}
                                className="text-red-600"
                                data-testid={`action-delete-${lancamento.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
