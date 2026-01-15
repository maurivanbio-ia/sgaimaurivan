import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useToast } from "@/hooks/use-toast";

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
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";

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
] as const;

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
] as const;

const LINK_ICONS: Record<string, any> = {
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

const normalizeUrl = (raw: string) => {
  const value = raw.trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const formSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título com pelo menos 2 caracteres").max(120),
  url: z
    .string()
    .trim()
    .min(5, "Informe uma URL válida")
    .max(500)
    .transform((v) => normalizeUrl(v))
    .refine((v) => {
      try {
        const u = new URL(v);
        return ["http:", "https:"].includes(u.protocol);
      } catch {
        return false;
      }
    }, "URL inválida. Use http(s)://"),
  descricao: z.string().trim().max(500).optional().or(z.literal("")),
  icone: z.string().default("link"),
  cor: z.string().trim().min(4).max(20).default("#3b82f6"),
  categoria: z.string().default("fauna"),
  tipo: z.string().default("portal"),
});

type LinkFormValues = z.infer<typeof formSchema>;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type SortKey = "titulo" | "acessos" | "ordem";

export default function LinksUteis() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 250);

  const [filtroPasta, setFiltroPasta] = useState<string>("todas");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("ordem");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkUtil | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LinkUtil | null>(null);

  const form = useForm<LinkFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      descricao: "",
      url: "",
      icone: "link",
      cor: "#3b82f6",
      categoria: "fauna",
      tipo: "portal",
    },
    mode: "onChange",
  });

  const {
    data: links = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<LinkUtil[]>({
    queryKey: ["/api/links-uteis"],
    queryFn: async () => {
      const res = await fetch("/api/links-uteis");
      if (!res.ok) throw new Error("Erro ao buscar links");
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: LinkFormValues) =>
      apiRequest("POST", "/api/links-uteis", data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      toast({ title: "Link criado!" });
      setIsDialogOpen(false);
      setEditingLink(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao criar link",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: LinkFormValues }) =>
      apiRequest("PUT", `/api/links-uteis/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      toast({ title: "Link atualizado!" });
      setIsDialogOpen(false);
      setEditingLink(null);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao atualizar",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/links-uteis/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      toast({ title: "Link removido!" });
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir",
        variant: "destructive",
      });
    },
  });

  const accessMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/links-uteis/${id}/acessar`);
      return res.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/links-uteis"] });
      if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao acessar link",
        variant: "destructive",
      });
    },
  });

  const handleNew = () => {
    setEditingLink(null);
    form.reset({
      titulo: "",
      descricao: "",
      url: "",
      icone: "link",
      cor: "#3b82f6",
      categoria: "fauna",
      tipo: "portal",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (link: LinkUtil) => {
    setEditingLink(link);
    form.reset({
      titulo: link.titulo ?? "",
      descricao: link.descricao ?? "",
      url: link.url ?? "",
      icone: link.icone ?? "link",
      cor: link.cor ?? "#3b82f6",
      categoria: link.categoria ?? "outros",
      tipo: link.tipo ?? "portal",
    });
    setIsDialogOpen(true);
  };

  const handleOpenLink = (link: LinkUtil) => {
    if (accessMutation.isPending) return;
    accessMutation.mutate(link.id);
  };

  const getIconComponent = (iconName: string) => LINK_ICONS[iconName] || Link2;

  const filteredAndSortedLinks = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    const base = links.filter((link) => {
      const matchesSearch =
        !term ||
        link.titulo?.toLowerCase().includes(term) ||
        link.descricao?.toLowerCase().includes(term) ||
        link.url?.toLowerCase().includes(term);

      const matchesPasta = filtroPasta === "todas" || (link.categoria || "outros") === filtroPasta;
      const matchesTipo = filtroTipo === "todos" || (link.tipo || "outro") === filtroTipo;

      return matchesSearch && matchesPasta && matchesTipo;
    });

    const byTitle = (a: LinkUtil, b: LinkUtil) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR");
    const byAccess = (a: LinkUtil, b: LinkUtil) => (b.acessos || 0) - (a.acessos || 0) || byTitle(a, b);
    const byOrder = (a: LinkUtil, b: LinkUtil) =>
      (a.ordem ?? 999999) - (b.ordem ?? 999999) || byTitle(a, b);

    const sorted =
      sortKey === "titulo" ? base.sort(byTitle) : sortKey === "acessos" ? base.sort(byAccess) : base.sort(byOrder);

    return sorted;
  }, [links, debouncedSearch, filtroPasta, filtroTipo, sortKey]);

  const linksByPasta = useMemo(() => {
    const map = new Map<string, LinkUtil[]>();
    for (const p of PASTAS) map.set(p.value, []);
    for (const link of filteredAndSortedLinks) {
      const key = link.categoria || "outros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(link);
    }
    return map;
  }, [filteredAndSortedLinks]);

  const pastasComLinks = useMemo(
    () => PASTAS.filter((p) => (linksByPasta.get(p.value) || []).length > 0),
    [linksByPasta]
  );

  const defaultOpenAccordions = useMemo(() => pastasComLinks.map((p) => p.value), [pastasComLinks]);

  const onSubmit = (values: LinkFormValues) => {
    const payload: LinkFormValues = {
      ...values,
      url: normalizeUrl(values.url),
      titulo: values.titulo.trim(),
      descricao: values.descricao?.trim() || "",
    };

    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, data: payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Link2 className="h-8 w-8" />
            Links Úteis
          </h1>
          <p className="text-muted-foreground mt-2">
            Biblioteca de links organizados por categoria ambiental
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Link
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-12">
        <div className="relative md:col-span-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descrição ou URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            aria-label="Buscar links"
          />
        </div>

        <div className="md:col-span-3">
          <Select value={filtroPasta} onValueChange={setFiltroPasta}>
            <SelectTrigger aria-label="Filtrar por pasta">
              <SelectValue placeholder="Pasta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as pastas</SelectItem>
              {PASTAS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger aria-label="Filtrar por tipo">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-1">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger aria-label="Ordenar">
              <SelectValue placeholder="Ord." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ordem">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Ordem
                </div>
              </SelectItem>
              <SelectItem value="titulo">Título</SelectItem>
              <SelectItem value="acessos">Acessos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card className="p-8">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Falha ao carregar links</p>
              <p className="text-sm text-muted-foreground">
                {(error as any)?.message ?? "Erro inesperado ao buscar dados."}
              </p>
              <div className="flex gap-2">
                <Button onClick={() => refetch()} disabled={isFetching}>
                  {isFetching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tentar novamente
                </Button>
              </div>
            </div>
          </div>
        </Card>
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
          <Accordion type="multiple" defaultValue={defaultOpenAccordions} className="space-y-2">
            {PASTAS.map((pasta) => {
              const linksNaPasta = linksByPasta.get(pasta.value) || [];
              const PastaIcon = pasta.icon;

              if (linksNaPasta.length === 0) return null;

              return (
                <AccordionItem
                  key={pasta.value}
                  value={pasta.value}
                  className="border rounded-lg overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: pasta.cor + "20" }}>
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
                        const tipoInfo = TIPOS.find((t) => t.value === (link.tipo || "outro"));

                        return (
                          <Card
                            key={link.id}
                            className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4"
                            style={{ borderLeftColor: link.cor || pasta.cor }}
                            onClick={() => handleOpenLink(link)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") handleOpenLink(link);
                            }}
                            aria-label={`Abrir link ${link.titulo}`}
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(link)}
                                  aria-label={`Editar ${link.titulo}`}
                                  title="Editar"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => setDeleteTarget(link)}
                                  aria-label={`Excluir ${link.titulo}`}
                                  title="Excluir"
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
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {link.descricao}
                              </p>
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

          {debouncedSearch && filteredAndSortedLinks.length === 0 && (
            <Card className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum link encontrado para "{debouncedSearch}"
              </p>
            </Card>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLink ? "Editar Link" : "Novo Link"}</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
                e.preventDefault();
                form.handleSubmit(onSubmit)();
              }
            }}
          >
            <div>
              <label className="text-sm font-medium">Título *</label>
              <Input
                autoFocus
                placeholder="Ex: Portal SEIA Bahia"
                {...form.register("titulo")}
              />
              {form.formState.errors.titulo && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.titulo.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">URL *</label>
              <Input placeholder="https://seia.inema.ba.gov.br" {...form.register("url")} />
              {form.formState.errors.url && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.url.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                placeholder="Breve descrição do link"
                className="min-h-[60px]"
                {...form.register("descricao")}
              />
              {form.formState.errors.descricao && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.descricao.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Pasta/Categoria *</label>
                <Select
                  value={form.watch("categoria")}
                  onValueChange={(v) => form.setValue("categoria", v, { shouldValidate: true })}
                >
                  <SelectTrigger aria-label="Selecionar pasta">
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
                <Select
                  value={form.watch("tipo")}
                  onValueChange={(v) => form.setValue("tipo", v, { shouldValidate: true })}
                >
                  <SelectTrigger aria-label="Selecionar tipo">
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
                <Select
                  value={form.watch("icone")}
                  onValueChange={(v) => form.setValue("icone", v)}
                >
                  <SelectTrigger aria-label="Selecionar ícone">
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
                    <SelectItem value="users">Usuários</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Cor</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={form.watch("cor")}
                    onChange={(e) => form.setValue("cor", e.target.value)}
                    className="w-12 h-10 p-1"
                    aria-label="Selecionar cor"
                  />
                  <Input
                    value={form.watch("cor")}
                    onChange={(e) => form.setValue("cor", e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                    aria-label="Cor em hexadecimal"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingLink(null);
                }}
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={!form.formState.isValid || isSaving}
                aria-disabled={!form.formState.isValid || isSaving}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingLink ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm">
                  Você está prestes a excluir{" "}
                  <span className="font-semibold">{deleteTarget?.titulo}</span>.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
