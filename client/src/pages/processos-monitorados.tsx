import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { ProcessoMonitorado, Empreendimento } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  RefreshCw,
  FileText,
  Building2,
  MapPin,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trash2,
  Edit,
  Eye,
  History,
  Bell,
  BellOff,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const processoSchema = z.object({
  numeroProcesso: z.string().min(1, "Número do processo é obrigatório"),
  orgao: z.string().min(1, "Órgão é obrigatório"),
  tipoProcesso: z.string().optional(),
  empreendimentoId: z.number().optional().nullable(),
  nomeEmpreendimento: z.string().optional(),
  interessado: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().default("BA"),
  frequenciaConsulta: z.number().default(24),
  alertasAtivos: z.boolean().default(true),
  emailsNotificacao: z.string().optional(),
});

type ProcessoFormData = z.infer<typeof processoSchema>;

const orgaos = [
  { value: "INEMA", label: "INEMA - Instituto do Meio Ambiente e Recursos Hídricos" },
  { value: "IBAMA", label: "IBAMA - Instituto Brasileiro do Meio Ambiente" },
  { value: "SEMA", label: "SEMA - Secretaria de Meio Ambiente" },
  { value: "ICMBio", label: "ICMBio - Instituto Chico Mendes" },
  { value: "OUTRO", label: "Outro" },
];

const tiposProcesso = [
  "Licenciamento Ambiental",
  "Autorização Ambiental",
  "Outorga de Água",
  "Supressão de Vegetação",
  "Cadastro Ambiental Rural",
  "Outro",
];

export default function ProcessosMonitorados() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoMonitorado | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOrgao, setFilterOrgao] = useState<string>("todos");
  const [showHistorico, setShowHistorico] = useState<number | null>(null);

  const { data: processos = [], isLoading } = useQuery<ProcessoMonitorado[]>({
    queryKey: ["/api/processos-monitorados"],
  });

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: servicoStatus } = useQuery<{ running: boolean; lastRun?: string }>({
    queryKey: ["/api/processos-monitorados/servico/status"],
  });

  const form = useForm<ProcessoFormData>({
    resolver: zodResolver(processoSchema),
    defaultValues: {
      numeroProcesso: "",
      orgao: "INEMA",
      tipoProcesso: "",
      empreendimentoId: null,
      nomeEmpreendimento: "",
      interessado: "",
      municipio: "",
      uf: "BA",
      frequenciaConsulta: 24,
      alertasAtivos: true,
      emailsNotificacao: "",
    },
  });

  const createProcesso = useMutation({
    mutationFn: async (data: ProcessoFormData) => {
      const response = await apiRequest("POST", "/api/processos-monitorados", {
        ...data,
        unidade: user?.unidade || "salvador",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      toast({ title: "Processo cadastrado com sucesso!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao cadastrar processo", description: error.message, variant: "destructive" });
    },
  });

  const updateProcesso = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ProcessoFormData> }) => {
      const response = await apiRequest("PATCH", `/api/processos-monitorados/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      toast({ title: "Processo atualizado!" });
      setSelectedProcesso(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteProcesso = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/processos-monitorados/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      toast({ title: "Processo removido!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });

  const consultarProcesso = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("POST", `/api/processos-monitorados/${id}/consultar`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      if (data.success) {
        toast({ title: "Consulta realizada!", description: data.message });
      } else {
        toast({ title: "Consulta com problemas", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erro na consulta", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: ProcessoFormData) => {
    if (selectedProcesso) {
      updateProcesso.mutate({ id: selectedProcesso.id, data });
    } else {
      createProcesso.mutate(data);
    }
  };

  const handleEdit = (processo: ProcessoMonitorado) => {
    setSelectedProcesso(processo);
    form.reset({
      numeroProcesso: processo.numeroProcesso,
      orgao: processo.orgao,
      tipoProcesso: processo.tipoProcesso || "",
      empreendimentoId: processo.empreendimentoId,
      nomeEmpreendimento: processo.nomeEmpreendimento || "",
      interessado: processo.interessado || "",
      municipio: processo.municipio || "",
      uf: processo.uf || "BA",
      frequenciaConsulta: processo.frequenciaConsulta || 24,
      alertasAtivos: processo.alertasAtivos ?? true,
      emailsNotificacao: processo.emailsNotificacao || "",
    });
    setIsDialogOpen(true);
  };

  const filteredProcessos = processos.filter((p) => {
    const matchSearch =
      p.numeroProcesso.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nomeEmpreendimento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.interessado?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchOrgao = filterOrgao === "todos" || p.orgao === filterOrgao;
    return matchSearch && matchOrgao;
  });

  const processosAtivos = processos.filter((p) => p.ativo);
  const processosInativos = processos.filter((p) => !p.ativo);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Processos</h1>
          <p className="text-muted-foreground">
            Acompanhamento automático de processos ambientais em órgãos governamentais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={servicoStatus?.running ? "default" : "secondary"} className="gap-1">
            {servicoStatus?.running ? (
              <>
                <CheckCircle className="w-3 h-3" /> Serviço ativo
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3" /> Serviço inativo
              </>
            )}
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedProcesso(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Novo Processo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedProcesso ? "Editar Processo" : "Cadastrar Processo para Monitoramento"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="numeroProcesso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número do Processo *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: 2024.001.000123/INEMA" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="orgao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Órgão *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o órgão" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {orgaos.map((orgao) => (
                                <SelectItem key={orgao.value} value={orgao.value}>
                                  {orgao.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="tipoProcesso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Processo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tiposProcesso.map((tipo) => (
                                <SelectItem key={tipo} value={tipo}>
                                  {tipo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="empreendimentoId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vincular a Empreendimento</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(v ? parseInt(v) : null)}
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione (opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">Nenhum</SelectItem>
                              {empreendimentos.map((emp) => (
                                <SelectItem key={emp.id} value={emp.id.toString()}>
                                  {emp.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nomeEmpreendimento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Empreendimento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome para referência" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="interessado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interessado/Requerente</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Nome do interessado" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="municipio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Município</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Município" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="BA" maxLength={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="frequenciaConsulta"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequência (horas)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              min={1}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="emailsNotificacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mails para Notificação</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="email1@exemplo.com, email2@exemplo.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="alertasAtivos"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">Receber alertas de mudanças</FormLabel>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createProcesso.isPending || updateProcesso.isPending}>
                      {(createProcesso.isPending || updateProcesso.isPending) && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {selectedProcesso ? "Salvar" : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por número, empreendimento ou interessado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterOrgao} onValueChange={setFilterOrgao}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por órgão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os órgãos</SelectItem>
            {orgaos.map((orgao) => (
              <SelectItem key={orgao.value} value={orgao.value}>
                {orgao.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{processos.length}</p>
                <p className="text-sm text-muted-foreground">Total de processos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{processosAtivos.length}</p>
                <p className="text-sm text-muted-foreground">Monitorados ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bell className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {processos.filter((p) => p.alertasAtivos).length}
                </p>
                <p className="text-sm text-muted-foreground">Com alertas ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">6h</p>
                <p className="text-sm text-muted-foreground">Intervalo de consulta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProcessos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum processo encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre processos para monitorar automaticamente suas movimentações
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Cadastrar Processo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredProcessos.map((processo) => (
            <Card key={processo.id} className={!processo.ativo ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{processo.numeroProcesso}</h3>
                      <Badge variant="outline">{processo.orgao}</Badge>
                      {processo.tipoProcesso && (
                        <Badge variant="secondary">{processo.tipoProcesso}</Badge>
                      )}
                      {processo.alertasAtivos ? (
                        <Badge variant="default" className="gap-1">
                          <Bell className="w-3 h-3" /> Alertas
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <BellOff className="w-3 h-3" /> Sem alertas
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      {processo.nomeEmpreendimento && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" /> {processo.nomeEmpreendimento}
                        </span>
                      )}
                      {processo.municipio && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" /> {processo.municipio}/{processo.uf}
                        </span>
                      )}
                      {processo.dataUltimaConsulta && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" /> Última consulta:{" "}
                          {formatDistanceToNow(new Date(processo.dataUltimaConsulta), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                    </div>
                    {processo.statusAtual && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-sm">
                          <strong>Status:</strong> {processo.statusAtual}
                        </span>
                      </div>
                    )}
                    {processo.ultimaMovimentacao && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Última movimentação:</strong> {processo.ultimaMovimentacao}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => consultarProcesso.mutate(processo.id)}
                      disabled={consultarProcesso.isPending}
                    >
                      {consultarProcesso.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Consultar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistorico(showHistorico === processo.id ? null : processo.id)}
                    >
                      <History className="w-4 h-4" />
                      <span className="ml-2 hidden sm:inline">Histórico</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(processo)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm("Tem certeza que deseja remover este processo?")) {
                          deleteProcesso.mutate(processo.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {showHistorico === processo.id && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold mb-2">Histórico de Movimentações</h4>
                    <ScrollArea className="h-[200px]">
                      {Array.isArray(processo.historicoMovimentacoes) &&
                      processo.historicoMovimentacoes.length > 0 ? (
                        <div className="space-y-2">
                          {(processo.historicoMovimentacoes as any[]).map((mov, idx) => (
                            <div key={idx} className="text-sm p-2 bg-muted rounded">
                              <p className="font-medium">{mov.status}</p>
                              <p className="text-muted-foreground">{mov.descricao}</p>
                              {mov.data && (
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(mov.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma movimentação registrada ainda.
                        </p>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
