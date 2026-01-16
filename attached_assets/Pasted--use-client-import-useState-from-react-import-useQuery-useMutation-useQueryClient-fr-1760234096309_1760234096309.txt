"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format as formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, Trash2, FileSpreadsheet } from "lucide-react";

// ===================================================
// Funções auxiliares
// ===================================================

async function apiRequest<T = any>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(json?.message || text || "Erro desconhecido");
  return (json ?? null) as T;
}

function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

// ===================================================
// Página principal
// ===================================================

export default function GestaoDadosPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    projetoId: "",
    descricao: "",
  });

  const { data: projetos } = useQuery({
    queryKey: ["/api/projetos"],
    queryFn: async () => apiRequest("GET", "/api/projetos"),
  });

  const { data: raw, isLoading } = useQuery({
    queryKey: ["/api/datasets"],
    queryFn: async () => apiRequest("GET", "/api/datasets"),
  });

  const datasets = ensureArray<any>(raw);

  // Upload
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !form.projetoId) throw new Error("Selecione um arquivo e projeto");

      const tipo = selectedFile.name.split(".").pop()?.toLowerCase() || "outro";
      const payload = {
        projetoId: Number(form.projetoId),
        nome: selectedFile.name,
        descricao: form.descricao,
        tipo,
        tamanho: selectedFile.size,
        usuario: "admin@ecobrasil.com",
        dataUpload: new Date().toISOString(),
        url: `/uploads/${selectedFile.name}`,
      };

      return apiRequest("POST", "/api/datasets", payload);
    },
    onSuccess: async () => {
      toast({ title: "Arquivo enviado com sucesso!" });
      setSelectedFile(null);
      setForm({ projetoId: "", descricao: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
    },
    onError: (e: any) => toast({ title: "Falha no upload", description: e.message, variant: "destructive" }),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/datasets/${id}`),
    onSuccess: () => {
      toast({ title: "Arquivo removido!" });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Dados</h1>
          <p className="text-muted-foreground mt-1">
            Vincule planilhas, relatórios e dados brutos aos projetos cadastrados.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Upload className="h-4 w-4 mr-2" /> Novo Upload</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload de Arquivo</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                uploadMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <Label>Projeto</Label>
                <Select
                  value={form.projetoId}
                  onValueChange={(v) => setForm({ ...form, projetoId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                  <SelectContent>
                    {ensureArray<any>(projetos).map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>

              <div>
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.pdf,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>

              <Button type="submit" disabled={uploadMutation.isPending} className="w-full">
                {uploadMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                ) : "Enviar Arquivo"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Arquivos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : datasets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo cadastrado ainda</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-2 text-left">Projeto</th>
                    <th className="p-2 text-left">Arquivo</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Data Upload</th>
                    <th className="p-2 text-left">Tamanho</th>
                    <th className="p-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((d) => (
                    <tr key={d.id} className="border-b hover:bg-muted/50 transition">
                      <td className="p-2">{d.projetoNome || `Projeto #${d.projetoId}`}</td>
                      <td className="p-2 flex items-center gap-1">
                        <FileSpreadsheet className="h-4 w-4 text-primary" /> {d.nome}
                      </td>
                      <td className="p-2"><Badge variant="outline">{d.tipo}</Badge></td>
                      <td className="p-2">{formatDate(new Date(d.dataUpload), "dd/MM/yyyy", { locale: ptBR })}</td>
                      <td className="p-2">{(d.tamanho / 1024).toFixed(1)} KB</td>
                      <td className="p-2 flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => window.open(d.url, "_blank")}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
