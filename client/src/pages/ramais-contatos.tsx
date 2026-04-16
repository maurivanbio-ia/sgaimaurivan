
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Building2,
  Search,
  Plus,
  Edit,
  Trash2,
  Mail,
  Smartphone,
  Copy,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RamalContato = {
  id: number;
  nome: string;
  cargo?: string;
  departamento?: string;
  ramal?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  foto?: string;
  ordem?: number;
};

export default function RamaisContatos() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContato, setEditingContato] = useState<RamalContato | null>(null);
  const [contatoForm, setContatoForm] = useState({
    nome: "",
    cargo: "",
    departamento: "",
    ramal: "",
    telefone: "",
    celular: "",
    email: "",
  });

  const { data: contatos = [], isLoading } = useQuery<RamalContato[]>({
    queryKey: ["/api/ramais-contatos"],
    queryFn: async () => {
      const res = await fetch("/api/ramais-contatos");
      if (!res.ok) throw new Error("Erro ao buscar contatos");
      return res.json();
    },
  });

  const filteredContatos = useMemo(() => {
    if (!searchTerm) return contatos;
    const term = searchTerm.toLowerCase();
    return contatos.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.departamento?.toLowerCase().includes(term) ||
        c.cargo?.toLowerCase().includes(term)
    );
  }, [contatos, searchTerm]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof contatoForm) =>
      apiRequest("POST", "/api/ramais-contatos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ramais-contatos"] });
      toast({ title: "Contato criado!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar contato", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof contatoForm }) =>
      apiRequest("PUT", `/api/ramais-contatos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ramais-contatos"] });
      toast({ title: "Contato atualizado!" });
      setIsDialogOpen(false);
      setEditingContato(null);
      resetForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/ramais-contatos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ramais-contatos"] });
      toast({ title: "Contato removido!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setContatoForm({
      nome: "",
      cargo: "",
      departamento: "",
      ramal: "",
      telefone: "",
      celular: "",
      email: "",
    });
  };

  const handleEdit = (contato: RamalContato) => {
    setEditingContato(contato);
    setContatoForm({
      nome: contato.nome,
      cargo: contato.cargo || "",
      departamento: contato.departamento || "",
      ramal: contato.ramal || "",
      telefone: contato.telefone || "",
      celular: contato.celular || "",
      email: contato.email || "",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingContato(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Phone className="h-8 w-8" />
            Ramais e Contatos
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie a lista de ramais e contatos da empresa
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Contato
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, departamento..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredContatos.length === 0 ? (
        <Card className="p-8 text-center">
          <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum contato encontrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContatos.map((contato) => (
            <Card key={contato.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                      {contato.nome.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold">{contato.nome}</h4>
                    {contato.cargo && (
                      <p className="text-sm text-muted-foreground">{contato.cargo}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { handleEdit(contato); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteMutation.mutate(contato.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {contato.departamento && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Building2 className="h-4 w-4" />
                  <span>{contato.departamento}</span>
                </div>
              )}

              <div className="space-y-2">
                {contato.ramal && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>Ramal: {contato.ramal}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(contato.ramal!, "Ramal")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {contato.telefone && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contato.telefone}`} className="hover:underline">{contato.telefone}</a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(contato.telefone!, "Telefone")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {contato.celular && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contato.celular}`} className="hover:underline">{contato.celular}</a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(contato.celular!, "Celular")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {contato.email && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${contato.email}`} className="hover:underline truncate max-w-[180px]">{contato.email}</a>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(contato.email!, "Email")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContato ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={contatoForm.nome}
                onChange={(e) => setContatoForm({ ...contatoForm, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cargo</label>
                <Input
                  value={contatoForm.cargo}
                  onChange={(e) => setContatoForm({ ...contatoForm, cargo: e.target.value })}
                  placeholder="Cargo"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Departamento</label>
                <Input
                  value={contatoForm.departamento}
                  onChange={(e) => setContatoForm({ ...contatoForm, departamento: e.target.value })}
                  placeholder="Departamento"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Ramal</label>
                <Input
                  value={contatoForm.ramal}
                  onChange={(e) => setContatoForm({ ...contatoForm, ramal: e.target.value })}
                  placeholder="Ex: 1234"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  value={contatoForm.telefone}
                  onChange={(e) => { setContatoForm({ ...contatoForm, telefone: e.target.value }); }}
                  placeholder="(00) 0000-0000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Celular</label>
                <Input
                  value={contatoForm.celular}
                  onChange={(e) => setContatoForm({ ...contatoForm, celular: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={contatoForm.email}
                  onChange={(e) => setContatoForm({ ...contatoForm, email: e.target.value })}
                  placeholder="email@empresa.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingContato) {
                  updateMutation.mutate({ id: editingContato.id, data: contatoForm });
                } else {
                  createMutation.mutate(contatoForm);
                }
              }}
              disabled={!contatoForm.nome || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingContato ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
