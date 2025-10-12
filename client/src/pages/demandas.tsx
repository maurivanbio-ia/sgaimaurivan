"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Plus, Search, Wrench, Loader2, Trash2, Edit3 } from "lucide-react";

// ✅ Instância React Query
const queryClient = new QueryClient();

// ======================= Banco em Memória =======================
type Equipamento = {
  id: number;
  nome: string;
  tipo: string;
  status: "ativo" | "manutencao" | "inativo";
  descricao?: string;
  responsavel?: string;
};

let DB: Equipamento[] = [
  { id: 1, nome: "Drone DJI Phantom 4", tipo: "Drone", status: "ativo", responsavel: "Carlos" },
  { id: 2, nome: "GPS Garmin 64s", tipo: "GPS", status: "manutencao", responsavel: "Ana" },
  { id: 3, nome: "Câmera Bushnell 24MP", tipo: "Câmera", status: "ativo", responsavel: "Bruno" },
];

// ======================= API Simulada =======================
async function fetchEquipamentos(): Promise<Equipamento[]> {
  await new Promise((r) => setTimeout(r, 200));
  return [...DB];
}
async function addEquipamento(data: Omit<Equipamento, "id">): Promise<Equipamento> {
  const novo = { ...data, id: DB.length + 1 };
  DB.push(novo);
  return novo;
}
async function updateEquipamento(id: number, changes: Partial<Equipamento>): Promise<Equipamento> {
  const idx = DB.findIndex((e) => e.id === id);
  DB[idx] = { ...DB[idx], ...changes };
  return DB[idx];
}
async function deleteEquipamento(id: number): Promise<void> {
  DB = DB.filter((e) => e.id !== id);
}

// ======================= Formulário =======================
const schema = z.object({
  nome: z.string().min(3, "Informe o nome do equipamento"),
  tipo: z.string().min(2, "Informe o tipo"),
  status: z.enum(["ativo", "manutencao", "inativo"]),
  responsavel: z.string().optional(),
  descricao: z.string().optional(),
});

function EquipamentoForm({
  initialData,
  onSuccess,
}: {
  initialData?: Equipamento;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData || {
      nome: "",
      tipo: "",
      status: "ativo",
      responsavel: "",
      descricao: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof schema>) => {
      if (initialData) return updateEquipamento(initialData.id, data);
      return addEquipamento(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipamentos"] });
      onSuccess();
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
        <FormField control={form.control} name="nome" render={({ field }) => (
          <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="tipo" render={({ field }) => (
          <FormItem><FormLabel>Tipo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )}/>
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="manutencao">Em Manutenção</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}/>
        <FormField control={form.control} name="responsavel" render={({ field }) => (
          <FormItem><FormLabel>Responsável</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )}/>
        <FormField control={form.control} name="descricao" render={({ field }) => (
          <FormItem><FormLabel>Descrição</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
        )}/>
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Salvando...</> : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ======================= Página Principal =======================
function EquipamentosPage() {
  const queryClient = useQueryClient();
  const { data: equipamentos = [], isLoading } = useQuery({ queryKey: ["equipamentos"], queryFn: fetchEquipamentos });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Equipamento | null>(null);
  const [toDelete, setToDelete] = useState<Equipamento | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => deleteEquipamento(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipamentos"] }),
  });

  const filtrados = equipamentos.filter((e) =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    e.tipo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="h-6 w-6 text-blue-700" /> Gestão de Equipamentos
        </h1>
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2"/>Novo Equipamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Equipamento</DialogTitle></DialogHeader>
            <EquipamentoForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["equipamentos"] })}/>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center"><Search className="h-4 w-4" /> Buscar</CardTitle>
        </CardHeader>
        <CardContent>
          <Input placeholder="Buscar por nome ou tipo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista de Equipamentos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell>{eq.id}</TableCell>
                    <TableCell>{eq.nome}</TableCell>
                    <TableCell>{eq.tipo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        eq.status === "ativo" ? "text-green-700 border-green-700" :
                        eq.status === "manutencao" ? "text-yellow-700 border-yellow-700" :
                        "text-gray-500 border-gray-500"
                      }>
                        {eq.status === "ativo" ? "Ativo" :
                         eq.status === "manutencao" ? "Manutenção" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{eq.responsavel || "-"}</TableCell>
                    <TableCell className="text-right flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => setSelected(eq)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Editar Equipamento</DialogTitle></DialogHeader>
                          <EquipamentoForm initialData={eq} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["equipamentos"] })}/>
                        </DialogContent>
                      </Dialog>

                      <Button variant="outline" size="icon" onClick={() => setToDelete(eq)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir Equipamento</AlertDialogTitle></AlertDialogHeader>
          Tem certeza que deseja excluir <strong>{toDelete?.nome}</strong>?
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ======================= Provider Wrapper =======================
export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <EquipamentosPage />
    </QueryClientProvider>
  );
}
