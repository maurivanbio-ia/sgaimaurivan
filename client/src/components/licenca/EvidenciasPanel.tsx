import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date-utils";
import { FileText, Upload, CheckCircle2, Star, Download, Trash2 } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { CondicionanteEvidencia } from "@shared/schema";
import { evidenciaSchema, type EvidenciaFormData } from "./types";

export function EvidenciasPanel({ condicionanteId, licencaId }: { condicionanteId: number; licencaId?: number }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploadedFilePath, setUploadedFilePath] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/condicionantes", condicionanteId, "evidencias"] });
    if (licencaId) queryClient.invalidateQueries({ queryKey: ["/api/licencas", licencaId, "condicionantes"] });
  }

  const { data: evidencias = [], isLoading } = useQuery<CondicionanteEvidencia[]>({
    queryKey: ["/api/condicionantes", condicionanteId, "evidencias"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/condicionantes/${condicionanteId}/evidencias`);
      return res.json();
    },
  });

  const form = useForm<EvidenciaFormData>({
    resolver: zodResolver(evidenciaSchema),
    defaultValues: { nome: "", tipo: "documento", url: "", descricao: "", emitidoPor: "", dataEmissao: "" },
  });

  const createEv = useMutation({
    mutationFn: async (data: EvidenciaFormData) => {
      const res = await apiRequest("POST", `/api/condicionantes/${condicionanteId}/evidencias`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Evidência registrada" });
      setIsDialogOpen(false);
      form.reset();
      setUploadedFilePath("");
      setUploadedFileName("");
    },
    onError: () => toast({ title: "Erro ao registrar evidência", variant: "destructive" }),
  });

  const aprovarEv = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/condicionantes/evidencias/${id}/aprovar`, {});
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Evidência aprovada" });
    },
  });

  const deleteEv = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/condicionantes/evidencias/${id}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Evidência removida" });
    },
  });

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="h-4 w-4" />
          Evidências e Documentos ({evidencias.length})
        </h4>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setUploadedFilePath(""); setUploadedFileName(""); form.reset(); } }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7">
              <Upload className="h-3 w-3" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Evidência</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createEv.mutate({ ...d, url: uploadedFilePath || d.url }))} className="space-y-3">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Documento *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Relatório de Monitoramento Q1 2025" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="documento">Documento</SelectItem>
                        <SelectItem value="imagem">Imagem</SelectItem>
                        <SelectItem value="relatorio">Relatório</SelectItem>
                        <SelectItem value="terceiros">Documento de Terceiros</SelectItem>
                        <SelectItem value="licenca">Licença/Autorização</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="descricao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea {...field} rows={2} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="emitidoPor" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emitido Por</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: Empresa Consultora X" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="dataEmissao" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Emissão</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Arquivo <span className="text-muted-foreground font-normal">(opcional)</span></label>
                  {uploadedFilePath ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-md border bg-green-50 text-green-800 text-sm">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{uploadedFileName || "Arquivo enviado"}</span>
                      <button type="button" onClick={() => { setUploadedFilePath(""); setUploadedFileName(""); }} className="text-green-600 hover:text-red-600 transition-colors ml-1 shrink-0" title="Remover arquivo">✕</button>
                    </div>
                  ) : (
                    <ObjectUploader
                      accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                      onGetUploadParameters={async () => {
                        const res = await apiRequest("POST", "/api/upload/pdf");
                        const data = await res.json();
                        return { method: "PUT" as const, url: data.url, filePath: data.filePath };
                      }}
                      onComplete={({ filePath, fileName }) => {
                        setUploadedFilePath(filePath || "");
                        setUploadedFileName(fileName || "Arquivo enviado");
                      }}
                    />
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createEv.isPending}>Registrar Evidência</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : evidencias.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
          Nenhuma evidência registrada. Adicione documentos de cumprimento.
        </div>
      ) : (
        <div className="space-y-2">
          {evidencias.map(ev => (
            <div key={ev.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="font-medium">{ev.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {ev.tipo} {ev.emitidoPor ? `• ${ev.emitidoPor}` : ""}
                    {ev.dataEmissao ? ` • ${formatDate(ev.dataEmissao)}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {ev.aprovado ? (
                  <Badge className="bg-green-100 text-green-800 gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Aprovado
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                    onClick={() => aprovarEv.mutate(ev.id)}>
                    <Star className="h-3 w-3" />
                    Aprovar
                  </Button>
                )}
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Download className="h-3 w-3" />
                    </Button>
                  </a>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500"
                  onClick={() => deleteEv.mutate(ev.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
