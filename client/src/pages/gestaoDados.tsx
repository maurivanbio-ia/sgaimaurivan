"use client";

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
import { Textarea } from "@/components/ui/textarea";
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
import { Upload, Download, Trash2, FileText, Database, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Dataset, Empreendimento } from "@shared/schema";

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function GestaoDados() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados principais
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState("");
  const [filterEmpreendimento, setFilterEmpreendimento] = useState("all");
  const [filterTipo, setFilterTipo] = useState("all");
  const [isUploading, setIsUploading] = useState(false);

  // Formulário
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // ============================================================
  // BUSCA DE DADOS
  // ============================================================

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: async () => {
      const res = await fetch("/api/empreendimentos");
      if (!res.ok) throw new Error("Erro ao carregar empreendimentos");
      return res.json();
    },
  });

  const { data: datasets = [], isLoading, refetch } = useQuery<
    Array<Dataset & { empreendimentoNome?: string }>
  >({
    queryKey: ["/api/datasets", { empreendimentoId: filterEmpreendimento, tipo: filterTipo }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterEmpreendimento !== "all") params.append("empreendimentoId", filterEmpreendimento);
      if (filterTipo !== "all") params.append("tipo", filterTipo);
      const res = await fetch(`/api/datasets?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar arquivos");
      return res.json();
    },
  });

  // ============================================================
  // UPLOAD E DELETE
  // ============================================================

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao enviar arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetch();
      toast({ title: "Sucesso", description: "Arquivo enviado com sucesso!" });
      resetForm();
      setIsUploadDialogOpen(false);
      setIsUploading(false);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao enviar arquivo.", variant: "destructive" });
      setIsUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/datasets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir arquivo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      refetch();
      toast({ title: "Sucesso", description: "Arquivo excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir arquivo.", variant: "destructive" });
    },
  });

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setTipo("");
    setFile(null);
    setSelectedEmpreendimento("");
  };

  const handleUpload = () => {
    if (!selectedEmpreendimento || !nome || !tipo || !file) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatórios.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      uploadMutation.mutate({
        empreendimentoId: parseInt(selectedEmpreendimento),
        nome,
        descricao,
        tipo,
        tamanho: file.size,
        usuario: "Usuário Atual",
        url: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (dataset: Dataset) => {
    const link = document.createElement("a");
    link.href = dataset.url;
    link.download = dataset.nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleClearFilters = () => {
    setFilterEmpreendimento("all");
    setFilterTipo("all");
  };

  // ============================================================
  // INTERFACE
  // ============================================================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8 text-primary" />
            Gestão de Dados
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie planilhas, relatórios e documentos técnicos de cada empreendimento.
          </p>
        </div>

        {/* Botão + Modal Upload */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" /> Enviar Arquivo
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Upload de Arquivo</DialogTitle>
              <DialogDescription>Selecione o empreendimento e envie o arquivo desejado.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Empreendimento *</Label>
                <Select value={selectedEmpreendimento} onValueChange={setSelectedEmpreendimento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o empreendimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {empreendimentos.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nome *</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Relatório de Fauna 2025"
                />
              </div>

              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planilha">Planilha</SelectItem>
                    <SelectItem value="relatorio">Relatório</SelectItem>
                    <SelectItem value="documento">Documento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descrição opcional do arquivo"
                />
              </div>

              <div>
                <Label>Arquivo *</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.pdf,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleUpload} disabled={isUploading || uploadMutation.isPending}>
                  {isUploading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Filtros</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleClearFilters}
          >
            <XCircle className="h-4 w-4 mr-1" /> Limpar Filtros
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Empreendimento</Label>
            <Select value={filterEmpreendimento} onValueChange={setFilterEmpreendimento}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {empreendimentos.map((e) => (
                  <SelectItem key={e.id} value={e.id.toString()}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo</Label>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="planilha">Planilha</SelectItem>
                <SelectItem value="relatorio">Relatório</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Arquivos Cadastrados</CardTitle>
          <CardDescription>{datasets.length} arquivo(s) encontrado(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground">Carregando...</div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              Nenhum arquivo encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empreendimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data Upload</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.nome}</TableCell>
                      <TableCell>{d.empreendimentoNome || `#${d.empreendimentoId}`}</TableCell>
                      <TableCell className="capitalize">{d.tipo}</TableCell>
                      <TableCell>{formatFileSize(d.tamanho)}</TableCell>
                      <TableCell>{d.usuario}</TableCell>
                      <TableCell>
                        {new Intl.DateTimeFormat("pt-BR").format(new Date(d.dataUpload))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleDownload(d)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(d.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
