import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";

export default function ImportPlanilhaDialog() {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("planilha", file);
      const res = await fetch("/api/financeiro/upload-planilha", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Importação concluída",
        description: `Registros inseridos: ${data.inseridos}`,
      });
      qc.invalidateQueries({ queryKey: ["/api/financeiro/lancamentos"] });
      setFile(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Upload className="mr-2 h-4 w-4" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Planilha Financeira</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            <p className="text-sm text-muted-foreground">
              Envie arquivos .xlsx, .xls ou .csv
            </p>
          </div>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            onClick={() => file && mutation.mutate(file)}
            disabled={!file || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
