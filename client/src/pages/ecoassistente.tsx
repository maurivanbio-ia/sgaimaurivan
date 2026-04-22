import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Bot, User, Sparkles, FileText, FolderOpen, ExternalLink,
  Upload, Loader2, Trash2, Database, Search, X, Info, Building, ChevronDown
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface DocumentCard {
  id: number;
  source: string;
  sourceType: string;
  module: string | null;
  moduleLabel: string | null;
  fileUrl: string | null;
  dropboxPath: string | null;
  empreendimentoNome: string | null;
  similarity: number;
  snippet: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  documents?: DocumentCard[];
}

const MODULE_ICON_MAP: Record<string, string> = {
  licenca: '📄', relatorio: '📊', contrato: '📋', mapa: '🗺️', amostra: '🧪',
  monitoramento: '📡', rh: '👥', financeiro: '💰', proposta: '📬', ata: '📝',
  parecer: '⚖️', autorizacao: '✅', plano: '📆', evidencia: '🔎', documento: '📁',
};

function DocumentCardView({ doc }: { doc: DocumentCard }) {
  const icon = MODULE_ICON_MAP[doc.module || ''] || '📄';
  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-2">
        <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate max-w-[200px]" title={doc.source}>{doc.source}</span>
            {doc.moduleLabel && <Badge variant="outline" className="text-xs">{doc.moduleLabel}</Badge>}
            <Badge variant="secondary" className="text-xs">{doc.similarity}% relevante</Badge>
          </div>
          {doc.empreendimentoNome && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />{doc.empreendimentoNome}
            </p>
          )}
          {doc.dropboxPath && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 font-mono">
              <FolderOpen className="h-3 w-3 text-blue-500" />
              <span className="truncate" title={doc.dropboxPath}>{doc.dropboxPath}</span>
            </p>
          )}
          {doc.snippet && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.snippet}</p>
          )}
          {doc.fileUrl && (
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              <ExternalLink className="h-3 w-3" /> Abrir documento
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EcoAssistente() {
  const { unidadeSelecionada } = useUnidade();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o **EcoGestor-AI**, seu assistente com acesso completo à plataforma.\n\nTenho acesso em **tempo real** a:\n- 🏗️ **Todos os empreendimentos** cadastrados\n- 📄 **Licenças e condicionantes** com prazos\n- 📋 **Demandas e contratos** ativos\n- 💰 **Lançamentos financeiros**\n- 👥 **RH, frota, equipamentos, amostras** e muito mais\n\nPode me perguntar qualquer coisa sobre os dados da plataforma. Como posso ajudar?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState<string>('todos');
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: empreendimentos = [] } = useQuery<any[]>({
    queryKey: ['/api/empreendimentos'],
    queryFn: () => fetch('/api/empreendimentos', { credentials: 'include' }).then(r => r.json()),
  });

  const { data: indexedDocs = [], refetch: refetchDocs } = useQuery<any[]>({
    queryKey: ['/api/ai/documents'],
    queryFn: () => fetch('/api/ai/documents', { credentials: 'include' }).then(r => r.json()),
    enabled: showDocsModal,
  });

  const queryMutation = useMutation({
    mutationFn: async (message: string) => {
      const empId = selectedEmpreendimentoId !== 'todos' ? parseInt(selectedEmpreendimentoId) : undefined;
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ unidade: unidadeSelecionada, message, empreendimentoId: empId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao processar pergunta');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        documents: data.documents || [],
      }]);
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message || "Erro ao processar pergunta", variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/ai/documents/${id}`, { method: 'DELETE', credentials: 'include' }),
    onSuccess: () => refetchDocs(),
  });

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    queryMutation.mutate(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sugestoes = [
    "Liste todos os empreendimentos cadastrados",
    "Quais licenças vencem nos próximos 60 dias?",
    "Mostre as demandas pendentes",
    "Quais funcionários estão ativos no RH?",
    "Qual o status da frota de veículos?",
    "Mostre os contratos ativos",
    "Quais equipamentos estão disponíveis?",
    "Mostre o resumo financeiro do mês",
  ];

  function renderMessageContent(content: string) {
    return content.split('\n').map((line, i) => {
      let rendered = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs">$1</code>');
      if (line.startsWith('- ')) rendered = `<span class="flex gap-1 items-start"><span class="mt-1">•</span><span>${rendered.substring(2)}</span></span>`;
      if (line.startsWith('# ')) rendered = `<h3 class="font-bold text-base">${rendered.substring(2)}</h3>`;
      return <div key={i} dangerouslySetInnerHTML={{ __html: rendered || '&nbsp;' }} />;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 md:p-8 text-white shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 md:p-4 bg-white/20 rounded-xl backdrop-blur-sm">
                <Sparkles className="h-8 w-8 md:h-10 md:w-10" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-bold">EcoGestor-AI</h1>
                <p className="text-white/90 text-sm md:text-lg mt-0.5">Assistente com acesso completo à plataforma · Dados em tempo real</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20 gap-2"
                onClick={() => setShowDocsModal(true)}>
                <Database className="h-4 w-4" />
                <span className="hidden md:inline">Documentos</span>
              </Button>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20 gap-2"
                onClick={() => setShowIndexModal(true)}>
                <Upload className="h-4 w-4" />
                <span className="hidden md:inline">Indexar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <Card className="shadow-2xl border-2">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b py-3">
            <CardTitle className="flex items-center gap-2 text-base flex-wrap">
              <Bot className="h-5 w-5 text-green-600" />
              Conversa
              <div className="ml-auto flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedEmpreendimentoId} onValueChange={setSelectedEmpreendimentoId}>
                  <SelectTrigger className="h-7 text-xs w-48 border-dashed">
                    <SelectValue placeholder="Todos os empreendimentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os empreendimentos</SelectItem>
                    {empreendimentos.map((e: any) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                  <Database className="h-3 w-3 mr-1" />Banco em Tempo Real
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] p-4 md:p-6">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    )}
                    <div className="max-w-[78%] space-y-2">
                      <div className={`rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      }`}>
                        <div className="text-sm space-y-0.5">
                          {msg.role === 'assistant'
                            ? renderMessageContent(msg.content)
                            : msg.content
                          }
                        </div>
                        <div className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                          {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Document Cards */}
                      {msg.documents && msg.documents.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground flex items-center gap-1 pl-1">
                            <FileText className="h-3 w-3" />
                            {msg.documents.length} documento(s) encontrado(s):
                          </p>
                          {msg.documents.map((doc) => (
                            <DocumentCardView key={doc.id} doc={doc} />
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {queryMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-green-600 dark:text-green-400 animate-pulse" />
                      </div>
                    </div>
                    <div className="max-w-[78%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800">
                      <div className="flex gap-1 items-center text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Consultando banco de dados e processando...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Suggestions */}
            {messages.length === 1 && (
              <div className="px-4 md:px-6 pb-4 border-t pt-4">
                <p className="text-xs text-gray-500 mb-2">Sugestões de perguntas:</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {sugestoes.map((sug, idx) => (
                    <Button key={idx} variant="outline" size="sm"
                      className="text-left justify-start h-auto py-2 text-xs"
                      onClick={() => { setInput(sug); }}>
                      {sug}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Pergunte sobre documentos, licenças, contratos..."
                  className="flex-1"
                  disabled={queryMutation.isPending}
                  data-testid="input-chat"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || queryMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-send"
                >
                  {queryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Database className="h-4 w-4 text-green-600" />Dados em Tempo Real</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                O agente consulta diretamente o banco de dados a cada pergunta — empreendimentos, licenças, contratos, RH, financeiro e mais. Sem indexação manual.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Building className="h-4 w-4 text-blue-600" />Filtro por Empreendimento</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Selecione um empreendimento específico no topo da conversa para focar as respostas naquele projeto, ou deixe em "Todos" para uma visão geral.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" />Documentos Indexados</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Arquivos enviados para a plataforma continuam indexados e aparecem como cartões clicáveis na conversa, complementando os dados do banco.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Indexed Documents Modal */}
      <Dialog open={showDocsModal} onOpenChange={setShowDocsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />Base de Documentos RAG
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {indexedDocs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Nenhum documento indexado ainda.</p>
                <p className="text-xs mt-1">Os documentos são indexados automaticamente ao serem enviados para a plataforma.</p>
              </div>
            ) : (
              indexedDocs.map((doc: any) => {
                const meta = doc.metadata as any || {};
                return (
                  <div key={doc.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.source}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{doc.sourceType}</Badge>
                        {meta.moduleLabel && <Badge variant="secondary" className="text-xs">{meta.moduleLabel}</Badge>}
                        {meta.empreendimentoNome && <span className="text-xs text-muted-foreground">{meta.empreendimentoNome}</span>}
                      </div>
                      {meta.dropboxPath && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{meta.dropboxPath}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Indexado em: {new Date(doc.criadoEm).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive flex-shrink-0"
                      onClick={() => deleteDocMutation.mutate(doc.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Index Modal */}
      <ManualIndexModal open={showIndexModal} onOpenChange={setShowIndexModal} unidade={unidadeSelecionada} onSuccess={() => { setShowIndexModal(false); refetchDocs(); }} />
    </div>
  );
}

function ManualIndexModal({ open, onOpenChange, unidade, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidade: string;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ content: '', source: '', sourceType: 'manual', module: 'documento', empreendimentoId: '' });
  const { toast } = useToast();

  const indexMutation = useMutation({
    mutationFn: (data: any) => fetch('/api/ai/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Documento indexado!", description: "O documento já pode ser encontrado pelo EcoGestor-AI." });
      setForm({ content: '', source: '', sourceType: 'manual', module: 'documento', empreendimentoId: '' });
      onSuccess();
    },
    onError: () => toast({ title: "Erro", description: "Falha ao indexar documento.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />Indexar Documento Manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>Documentos enviados pela plataforma são indexados automaticamente. Use este formulário para indexar textos ou informações adicionais.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome / Título *</label>
            <Input value={form.source} onChange={(e) => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Ex: Relatório de Impacto Ambiental - Projeto X" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Módulo</label>
              <select className="w-full border rounded-md p-2 text-sm bg-background"
                value={form.module} onChange={(e) => setForm(f => ({ ...f, module: e.target.value }))}>
                {[['documento','Documento'],['licenca','Licença'],['relatorio','Relatório'],['contrato','Contrato'],['ata','Ata de Reunião'],['parecer','Parecer Técnico'],['proposta','Proposta Comercial'],['financeiro','Financeiro'],['base_conhecimento','Base de Conhecimento']].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">ID do Empreendimento</label>
              <Input type="number" value={form.empreendimentoId} onChange={(e) => setForm(f => ({ ...f, empreendimentoId: e.target.value }))} placeholder="(opcional)" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Conteúdo *</label>
            <Textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Cole aqui o texto do documento, resumo, ou informações relevantes para busca..."
              rows={5} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={!form.source || !form.content || indexMutation.isPending}
              onClick={() => indexMutation.mutate({ ...form, unidade, empreendimentoId: form.empreendimentoId ? parseInt(form.empreendimentoId) : undefined, metadata: { module: form.module } })}>
              {indexMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Indexando...</> : 'Indexar Documento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
