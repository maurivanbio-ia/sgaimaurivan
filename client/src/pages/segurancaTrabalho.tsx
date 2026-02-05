
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Users, 
  FileText, 
  Shield, 
  AlertCircle,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Download,
  Brain,
  Loader2,
  Upload,
  File
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Colaborador, SegDocumentoColaborador, Empreendimento } from "@shared/schema";

export default function SegurancaTrabalho() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados
  const [activeTab, setActiveTab] = useState("colaboradores");
  const [isColaboradorDialogOpen, setIsColaboradorDialogOpen] = useState(false);
  const [isDocumentoDialogOpen, setIsDocumentoDialogOpen] = useState(false);
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null);
  const [editingDocumento, setEditingDocumento] = useState<SegDocumentoColaborador | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [suggestedNomenclatura, setSuggestedNomenclatura] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>("");
  const [isEmpreendimentoEspecifico, setIsEmpreendimentoEspecifico] = useState(false);

  // Formulário Colaborador
  const [colaboradorForm, setColaboradorForm] = useState({
    nome: "",
    cpf: "",
    cargo: "",
    setor: "",
    empreendimentoId: "",
    dataAdmissao: "",
    status: "ativo",
    email: "",
    telefone: "",
  });

  // Formulário Documento
  const [documentoForm, setDocumentoForm] = useState({
    colaboradorId: "",
    empreendimentoId: "",
    tipoDocumento: "",
    tipoDescritivo: "",
    subtipoAso: "",
    nomeDocumento: "",
    descricao: "",
    arquivoUrl: "",
    dataEmissao: "",
    dataValidade: "",
    vigenciaInicio: "",
    vigenciaFim: "",
    empresaResponsavel: "",
    medicoResponsavel: "",
    registroCrm: "",
    assinaturaResponsavel: "",
    status: "valido",
  });

  // ============================================================
  // BUSCA DE DADOS
  // ============================================================

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: colaboradores = [], isLoading: isLoadingColaboradores } = useQuery<
    Array<Colaborador & { empreendimentoNome?: string }>
  >({
    queryKey: ["/api/colaboradores", { empreendimentoId: filterEmpreendimento }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      const res = await fetch(`/api/colaboradores?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar colaboradores");
      return res.json();
    },
  });

  const { data: documentos = [], isLoading: isLoadingDocumentos } = useQuery<
    Array<SegDocumentoColaborador & { colaboradorNome?: string; empreendimentoNome?: string }>
  >({
    queryKey: ["/api/seg-documentos", { empreendimentoId: filterEmpreendimento }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      const res = await fetch(`/api/seg-documentos?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar documentos");
      return res.json();
    },
  });

  const { data: indicadores } = useQuery({
    queryKey: ["/api/seguranca/indicadores", { empreendimentoId: filterEmpreendimento }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      const res = await fetch(`/api/seguranca/indicadores?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar indicadores");
      return res.json();
    },
  });

  // ============================================================
  // MUTATIONS COLABORADORES
  // ============================================================

  const createColaboradorMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/colaboradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar colaborador");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seguranca/indicadores"] });
      toast({ title: "Sucesso", description: "Colaborador criado com sucesso!" });
      resetColaboradorForm();
      setIsColaboradorDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar colaborador.", variant: "destructive" });
    },
  });

  const updateColaboradorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/colaboradores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar colaborador");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seguranca/indicadores"] });
      toast({ title: "Sucesso", description: "Colaborador atualizado com sucesso!" });
      resetColaboradorForm();
      setIsColaboradorDialogOpen(false);
      setEditingColaborador(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar colaborador.", variant: "destructive" });
    },
  });

  const deleteColaboradorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/colaboradores/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir colaborador");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colaboradores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seguranca/indicadores"] });
      toast({ title: "Sucesso", description: "Colaborador excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir colaborador.", variant: "destructive" });
    },
  });

  // ============================================================
  // MUTATIONS DOCUMENTOS
  // ============================================================

  const createDocumentoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/seg-documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar documento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seg-documentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seguranca/indicadores"] });
      toast({ title: "Sucesso", description: "Documento criado com sucesso!" });
      resetDocumentoForm();
      setIsDocumentoDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar documento.", variant: "destructive" });
    },
  });

  const updateDocumentoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/seg-documentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar documento");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seg-documentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seguranca/indicadores"] });
      toast({ title: "Sucesso", description: "Documento atualizado com sucesso!" });
      resetDocumentoForm();
      setIsDocumentoDialogOpen(false);
      setEditingDocumento(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar documento.", variant: "destructive" });
    },
  });

  const deleteDocumentoMutation = useMutation({
    mutationFn: async (id: number) => {
      const numericId = typeof id === 'number' ? id : parseInt(String(id));
      if (isNaN(numericId)) throw new Error("ID inválido");
      console.log('[SST] Chamando DELETE para documento ID:', numericId);
      const res = await fetch(`/api/seg-documentos/${numericId}`, { method: "DELETE" });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[SST] Erro ao excluir:', res.status, errorText);
        throw new Error("Erro ao excluir documento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seg-documentos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seguranca/indicadores"] });
      toast({ title: "Sucesso", description: "Documento excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir documento.", variant: "destructive" });
    },
  });

  // ============================================================
  // HANDLERS
  // ============================================================

  const resetColaboradorForm = () => {
    setColaboradorForm({
      nome: "",
      cpf: "",
      cargo: "",
      setor: "",
      empreendimentoId: "",
      dataAdmissao: "",
      status: "ativo",
      email: "",
      telefone: "",
    });
  };

  const resetDocumentoForm = () => {
    setDocumentoForm({
      colaboradorId: "",
      empreendimentoId: "",
      tipoDocumento: "",
      tipoDescritivo: "",
      subtipoAso: "",
      nomeDocumento: "",
      descricao: "",
      arquivoUrl: "",
      dataEmissao: "",
      dataValidade: "",
      vigenciaInicio: "",
      vigenciaFim: "",
      empresaResponsavel: "",
      medicoResponsavel: "",
      registroCrm: "",
      assinaturaResponsavel: "",
      status: "valido",
    });
    setAiAnalysis(null);
    setSuggestedNomenclatura(null);
    setSelectedFile(null);
    setDocumentContent("");
    setIsEmpreendimentoEspecifico(false);
  };

  const handleSaveColaborador = () => {
    if (!colaboradorForm.nome || !colaboradorForm.cpf || !colaboradorForm.empreendimentoId) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    const data = {
      ...colaboradorForm,
      empreendimentoId: parseInt(colaboradorForm.empreendimentoId),
    };

    if (editingColaborador) {
      updateColaboradorMutation.mutate({ id: editingColaborador.id, data });
    } else {
      createColaboradorMutation.mutate(data);
    }
  };

  const handleEditColaborador = (colaborador: Colaborador) => {
    setEditingColaborador(colaborador);
    setColaboradorForm({
      nome: colaborador.nome,
      cpf: colaborador.cpf,
      cargo: colaborador.cargo || "",
      setor: colaborador.setor || "",
      empreendimentoId: colaborador.empreendimentoId.toString(),
      dataAdmissao: colaborador.dataAdmissao || "",
      status: colaborador.status || "ativo",
      email: colaborador.email || "",
      telefone: colaborador.telefone || "",
    });
    setIsColaboradorDialogOpen(true);
  };

  const handleSaveDocumento = () => {
    if (!documentoForm.colaboradorId || !documentoForm.tipoDocumento) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    // Trata caso especial "escritorio" - envia colaboradorId como null e colaboradorNome como "Escritório"
    const isEscritorio = documentoForm.colaboradorId === "escritorio";
    const data = {
      ...documentoForm,
      colaboradorId: isEscritorio ? null : parseInt(documentoForm.colaboradorId),
      colaboradorNome: isEscritorio ? "Escritório" : undefined,
      empreendimentoId: documentoForm.empreendimentoId ? parseInt(documentoForm.empreendimentoId) : undefined,
    };

    if (editingDocumento) {
      updateDocumentoMutation.mutate({ id: editingDocumento.id, data });
    } else {
      createDocumentoMutation.mutate(data);
    }
  };

  // Função para fazer upload do arquivo
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setSelectedFile(file);
    
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      
      const response = await fetch("/api/sst/upload-documento", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Falha no upload");
      
      const result = await response.json();
      setDocumentoForm(prev => ({ ...prev, arquivoUrl: result.url }));
      setDocumentContent(result.textContent || "");
      
      toast({ title: "Upload concluído", description: `Arquivo "${result.fileName}" enviado com sucesso.` });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao fazer upload do arquivo.", variant: "destructive" });
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Função para converter data DD/MM/YYYY para YYYY-MM-DD (formato do input date)
  const parseDataBR = (dataBR: string | null): string => {
    if (!dataBR || dataBR === 'null') return '';
    const match = dataBR.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return '';
  };

  // Função para analisar documento com IA
  const handleAnalyzeDocument = async () => {
    if (!documentContent && !selectedFile) {
      toast({ title: "Aviso", description: "Faça o upload de um documento primeiro.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setAiAnalysis(null);
    setSuggestedNomenclatura(null);

    try {
      const response = await fetch("/api/sst/analisar-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: documentoForm.tipoDocumento || "outro",
          nome: selectedFile?.name || "documento",
          conteudo: documentContent || `Documento: ${selectedFile?.name || "sem nome"}`,
        }),
      });

      if (!response.ok) throw new Error("Falha na análise");

      const result = await response.json();
      
      // DEBUG: Log completo da resposta da IA
      console.log('========================================');
      console.log('[SST IA] RESPOSTA COMPLETA DA ANÁLISE:', JSON.stringify(result, null, 2));
      console.log('[SST IA] Médico Responsável:', result.medicoResponsavel);
      console.log('[SST IA] Registro CRM:', result.registroCrm);
      console.log('[SST IA] Empresa Responsável:', result.empresaResponsavel);
      console.log('[SST IA] Vigência Início:', result.vigenciaInicio);
      console.log('[SST IA] Vigência Fim:', result.vigenciaFim);
      console.log('========================================');
      
      // Atualiza o formulário com TODAS as informações extraídas pela IA
      const updates: Partial<typeof documentoForm> = {};
      
      // Descrição curta
      if (result.descricao) {
        updates.descricao = result.descricao;
        setAiAnalysis(result.descricao);
      }
      
      // Data de emissão
      if (result.dataEmissao && result.dataEmissao !== 'null') {
        const dataFormatada = parseDataBR(result.dataEmissao);
        if (dataFormatada) updates.dataEmissao = dataFormatada;
      }
      
      // Data de validade
      if (result.dataValidade && result.dataValidade !== 'null') {
        const dataFormatada = parseDataBR(result.dataValidade);
        if (dataFormatada) updates.dataValidade = dataFormatada;
      }
      
      // Responsável pela assinatura
      if (result.responsavel && result.responsavel !== 'null') {
        updates.assinaturaResponsavel = result.responsavel;
      }
      
      // Status do documento - CALCULAR AUTOMATICAMENTE baseado na data de validade
      if (updates.dataValidade) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataValidade = new Date(updates.dataValidade);
        const diffDias = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDias < 0) {
          updates.status = 'vencido';
        } else if (diffDias <= 30) {
          updates.status = 'proximo_vencimento';
        } else {
          updates.status = 'valido';
        }
        console.log(`[SST IA] Status calculado: ${updates.status} (${diffDias} dias para vencer)`);
      } else if (result.status && result.status !== 'null') {
        const statusMap: Record<string, string> = {
          'valido': 'valido',
          'vencido': 'vencido',
          'proximo_vencimento': 'proximo_vencimento'
        };
        if (statusMap[result.status]) {
          updates.status = statusMap[result.status];
        }
      }
      
      // Tipo de documento - já vem no formato correto do backend (ASO, NR, EPI, CIPA, outro)
      if (result.tipoDocumento && result.tipoDocumento !== 'null') {
        updates.tipoDocumento = result.tipoDocumento;
      }
      
      // Tipo descritivo - o tipo real do documento (PCMSO, PGR, ASO, LTCAT, etc.)
      if (result.tipoDescritivo && result.tipoDescritivo !== 'null') {
        updates.tipoDescritivo = result.tipoDescritivo;
      }
      
      // Subtipo de ASO (admissional, demissional, periodico, retorno, mudanca_funcao)
      if (result.subtipoAso && result.subtipoAso !== 'null') {
        updates.subtipoAso = result.subtipoAso;
      }
      
      // Nomenclatura sugerida - preenche o campo Nome do Documento automaticamente
      if (result.nomenclatura && result.nomenclatura !== 'null') {
        setSuggestedNomenclatura(result.nomenclatura);
        updates.nomeDocumento = result.nomenclatura;
      }
      
      // Seleção automática de Colaborador
      if (result.isDocumentoGeral === true) {
        // Documento geral da empresa - seleciona "Escritório"
        updates.colaboradorId = "escritorio";
      } else if (result.nomeColaborador && result.nomeColaborador !== 'null') {
        // Documento individual - tenta encontrar o colaborador pelo nome
        const nomeColabLower = result.nomeColaborador.toLowerCase();
        const colaboradorEncontrado = colaboradores.find(c => 
          c.nome.toLowerCase().includes(nomeColabLower) || 
          nomeColabLower.includes(c.nome.toLowerCase().split(' ')[0])
        );
        if (colaboradorEncontrado) {
          updates.colaboradorId = colaboradorEncontrado.id.toString();
        }
      }
      
      // Empresa responsável (clínica/consultoria)
      if (result.empresaResponsavel && result.empresaResponsavel !== 'null') {
        updates.empresaResponsavel = result.empresaResponsavel;
      }
      
      // Médico responsável
      if (result.medicoResponsavel && result.medicoResponsavel !== 'null') {
        updates.medicoResponsavel = result.medicoResponsavel;
      }
      
      // Registro CRM
      if (result.registroCrm && result.registroCrm !== 'null') {
        updates.registroCrm = result.registroCrm;
      }
      
      // Vigência (De - Até)
      if (result.vigenciaInicio && result.vigenciaInicio !== 'null') {
        const dataFormatada = parseDataBR(result.vigenciaInicio);
        if (dataFormatada) updates.vigenciaInicio = dataFormatada;
      } else if (updates.dataEmissao) {
        // Fallback: usa data de emissão como início de vigência
        updates.vigenciaInicio = updates.dataEmissao;
      }
      
      if (result.vigenciaFim && result.vigenciaFim !== 'null') {
        const dataFormatada = parseDataBR(result.vigenciaFim);
        if (dataFormatada) updates.vigenciaFim = dataFormatada;
      } else if (updates.dataValidade) {
        // Fallback: usa data de validade como fim de vigência
        updates.vigenciaFim = updates.dataValidade;
      }
      
      // Aplica todas as atualizações de uma vez
      if (Object.keys(updates).length > 0) {
        setDocumentoForm(prev => ({ ...prev, ...updates }));
      }

      const camposPreenchidos = Object.keys(updates).length + (result.nomenclatura ? 1 : 0);
      toast({ 
        title: "Análise concluída", 
        description: `A IA extraiu ${camposPreenchidos} informações do documento.` 
      });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível analisar o documento.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditDocumento = (documento: SegDocumentoColaborador) => {
    setEditingDocumento(documento);
    const doc = documento as any;
    setDocumentoForm({
      colaboradorId: documento.colaboradorId ? documento.colaboradorId.toString() : (documento.colaboradorNome === "Escritório" ? "escritorio" : ""),
      empreendimentoId: documento.empreendimentoId?.toString() || "",
      tipoDocumento: documento.tipoDocumento,
      tipoDescritivo: doc.tipoDescritivo || "",
      subtipoAso: doc.subtipoAso || "",
      nomeDocumento: doc.nomeDocumento || "",
      descricao: documento.descricao || "",
      arquivoUrl: documento.arquivoUrl || "",
      dataEmissao: documento.dataEmissao || "",
      dataValidade: documento.dataValidade || "",
      vigenciaInicio: doc.vigenciaInicio || "",
      vigenciaFim: doc.vigenciaFim || "",
      empresaResponsavel: doc.empresaResponsavel || "",
      medicoResponsavel: doc.medicoResponsavel || "",
      registroCrm: doc.registroCrm || "",
      assinaturaResponsavel: documento.assinaturaResponsavel || "",
      status: documento.status || "valido",
    });
    setIsEmpreendimentoEspecifico(!!documento.empreendimentoId);
    setIsDocumentoDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; icon: any }> = {
      ativo: { variant: "default", icon: CheckCircle },
      inativo: { variant: "secondary", icon: AlertCircle },
      valido: { variant: "default", icon: CheckCircle },
      vencido: { variant: "destructive", icon: AlertCircle },
      a_vencer: { variant: "outline", icon: Clock },
    };
    const config = variants[status] || { variant: "outline" as const, icon: AlertCircle };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8" />
            Segurança do Trabalho
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Gestão de colaboradores e documentos de segurança
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
            <SelectTrigger className="w-[250px]" data-testid="select-filter-empreendimento">
              <SelectValue placeholder="Filtrar por empreendimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os empreendimentos</SelectItem>
              {empreendimentos.map((emp) => (
                <SelectItem key={emp.id} value={emp.id.toString()}>
                  {emp.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Indicadores */}
      {indicadores && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card data-testid="card-indicador-total">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-documentos">{indicadores.totalDocumentos}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-indicador-validos">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Documentos Válidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-documentos-validos">{indicadores.documentosValidos}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-indicador-vencidos">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Documentos Vencidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-documentos-vencidos">{indicadores.documentosVencidos}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-indicador-conformidade">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">% Conformidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-percentual-conformidade">{indicadores.percentualConformidade}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="colaboradores" data-testid="tab-colaboradores">
            <Users className="h-4 w-4 mr-2" />
            Colaboradores
          </TabsTrigger>
          <TabsTrigger value="documentos" data-testid="tab-documentos">
            <FileText className="h-4 w-4 mr-2" />
            Documentos
          </TabsTrigger>
        </TabsList>

        {/* Tab Colaboradores */}
        <TabsContent value="colaboradores" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold" data-testid="text-colaboradores-title">Colaboradores Cadastrados</h2>
            <Dialog open={isColaboradorDialogOpen} onOpenChange={setIsColaboradorDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetColaboradorForm(); setEditingColaborador(null); }} data-testid="button-add-colaborador">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Colaborador
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle data-testid="text-dialog-title-colaborador">
                    {editingColaborador ? "Editar Colaborador" : "Novo Colaborador"}
                  </DialogTitle>
                  <DialogDescription>Preencha as informações do colaborador</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={colaboradorForm.nome}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, nome: e.target.value })}
                        placeholder="Nome completo"
                        data-testid="input-colaborador-nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={colaboradorForm.cpf}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                        data-testid="input-colaborador-cpf"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cargo">Cargo</Label>
                      <Input
                        id="cargo"
                        value={colaboradorForm.cargo}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, cargo: e.target.value })}
                        placeholder="Ex: Técnico de Segurança"
                        data-testid="input-colaborador-cargo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setor">Setor</Label>
                      <Input
                        id="setor"
                        value={colaboradorForm.setor}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, setor: e.target.value })}
                        placeholder="Ex: Segurança do Trabalho"
                        data-testid="input-colaborador-setor"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="empreendimento">Empreendimento *</Label>
                      <Select
                        value={colaboradorForm.empreendimentoId}
                        onValueChange={(value) => setColaboradorForm({ ...colaboradorForm, empreendimentoId: value })}
                      >
                        <SelectTrigger data-testid="select-colaborador-empreendimento">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {empreendimentos.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              {emp.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataAdmissao">Data de Admissão</Label>
                      <Input
                        id="dataAdmissao"
                        type="date"
                        value={colaboradorForm.dataAdmissao}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, dataAdmissao: e.target.value })}
                        data-testid="input-colaborador-data-admissao"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={colaboradorForm.email}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, email: e.target.value })}
                        placeholder="email@exemplo.com"
                        data-testid="input-colaborador-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={colaboradorForm.telefone}
                        onChange={(e) => setColaboradorForm({ ...colaboradorForm, telefone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        data-testid="input-colaborador-telefone"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={colaboradorForm.status}
                      onValueChange={(value) => setColaboradorForm({ ...colaboradorForm, status: value })}
                    >
                      <SelectTrigger data-testid="select-colaborador-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsColaboradorDialogOpen(false)} data-testid="button-cancel-colaborador">
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveColaborador} data-testid="button-save-colaborador">
                    {editingColaborador ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoadingColaboradores ? (
                <div className="text-center py-8" data-testid="text-loading-colaboradores">Carregando...</div>
              ) : colaboradores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-colaboradores">
                  Nenhum colaborador cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Empreendimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colaboradores.map((colaborador) => (
                      <TableRow key={colaborador.id} data-testid={`row-colaborador-${colaborador.id}`}>
                        <TableCell className="font-medium" data-testid={`text-colaborador-nome-${colaborador.id}`}>{colaborador.nome}</TableCell>
                        <TableCell data-testid={`text-colaborador-cpf-${colaborador.id}`}>{colaborador.cpf}</TableCell>
                        <TableCell data-testid={`text-colaborador-cargo-${colaborador.id}`}>{colaborador.cargo || "-"}</TableCell>
                        <TableCell data-testid={`text-colaborador-empreendimento-${colaborador.id}`}>{colaborador.empreendimentoNome}</TableCell>
                        <TableCell>{getStatusBadge(colaborador.status || "ativo")}</TableCell>
                        <TableCell className="text-right relative z-10">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditColaborador(colaborador);
                              }}
                              data-testid={`button-edit-colaborador-${colaborador.id}`}
                              className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Tem certeza que deseja excluir este colaborador?')) {
                                  deleteColaboradorMutation.mutate(colaborador.id);
                                }
                              }}
                              data-testid={`button-delete-colaborador-${colaborador.id}`}
                              className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Documentos */}
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold" data-testid="text-documentos-title">Documentos de Segurança</h2>
            <Dialog open={isDocumentoDialogOpen} onOpenChange={setIsDocumentoDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetDocumentoForm(); setEditingDocumento(null); }} data-testid="button-add-documento">
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Documento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle data-testid="text-dialog-title-documento">
                    {editingDocumento ? "Editar Documento" : "Novo Documento"}
                  </DialogTitle>
                  <DialogDescription>Preencha as informações do documento de segurança</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 overflow-y-auto">
                  {/* PASSO 1: Upload do arquivo */}
                  <div className="space-y-2 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                    <Label htmlFor="arquivo" className="text-base font-semibold flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      1. Faça o Upload do Documento
                    </Label>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <label 
                          htmlFor="arquivo-upload"
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors"
                        >
                          {isUploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                          ) : (
                            <><Upload className="h-4 w-4" /> Selecionar Arquivo</>
                          )}
                        </label>
                        <input
                          id="arquivo-upload"
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          disabled={isUploading}
                          data-testid="input-documento-arquivo"
                        />
                        {selectedFile && (
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                            <File className="h-4 w-4" />
                            <span>{selectedFile.name}</span>
                          </div>
                        )}
                      </div>
                      {documentoForm.arquivoUrl && !selectedFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <File className="h-4 w-4" />
                          <a href={documentoForm.arquivoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Ver arquivo atual
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PASSO 2: Análise por IA */}
                  <div className="space-y-3 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-600" />
                        2. Análise Automática por IA
                      </Label>
                      <Button
                        type="button"
                        onClick={handleAnalyzeDocument}
                        disabled={isAnalyzing || (!documentContent && !selectedFile)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        {isAnalyzing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando...</>
                        ) : (
                          <><Brain className="h-4 w-4 mr-2" /> Analisar e Preencher Automaticamente</>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A IA irá identificar o tipo de documento, datas, responsável e preencher todos os campos automaticamente.
                    </p>
                    
                    {aiAnalysis && (
                      <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-blue-800 dark:text-blue-300">Resultado da Análise</span>
                        </div>
                        <p className="text-sm text-blue-700 dark:text-blue-400 whitespace-pre-wrap">{aiAnalysis}</p>
                      </div>
                    )}
                  </div>

                  {/* Campo Nome do Documento (preenchido automaticamente) */}
                  <div className="space-y-2">
                    <Label htmlFor="nomeDocumento" className="font-semibold">Nome do Documento (Nomenclatura Padronizada)</Label>
                    <Input
                      id="nomeDocumento"
                      value={documentoForm.nomeDocumento}
                      onChange={(e) => setDocumentoForm({ ...documentoForm, nomeDocumento: e.target.value })}
                      placeholder="Será preenchido automaticamente pela IA (ex: SST-ASO-2025-JOAO_SILVA-ECOBR)"
                      data-testid="input-documento-nome"
                      className={suggestedNomenclatura ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}
                    />
                    {suggestedNomenclatura && (
                      <p className="text-xs text-green-600 dark:text-green-400">✓ Nomenclatura gerada automaticamente pela IA</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="colaboradorId">Colaborador *</Label>
                      <Select
                        value={documentoForm.colaboradorId}
                        onValueChange={(value) => setDocumentoForm({ ...documentoForm, colaboradorId: value })}
                      >
                        <SelectTrigger data-testid="select-documento-colaborador">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="escritorio">🏢 Escritório</SelectItem>
                          {colaboradores.map((col) => (
                            <SelectItem key={col.id} value={col.id.toString()}>
                              {col.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipoDocumento">Tipo de Documento *</Label>
                      <Select
                        value={documentoForm.tipoDocumento}
                        onValueChange={(value) => setDocumentoForm({ ...documentoForm, tipoDocumento: value })}
                      >
                        <SelectTrigger data-testid="select-documento-tipo">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PCMSO">PCMSO - Programa de Controle Médico de Saúde Ocupacional</SelectItem>
                          <SelectItem value="PGR">PGR - Programa de Gerenciamento de Riscos</SelectItem>
                          <SelectItem value="LTCAT">LTCAT - Laudo Técnico das Condições Ambientais</SelectItem>
                          <SelectItem value="ASO">ASO - Atestado de Saúde Ocupacional</SelectItem>
                          <SelectItem value="PPRA">PPRA - Programa de Prevenção de Riscos Ambientais</SelectItem>
                          <SelectItem value="APR">APR - Análise Preliminar de Riscos</SelectItem>
                          <SelectItem value="POP">POP - Procedimento Operacional Padrão</SelectItem>
                          <SelectItem value="NR">Treinamento NR</SelectItem>
                          <SelectItem value="EPI">Registro de EPI</SelectItem>
                          <SelectItem value="CIPA">Certificado CIPA</SelectItem>
                          <SelectItem value="CAT">CAT - Comunicação de Acidente de Trabalho</SelectItem>
                          <SelectItem value="PPP">PPP - Perfil Profissiográfico Previdenciário</SelectItem>
                          <SelectItem value="LAUDOERGO">Laudo Ergonômico</SelectItem>
                          <SelectItem value="LAUDOINS">Laudo de Insalubridade</SelectItem>
                          <SelectItem value="LAUDOPER">Laudo de Periculosidade</SelectItem>
                          <SelectItem value="TREINAMENTO">Certificado de Treinamento</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Subtipo de ASO - aparece apenas quando tipo é ASO */}
                    {documentoForm.tipoDocumento === "ASO" && (
                      <div className="space-y-2">
                        <Label htmlFor="subtipoAso">Tipo de ASO</Label>
                        <Select
                          value={documentoForm.subtipoAso}
                          onValueChange={(value) => setDocumentoForm({ ...documentoForm, subtipoAso: value })}
                        >
                          <SelectTrigger data-testid="select-subtipo-aso">
                            <SelectValue placeholder="Selecione o tipo de ASO" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admissional">ASO Admissional</SelectItem>
                            <SelectItem value="demissional">ASO Demissional</SelectItem>
                            <SelectItem value="periodico">ASO Periódico</SelectItem>
                            <SelectItem value="retorno">ASO Retorno ao Trabalho</SelectItem>
                            <SelectItem value="mudanca_funcao">ASO Mudança de Função</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Label className="font-medium">Específico para algum empreendimento?</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="empreendimentoEspecifico"
                            checked={!isEmpreendimentoEspecifico}
                            onChange={() => {
                              setIsEmpreendimentoEspecifico(false);
                              setDocumentoForm({ ...documentoForm, empreendimentoId: "" });
                            }}
                            className="w-4 h-4"
                          />
                          <span>Não (Geral)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="empreendimentoEspecifico"
                            checked={isEmpreendimentoEspecifico}
                            onChange={() => setIsEmpreendimentoEspecifico(true)}
                            className="w-4 h-4"
                          />
                          <span>Sim</span>
                        </label>
                      </div>
                    </div>
                    
                    {isEmpreendimentoEspecifico && (
                      <div className="space-y-2">
                        <Label htmlFor="empreendimentoId">Selecione o Empreendimento *</Label>
                        <Select
                          value={documentoForm.empreendimentoId}
                          onValueChange={(value) => setDocumentoForm({ ...documentoForm, empreendimentoId: value })}
                        >
                          <SelectTrigger data-testid="select-documento-empreendimento">
                            <SelectValue placeholder="Selecione o empreendimento" />
                          </SelectTrigger>
                          <SelectContent>
                            {empreendimentos.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id.toString()}>
                                {emp.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição</Label>
                    <Input
                      id="descricao"
                      value={documentoForm.descricao}
                      onChange={(e) => setDocumentoForm({ ...documentoForm, descricao: e.target.value })}
                      placeholder="Descrição do documento"
                      data-testid="input-documento-descricao"
                    />
                  </div>
                  {/* Empresa e Médico Responsável */}
                  <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-900/20">
                    <div className="col-span-2">
                      <Label className="text-sm font-semibold text-blue-700 dark:text-blue-400">Empresa e Médico Responsável</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresaResponsavel">Empresa Responsável</Label>
                      <Input
                        id="empresaResponsavel"
                        value={documentoForm.empresaResponsavel}
                        onChange={(e) => setDocumentoForm({ ...documentoForm, empresaResponsavel: e.target.value })}
                        placeholder="Ex: CEMED Medicina e Segurança"
                        data-testid="input-documento-empresa-responsavel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medicoResponsavel">Médico Responsável</Label>
                      <Input
                        id="medicoResponsavel"
                        value={documentoForm.medicoResponsavel}
                        onChange={(e) => setDocumentoForm({ ...documentoForm, medicoResponsavel: e.target.value })}
                        placeholder="Ex: Dr. Fulano de Tal"
                        data-testid="input-documento-medico-responsavel"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registroCrm">Registro CRM</Label>
                      <Input
                        id="registroCrm"
                        value={documentoForm.registroCrm}
                        onChange={(e) => setDocumentoForm({ ...documentoForm, registroCrm: e.target.value })}
                        placeholder="Ex: 2369 - CRM/SE"
                        data-testid="input-documento-crm"
                      />
                    </div>
                  </div>

                  {/* Vigência */}
                  <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-green-50/50 dark:bg-green-900/20">
                    <div className="col-span-2">
                      <Label className="text-sm font-semibold text-green-700 dark:text-green-400">Vigência do Documento</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vigenciaInicio">De (Início)</Label>
                      <Input
                        id="vigenciaInicio"
                        type="date"
                        value={documentoForm.vigenciaInicio}
                        onChange={(e) => setDocumentoForm({ ...documentoForm, vigenciaInicio: e.target.value })}
                        data-testid="input-documento-vigencia-inicio"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vigenciaFim">Até (Término)</Label>
                      <Input
                        id="vigenciaFim"
                        type="date"
                        value={documentoForm.vigenciaFim}
                        onChange={(e) => setDocumentoForm({ ...documentoForm, vigenciaFim: e.target.value })}
                        data-testid="input-documento-vigencia-fim"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assinatura">Responsável pela Assinatura</Label>
                      <Input
                        id="assinatura"
                        value={documentoForm.assinaturaResponsavel}
                        onChange={(e) => setDocumentoForm({ ...documentoForm, assinaturaResponsavel: e.target.value })}
                        placeholder="Nome do responsável"
                        data-testid="input-documento-assinatura"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="statusDoc">Status</Label>
                      <Select
                        value={documentoForm.status}
                        onValueChange={(value) => setDocumentoForm({ ...documentoForm, status: value })}
                      >
                        <SelectTrigger data-testid="select-documento-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="valido">Válido</SelectItem>
                          <SelectItem value="vencido">Vencido</SelectItem>
                          <SelectItem value="a_vencer">A Vencer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDocumentoDialogOpen(false)} data-testid="button-cancel-documento">
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveDocumento} data-testid="button-save-documento">
                    {editingDocumento ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoadingDocumentos ? (
                <div className="text-center py-8" data-testid="text-loading-documentos">Carregando...</div>
              ) : documentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-documentos">
                  Nenhum documento cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Empreendimento</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((doc) => (
                      <TableRow key={doc.id} data-testid={`row-documento-${doc.id}`}>
                        <TableCell className="font-medium" data-testid={`text-documento-tipo-${doc.id}`}>{(doc as any).tipoDescritivo || doc.tipoDocumento}</TableCell>
                        <TableCell data-testid={`text-documento-colaborador-${doc.id}`}>{doc.colaboradorNome || (doc.colaboradorId ? `Colaborador #${doc.colaboradorId}` : "Escritório")}</TableCell>
                        <TableCell data-testid={`text-documento-empreendimento-${doc.id}`}>
                          {(doc as any).empreendimentoNome || "Geral"}
                        </TableCell>
                        <TableCell data-testid={`text-documento-descricao-${doc.id}`}>{doc.descricao || "-"}</TableCell>
                        <TableCell data-testid={`text-documento-validade-${doc.id}`}>
                          {doc.dataValidade ? new Date(doc.dataValidade).toLocaleDateString("pt-BR") : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status || "valido")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 relative z-50">
                            {doc.arquivoUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const downloadUrl = `/api/seg-documentos/${doc.id}/download`;
                                  console.log('[SST] Baixando documento:', downloadUrl);
                                  window.open(downloadUrl, "_blank");
                                }}
                                data-testid={`button-download-documento-${doc.id}`}
                                className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900 pointer-events-auto"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditDocumento(doc);
                              }}
                              data-testid={`button-edit-documento-${doc.id}`}
                              className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 pointer-events-auto"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm('Tem certeza que deseja excluir este documento?')) {
                                  console.log('[SST] Excluindo documento:', doc.id);
                                  deleteDocumentoMutation.mutate(doc.id);
                                }
                              }}
                              data-testid={`button-delete-documento-${doc.id}`}
                              className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900 pointer-events-auto"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
