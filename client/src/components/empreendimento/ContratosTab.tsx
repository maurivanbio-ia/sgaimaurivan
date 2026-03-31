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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, DollarSign, Calendar, Plus, Edit, Trash2, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp, FileSignature, X, Upload, FileDown } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface ContratosTabProps {
  empreendimentoId: number;
}

type Contrato = {
  id: number;
  numero: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  situacao: string;
  valorTotal: string;
  arquivoPdfId?: number | null;
  observacoes?: string | null;
  empreendimentoId: number;
};

type Aditivo = {
  id: number;
  contratoId: number;
  descricao: string;
  valorAdicional: string | null;
  vigenciaNovaFim: string | null;
  dataAssinatura: string;
  arquivoPdfId?: number | null;
  criadoEm: string;
};

type ContratoDocumento = {
  id: number;
  contratoId: number;
  aditivoId?: number | null;
  tipo: string;
  nome: string;
  descricao?: string | null;
  objectPath: string;
  tamanho?: number | null;
  mime?: string | null;
  criadoEm: string;
};

const TIPO_DOCUMENTO_CONFIG: Record<string, { label: string; color: string }> = {
  contrato: { label: "Contrato", color: "bg-blue-100 text-blue-800" },
  aditivo: { label: "Aditivo", color: "bg-purple-100 text-purple-800" },
  anexo: { label: "Anexo", color: "bg-green-100 text-green-800" },
  comprovante: { label: "Comprovante", color: "bg-yellow-100 text-yellow-800" },
  outro: { label: "Outro", color: "bg-gray-100 text-gray-800" },
};

const SITUACAO_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  vigente: { label: "Vigente", color: "bg-green-100 text-green-800", icon: CheckCircle },
  vencido: { label: "Vencido", color: "bg-red-100 text-red-800", icon: AlertCircle },
  suspenso: { label: "Suspenso", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  encerrado: { label: "Encerrado", color: "bg-gray-100 text-gray-800", icon: FileText },
};

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
};

type ContratoForm = {
  numero: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  situacao: string;
  valorTotal: string;
  observacoes: string;
};

type AditivoForm = {
  descricao: string;
  valorAdicional: string;
  vigenciaNovaFim: string;
  dataAssinatura: string;
};

const emptyForm: ContratoForm = {
  numero: "",
  objeto: "",
  vigenciaInicio: "",
  vigenciaFim: "",
  situacao: "vigente",
  valorTotal: "",
  observacoes: "",
};

const emptyAditivoForm: AditivoForm = {
  descricao: "",
  valorAdicional: "",
  vigenciaNovaFim: "",
  dataAssinatura: "",
};

export function ContratosTab({ empreendimentoId }: ContratosTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null);
  const [contratoToDelete, setContratoToDelete] = useState<Contrato | null>(null);
  const [form, setForm] = useState<ContratoForm>(emptyForm);
  const [expandedContratoId, setExpandedContratoId] = useState<number | null>(null);
  const [aditivoDialogOpen, setAditivoDialogOpen] = useState(false);
  const [aditivoForm, setAditivoForm] = useState<AditivoForm>(emptyAditivoForm);
  const [activeContratoForAditivo, setActiveContratoForAditivo] = useState<number | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState<number | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docTipo, setDocTipo] = useState("contrato");
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [formPdfFile, setFormPdfFile] = useState<File | null>(null);

  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"],
  });

  const { data: aditivos = [] } = useQuery<Aditivo[]>({
    queryKey: ["/api/contratos", expandedContratoId, "aditivos"],
    enabled: !!expandedContratoId,
  });

  const { data: documentos = [], refetch: refetchDocumentos } = useQuery<ContratoDocumento[]>({
    queryKey: ["/api/contratos", expandedContratoId, "documentos"],
    enabled: !!expandedContratoId,
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ contratoId, file, tipo }: { contratoId: number; file: File; tipo: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo', tipo);
      const response = await fetch(`/api/contratos/${contratoId}/documentos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Erro ao fazer upload' }));
        throw new Error(err.message || 'Erro ao fazer upload');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos", variables.contratoId, "documentos"] });
      toast({ title: "Documento anexado", description: "O arquivo foi salvo com sucesso." });
      setUploadingDoc(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploadingDoc(false);
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async ({ docId, contratoId }: { docId: number; contratoId: number }) => {
      return apiRequest("DELETE", `/api/contrato-documentos/${docId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos", variables.contratoId, "documentos"] });
      toast({ title: "Documento removido", description: "O arquivo foi excluído com sucesso." });
      setDeletingDocId(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      setDeletingDocId(null);
    },
  });

  const deletePdfMutation = useMutation({
    mutationFn: async (contratoId: number) => {
      return apiRequest("DELETE", `/api/contratos/${contratoId}/pdf`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "PDF removido", description: "O documento foi removido com sucesso." });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/empreendimentos/${empreendimentoId}/contratos`, data);
      return res.json();
    },
    onSuccess: async (newContrato: any) => {
      if (formPdfFile && newContrato?.id) {
        try {
          const fd = new FormData();
          fd.append('file', formPdfFile);
          const r = await fetch(`/api/empreendimentos/${empreendimentoId}/contratos/${newContrato.id}/pdf`, {
            method: 'POST', body: fd, credentials: 'include',
          });
          if (!r.ok) throw new Error('Erro no upload do PDF');
        } catch (e: any) {
          toast({ title: "Contrato criado, mas falha no PDF", description: e.message, variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Contrato criado", description: "O contrato foi cadastrado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/empreendimentos/${empreendimentoId}/contratos/${id}`, data);
    },
    onSuccess: async (_: any, variables: any) => {
      if (formPdfFile && variables.id) {
        try {
          const fd = new FormData();
          fd.append('file', formPdfFile);
          const r = await fetch(`/api/empreendimentos/${empreendimentoId}/contratos/${variables.id}/pdf`, {
            method: 'POST', body: fd, credentials: 'include',
          });
          if (!r.ok) throw new Error('Erro no upload do PDF');
        } catch (e: any) {
          toast({ title: "Contrato atualizado, mas falha no PDF", description: e.message, variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Contrato atualizado", description: "O contrato foi atualizado com sucesso." });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/contratos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "Contrato excluído", description: "O contrato foi removido com sucesso." });
      setDeleteDialogOpen(false);
      setContratoToDelete(null);
      if (expandedContratoId === contratoToDelete?.id) {
        setExpandedContratoId(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const createAditivoMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/contratos/${activeContratoForAditivo}/aditivos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contratos", activeContratoForAditivo, "aditivos"] });
      toast({ title: "Aditivo criado", description: "O aditivo foi cadastrado com sucesso." });
      setAditivoDialogOpen(false);
      setAditivoForm(emptyAditivoForm);
      setActiveContratoForAditivo(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar aditivo", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenCreate = () => {
    setEditingContrato(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (contrato: Contrato) => {
    setEditingContrato(contrato);
    setForm({
      numero: contrato.numero,
      objeto: contrato.objeto,
      vigenciaInicio: contrato.vigenciaInicio,
      vigenciaFim: contrato.vigenciaFim,
      situacao: contrato.situacao,
      valorTotal: contrato.valorTotal,
      observacoes: contrato.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingContrato(null);
    setForm(emptyForm);
    setFormPdfFile(null);
  };

  const handleSubmit = () => {
    if (!form.numero.trim() || !form.objeto.trim()) {
      toast({ title: "Erro", description: "Número e objeto do contrato são obrigatórios.", variant: "destructive" });
      return;
    }

    const data = {
      numero: form.numero,
      objeto: form.objeto,
      vigenciaInicio: form.vigenciaInicio,
      vigenciaFim: form.vigenciaFim,
      situacao: form.situacao,
      valorTotal: form.valorTotal || "0",
      observacoes: form.observacoes || null,
    };

    if (editingContrato) {
      updateMutation.mutate({ id: editingContrato.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (contrato: Contrato) => {
    setContratoToDelete(contrato);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (contratoToDelete) {
      deleteMutation.mutate(contratoToDelete.id);
    }
  };

  const toggleExpand = (contratoId: number) => {
    setExpandedContratoId(expandedContratoId === contratoId ? null : contratoId);
  };

  const handleOpenAditivoDialog = (contratoId: number) => {
    setActiveContratoForAditivo(contratoId);
    setAditivoForm(emptyAditivoForm);
    setAditivoDialogOpen(true);
  };

  const handleSubmitAditivo = () => {
    if (!aditivoForm.descricao.trim() || !aditivoForm.dataAssinatura) {
      toast({ title: "Erro", description: "Descrição e data de assinatura são obrigatórios.", variant: "destructive" });
      return;
    }

    createAditivoMutation.mutate({
      descricao: aditivoForm.descricao,
      valorAdicional: aditivoForm.valorAdicional || null,
      vigenciaNovaFim: aditivoForm.vigenciaNovaFim || null,
      dataAssinatura: aditivoForm.dataAssinatura,
    });
  };

  const contratosVigentes = contratos.filter(c => c.situacao === 'vigente');
  const contratosVencidos = contratos.filter(c => c.situacao === 'vencido');
  const valorTotalContratos = contratos.reduce((sum, c) => sum + Number(c.valorTotal || 0), 0);

  const handleUploadPdf = async (contratoId: number, file: File) => {
    setUploadingPdf(contratoId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/empreendimentos/${empreendimentoId}/contratos/${contratoId}/pdf`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Erro ao fazer upload');
      
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", empreendimentoId, "contratos"] });
      toast({ title: "PDF anexado", description: "O arquivo PDF do contrato foi salvo com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } finally {
      setUploadingPdf(null);
    }
  };

  const handleDownloadPdf = async (contrato: Contrato) => {
    if (!contrato.arquivoPdfId) return;
    window.open(`/api/contratos/${contrato.id}/pdf`, '_blank');
  };

  const calcularDiasRestantes = (dataFim: string) => {
    const hoje = new Date();
    const fim = new Date(dataFim);
    const diff = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Carregando contratos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contratos
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {contratos.length} contrato{contratos.length !== 1 ? 's' : ''} vinculado{contratos.length !== 1 ? 's' : ''} a este empreendimento
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2" data-testid="button-novo-contrato">
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-700">{contratos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Vigentes</p>
                <p className="text-2xl font-bold text-green-700">{contratosVigentes.length}</p>
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
                <p className="text-2xl font-bold text-red-700">{contratosVencidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(valorTotalContratos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {contratos.length > 0 ? (
        <div className="space-y-4">
          {contratos.map((contrato) => {
            const config = SITUACAO_CONFIG[contrato.situacao] || SITUACAO_CONFIG.vigente;
            const StatusIcon = config.icon;
            const isExpanded = expandedContratoId === contrato.id;
            const diasRestantes = calcularDiasRestantes(contrato.vigenciaFim);
            const aditivosContrato = isExpanded ? aditivos : [];
            const valorTotalComAditivos = Number(contrato.valorTotal || 0) + aditivosContrato.reduce((sum, a) => sum + Number(a.valorAdicional || 0), 0);
            
            return (
              <Card 
                key={contrato.id} 
                className={`transition-all duration-200 ${isExpanded ? 'ring-2 ring-primary/20 shadow-lg' : 'hover:shadow-md'}`} 
                data-testid={`card-contrato-${contrato.id}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(contrato.id)}>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-lg" data-testid={`text-contrato-numero-${contrato.id}`}>
                          Contrato {contrato.numero}
                        </h4>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {contrato.objeto}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <Badge className={config.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      {contrato.arquivoPdfId ? (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDownloadPdf(contrato)}
                          title="Baixar PDF do contrato"
                          data-testid={`button-download-pdf-${contrato.id}`}
                        >
                          <FileDown className="h-4 w-4 text-blue-500" />
                        </Button>
                      ) : (
                        <label title="Anexar PDF do contrato">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            disabled={uploadingPdf === contrato.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadPdf(contrato.id, file);
                            }}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            asChild
                            className={uploadingPdf === contrato.id ? 'opacity-50' : ''}
                            data-testid={`button-upload-pdf-${contrato.id}`}
                          >
                            <span>
                              <Upload className="h-4 w-4 text-emerald-500" />
                            </span>
                          </Button>
                        </label>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(contrato)} data-testid={`button-edit-${contrato.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contrato)} data-testid={`button-delete-${contrato.id}`}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Valor Total
                      </p>
                      <p className="font-medium">{formatCurrency(contrato.valorTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Vigência
                      </p>
                      <p className="font-medium text-sm">
                        {formatDate(contrato.vigenciaInicio)} - {formatDate(contrato.vigenciaFim)}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Dias Restantes</p>
                          <p className={`text-xl font-bold ${diasRestantes < 0 ? 'text-red-600' : diasRestantes < 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {diasRestantes < 0 ? `Vencido há ${Math.abs(diasRestantes)} dias` : `${diasRestantes} dias`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor + Aditivos</p>
                          <p className="text-xl font-bold text-emerald-700">{formatCurrency(valorTotalComAditivos)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Aditivos</p>
                          <p className="text-xl font-bold text-blue-700">{aditivosContrato.length}</p>
                        </div>
                      </div>

                      {contrato.observacoes && (
                        <div className="bg-muted/30 p-4 rounded-lg">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Observações</p>
                          <p className="text-sm">{contrato.observacoes}</p>
                        </div>
                      )}

                      <Separator />

                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-semibold flex items-center gap-2">
                            <FileSignature className="h-4 w-4" />
                            Aditivos Contratuais
                          </h5>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => handleOpenAditivoDialog(contrato.id)}
                          >
                            <Plus className="h-3 w-3" />
                            Novo Aditivo
                          </Button>
                        </div>

                        {aditivosContrato.length > 0 ? (
                          <div className="space-y-2">
                            {aditivosContrato.map((aditivo, index) => (
                              <div 
                                key={aditivo.id} 
                                className="flex items-start justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {index + 1}º Aditivo
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Assinado em {formatDate(aditivo.dataAssinatura)}
                                    </span>
                                  </div>
                                  <p className="text-sm mt-1">{aditivo.descricao}</p>
                                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                    {aditivo.valorAdicional && (
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        Valor Adicional: <span className="font-medium text-emerald-600">{formatCurrency(aditivo.valorAdicional)}</span>
                                      </span>
                                    )}
                                    {aditivo.vigenciaNovaFim && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Nova Vigência: <span className="font-medium">{formatDate(aditivo.vigenciaNovaFim)}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                            <FileSignature className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum aditivo cadastrado</p>
                            <p className="text-xs">Clique em "Novo Aditivo" para adicionar</p>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Seção de Documentos */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Documentos do Contrato
                          </h5>
                          <div className="flex items-center gap-2">
                            <Select value={docTipo} onValueChange={setDocTipo}>
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contrato">Contrato</SelectItem>
                                <SelectItem value="aditivo">Aditivo</SelectItem>
                                <SelectItem value="anexo">Anexo</SelectItem>
                                <SelectItem value="comprovante">Comprovante</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <label>
                              <input
                                type="file"
                                className="hidden"
                                disabled={uploadingDoc}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setUploadingDoc(true);
                                    uploadDocMutation.mutate({ contratoId: contrato.id, file, tipo: docTipo });
                                    e.target.value = '';
                                  }
                                }}
                              />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-1"
                                asChild
                                disabled={uploadingDoc}
                              >
                                <span>
                                  <Upload className="h-3 w-3" />
                                  {uploadingDoc ? "Enviando..." : "Anexar"}
                                </span>
                              </Button>
                            </label>
                          </div>
                        </div>

                        {documentos.length > 0 ? (
                          <div className="space-y-2">
                            {documentos.map((doc) => {
                              const tipoConfig = TIPO_DOCUMENTO_CONFIG[doc.tipo] || TIPO_DOCUMENTO_CONFIG.outro;
                              return (
                                <div 
                                  key={doc.id} 
                                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium truncate">{doc.nome}</p>
                                        <Badge className={`text-xs ${tipoConfig.color}`}>
                                          {tipoConfig.label}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {doc.tamanho ? `${(doc.tamanho / 1024).toFixed(1)} KB` : ''} 
                                        {doc.criadoEm && ` • ${formatDate(doc.criadoEm)}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => window.open(`/api/contrato-documentos/${doc.id}/download`, '_blank')}
                                      title="Baixar documento"
                                    >
                                      <FileDown className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => {
                                        setDeletingDocId(doc.id);
                                        deleteDocMutation.mutate({ docId: doc.id, contratoId: contrato.id });
                                      }}
                                      disabled={deletingDocId === doc.id}
                                      title="Remover documento"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum documento anexado</p>
                            <p className="text-xs">Selecione o tipo e clique em "Anexar" para adicionar</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-card-foreground mb-2">
              Nenhum contrato cadastrado
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Este empreendimento ainda não possui contratos. Clique no botão acima para criar o primeiro.
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Primeiro Contrato
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="numero">Número do Contrato *</Label>
                <Input
                  id="numero"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="Ex: CT-2025-001"
                />
              </div>
              <div>
                <Label htmlFor="situacao">Situação</Label>
                <Select value={form.situacao} onValueChange={(value) => setForm({ ...form, situacao: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="objeto">Objeto do Contrato *</Label>
                <Textarea
                  id="objeto"
                  value={form.objeto}
                  onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                  placeholder="Descrição do objeto do contrato"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="vigenciaInicio">Início da Vigência</Label>
                <Input
                  id="vigenciaInicio"
                  type="date"
                  value={form.vigenciaInicio}
                  onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="vigenciaFim">Fim da Vigência</Label>
                <Input
                  id="vigenciaFim"
                  type="date"
                  value={form.vigenciaFim}
                  onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="valorTotal">Valor Total</Label>
                <Input
                  id="valorTotal"
                  type="number"
                  step="0.01"
                  value={form.valorTotal}
                  onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Observações adicionais"
                  rows={2}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="formPdfFile">Arquivo do Contrato (PDF)</Label>
                <div className="mt-1">
                  {formPdfFile ? (
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/40">
                      <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="text-sm truncate flex-1">{formPdfFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => setFormPdfFile(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="formPdfFile"
                      className="flex items-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para selecionar um arquivo PDF</span>
                      <input
                        id="formPdfFile"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setFormPdfFile(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : editingContrato ? "Salvar Alterações" : "Criar Contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aditivoDialogOpen} onOpenChange={setAditivoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Novo Aditivo Contratual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="aditivo-descricao">Descrição do Aditivo *</Label>
              <Textarea
                id="aditivo-descricao"
                value={aditivoForm.descricao}
                onChange={(e) => setAditivoForm({ ...aditivoForm, descricao: e.target.value })}
                placeholder="Ex: Prorrogação de prazo por 12 meses"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aditivo-valor">Valor Adicional</Label>
                <Input
                  id="aditivo-valor"
                  type="number"
                  step="0.01"
                  value={aditivoForm.valorAdicional}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, valorAdicional: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="aditivo-data">Data de Assinatura *</Label>
                <Input
                  id="aditivo-data"
                  type="date"
                  value={aditivoForm.dataAssinatura}
                  onChange={(e) => setAditivoForm({ ...aditivoForm, dataAssinatura: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="aditivo-vigencia">Nova Data de Vigência (opcional)</Label>
              <Input
                id="aditivo-vigencia"
                type="date"
                value={aditivoForm.vigenciaNovaFim}
                onChange={(e) => setAditivoForm({ ...aditivoForm, vigenciaNovaFim: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Preencha se o aditivo alterar a data de término do contrato</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAditivoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitAditivo} disabled={createAditivoMutation.isPending}>
              {createAditivoMutation.isPending ? "Salvando..." : "Criar Aditivo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contrato "{contratoToDelete?.numero}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
