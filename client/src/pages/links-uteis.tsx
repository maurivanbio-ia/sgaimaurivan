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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Bug,
  TreeDeciduous,
  Map,
  Droplets,
  Scale,
  Shield,
  BookOpen,
  Folder,
  Search,
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
  tipo?: string;
  acessos?: number;
  ordem?: number;
};

const PASTAS = [
  { value: "fauna", label: "Fauna", icon: Bug, cor: "#22c55e" },
  { value: "flora", label: "Flora", icon: TreeDeciduous, cor: "#16a34a" },
  { value: "geoprocessamento", label: "Geoprocessamento", icon: Map, cor: "#3b82f6" },
  { value: "recursos_hidricos", label: "Recursos Hídricos", icon: Droplets, cor: "#0ea5e9" },
  { value: "licenciamento", label: "Licenciamento", icon: Shield, cor: "#f59e0b" },
  { value: "legislacao", label: "Legislação", icon: Scale, cor: "#8b5cf6" },
  { value: "gestao", label: "Gestão Ambiental", icon: Layers, cor: "#10b981" },
  { value: "documentos", label: "Documentos e Normas", icon: BookOpen, cor: "#6366f1" },
  { value: "sistemas", label: "Sistemas", icon: Building2, cor: "#64748b" },
  { value: "ferramentas", label: "Ferramentas", icon: Wrench, cor: "#78716c" },
  { value: "outros", label: "Outros", icon: FolderOpen, cor: "#94a3b8" },
];

const TIPOS = [
  { value: "portal", label: "Portal" },
  { value: "sistema", label: "Sistema" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "documento", label: "Documento" },
  { value: "legislacao", label: "Legislação" },
  { value: "mapa", label: "Mapa/GIS" },
  { value: "banco_dados", label: "Banco de Dados" },
  { value: "api", label: "API/Serviço" },
  { value: "outro", label: "Outro" },
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
  bug: Bug,
  tree: TreeDeciduous,
  map: Map,
  droplets: Droplets,
  scale: Scale,
  shield: Shield,
  book: BookOpen,
};

export default function LinksUteis() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkUtil | null>(null);
  const [linkForm, setLinkForm] = useState({
    titulo: "",
    descricao: "",
    url: "",
    icone: "link",
    cor: "#3b82f6",
    categoria: "fauna",
    tipo: "portal",
  });

  const { data: links = [], isLoading } = useQuery<LinkUtil[]>({
    queryKey: ["/api/links-uteis"],
    queryFn: async () => {
      const res = await fetch("/api/links-uteis");
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
      categoria: "fauna",
      tipo: "portal",
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
      categoria: link.categoria || "outros",
      tipo: link.tipo || "portal",
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

  const filteredLinks = links.filter(link => 
    searchTerm === "" || 
    link.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    link.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLinksByPasta = (pasta: string) => {
    return filteredLinks.filter(link => link.categoria === pasta);
  };

  const pastasComLinks = PASTAS.filter(pasta => getLinksByPasta(pasta.value).length > 0);
  const pastasVazias = PASTAS.filter(pasta => getLinksByPasta(pasta.value).length === 0);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-8 w-8" />
            Links Úteis
          </h1>
          <p className="text-muted-foreground mt-2">
            Biblioteca de links organizados por categoria ambiental
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Link
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar links..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <Card className="p-8 text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum link cadastrado ainda</p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar primeiro link
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          <Accordion type="multiple" defaultValue={pastasComLinks.map(p => p.value)} className="space-y-2">
            {PASTAS.map((pasta) => {
              const linksNaPasta = getLinksByPasta(pasta.value);
              const PastaIcon = pasta.icon;
              
              if (linksNaPasta.length === 0 && searchTerm === "") return null;
              if (linksNaPasta.length === 0) return null;
              
              return (
                <AccordionItem 
                  key={pasta.value} 
                  value={pasta.value}
                  className="border rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div 
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: pasta.cor + "20" }}
                      >
                        <PastaIcon className="h-5 w-5" style={{ color: pasta.cor }} />
                      </div>
                      <span className="font-semibold">{pasta.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {linksNaPasta.length} {linksNaPasta.length === 1 ? "link" : "links"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pt-2">
                      {linksNaPasta.map((link) => {
                        const IconComponent = getIconComponent(link.icone || "link");
                        const tipoInfo = TIPOS.find(t => t.value === link.tipo);
                        
                        return (
                          <Card 
                            key={link.id} 
                            className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4"
                            style={{ borderLeftColor: link.cor || pasta.cor }}
                            onClick={() => handleOpenLink(link)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div 
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: (link.cor || pasta.cor) + "20" }}
                              >
                                <IconComponent 
                                  className="h-5 w-5" 
                                  style={{ color: link.cor || pasta.cor }}
                                />
                              </div>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(link)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => deleteMutation.mutate(link.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
                              {link.titulo}
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </h4>
                            {link.descricao && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{link.descricao}</p>
                            )}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                              <Badge variant="outline" className="text-xs">
                                {tipoInfo?.label || link.tipo || "Link"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {link.acessos || 0} acessos
                              </span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {searchTerm && filteredLinks.length === 0 && (
            <Card className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum link encontrado para "{searchTerm}"</p>
            </Card>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLink ? "Editar Link" : "Novo Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input
                value={linkForm.titulo}
                onChange={(e) => setLinkForm({ ...linkForm, titulo: e.target.value })}
                placeholder="Ex: Portal SEIA Bahia"
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input
                value={linkForm.url}
                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                placeholder="https://seia.inema.ba.gov.br"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={linkForm.descricao}
                onChange={(e) => setLinkForm({ ...linkForm, descricao: e.target.value })}
                placeholder="Breve descrição do link"
                className="min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Pasta/Categoria *</label>
                <Select value={linkForm.categoria} onValueChange={(v) => setLinkForm({ ...linkForm, categoria: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a pasta" />
                  </SelectTrigger>
                  <SelectContent>
                    {PASTAS.map((pasta) => {
                      const PastaIcon = pasta.icon;
                      return (
                        <SelectItem key={pasta.value} value={pasta.value}>
                          <div className="flex items-center gap-2">
                            <PastaIcon className="h-4 w-4" style={{ color: pasta.cor }} />
                            {pasta.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <Select value={linkForm.tipo} onValueChange={(v) => setLinkForm({ ...linkForm, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="bug">Fauna</SelectItem>
                    <SelectItem value="tree">Flora</SelectItem>
                    <SelectItem value="map">Mapa</SelectItem>
                    <SelectItem value="droplets">Água</SelectItem>
                    <SelectItem value="scale">Legislação</SelectItem>
                    <SelectItem value="shield">Licenciamento</SelectItem>
                    <SelectItem value="book">Documento</SelectItem>
                    <SelectItem value="wrench">Ferramenta</SelectItem>
                    <SelectItem value="folder">Pasta</SelectItem>
                    <SelectItem value="layers">Camadas</SelectItem>
                    <SelectItem value="file">Arquivo</SelectItem>
                    <SelectItem value="building">Prédio</SelectItem>
                  </SelectContent>
                </Select>
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
