"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  FileSearch, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Building,
  MapPin,
  Calendar,
  History,
  Loader2,
  Activity
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const processoSchema = z.object({
  id: z.number().optional(),
  numeroProcesso: z.string().min(1, "Número do processo é obrigatório"),
  orgao: z.string().min(1, "Órgão é obrigatório"),
  tipoProcesso: z.string().optional(),
  empreendimentoId: z.number().optional().nullable(),
  licencaId: z.number().optional().nullable(),
  nomeEmpreendimento: z.string().optional(),
  interessado: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().default("BA"),
  frequenciaConsulta: z.preprocess((v) => (v === "" || v === undefined || v === null ? 24 : Number(v)), z.number().min(1).max(168)),
  alertasAtivos: z.boolean().default(true),
  emailsNotificacao: z.string().optional(),
});

type ProcessoForm = z.infer<typeof processoSchema>;

interface Processo {
  id: number;
  numeroProcesso: string;
  orgao: string;
  tipoProcesso?: string;
  empreendimentoId?: number;
  licencaId?: number;
  nomeEmpreendimento?: string;
  interessado?: string;
  municipio?: string;
  uf?: string;
  statusAtual?: string;
  ultimaMovimentacao?: string;
  dataUltimaMovimentacao?: string;
  dataUltimaConsulta?: string;
  proximaConsulta?: string;
  frequenciaConsulta?: number;
  ativo: boolean;
  alertasAtivos?: boolean;
  emailsNotificacao?: string;
  historicoMovimentacoes?: any[];
  metadados?: any;
  criadoEm?: string;
  atualizadoEm?: string;
}

interface Consulta {
  id: number;
  processoId: number;
  dataConsulta: string;
  sucesso: boolean;
  statusEncontrado?: string;
  movimentacaoEncontrada?: string;
  houveMudanca: boolean;
  dadosRetornados?: any;
  erro?: string;
  tempoResposta?: number;
}

const ORGAO_OPTIONS = [
  { value: "INEMA", label: "INEMA - Instituto do Meio Ambiente e Recursos Hídricos" },
  { value: "IBAMA", label: "IBAMA - Instituto Brasileiro do Meio Ambiente" },
  { value: "ICMBio", label: "ICMBio - Instituto Chico Mendes" },
  { value: "ANA", label: "ANA - Agência Nacional de Águas" },
  { value: "IPHAN", label: "IPHAN - Instituto do Patrimônio Histórico" },
  { value: "OUTRO", label: "Outro" },
];

const TIPO_PROCESSO_OPTIONS = [
  { value: "licenciamento", label: "Licenciamento Ambiental" },
  { value: "autorizacao", label: "Autorização Ambiental" },
  { value: "supressao", label: "Supressão de Vegetação" },
  { value: "outorga", label: "Outorga de Recursos Hídricos" },
  { value: "patrimonio", label: "Patrimônio Histórico" },
  { value: "renovacao", label: "Renovação de Licença" },
  { value: "outro", label: "Outro" },
];

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const PORTAIS_SEIA: Record<string, { nome: string; url: string; orgao: string }> = {
  BA: { nome: "SEIA Bahia", url: "https://sistema.seia.ba.gov.br", orgao: "INEMA" },
  GO: { nome: "SEIA Goiás", url: "https://seia.go.gov.br", orgao: "SEMAD-GO" },
  MT: { nome: "SIMLAM Mato Grosso", url: "https://monitoramento.sema.mt.gov.br/simlam", orgao: "SEMA-MT" },
  MS: { nome: "IMASUL", url: "https://imasul.ms.gov.br", orgao: "IMASUL" },
  MG: { nome: "SIAM Minas Gerais", url: "http://www.siam.mg.gov.br/siam/login.jsp", orgao: "SEMAD-MG" },
  ES: { nome: "IEMA Espírito Santo", url: "https://iema.es.gov.br", orgao: "IEMA-ES" },
  PR: { nome: "IAT Paraná", url: "https://www.iat.pr.gov.br", orgao: "IAT-PR" },
  SC: { nome: "IMA Santa Catarina", url: "https://www.ima.sc.gov.br", orgao: "IMA-SC" },
  RS: { nome: "FEPAM", url: "https://www.fepam.rs.gov.br", orgao: "FEPAM" },
  RJ: { nome: "INEA Rio de Janeiro", url: "https://www.inea.rj.gov.br", orgao: "INEA" },
  SP: { nome: "CETESB", url: "https://cetesb.sp.gov.br", orgao: "CETESB" },
  PE: { nome: "CPRH Pernambuco", url: "https://www.cprh.pe.gov.br", orgao: "CPRH" },
  CE: { nome: "SEMACE Ceará", url: "https://www.semace.ce.gov.br", orgao: "SEMACE" },
  PA: { nome: "SEMAS Pará", url: "https://www.semas.pa.gov.br", orgao: "SEMAS-PA" },
  AM: { nome: "IPAAM Amazonas", url: "http://www.ipaam.am.gov.br", orgao: "IPAAM" },
  TO: { nome: "NATURATINS", url: "https://naturatins.to.gov.br", orgao: "NATURATINS" },
  PI: { nome: "SEMAR Piauí", url: "https://www.semar.pi.gov.br", orgao: "SEMAR-PI" },
  MA: { nome: "SEMA Maranhão", url: "https://www.sema.ma.gov.br", orgao: "SEMA-MA" },
  RN: { nome: "IDEMA", url: "https://www.idema.rn.gov.br", orgao: "IDEMA" },
  PB: { nome: "SUDEMA", url: "https://www.sudema.pb.gov.br", orgao: "SUDEMA" },
  AL: { nome: "IMA Alagoas", url: "https://www.ima.al.gov.br", orgao: "IMA-AL" },
  SE: { nome: "ADEMA", url: "https://www.adema.se.gov.br", orgao: "ADEMA" },
  RO: { nome: "SEDAM Rondônia", url: "https://www.sedam.ro.gov.br", orgao: "SEDAM" },
  AC: { nome: "IMAC Acre", url: "https://www.imac.ac.gov.br", orgao: "IMAC" },
  AP: { nome: "SEMA Amapá", url: "https://www.sema.ap.gov.br", orgao: "SEMA-AP" },
  RR: { nome: "FEMARH Roraima", url: "https://www.femarh.rr.gov.br", orgao: "FEMARH" },
  DF: { nome: "IBRAM DF", url: "https://www.ibram.df.gov.br", orgao: "IBRAM-DF" },
  IBAMA: { nome: "IBAMA Federal", url: "https://servicos.ibama.gov.br/ctf", orgao: "IBAMA" },
  ICMBio: { nome: "ICMBio Federal", url: "https://www.icmbio.gov.br", orgao: "ICMBio" },
  ANA: { nome: "ANA Federal", url: "https://www.gov.br/ana", orgao: "ANA" },
};

const getPortalUrl = (uf?: string, orgao?: string): string => {
  if (orgao === "IBAMA" || orgao === "ICMBio" || orgao === "ANA") {
    return PORTAIS_SEIA[orgao]?.url || "";
  }
  return PORTAIS_SEIA[uf || "BA"]?.url || "https://sistema.seia.ba.gov.br";
};

const getPortalNome = (uf?: string, orgao?: string): string => {
  if (orgao === "IBAMA" || orgao === "ICMBio" || orgao === "ANA") {
    return PORTAIS_SEIA[orgao]?.nome || orgao;
  }
  return PORTAIS_SEIA[uf || "BA"]?.nome || "Portal SEIA";
};

export default function ProcessosMonitorados() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [orgaoFilter, setOrgaoFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [consultingId, setConsultingId] = useState<number | null>(null);
  
  const debouncedSearch = useDebounce(search, 300);

  const form = useForm<ProcessoForm>({
    resolver: zodResolver(processoSchema),
    defaultValues: {
      orgao: "INEMA",
      uf: "BA",
      frequenciaConsulta: 24,
      alertasAtivos: true,
    },
  });

  const { data: processos = [], isLoading } = useQuery<Processo[]>({
    queryKey: ["/api/processos-monitorados"],
  });

  const { data: empreendimentos = [] } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: licencas = [] } = useQuery<any[]>({
    queryKey: ["/api/licencas"],
  });

  const { data: seiaStatus } = useQuery<{ disponivel: boolean; mensagem: string }>({
    queryKey: ["/api/processos-monitorados/servico/status"],
    refetchInterval: 60000,
  });

  const { data: consultas = [] } = useQuery<Consulta[]>({
    queryKey: ["/api/processos-monitorados", selectedProcesso?.id, "consultas"],
    enabled: !!selectedProcesso?.id && isHistoryDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: ProcessoForm) => apiRequest("POST", "/api/processos-monitorados", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Processo adicionado ao monitoramento" });
    },
    onError: () => {
      toast({ title: "Erro ao adicionar processo", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: ProcessoForm & { id: number }) =>
      apiRequest("PATCH", `/api/processos-monitorados/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      setIsDialogOpen(false);
      setSelectedProcesso(null);
      form.reset();
      toast({ title: "Processo atualizado" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar processo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/processos-monitorados/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      setIsDeleteDialogOpen(false);
      setSelectedProcesso(null);
      toast({ title: "Processo removido do monitoramento" });
    },
    onError: () => {
      toast({ title: "Erro ao remover processo", variant: "destructive" });
    },
  });

  const consultMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/processos-monitorados/${id}/consultar`),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/processos-monitorados"] });
      setConsultingId(null);
      if (data?.resultado?.sucesso) {
        toast({ 
          title: "Consulta realizada com sucesso",
          description: data.resultado.statusAtual || "Status verificado",
        });
      } else {
        toast({ 
          title: "Consulta realizada",
          description: data?.resultado?.erro || "Verifique os detalhes",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      setConsultingId(null);
      toast({ title: "Erro ao consultar processo", variant: "destructive" });
    },
  });

  const filteredProcessos = useMemo(() => {
    return processos.filter((p) => {
      const matchesSearch =
        !debouncedSearch ||
        p.numeroProcesso.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.nomeEmpreendimento?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.interessado?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.municipio?.toLowerCase().includes(debouncedSearch.toLowerCase());
      
      const matchesOrgao = orgaoFilter === "all" || p.orgao === orgaoFilter;
      
      return matchesSearch && matchesOrgao;
    });
  }, [processos, debouncedSearch, orgaoFilter]);

  const handleEdit = (processo: Processo) => {
    setSelectedProcesso(processo);
    form.reset({
      id: processo.id,
      numeroProcesso: processo.numeroProcesso,
      orgao: processo.orgao,
      tipoProcesso: processo.tipoProcesso || undefined,
      empreendimentoId: processo.empreendimentoId || undefined,
      licencaId: processo.licencaId || undefined,
      nomeEmpreendimento: processo.nomeEmpreendimento || undefined,
      interessado: processo.interessado || undefined,
      municipio: processo.municipio || undefined,
      uf: processo.uf || "BA",
      frequenciaConsulta: processo.frequenciaConsulta || 24,
      alertasAtivos: processo.alertasAtivos ?? true,
      emailsNotificacao: processo.emailsNotificacao || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (processo: Processo) => {
    setSelectedProcesso(processo);
    setIsDeleteDialogOpen(true);
  };

  const handleViewHistory = (processo: Processo) => {
    setSelectedProcesso(processo);
    setIsHistoryDialogOpen(true);
  };

  const handleConsult = (id: number) => {
    setConsultingId(id);
    consultMutation.mutate(id);
  };

  const onSubmit = (data: ProcessoForm) => {
    if (selectedProcesso?.id) {
      updateMutation.mutate({ ...data, id: selectedProcesso.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return "bg-gray-500";
    const statusLower = status.toLowerCase();
    if (statusLower.includes("deferido") || statusLower.includes("aprovado")) return "bg-green-500";
    if (statusLower.includes("indeferido") || statusLower.includes("arquivado")) return "bg-red-500";
    if (statusLower.includes("análise") || statusLower.includes("aguardando")) return "bg-yellow-500";
    return "bg-blue-500";
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoramento de Processos</h1>
          <p className="text-muted-foreground">
            Acompanhe processos ambientais no INEMA/SEIA e outros órgãos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <Button onClick={() => {
            setSelectedProcesso(null);
            form.reset({
              orgao: "INEMA",
              uf: "BA",
              frequenciaConsulta: 24,
              alertasAtivos: true,
            });
            setIsDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Processo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Monitorados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{processos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Com Alertas Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {processos.filter(p => p.alertasAtivos).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Última Consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {processos.length > 0 && processos.some(p => p.dataUltimaConsulta)
                ? formatDistanceToNow(
                    new Date(
                      Math.max(...processos.filter(p => p.dataUltimaConsulta).map(p => new Date(p.dataUltimaConsulta!).getTime()))
                    ),
                    { addSuffix: true, locale: ptBR }
                  )
                : "Nenhuma consulta"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status SEIA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {seiaStatus?.disponivel ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-yellow-600">Verificando...</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processos Monitorados</CardTitle>
          <CardDescription>
            Lista de processos ambientais em acompanhamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, empreendimento, interessado..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={orgaoFilter} onValueChange={setOrgaoFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os órgãos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os órgãos</SelectItem>
                {ORGAO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredProcessos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum processo encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processo</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Empreendimento/Interessado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Consulta</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcessos.map((processo) => (
                    <TableRow key={processo.id}>
                      <TableCell>
                        <div className="font-medium">{processo.numeroProcesso}</div>
                        {processo.tipoProcesso && (
                          <div className="text-xs text-muted-foreground">
                            {TIPO_PROCESSO_OPTIONS.find(t => t.value === processo.tipoProcesso)?.label || processo.tipoProcesso}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{processo.orgao}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>{processo.nomeEmpreendimento || processo.interessado || "-"}</div>
                        {processo.municipio && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {processo.municipio}/{processo.uf}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(processo.statusAtual)}>
                          {processo.statusAtual || "Aguardando consulta"}
                        </Badge>
                        {processo.ultimaMovimentacao && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                            {processo.ultimaMovimentacao}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {processo.dataUltimaConsulta ? (
                          <div className="text-sm">
                            {formatDistanceToNow(new Date(processo.dataUltimaConsulta), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConsult(processo.id)}
                            disabled={consultingId === processo.id}
                            title="Consultar agora"
                          >
                            {consultingId === processo.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewHistory(processo)}
                            title="Ver histórico"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(processo)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(processo)}
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title={`Abrir ${getPortalNome(processo.uf, processo.orgao)}`}
                          >
                            <a
                              href={getPortalUrl(processo.uf, processo.orgao)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProcesso ? "Editar Processo" : "Adicionar Processo ao Monitoramento"}
            </DialogTitle>
            <DialogDescription>
              Cadastre um processo para acompanhamento automático de status
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numeroProcesso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número do Processo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 2024.01.123456.789" {...field} />
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
                          {ORGAO_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                          {TIPO_PROCESSO_OPTIONS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
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
                          {empreendimentos.map((e: any) => (
                            <SelectItem key={e.id} value={e.id.toString()}>
                              {e.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nomeEmpreendimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Empreendimento</FormLabel>
                      <FormControl>
                        <Input placeholder="Para referência" {...field} />
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
                        <Input placeholder="Nome do interessado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="municipio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Município</FormLabel>
                      <FormControl>
                        <Input placeholder="Município" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value || "BA"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UF_OPTIONS.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="frequenciaConsulta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência de Consulta (horas)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={168} {...field} />
                      </FormControl>
                      <FormDescription>
                        Intervalo entre consultas automáticas (1-168h)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emailsNotificacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mails para Notificação</FormLabel>
                      <FormControl>
                        <Input placeholder="email1@exemplo.com, email2@exemplo.com" {...field} />
                      </FormControl>
                      <FormDescription>
                        Separados por vírgula
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="alertasAtivos"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Alertas Ativos</FormLabel>
                      <FormDescription>
                        Receber notificações quando houver movimentação no processo
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {selectedProcesso ? "Salvar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover processo do monitoramento?</AlertDialogTitle>
            <AlertDialogDescription>
              O processo {selectedProcesso?.numeroProcesso} será removido do monitoramento.
              Esta ação pode ser desfeita adicionando o processo novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProcesso && deleteMutation.mutate(selectedProcesso.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Histórico de Consultas</DialogTitle>
            <DialogDescription>
              Processo: {selectedProcesso?.numeroProcesso}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            {consultas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                Nenhuma consulta realizada ainda
              </div>
            ) : (
              <div className="space-y-3">
                {consultas.map((consulta) => (
                  <Card key={consulta.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {consulta.sucesso ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {format(new Date(consulta.dataConsulta), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          {consulta.houveMudanca && (
                            <Badge variant="secondary" className="text-xs">
                              Nova movimentação
                            </Badge>
                          )}
                        </div>
                        {consulta.tempoResposta && (
                          <span className="text-xs text-muted-foreground">
                            {consulta.tempoResposta}ms
                          </span>
                        )}
                      </div>
                      {consulta.statusEncontrado && (
                        <div className="mt-2">
                          <Badge className={getStatusColor(consulta.statusEncontrado)}>
                            {consulta.statusEncontrado}
                          </Badge>
                        </div>
                      )}
                      {consulta.movimentacaoEncontrada && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {consulta.movimentacaoEncontrada}
                        </p>
                      )}
                      {consulta.erro && (
                        <p className="mt-2 text-sm text-red-500">
                          Erro: {consulta.erro}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
