"use client";

import { useState } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  Globe,
  Wrench,
  FolderOpen,
  Layers,
  FileText,
  Building2,
  Users,
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LinkUtil = {
  id: number;
  titulo: string;
  descricao?: string;
  url: string;
  icone?: string;
  cor?: string;
  categoria?: string;
  acessos?: number;
  ordem?: number;
};

const LINK_CATEGORIAS = [
  { value: "all", label: "Todos" },
  { value: "sistemas", label: "Sistemas" },
  { value: "portais", label: "Portais" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "documentos", label: "Documentos" },
];

const LINK_ICONS: { [key: string]: any } = {
  globe: Globe,
  wrench: Wrench,
  folder: FolderOpen,
  layers: Layers,
  file: FileText,
  link: Link2,
  building: Building2,
  users: Users,
};

export default function LinksUteis() {
  const { toast } = useToast();
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkUtil | null>(null);
  const [linkForm, setLinkForm] = useState({
    titulo: "",
    descricao: "",
    url: "",
    icone: "link",
    cor: "#3b82f6",
    categoria: "sistemas",
  });

  const { data: links = [], isLoading } = useQuery<LinkUtil[]>({
    queryKey: ["/api/links-uteis", categoriaFilter],
    queryFn: async () => {
      const params = categoriaFilter !== "all" ? `?categoria=${categoriaFilter}` : "";
      const res = await fetch(`/api/links-uteis${params}`);
      if (!res.ok) throw new Error("Erro ao buscar links");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof linkForm) =>
      apiRequest("POST", "/api/links-uteis", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      toast({ title: "Link criado!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar link", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof linkForm }) =>
      apiRequest("PUT", `/api/links-uteis/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      toast({ title: "Link atualizado!" });
      setIsDialogOpen(false);
      setEditingLink(null);
      resetForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/links-uteis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      toast({ title: "Link removido!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir", variant: "destructive" });
    },
  });

  const accessMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/links-uteis/${id}/acessar`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      window.open(data.url, "_blank");
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao acessar link", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setLinkForm({
      titulo: "",
      descricao: "",
      url: "",
      icone: "link",
      cor: "#3b82f6",
      categoria: "sistemas",
    });
  };

  const handleEdit = (link: LinkUtil) => {
    setEditingLink(link);
    setLinkForm({
      titulo: link.titulo,
      descricao: link.descricao || "",
      url: link.url,
      icone: link.icone || "link",
      cor: link.cor || "#3b82f6",
      categoria: link.categoria || "sistemas",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingLink(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenLink = (link: LinkUtil) => {
    accessMutation.mutate(link.id);
  };

  const getIconComponent = (iconName: string) => {
    return LINK_ICONS[iconName] || Link2;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-8 w-8" />
            Links Úteis
          </h1>
          <p className="text-muted-foreground mt-2">
            Acesse rapidamente sistemas, portais e ferramentas importantes
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Link
        </Button>
      </div>

      <Tabs value={categoriaFilter} onValueChange={setCategoriaFilter}>
        <TabsList>
          {LINK_CATEGORIAS.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <Card className="p-8 text-center">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum link encontrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => {
            const IconComponent = getIconComponent(link.icone || "link");
            return (
              <Card 
                key={link.id} 
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleOpenLink(link)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div 
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: (link.cor || "#3b82f6") + "20" }}
                  >
                    <IconComponent 
                      className="h-6 w-6" 
                      style={{ color: link.cor || "#3b82f6" }}
                    />
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(link)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteMutation.mutate(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <h4 className="font-semibold mb-1 flex items-center gap-2">
                  {link.titulo}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </h4>
                {link.descricao && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{link.descricao}</p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <Badge variant="secondary" className="text-xs">
                    {LINK_CATEGORIAS.find(c => c.value === link.categoria)?.label || link.categoria}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {link.acessos || 0} acessos
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "Editar Link" : "Novo Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={linkForm.titulo}
                onChange={(e) => setLinkForm({ ...linkForm, titulo: e.target.value })}
                placeholder="Título do link"
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input
                value={linkForm.url}
                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                placeholder="https://exemplo.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={linkForm.descricao}
                onChange={(e) => setLinkForm({ ...linkForm, descricao: e.target.value })}
                placeholder="Breve descrição do link"
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Ícone</label>
                <Select value={linkForm.icone} onValueChange={(v) => setLinkForm({ ...linkForm, icone: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="globe">Globo</SelectItem>
                    <SelectItem value="wrench">Ferramenta</SelectItem>
                    <SelectItem value="folder">Pasta</SelectItem>
                    <SelectItem value="layers">Camadas</SelectItem>
                    <SelectItem value="file">Arquivo</SelectItem>
                    <SelectItem value="building">Prédio</SelectItem>
                    <SelectItem value="users">Usuários</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={linkForm.categoria} onValueChange={(v) => setLinkForm({ ...linkForm, categoria: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sistemas">Sistemas</SelectItem>
                    <SelectItem value="portais">Portais</SelectItem>
                    <SelectItem value="ferramentas">Ferramentas</SelectItem>
                    <SelectItem value="documentos">Documentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={linkForm.cor}
                  onChange={(e) => setLinkForm({ ...linkForm, cor: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={linkForm.cor}
                  onChange={(e) => setLinkForm({ ...linkForm, cor: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1"
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
                if (editingLink) {
                  updateMutation.mutate({ id: editingLink.id, data: linkForm });
                } else {
                  createMutation.mutate(linkForm);
                }
              }}
              disabled={!linkForm.titulo || !linkForm.url || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingLink ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
