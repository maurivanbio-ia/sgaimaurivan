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
  Calendar,
  Tag,
  BarChart3,
  FileText,
  Clock,
  Users,
  CheckCircle,
  Vote,
  Smile,
  MapPin,
  Copy,
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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
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
  dataPublicacao: z.string().optional(),
  dataExpiracao: z.string().optional(),
  leituraObrigatoria: z.boolean().optional().default(false),
  tags: z.string().optional(),
  categoriaId: z.number().optional(),
  enquetePergunta: z.string().optional(),
  enqueteOpcoes: z.array(z.string()).optional(),
});

type ComunicadoForm = z.infer<typeof comunicadoSchema>;

type Categoria = {
  id: number;
  nome: string;
  cor: string;
};

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
  dataExpiracao?: string;
  leituraObrigatoria?: boolean;
  tags?: string;
  categoriaId?: number;
  categoria?: Categoria;
  autor?: {
    id: number;
    email: string;
  };
  curtidas?: number;
  usuarioCurtiu?: boolean;
  enquete?: Enquete;
  reacoes?: Record<string, number>;
  reacaoUsuario?: string;
  leituras?: { usuarioId: number; email: string; leuEm: string }[];
  totalLeituras?: number;
};

type Enquete = {
  id: number;
  pergunta: string;
  opcoes: EnqueteOpcao[];
  votouEm?: number;
  totalVotos: number;
};

type EnqueteOpcao = {
  id: number;
  texto: string;
  votos: number;
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

type Evento = {
  id: number;
  titulo: string;
  descricao?: string;
  data: string;
  local?: string;
  comunicadoId?: number;
};

type Template = {
  id: number;
  nome: string;
  titulo: string;
  conteudo: string;
  tipo: string;
  resumo?: string;
  tags?: string;
};

type EngajamentoStats = {
  totalVisualizacoes: number;
  totalReacoes: number;
  totalComentarios: number;
  totalComunicados: number;
  comunicadosMaisVistos: { id: number; titulo: string; visualizacoes: number }[];
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

const REACTIONS = [
  { emoji: "👍", key: "like" },
  { emoji: "❤️", key: "love" },
  { emoji: "😂", key: "laugh" },
  { emoji: "😮", key: "wow" },
  { emoji: "😢", key: "sad" },
  { emoji: "🎉", key: "celebrate" },
];

function getTipoConfig(tipo: string) {
  return TIPOS.find((t) => t.value === tipo) || TIPOS[0];
}

function getInitials(email?: string) {
  if (!email) return "?";
  return email.substring(0, 2).toUpperCase();
}

function EnqueteComponent({ 
  enquete, 
  comunicadoId, 
  onVote 
}: { 
  enquete: Enquete; 
  comunicadoId: number;
  onVote: () => void;
}) {
  const { toast } = useToast();
  const voteMutation = useMutation({
    mutationFn: async (opcaoId: number) => 
      apiRequest("POST", `/api/comunicados/${comunicadoId}/enquete/votar`, { opcaoId }),
    onSuccess: () => {
      onVote();
      toast({ title: "Voto registrado!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao votar", variant: "destructive" });
    },
  });

  const jaVotou = enquete.votouEm !== undefined && enquete.votouEm !== null;

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <Vote className="h-5 w-5 text-primary" />
        <h4 className="font-semibold">{enquete.pergunta}</h4>
      </div>
      <div className="space-y-2">
        {enquete.opcoes.map((opcao) => {
          const percentage = enquete.totalVotos > 0 ? (opcao.votos / enquete.totalVotos) * 100 : 0;
          const isSelected = enquete.votouEm === opcao.id;
          
          return (
            <div key={opcao.id} className="space-y-1">
              {jaVotou ? (
                <div className="flex items-center justify-between text-sm">
                  <span className={isSelected ? "font-medium" : ""}>{opcao.texto}</span>
                  <span className="text-muted-foreground">{opcao.votos} votos ({percentage.toFixed(0)}%)</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => voteMutation.mutate(opcao.id)}
                  disabled={voteMutation.isPending}
                >
                  {opcao.texto}
                </Button>
              )}
              {jaVotou && (
                <Progress value={percentage} className="h-2" />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Total de votos: {enquete.totalVotos}
      </p>
    </div>
  );
}

function ReactionsComponent({
  comunicadoId,
  reacoes,
  reacaoUsuario,
  onReact,
}: {
  comunicadoId: number;
  reacoes: Record<string, number>;
  reacaoUsuario?: string;
  onReact: () => void;
}) {
  const { toast } = useToast();
  const reactMutation = useMutation({
    mutationFn: async (tipoReacao: string) =>
      apiRequest("POST", `/api/comunicados/${comunicadoId}/reagir`, { tipoReacao }),
    onSuccess: () => {
      onReact();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao reagir", variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTIONS.map((r) => {
        const count = reacoes?.[r.key] || 0;
        const isSelected = reacaoUsuario === r.key;
        return (
          <Button
            key={r.key}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="h-8 px-2"
            onClick={() => reactMutation.mutate(r.key)}
            disabled={reactMutation.isPending}
          >
            <span className="mr-1">{r.emoji}</span>
            {count > 0 && <span className="text-xs">{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}

function MandatoryReadingBadge({
  comunicado,
  onConfirmRead,
}: {
  comunicado: Comunicado;
  onConfirmRead: () => void;
}) {
  const { toast } = useToast();
  const [showReaders, setShowReaders] = useState(false);
  
  const confirmMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/comunicados/${comunicado.id}/confirmar-leitura`),
    onSuccess: () => {
      onConfirmRead();
      toast({ title: "Leitura confirmada!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao confirmar", variant: "destructive" });
    },
  });

  const userHasRead = comunicado.leituras?.some(l => l.usuarioId === comunicado.autor?.id) ?? false;

  if (!comunicado.leituraObrigatoria) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Leitura Obrigatória
        </Badge>
        {comunicado.totalLeituras !== undefined && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => setShowReaders(!showReaders)}
          >
            <Users className="h-3 w-3 mr-1" />
            {comunicado.totalLeituras} leram
          </Button>
        )}
      </div>
      
      {!userHasRead && (
        <Button
          size="sm"
          onClick={() => confirmMutation.mutate()}
          disabled={confirmMutation.isPending}
        >
          {confirmMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Confirmar Leitura
        </Button>
      )}
      
      {showReaders && comunicado.leituras && comunicado.leituras.length > 0 && (
        <div className="border rounded-lg p-3 mt-2 bg-muted/30">
          <h5 className="text-sm font-medium mb-2">Quem leu:</h5>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {comunicado.leituras.map((l, idx) => (
              <div key={idx} className="text-sm flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>{l.email}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(l.leuEm), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarioTab() {
  const { toast } = useToast();
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ titulo: "", descricao: "", data: "", local: "" });

  const { data: eventos = [], isLoading } = useQuery<Evento[]>({
    queryKey: ["/api/comunicado-eventos"],
    queryFn: async () => {
      const res = await fetch("/api/comunicado-eventos");
      if (!res.ok) throw new Error("Erro ao buscar eventos");
      return res.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: typeof eventForm) =>
      apiRequest("POST", "/api/comunicado-eventos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicado-eventos"] });
      toast({ title: "Evento criado!" });
      setIsEventDialogOpen(false);
      setEventForm({ titulo: "", descricao: "", data: "", local: "" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar evento", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Próximos Eventos
        </h3>
        <Button onClick={() => setIsEventDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : eventos.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum evento agendado</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {eventos.map((evento) => (
            <Card key={evento.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{evento.titulo}</h4>
                  {evento.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{evento.descricao}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(evento.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {evento.local && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {evento.local}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={eventForm.titulo}
                onChange={(e) => setEventForm({ ...eventForm, titulo: e.target.value })}
                placeholder="Título do evento"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data e Hora</label>
              <Input
                type="datetime-local"
                value={eventForm.data}
                onChange={(e) => setEventForm({ ...eventForm, data: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Local</label>
              <Input
                value={eventForm.local}
                onChange={(e) => setEventForm({ ...eventForm, local: e.target.value })}
                placeholder="Local do evento"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={eventForm.descricao}
                onChange={(e) => setEventForm({ ...eventForm, descricao: e.target.value })}
                placeholder="Descrição do evento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createEventMutation.mutate(eventForm)}
              disabled={!eventForm.titulo || !eventForm.data || createEventMutation.isPending}
            >
              {createEventMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricasTab() {
  const [periodo, setPeriodo] = useState("30");

  const { data: stats, isLoading } = useQuery<EngajamentoStats>({
    queryKey: ["/api/comunicados/engajamento/stats", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/comunicados/engajamento/stats?dias=${periodo}`);
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Métricas de Engajamento
        </h3>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Visualizações</p>
                  <p className="text-2xl font-bold">{stats.totalVisualizacoes}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-100 text-pink-600">
                  <Smile className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reações</p>
                  <p className="text-2xl font-bold">{stats.totalReacoes}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comentários</p>
                  <p className="text-2xl font-bold">{stats.totalComentarios}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Comunicados</p>
                  <p className="text-2xl font-bold">{stats.totalComunicados}</p>
                </div>
              </div>
            </Card>
          </div>

          {stats.comunicadosMaisVistos && stats.comunicadosMaisVistos.length > 0 && (
            <Card className="p-4">
              <h4 className="font-semibold mb-4">Comunicados Mais Vistos</h4>
              <div className="space-y-3">
                {stats.comunicadosMaisVistos.map((c, idx) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono text-sm">#{idx + 1}</span>
                      <span className="text-sm">{c.titulo}</span>
                    </div>
                    <Badge variant="secondary">{c.visualizacoes} views</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma métrica disponível</p>
        </Card>
      )}
    </div>
  );
}

function TemplatesTab({ onUseTemplate }: { onUseTemplate: (template: Template) => void }) {
  const { toast } = useToast();
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ nome: "", titulo: "", conteudo: "", tipo: "comunicado", resumo: "", tags: "" });

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/comunicado-templates"],
    queryFn: async () => {
      const res = await fetch("/api/comunicado-templates");
      if (!res.ok) throw new Error("Erro ao buscar templates");
      return res.json();
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateForm) =>
      apiRequest("POST", "/api/comunicado-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicado-templates"] });
      toast({ title: "Template criado!" });
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao criar template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof templateForm }) =>
      apiRequest("PUT", `/api/comunicado-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicado-templates"] });
      toast({ title: "Template atualizado!" });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      resetTemplateForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/comunicado-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicado-templates"] });
      toast({ title: "Template removido!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message ?? "Falha ao excluir", variant: "destructive" });
    },
  });

  const resetTemplateForm = () => {
    setTemplateForm({ nome: "", titulo: "", conteudo: "", tipo: "comunicado", resumo: "", tags: "" });
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setTemplateForm({
      nome: template.nome,
      titulo: template.titulo,
      conteudo: template.conteudo,
      tipo: template.tipo,
      resumo: template.resumo || "",
      tags: template.tags || "",
    });
    setIsTemplateDialogOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    resetTemplateForm();
    setIsTemplateDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Templates de Comunicado
        </h3>
        <Button onClick={handleNewTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum template cadastrado</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge variant="outline">{getTipoConfig(template.tipo).label}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTemplate(template)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <h4 className="font-semibold mb-1">{template.nome}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{template.titulo}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onUseTemplate(template)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Usar Template
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Template</label>
              <Input
                value={templateForm.nome}
                onChange={(e) => setTemplateForm({ ...templateForm, nome: e.target.value })}
                placeholder="Ex: Aviso de Reunião"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select 
                  value={templateForm.tipo} 
                  onValueChange={(v) => setTemplateForm({ ...templateForm, tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tags</label>
                <Input
                  value={templateForm.tags}
                  onChange={(e) => setTemplateForm({ ...templateForm, tags: e.target.value })}
                  placeholder="tag1, tag2"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={templateForm.titulo}
                onChange={(e) => setTemplateForm({ ...templateForm, titulo: e.target.value })}
                placeholder="Título do comunicado"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Resumo</label>
              <Input
                value={templateForm.resumo}
                onChange={(e) => setTemplateForm({ ...templateForm, resumo: e.target.value })}
                placeholder="Breve resumo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo</label>
              <Textarea
                value={templateForm.conteudo}
                onChange={(e) => setTemplateForm({ ...templateForm, conteudo: e.target.value })}
                placeholder="Conteúdo do comunicado"
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingTemplate) {
                  updateTemplateMutation.mutate({ id: editingTemplate.id, data: templateForm });
                } else {
                  createTemplateMutation.mutate(templateForm);
                }
              }}
              disabled={!templateForm.nome || !templateForm.titulo || createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTemplate ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ComunicacaoPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Comunicado | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [selectedComunicado, setSelectedComunicado] = useState<Comunicado | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [mainTab, setMainTab] = useState("feed");
  const [enqueteEnabled, setEnqueteEnabled] = useState(false);
  const [enqueteOpcoes, setEnqueteOpcoes] = useState<string[]>(["", ""]);

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ["/api/comunicado-categorias"],
    queryFn: async () => {
      const res = await fetch("/api/comunicado-categorias");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: comunicados = [], isLoading } = useQuery<Comunicado[]>({
    queryKey: ["/api/comunicados", tipoFilter, categoriaFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tipoFilter !== "all") params.set("tipo", tipoFilter);
      if (categoriaFilter !== "all") params.set("categoriaId", categoriaFilter);
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
      dataPublicacao: "",
      dataExpiracao: "",
      leituraObrigatoria: false,
      tags: "",
      categoriaId: undefined,
      enquetePergunta: "",
      enqueteOpcoes: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ComunicadoForm) => {
      const payload = { ...data };
      if (enqueteEnabled && data.enquetePergunta) {
        payload.enqueteOpcoes = enqueteOpcoes.filter(o => o.trim());
      }
      return apiRequest("POST", "/api/comunicados", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comunicados"] });
      toast({ title: "Sucesso", description: "Comunicado publicado!" });
      setIsFormDialogOpen(false);
      form.reset();
      setEnqueteEnabled(false);
      setEnqueteOpcoes(["", ""]);
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
    setEnqueteEnabled(false);
    setEnqueteOpcoes(["", ""]);
    form.reset({
      titulo: "",
      conteudo: "",
      resumo: "",
      tipo: "comunicado",
      prioridade: "normal",
      fixado: false,
      destaque: false,
      status: "publicado",
      dataPublicacao: "",
      dataExpiracao: "",
      leituraObrigatoria: false,
      tags: "",
      categoriaId: undefined,
      enquetePergunta: "",
      enqueteOpcoes: [],
    });
    setIsFormDialogOpen(true);
  };

  const handleEdit = (item: Comunicado) => {
    setEditingItem(item);
    setEnqueteEnabled(!!item.enquete);
    form.reset({
      titulo: item.titulo,
      conteudo: item.conteudo,
      resumo: item.resumo || "",
      tipo: item.tipo,
      prioridade: item.prioridade,
      fixado: item.fixado || false,
      destaque: item.destaque || false,
      status: item.status,
      dataPublicacao: item.dataPublicacao ? item.dataPublicacao.split("T")[0] : "",
      dataExpiracao: item.dataExpiracao ? item.dataExpiracao.split("T")[0] : "",
      leituraObrigatoria: item.leituraObrigatoria || false,
      tags: item.tags || "",
      categoriaId: item.categoriaId,
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

  const handleUseTemplate = (template: Template) => {
    setEditingItem(null);
    setEnqueteEnabled(false);
    setEnqueteOpcoes(["", ""]);
    form.reset({
      titulo: template.titulo,
      conteudo: template.conteudo,
      resumo: template.resumo || "",
      tipo: template.tipo,
      prioridade: "normal",
      fixado: false,
      destaque: false,
      status: "publicado",
      tags: template.tags || "",
    });
    setMainTab("feed");
    setIsFormDialogOpen(true);
    toast({ title: "Template carregado", description: "Preencha os campos e publique." });
  };

  const addEnqueteOpcao = () => {
    setEnqueteOpcoes([...enqueteOpcoes, ""]);
  };

  const removeEnqueteOpcao = (index: number) => {
    if (enqueteOpcoes.length > 2) {
      setEnqueteOpcoes(enqueteOpcoes.filter((_, i) => i !== index));
    }
  };

  const updateEnqueteOpcao = (index: number, value: string) => {
    const updated = [...enqueteOpcoes];
    updated[index] = value;
    setEnqueteOpcoes(updated);
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
            <div className="flex items-center gap-2 flex-wrap">
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
              {item.leituraObrigatoria && (
                <Badge variant="outline" className="text-red-600 border-red-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Obrigatória
                </Badge>
              )}
              {item.categoria && (
                <Badge 
                  variant="secondary" 
                  style={{ backgroundColor: item.categoria.cor + "20", color: item.categoria.cor }}
                >
                  {item.categoria.nome}
                </Badge>
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
          {item.tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.split(",").map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  <Tag className="h-2 w-2 mr-1" />
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          )}
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

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="feed" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="calendario" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="metricas" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-6">
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
            {categorias.length > 0 && (
              <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }} />
                        {cat.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
        </TabsContent>

        <TabsContent value="calendario">
          <CalendarioTab />
        </TabsContent>

        <TabsContent value="metricas">
          <MetricasTab />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab onUseTemplate={handleUseTemplate} />
        </TabsContent>
      </Tabs>

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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="grid grid-cols-2 gap-4">
                {categorias.length > 0 && (
                  <FormField
                    control={form.control}
                    name="categoriaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select 
                          onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)} 
                          value={field.value?.toString() || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categorias.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }} />
                                  {cat.nome}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input placeholder="tag1, tag2, tag3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataPublicacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Publicação (agendamento)</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dataExpiracao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Expiração</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
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

              <div className="flex items-center gap-6 flex-wrap">
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

                <FormField
                  control={form.control}
                  name="leituraObrigatoria"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">Leitura Obrigatória</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {!editingItem && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={enqueteEnabled} 
                      onCheckedChange={(v) => setEnqueteEnabled(!!v)} 
                    />
                    <label className="font-medium cursor-pointer flex items-center gap-2">
                      <Vote className="h-4 w-4" />
                      Adicionar Enquete
                    </label>
                  </div>
                  
                  {enqueteEnabled && (
                    <div className="space-y-3 ml-6">
                      <FormField
                        control={form.control}
                        name="enquetePergunta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pergunta da Enquete</FormLabel>
                            <FormControl>
                              <Input placeholder="Qual sua opinião sobre...?" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Opções</label>
                        {enqueteOpcoes.map((opcao, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={opcao}
                              onChange={(e) => updateEnqueteOpcao(idx, e.target.value)}
                              placeholder={`Opção ${idx + 1}`}
                            />
                            {enqueteOpcoes.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEnqueteOpcao(idx)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={addEnqueteOpcao}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar Opção
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                  {selectedDetail.categoria && (
                    <Badge 
                      variant="secondary"
                      style={{ backgroundColor: selectedDetail.categoria.cor + "20", color: selectedDetail.categoria.cor }}
                    >
                      {selectedDetail.categoria.nome}
                    </Badge>
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
                {selectedDetail.leituraObrigatoria && (
                  <MandatoryReadingBadge 
                    comunicado={selectedDetail} 
                    onConfirmRead={refetchDetail}
                  />
                )}

                {selectedDetail.tags && (
                  <div className="flex flex-wrap gap-1">
                    {selectedDetail.tags.split(",").map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <Tag className="h-2 w-2 mr-1" />
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">{selectedDetail.conteudo}</p>
                </div>

                {selectedDetail.enquete && (
                  <EnqueteComponent
                    enquete={selectedDetail.enquete}
                    comunicadoId={selectedDetail.id}
                    onVote={refetchDetail}
                  />
                )}

                <div className="py-4 border-y space-y-4">
                  <ReactionsComponent
                    comunicadoId={selectedDetail.id}
                    reacoes={selectedDetail.reacoes || {}}
                    reacaoUsuario={selectedDetail.reacaoUsuario}
                    onReact={refetchDetail}
                  />

                  <div className="flex items-center gap-4">
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
