"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Heart,
  Pin,
  Megaphone,
  AlertTriangle,
  MessageCircle,
  PartyPopper,
  Bell,
  Send,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";

const comunicadoSchema = z.object({
  id: z.number().optional(),
  titulo: z.string().min(1, "Título obrigatório"),
  conteudo: z.string().min(1, "Conteúdo obrigatório"),
  resumo: z.string().optional(),
  tipo: z.string().min(1, "Selecione o tipo"),
  prioridade: z.string().default("normal"),
  fixado: z.boolean().optional().default(false),
  destaque: z.boolean().optional().default(false),
  status: z.string().optional().default("publicado"),
});

type ComunicadoForm = z.infer<typeof comunicadoSchema>;

type Comunicado = {
  id: number;
  titulo: string;
  conteudo: string;
  resumo?: string;
  tipo: string;
  prioridade: string;
  fixado?: boolean;
  destaque?: boolean;
  status: string;
  visualizacoes?: number;
  dataPublicacao: string;
  autor?: {
    id: number;
    email: string;
  };
  curtidas?: number;
  usuarioCurtiu?: boolean;
};

type Comentario = {
  id: number;
  conteudo: string;
  criadoEm: string;
  autor?: {
    id: number;
    email: string;
  };
};

const TIPOS = [
  { value: "aviso", label: "Aviso", icon: Bell, color: "bg-blue-500" },
  { value: "comunicado", label: "Comunicado", icon: Megaphone, color: "bg-green-500" },
  { value: "urgente", label: "Urgente", icon: AlertTriangle, color: "bg-red-500" },
  { value: "informativo", label: "Informativo", icon: MessageCircle, color: "bg-gray-500" },
  { value: "celebracao", label: "Celebração", icon: PartyPopper, color: "bg-yellow-500" },
];

const PRIORIDADES = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

function getTipoConfig(tipo: string) {
  return TIPOS.find((t) => t.value === tipo) || TIPOS[0];
}

function getInitials(email?: string) {
  if (!email) return "?";
  return email.substring(0, 2).toUpperCase();
}

export default function ComunicacaoPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Comunicado | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [selectedComunicado, setSelectedComunicado] = useState<Comunicado | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  const { data: comunicados = [], isLoading } = useQuery<Comunicado[]>({
    queryKey: ["/api/comunicados", tipoFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tipoFilter !== "all") params.set("tipo", tipoFilter);
      const res = await fetch(`/api/comunicados${params.toString() ? `?${params}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar comunicados");
      return res.json();
    },
  });

  const filteredComunicados = useMemo(() => {
    if (!debouncedSearch) return comunicados;
    return comunicados.filter(
      (c) =>
        c.titulo.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.conteudo.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [comunicados, debouncedSearch]);

  const fixedComunicados = useMemo(
    () => filteredComunicados.filter((c) => c.fixado),
    [filteredComunicados]
  );
  const regularComunicados = useMemo(
    () => filteredComunicados.filter((c) => !c.fixado),
    [filteredComunicados]
  );

  const { data: selectedDetail, refetch: refetchDetail } = useQuery<Comunicado>({
    queryKey: ["/api/comunicados", selectedComunicado?.id],
    queryFn: async () => {
      if (!selectedComunicado?.id) return null;
      const res = await fetch(`/api/comunicados/${selectedComunicado.id}`);
      if (!res.ok) throw new Error("Erro ao buscar detalhes");
      return res.json();
    },
    enabled: !!selectedComunicado?.id && detailSheetOpen,
  });

  const { data: comentarios = [], refetch: refetchComentarios } = useQuery<Comentario[]>({
    queryKey: ["/api/comunicados", selectedComunicado?.id, "comentarios"],
    queryFn: async () => {
      if (!selectedComunicado?.id) return [];
      const res = await fetch(`/api/comunicados/${selectedComunicado.id}/comentarios`);
      if (!res.ok) throw new Error("Erro ao buscar comentários");
      return res.json();
    },
    enabled: !!selectedComunicado?.id && detailSheetOpen,
  });

  const form = useForm<ComunicadoForm>({
    resolver: zodResolver(comunicadoSchema),
    defaultValues: {
      titulo: "",
      conteudo: "",
      resumo: "",
      tipo: "comunicado",
      prioridade: "normal",
      fixado: false,
      destaque: false,
      status: "publicado",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ComunicadoForm) => apiRequest("POST", "/api/comunicados", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicados"] });
      toast({ title: "Sucesso", description: "Comunicado publicado!" });
      setIsFormDialogOpen(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao criar comunicado",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ComunicadoForm }) =>
      apiRequest("PUT", `/api/comunicados/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicados"] });
      toast({ title: "Sucesso", description: "Comunicado atualizado!" });
      setIsFormDialogOpen(false);
      setEditingItem(null);
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
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/comunicados/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicados"] });
      toast({ title: "Sucesso", description: "Comunicado removido!" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao excluir",
        variant: "destructive",
      });
    },
  });

  const viewMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/comunicados/${id}/visualizar`),
    onSuccess: () => {
      refetchDetail();
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/comunicados/${id}/curtir`),
    onSuccess: () => {
      refetchDetail();
      queryClient.invalidateQueries({ queryKey: ["/api/comunicados"] });
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao curtir",
        variant: "destructive",
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ id, conteudo }: { id: number; conteudo: string }) =>
      apiRequest("POST", `/api/comunicados/${id}/comentarios`, { conteudo }),
    onSuccess: () => {
      refetchComentarios();
      setNewComment("");
      toast({ title: "Comentário adicionado!" });
    },
    onError: (e: any) => {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao comentar",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ComunicadoForm) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleNew = () => {
    setEditingItem(null);
    form.reset({
      titulo: "",
      conteudo: "",
      resumo: "",
      tipo: "comunicado",
      prioridade: "normal",
      fixado: false,
      destaque: false,
      status: "publicado",
    });
    setIsFormDialogOpen(true);
  };

  const handleEdit = (item: Comunicado) => {
    setEditingItem(item);
    form.reset({
      titulo: item.titulo,
      conteudo: item.conteudo,
      resumo: item.resumo || "",
      tipo: item.tipo,
      prioridade: item.prioridade,
      fixado: item.fixado || false,
      destaque: item.destaque || false,
      status: item.status,
    });
    setIsFormDialogOpen(true);
  };

  const handleViewDetail = (item: Comunicado) => {
    setSelectedComunicado(item);
    setDetailSheetOpen(true);
    viewMutation.mutate(item.id);
  };

  const handleLike = () => {
    if (selectedComunicado) {
      likeMutation.mutate(selectedComunicado.id);
    }
  };

  const handleAddComment = () => {
    if (selectedComunicado && newComment.trim()) {
      commentMutation.mutate({ id: selectedComunicado.id, conteudo: newComment.trim() });
    }
  };

  const ComunicadoCard = ({ item }: { item: Comunicado }) => {
    const tipoConfig = getTipoConfig(item.tipo);
    const TipoIcon = tipoConfig.icon;

    return (
      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => handleViewDetail(item)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className={`${tipoConfig.color} text-white`}>
                <TipoIcon className="h-3 w-3 mr-1" />
                {tipoConfig.label}
              </Badge>
              {item.prioridade === "urgente" && (
                <Badge variant="destructive">Urgente</Badge>
              )}
              {item.fixado && (
                <Pin className="h-4 w-4 text-orange-500" />
              )}
              {item.destaque && (
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(item);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setItemToDelete(item.id);
                  setDeleteDialogOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardTitle className="text-lg line-clamp-2">{item.titulo}</CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {item.resumo || item.conteudo.substring(0, 150)}
            {item.conteudo.length > 150 ? "..." : ""}
          </p>
        </CardContent>
        <CardFooter className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {getInitials(item.autor?.email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {item.autor?.email?.split("@")[0] || "Anônimo"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {item.visualizacoes || 0}
            </span>
            <span>
              {item.dataPublicacao
                ? formatDistanceToNow(new Date(item.dataPublicacao), {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : ""}
            </span>
          </div>
        </CardFooter>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" />
            Portal de Comunicação
          </h1>
          <p className="text-muted-foreground">
            Avisos, comunicados e informações internas da equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Comunicado
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar comunicados..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={(v) => setTipoFilter(v)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {TIPOS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredComunicados.length === 0 ? (
        <Card className="p-12 text-center">
          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum comunicado encontrado</h3>
          <p className="text-muted-foreground">
            Clique em "Novo Comunicado" para publicar o primeiro.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {fixedComunicados.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Pin className="h-5 w-5 text-orange-500" />
                Fixados
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fixedComunicados.map((item) => (
                  <ComunicadoCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          <div>
            {fixedComunicados.length > 0 && (
              <h2 className="text-lg font-semibold mb-3">Recentes</h2>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {regularComunicados.map((item) => (
                <ComunicadoCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Editar Comunicado" : "Novo Comunicado"}
            </DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para {editingItem ? "atualizar" : "publicar"} um comunicado.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="titulo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título do comunicado" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prioridade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Prioridade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORIDADES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="resumo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resumo (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Breve resumo do comunicado" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="conteudo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conteúdo</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Escreva o conteúdo do comunicado..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-6">
                <FormField
                  control={form.control}
                  name="fixado"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Fixar no topo</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destaque"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Em destaque</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingItem ? "Atualizar" : "Publicar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comunicado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O comunicado será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedDetail && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const tipoConfig = getTipoConfig(selectedDetail.tipo);
                    const TipoIcon = tipoConfig.icon;
                    return (
                      <Badge className={`${tipoConfig.color} text-white`}>
                        <TipoIcon className="h-3 w-3 mr-1" />
                        {tipoConfig.label}
                      </Badge>
                    );
                  })()}
                  {selectedDetail.prioridade === "urgente" && (
                    <Badge variant="destructive">Urgente</Badge>
                  )}
                  {selectedDetail.fixado && (
                    <Pin className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <SheetTitle className="text-xl">{selectedDetail.titulo}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedDetail.autor?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedDetail.autor?.email?.split("@")[0] || "Anônimo"}</span>
                    </div>
                    <span>•</span>
                    <span>
                      {selectedDetail.dataPublicacao
                        ? format(new Date(selectedDetail.dataPublicacao), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })
                        : ""}
                    </span>
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{selectedDetail.conteudo}</p>
                </div>

                <div className="flex items-center gap-4 py-4 border-y">
                  <Button
                    variant={selectedDetail.usuarioCurtiu ? "default" : "outline"}
                    size="sm"
                    onClick={handleLike}
                    disabled={likeMutation.isPending}
                  >
                    <Heart
                      className={`h-4 w-4 mr-2 ${
                        selectedDetail.usuarioCurtiu ? "fill-current" : ""
                      }`}
                    />
                    {selectedDetail.curtidas || 0} curtidas
                  </Button>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{selectedDetail.visualizacoes || 0} visualizações</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Comentários ({comentarios.length})
                  </h3>
                  
                  <div className="flex gap-2 mb-4">
                    <Input
                      placeholder="Escreva um comentário..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || commentMutation.isPending}
                    >
                      {commentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {comentarios.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          Nenhum comentário ainda. Seja o primeiro!
                        </p>
                      ) : (
                        comentarios.map((c) => (
                          <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(c.autor?.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {c.autor?.email?.split("@")[0] || "Anônimo"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {c.criadoEm
                                    ? formatDistanceToNow(new Date(c.criadoEm), {
                                        addSuffix: true,
                                        locale: ptBR,
                                      })
                                    : ""}
                                </span>
                              </div>
                              <p className="text-sm">{c.conteudo}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
