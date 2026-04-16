import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Loader2, File, Download, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { queryClient } from "@/lib/queryClient";

interface Documento {
  id: number;
  nome: string;
  arquivoUrl: string;
  tipo: string;
  tamanho: number;
  empreendimentoId: number;
  empreendimentoNome?: string;
  createdAt: string;
}

interface Empreendimento {
  id: number;
  nome: string;
}

export default function ClienteDocumentos() {
  const { toast } = useToast();
  const [selectedEmpreendimento, setSelectedEmpreendimento] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: documentos = [], isLoading: docsLoading } = useQuery<Documento[]>({
    queryKey: ['/api/cliente/documentos'],
  });

  const { data: empreendimentos = [], isLoading: empLoading } = useQuery<Empreendimento[]>({
    queryKey: ['/api/cliente/empreendimentos'],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/cliente/documentos', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar documento');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Documento enviado",
        description: "Seu documento foi enviado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cliente/documentos'] });
      setSelectedFile(null);
      setSelectedEmpreendimento("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar o documento",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !selectedEmpreendimento) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um empreendimento e um arquivo",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('empreendimentoId', selectedEmpreendimento);
    formData.append('nome', selectedFile.name);

    uploadMutation.mutate(formData);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Documentos
        </h1>
        <p className="text-muted-foreground">
          Envie e gerencie documentos relacionados aos seus empreendimentos
        </p>
      </div>

      <Card data-testid="card-upload">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-green-600" />
            Enviar Documento
          </CardTitle>
          <CardDescription>
            Selecione o empreendimento e o arquivo para enviar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="empreendimento">Empreendimento</Label>
              {empLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select 
                  value={selectedEmpreendimento} 
                  onValueChange={setSelectedEmpreendimento}
                >
                  <SelectTrigger data-testid="select-empreendimento">
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
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="cursor-pointer"
                data-testid="input-file"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selecionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending || !selectedFile || !selectedEmpreendimento}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-upload"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Enviar Documento
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-documentos-lista">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Meus Documentos
          </CardTitle>
          <CardDescription>
            Lista de documentos enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum documento enviado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentos.map((doc) => (
                  <TableRow key={doc.id} data-testid={`doc-row-${doc.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        {doc.nome}
                      </div>
                    </TableCell>
                    <TableCell>{doc.empreendimentoNome || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.tipo || 'documento'}</Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.tamanho || 0)}</TableCell>
                    <TableCell>
                      {doc.createdAt ? format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      {doc.arquivoUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid={`button-download-${doc.id}`}
                        >
                          <a href={doc.arquivoUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
