import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wrench, Plus, Package, CheckCircle, AlertCircle, LogIn, LogOut } from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface EquipamentosTabProps {
  empreendimentoId: number;
}

type Equipamento = {
  id: number;
  nome: string;
  tipo: string;
  status: string;
  localizacaoAtual: string;
  responsavel?: string;
  marca?: string;
  modelo?: string;
  numeroPatrimonio?: string;
  dataAquisicao?: string;
  ultimaManutencao?: string;
  proximaManutencao?: string;
  valorAquisicao?: number;
  observacoes?: string;
  empreendimentoId?: number;
  retiradoPor?: string;
  dataRetirada?: string;
  dataDevolvida?: string;
  condicaoDevolucao?: string;
};

export function EquipamentosTab({ empreendimentoId }: EquipamentosTabProps) {
  const { toast } = useToast();
  const [retiradaModal, setRetiradaModal] = useState<Equipamento | null>(null);
  const [devolucaoModal, setDevolucaoModal] = useState<Equipamento | null>(null);
  const [retiradaForm, setRetiradaForm] = useState({ retiradoPor: "", dataRetirada: "", dataDevolucaoPrevista: "", observacoes: "" });
  const [devolucaoForm, setDevolucaoForm] = useState({ condicaoDevolucao: "funcionando", observacoes: "" });

  const { data: equipamentos = [], isLoading } = useQuery<Equipamento[]>({
    queryKey: ["/api/equipamentos", { empreendimentoId }],
    queryFn: async () => {
      const res = await fetch(`/api/equipamentos?empreendimentoId=${empreendimentoId}`);
      if (!res.ok) throw new Error("Erro ao carregar equipamentos");
      return res.json();
    },
  });

  const retirarMutation = useMutation({
    mutationFn: (vars: { id: number; body: typeof retiradaForm }) =>
      apiRequest("POST", `/api/equipamentos/${vars.id}/retirar`, { ...vars.body, empreendimentoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos", { empreendimentoId }] });
      toast({ title: "Retirada registrada", description: "Equipamento marcado como em uso." });
      setRetiradaModal(null);
    },
    onError: () => toast({ title: "Erro", description: "Falha ao registrar retirada.", variant: "destructive" }),
  });

  const devolverMutation = useMutation({
    mutationFn: (vars: { id: number; body: typeof devolucaoForm }) =>
      apiRequest("POST", `/api/equipamentos/${vars.id}/devolver`, vars.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipamentos", { empreendimentoId }] });
      toast({ title: "Devolução registrada", description: "Equipamento marcado como disponível." });
      setDevolucaoModal(null);
    },
    onError: () => toast({ title: "Erro", description: "Falha ao registrar devolução.", variant: "destructive" }),
  });

  const equipamentosDisponiveis = equipamentos.filter((e) => e.status === "disponivel");
  const equipamentosEmUso = equipamentos.filter((e) => e.status === "em_uso");
  const equipamentosManutencao = equipamentos.filter((e) => e.status === "manutencao");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "disponivel": return "bg-green-100 text-green-800 border-green-200";
      case "em_uso": return "bg-blue-100 text-blue-800 border-blue-200";
      case "manutencao": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "disponivel": return "Disponível";
      case "em_uso": return "Em Uso";
      case "manutencao": return "Manutenção";
      default: return status;
    }
  };

  const openRetirada = (eq: Equipamento) => {
    setRetiradaForm({ retiradoPor: "", dataRetirada: new Date().toISOString().split("T")[0], dataDevolucaoPrevista: "", observacoes: "" });
    setRetiradaModal(eq);
  };

  const openDevolucao = (eq: Equipamento) => {
    setDevolucaoForm({ condicaoDevolucao: "funcionando", observacoes: "" });
    setDevolucaoModal(eq);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando equipamentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Equipamentos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Equipamentos alocados a este empreendimento
          </p>
        </div>
        <Link href="/equipamentos">
          <Button data-testid="button-manage-equipamentos">
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar Equipamentos
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-equipamentos-total">{equipamentos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Disponível</p>
                <p className="text-2xl font-bold text-green-700" data-testid="stat-equipamentos-disponiveis">{equipamentosDisponiveis.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Em Uso</p>
                <p className="text-2xl font-bold text-blue-700" data-testid="stat-equipamentos-em-uso">{equipamentosEmUso.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Manutenção</p>
                <p className="text-2xl font-bold text-yellow-700" data-testid="stat-equipamentos-manutencao">{equipamentosManutencao.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {equipamentos.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Wrench className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum equipamento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Este empreendimento ainda não possui equipamentos alocados.
              </p>
              <Link href="/equipamentos">
                <Button data-testid="button-add-first-equipamento">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Equipamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {equipamentos.slice(0, 9).map((equipamento) => (
            <Card key={equipamento.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`card-equipamento-${equipamento.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {equipamento.nome}
                  </CardTitle>
                  <Badge variant="outline" className={`text-xs ml-2 border ${getStatusColor(equipamento.status)}`}>
                    {getStatusLabel(equipamento.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Tipo:</span> {equipamento.tipo}
                  </span>
                </div>
                {equipamento.marca && equipamento.modelo && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Marca/Modelo:</span> {equipamento.marca} {equipamento.modelo}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-medium">Localização:</span> {equipamento.localizacaoAtual}
                  </span>
                </div>
                {equipamento.retiradoPor && equipamento.status === "em_uso" && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Retirado por:</span> {equipamento.retiradoPor}
                      {equipamento.dataRetirada && ` em ${new Date(equipamento.dataRetirada).toLocaleDateString("pt-BR")}`}
                    </span>
                  </div>
                )}
                {equipamento.condicaoDevolucao && equipamento.status === "disponivel" && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Condição:</span> {equipamento.condicaoDevolucao}
                    </span>
                  </div>
                )}
                {equipamento.proximaManutencao && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium">Próx. Manutenção:</span>{" "}
                      {new Date(equipamento.proximaManutencao).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {equipamento.status === "disponivel" && (
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => openRetirada(equipamento)}>
                      <LogOut className="h-3 w-3 mr-1" />
                      Retirar
                    </Button>
                  )}
                  {equipamento.status === "em_uso" && (
                    <Button size="sm" variant="outline" className="flex-1 text-xs h-7 text-green-700 border-green-300 hover:bg-green-50" onClick={() => openDevolucao(equipamento)}>
                      <LogIn className="h-3 w-3 mr-1" />
                      Devolver
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {equipamentos.length > 9 && (
        <div className="text-center">
          <Link href="/equipamentos">
            <Button variant="outline" data-testid="button-view-all-equipamentos">
              Ver todos os {equipamentos.length} equipamentos
            </Button>
          </Link>
        </div>
      )}

      {/* Modal de Retirada */}
      <Dialog open={!!retiradaModal} onOpenChange={(open) => !open && setRetiradaModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Registrar Retirada — {retiradaModal?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Retirado por *</Label>
              <Input
                value={retiradaForm.retiradoPor}
                onChange={(e) => setRetiradaForm({ ...retiradaForm, retiradoPor: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>
            <div>
              <Label>Data de Retirada</Label>
              <Input
                type="date"
                value={retiradaForm.dataRetirada}
                onChange={(e) => setRetiradaForm({ ...retiradaForm, dataRetirada: e.target.value })}
              />
            </div>
            <div>
              <Label>Previsão de Devolução</Label>
              <Input
                type="date"
                value={retiradaForm.dataDevolucaoPrevista}
                onChange={(e) => setRetiradaForm({ ...retiradaForm, dataDevolucaoPrevista: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={retiradaForm.observacoes}
                onChange={(e) => setRetiradaForm({ ...retiradaForm, observacoes: e.target.value })}
                placeholder="Observações opcionais..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetiradaModal(null)}>Cancelar</Button>
            <Button
              disabled={!retiradaForm.retiradoPor || retirarMutation.isPending}
              onClick={() => retiradaModal && retirarMutation.mutate({ id: retiradaModal.id, body: retiradaForm })}
            >
              {retirarMutation.isPending ? "Salvando..." : "Confirmar Retirada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Devolução */}
      <Dialog open={!!devolucaoModal} onOpenChange={(open) => !open && setDevolucaoModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              Registrar Devolução — {devolucaoModal?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Condição na Devolução *</Label>
              <Select
                value={devolucaoForm.condicaoDevolucao}
                onValueChange={(v) => setDevolucaoForm({ ...devolucaoForm, condicaoDevolucao: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="funcionando">Funcionando</SelectItem>
                  <SelectItem value="com_defeito">Com Defeito</SelectItem>
                  <SelectItem value="avariado">Avariado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={devolucaoForm.observacoes}
                onChange={(e) => setDevolucaoForm({ ...devolucaoForm, observacoes: e.target.value })}
                placeholder="Descreva o estado do equipamento..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevolucaoModal(null)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={devolverMutation.isPending}
              onClick={() => devolucaoModal && devolverMutation.mutate({ id: devolucaoModal.id, body: devolucaoForm })}
            >
              {devolverMutation.isPending ? "Salvando..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
