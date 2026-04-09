import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Users, Trash2, Search, ShieldCheck, UserCog, Loader2, AlertTriangle, Phone, Pencil, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

interface UserItem {
  id: number;
  email: string;
  role: string;
  cargo: string;
  unidade: string;
  criadoEm: string;
  whatsapp?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  colaborador: "Colaborador",
  diretor: "Diretor",
  financeiro: "Financeiro",
  rh: "RH",
};

const CARGO_LABELS: Record<string, string> = {
  admin: "Administrador",
  diretor: "Diretor",
  coordenador: "Coordenador",
  colaborador: "Colaborador",
  financeiro: "Financeiro",
  rh: "RH",
};

export default function AdminUsuarios() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<UserItem | null>(null);
  const [editWhatsapp, setEditWhatsapp] = useState<UserItem | null>(null);
  const [whatsappInput, setWhatsappInput] = useState("");

  const { data: usersList = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ["/api/users"],
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao excluir usuário");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Usuário excluído", description: `${data.deleted?.email} foi removido` });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setConfirmDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setConfirmDelete(null);
    },
  });

  const updateWhatsappMutation = useMutation({
    mutationFn: async ({ id, whatsapp }: { id: number; whatsapp: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, { whatsapp });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao atualizar WhatsApp");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "WhatsApp salvo!", description: "Número atualizado com sucesso." });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setEditWhatsapp(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const filtered = usersList.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.cargo?.toLowerCase().includes(search.toLowerCase()) ||
      u.unidade?.toLowerCase().includes(search.toLowerCase())
  );

  const openEditWhatsapp = (u: UserItem) => {
    setEditWhatsapp(u);
    setWhatsappInput(u.whatsapp || "");
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-slate-600" />
            Gerenciar Usuários
          </h1>
          <p className="text-muted-foreground text-sm">Administração de contas e WhatsApp para notificações</p>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Usuários cadastrados</CardTitle>
              <CardDescription>{usersList.length} conta(s) · Configure o WhatsApp de cada usuário para receber notificações de demandas</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por e-mail, cargo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                noNormalize
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando usuários...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhum usuário encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {CARGO_LABELS[u.cargo] || u.cargo} · {u.unidade || "Sem unidade"}
                      </p>
                      {u.whatsapp ? (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                          <CheckCircle className="h-3 w-3" />
                          WhatsApp: {u.whatsapp}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />
                          Sem WhatsApp cadastrado
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        u.role === "admin"
                          ? "border-red-300 text-red-700 bg-red-50"
                          : "border-slate-300 text-slate-600"
                      }
                    >
                      {u.role === "admin" && <ShieldCheck className="h-3 w-3 mr-1" />}
                      {ROLE_LABELS[u.role] || u.role}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-200 hover:bg-green-50 text-xs"
                      onClick={() => openEditWhatsapp(u)}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setConfirmDelete(u)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog editar WhatsApp */}
      <Dialog open={!!editWhatsapp} onOpenChange={(open) => { if (!open) setEditWhatsapp(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Phone className="h-5 w-5" />
              WhatsApp de {editWhatsapp?.email}
            </DialogTitle>
            <DialogDescription>
              Quando uma demanda for atribuída a este usuário, o sistema enviará uma notificação para este número.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label>Número WhatsApp</Label>
              <Input
                placeholder="Ex: 5571982090828 (com código do país)"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value.replace(/\D/g, ""))}
                noNormalize
              />
              <p className="text-xs text-muted-foreground">
                Digite apenas números com código do país: <strong>55</strong> + DDD + número.<br />
                Ex: <code>5571982090828</code>
              </p>
            </div>
            {whatsappInput && (
              <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-green-700">
                Número formatado: <strong>{whatsappInput}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWhatsapp(null)}>
              Cancelar
            </Button>
            {editWhatsapp?.whatsapp && (
              <Button
                variant="ghost"
                className="text-red-500"
                onClick={() => updateWhatsappMutation.mutate({ id: editWhatsapp!.id, whatsapp: "" })}
                disabled={updateWhatsappMutation.isPending}
              >
                Remover
              </Button>
            )}
            <Button
              onClick={() => updateWhatsappMutation.mutate({ id: editWhatsapp!.id, whatsapp: whatsappInput })}
              disabled={updateWhatsappMutation.isPending || !whatsappInput}
              className="bg-green-700 hover:bg-green-800"
            >
              {updateWhatsappMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" />Salvar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog excluir usuário */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Excluir Usuário
            </DialogTitle>
            <DialogDescription>
              Esta ação é permanente e não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm">
              Tem certeza que deseja excluir o usuário:
            </p>
            <p className="font-medium text-sm mt-1 p-2 bg-muted rounded">
              {confirmDelete?.email}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />Excluir</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
