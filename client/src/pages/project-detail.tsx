import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, getStatusLabel, getStatusClass } from "@/lib/date-utils";
import { Plus, ArrowLeft, Edit, FileText, Calendar, Building, Download, Trash2, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import type { EmpreendimentoWithLicencas, Condicionante } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const condicionanteSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  prazo: z.string().min(1, "Prazo é obrigatório"),
  status: z.enum(["pendente", "cumprida", "vencida"]),
  observacoes: z.string().optional(),
});

type CondicionanteFormData = z.infer<typeof condicionanteSchema>;

function CondicionantesSection({ licenseId }: { licenseId: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCondicionante, setEditingCondicionante] = useState<Condicionante | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: condicionantes = [], isLoading } = useQuery<Condicionante[]>({
    queryKey: ["/api/licencas", licenseId, "condicionantes"],
  });

  const form = useForm<CondicionanteFormData>({
    resolver: zodResolver(condicionanteSchema),
    defaultValues: {
      descricao: "",
      prazo: "",
      status: "pendente",
      observacoes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CondicionanteFormData) => {
      const response = await apiRequest("POST", "/api/condicionantes", {
        ...data,
        licencaId: licenseId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licenseId, "condicionantes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/condicionantes"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Condicionante criada",
        description: "Condicionante adicionada com sucesso!",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CondicionanteFormData> }) => {
      const response = await apiRequest("PUT", `/api/condicionantes/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licenseId, "condicionantes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/condicionantes"] });
      setEditingCondicionante(null);
      toast({
        title: "Condicionante atualizada",
        description: "Status atualizado com sucesso!",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/condicionantes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licencas", licenseId, "condicionantes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/condicionantes"] });
      toast({
        title: "Condicionante excluída",
        description: "Condicionante removida com sucesso!",
      });
    },
  });

  const onSubmit = (data: CondicionanteFormData) => {
    if (editingCondicionante) {
      updateMutation.mutate({ id: editingCondicionante.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (condicionante: Condicionante) => {
    setEditingCondicionante(condicionante);
    form.reset({
      descricao: condicionante.descricao,
      prazo: condicionante.prazo,
      status: condicionante.status as "pendente" | "cumprida" | "vencida",
      observacoes: condicionante.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleStatusChange = (id: number, status: "pendente" | "cumprida" | "vencida") => {
    updateMutation.mutate({ id, data: { status } });
  };

  const getCondicionanteStatusIcon = (status: string) => {
    switch (status) {
      case 'cumprida': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'vencida': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getCondicionanteStatusColor = (status: string) => {
    switch (status) {
      case 'cumprida': return 'bg-green-100 text-green-800';
      case 'vencida': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0 h-auto font-medium text-card-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Condicionantes ({condicionantes.length})
          </Button>
          {condicionantes.length > 0 && (
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">
                {condicionantes.filter(c => c.status === 'pendente').length} pendentes
              </Badge>
              <Badge variant="outline" className="text-xs">
                {condicionantes.filter(c => c.status === 'cumprida').length} cumpridas
              </Badge>
              <Badge variant="outline" className="text-xs">
                {condicionantes.filter(c => c.status === 'vencida').length} vencidas
              </Badge>
            </div>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingCondicionante(null);
                form.reset();
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCondicionante ? "Editar Condicionante" : "Nova Condicionante"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descrição da condicionante" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="prazo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prazo</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="cumprida">Cumprida</SelectItem>
                            <SelectItem value="vencida">Vencida</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="observacoes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações (opcional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Observações adicionais" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingCondicionante ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {isExpanded && (
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando condicionantes...</p>
          ) : condicionantes.length > 0 ? (
            condicionantes.map((condicionante) => (
              <div key={condicionante.id} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getCondicionanteStatusIcon(condicionante.status)}
                      <Badge className={`text-xs ${getCondicionanteStatusColor(condicionante.status)}`}>
                        {condicionante.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Prazo: {formatDate(condicionante.prazo)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-card-foreground mb-1">
                      {condicionante.descricao}
                    </p>
                    {condicionante.observacoes && (
                      <p className="text-xs text-muted-foreground">
                        {condicionante.observacoes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Select
                      value={condicionante.status}
                      onValueChange={(value) => handleStatusChange(condicionante.id, value)}
                    >
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="cumprida">Cumprida</SelectItem>
                        <SelectItem value="vencida">Vencida</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(condicionante)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja excluir esta condicionante?')) {
                          deleteMutation.mutate(condicionante.id);
                        }
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nenhuma condicionante cadastrada
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: project, isLoading } = useQuery<EmpreendimentoWithLicencas>({
    queryKey: ["/api/empreendimentos", id],
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/empreendimentos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      toast({
        title: "Empreendimento excluído",
        description: "O empreendimento foi excluído com sucesso.",
      });
      setLocation("/empreendimentos");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Não foi possível excluir o empreendimento.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirm(`Tem certeza que deseja excluir o empreendimento "${project?.nome}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando detalhes do empreendimento...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Empreendimento não encontrado</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-card-foreground" data-testid="text-project-name">
            {project.nome}
          </h2>
          <p className="text-muted-foreground mt-2">Licenças Ambientais</p>
        </div>
        <div className="flex space-x-2">
          <ExportButton entity="licencas" entityId={parseInt(id!)} variant="outline" />
          <Link href={`/empreendimentos/${id}/licencas/nova`}>
            <Button className="font-medium" data-testid="button-new-license">
              <Plus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </Link>
          <Link href={`/empreendimentos/${id}/editar`}>
            <Button variant="outline" className="font-medium" data-testid="button-edit-project">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="font-medium"
            data-testid="button-delete-project"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/empreendimentos")}
            className="font-medium"
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Project Info Card */}
      <Card className="shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cliente</p>
              <p className="text-card-foreground" data-testid="text-client">{project.cliente}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Localização</p>
              <p className="text-card-foreground" data-testid="text-location">{project.localizacao}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Responsável</p>
              <p className="text-card-foreground" data-testid="text-responsible">{project.responsavelInterno}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Licenses List */}
      {project.licencas && project.licencas.length > 0 ? (
        <div className="space-y-4">
          {project.licencas.map((license) => (
            <Card key={license.id} className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-semibold text-card-foreground mr-3" data-testid={`text-license-type-${license.id}`}>
                        {license.tipo}
                      </h3>
                      <span className={`status-badge ${getStatusClass(license.status)}`} data-testid={`text-license-status-${license.id}`}>
                        {getStatusLabel(license.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          <Building className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Órgão Emissor:</span> 
                          <span data-testid={`text-issuer-${license.id}`}> {license.orgaoEmissor}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Calendar className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Data de Emissão:</span> 
                          <span data-testid={`text-issue-date-${license.id}`}> {formatDate(license.dataEmissao)}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <Calendar className="inline mr-2 h-4 w-4" />
                          <span className="font-medium">Validade:</span> 
                          <span data-testid={`text-validity-${license.id}`}> {formatDate(license.validade)}</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          <FileText className="inline mr-2 h-4 w-4" />
                          {license.arquivoPdf ? (
                            <a 
                              href={license.arquivoPdf} 
                              className="text-primary hover:underline"
                              data-testid={`link-download-${license.id}`}
                            >
                              <Download className="inline mr-1 h-3 w-3" />
                              Baixar PDF
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Sem arquivo</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col space-y-2">
                    <Link href={`/licencas/${license.id}/editar`}>
                      <Button variant="outline" size="sm" data-testid={`button-edit-license-${license.id}`}>
                        <Edit className="mr-1 h-4 w-4" />
                        Editar
                      </Button>
                    </Link>
                  </div>
                </div>
                
                {/* Condicionantes Management Section */}
                <CondicionantesSection licenseId={license.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-card-foreground mb-2">
            Nenhuma licença cadastrada para este empreendimento
          </h3>
          <p className="text-muted-foreground mb-4">
            Comece cadastrando a primeira licença ambiental
          </p>
          <Link href={`/empreendimentos/${id}/licencas/nova`}>
            <Button data-testid="button-new-license-empty">
              <Plus className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
