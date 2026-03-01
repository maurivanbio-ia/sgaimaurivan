import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import {
  Bot, Send, X, Minimize2, Maximize2, Sparkles, User,
  Loader2, FileText, FolderOpen, ExternalLink, Building,
  ChevronDown, Database, Trash2,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  documents?: DocumentCard[];
}

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

function DocCard({ doc }: { doc: DocumentCard }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-2 text-xs">
      <div className="flex items-start gap-1.5">
        <FileText className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-blue-800 dark:text-blue-200 truncate">{doc.source}</p>
          {doc.moduleLabel && (
            <p className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 mt-0.5">
              <span className="truncate">{doc.moduleLabel}</span>
            </p>
          )}
          {doc.dropboxPath && (
            <p className="text-gray-500 flex items-center gap-0.5 mt-0.5">
              <FolderOpen className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{doc.dropboxPath}</span>
            </p>
          )}
          {doc.fileUrl && (
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 underline mt-0.5">
              <ExternalLink className="h-2.5 w-2.5" /> Abrir
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function inlineMd(text: string): string {
  return text
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-[10px] font-mono">$1</code>');
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const blocks: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Empty line ──────────────────────────────────────────────────────────
    if (line.trim() === "") { i++; continue; }

    // ── Table block ─────────────────────────────────────────────────────────
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      // Parse separator row (contains ---) and data rows
      const rows = tableLines.filter(l => !/^\|[\s|:-]+\|$/.test(l) || l.replace(/[\s|:-]/g, "").length === 0 ? !l.replace(/[|\s-:]/g, "") : true);
      const isSep = (l: string) => /^\|[\s|:-]+\|$/.test(l) && !l.replace(/[|\s:-]/g, "");
      const dataRows = tableLines.filter(l => !isSep(l));

      if (dataRows.length >= 1) {
        const parseRow = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
        const [header, ...body] = dataRows;
        blocks.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-gray-200 dark:border-gray-600">
            <table className="w-full text-[10px] border-collapse">
              <thead className="bg-violet-50 dark:bg-violet-900/30">
                <tr>
                  {parseRow(header).map((cell, ci) => (
                    <th key={ci} className="px-2 py-1.5 text-left font-semibold text-violet-800 dark:text-violet-300 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/60"}>
                    {parseRow(row).map((cell, ci) => (
                      <td key={ci} className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 align-top"
                        dangerouslySetInnerHTML={{ __html: inlineMd(cell) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // ── Heading ─────────────────────────────────────────────────────────────
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})\s/)?.[1].length || 1;
      const text = line.replace(/^#{1,3}\s/, "");
      const cls = level === 1
        ? "font-bold text-sm text-violet-800 dark:text-violet-300 mt-3 mb-1 pb-0.5 border-b border-violet-200 dark:border-violet-700"
        : level === 2
        ? "font-bold text-xs text-gray-800 dark:text-gray-200 mt-2 mb-1"
        : "font-semibold text-xs text-gray-700 dark:text-gray-300 mt-1.5";
      blocks.push(
        <div key={`h-${i}`} className={cls} dangerouslySetInnerHTML={{ __html: inlineMd(text) }} />
      );
      i++; continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────────────────
    if (/^---+$/.test(line.trim()) || /^===+$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} className="border-gray-200 dark:border-gray-600 my-2" />);
      i++; continue;
    }

    // ── Unordered list block ─────────────────────────────────────────────────
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, "").trim());
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-0.5 my-1 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-1.5 items-start">
              <span className="text-violet-500 mt-0.5 flex-shrink-0 text-xs">•</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Ordered list block ───────────────────────────────────────────────────
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s/, "").trim());
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="space-y-0.5 my-1 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-1.5 items-start">
              <span className="text-violet-500 font-semibold flex-shrink-0 text-xs min-w-[14px]">{ii + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────
    if (line.startsWith("> ")) {
      blocks.push(
        <div key={`bq-${i}`} className="border-l-2 border-violet-400 pl-2 my-1 text-gray-600 dark:text-gray-400 italic"
          dangerouslySetInnerHTML={{ __html: inlineMd(line.replace(/^>\s/, "")) }} />
      );
      i++; continue;
    }

    // ── Regular paragraph ────────────────────────────────────────────────────
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: inlineMd(line) || "&nbsp;" }} />
    );
    i++;
  }

  return blocks;
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: "assistant",
    content: "Olá! Sou o **EcoGestor-AI**.\n\nTenho acesso em tempo real ao banco de dados — empreendimentos, licenças, demandas, contratos, RH, financeiro e muito mais.\n\nComo posso ajudar?",
    timestamp: new Date(),
  },
];

const SUGESTOES = [
  "Liste todos os empreendimentos",
  "Quais licenças vencem em 60 dias?",
  "Mostre as demandas pendentes",
  "Qual o status da frota?",
  "Resumo financeiro",
  "Funcionários ativos no RH",
];

export default function FloatingAIChat() {
  const { unidadeSelecionada } = useUnidade();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const handler = () => { setOpen(true); setUnreadCount(0); };
    document.addEventListener("open-ai-chat", handler);
    return () => document.removeEventListener("open-ai-chat", handler);
  }, []);

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState("todos");
  const [unreadCount, setUnreadCount] = useState(0);

  const { data: empreendimentos = [] } = useQuery<any[]>({
    queryKey: ["/api/empreendimentos"],
    queryFn: () => fetch("/api/empreendimentos", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const queryMutation = useMutation({
    mutationFn: async (message: string) => {
      const empId = selectedEmpId !== "todos" ? parseInt(selectedEmpId) : undefined;
      const res = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ unidade: unidadeSelecionada, message, empreendimentoId: empId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao processar pergunta");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const msg: Message = {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        documents: data.documents || [],
      };
      setMessages(prev => [...prev, msg]);
      if (!open) setUnreadCount(c => c + 1);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setMessages(prev => prev.slice(0, -1));
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || queryMutation.isPending) return;
    setMessages(prev => [...prev, { role: "user", content: text, timestamp: new Date() }]);
    setInput("");
    queryMutation.mutate(text);
  };

  const handleOpen = () => {
    setOpen(true);
    setUnreadCount(0);
  };

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const panelWidth = maximized ? "w-[520px]" : "w-[380px]";
  const panelHeight = maximized ? "h-[680px]" : "h-[520px]";

  return (
    <>
      {/* Floating Panel */}
      {open && (
        <div
          className={`fixed bottom-24 right-4 z-50 ${panelWidth} ${panelHeight} flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300`}
          style={{ animation: "slideUp 0.2s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-none">EcoGestor-AI</p>
              <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
                <Database className="h-2.5 w-2.5" /> Dados em tempo real
              </p>
            </div>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => setMaximized(m => !m)}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Empreendimento selector */}
          <div className="px-3 py-1.5 border-b bg-gray-50 dark:bg-gray-800 flex items-center gap-2 flex-shrink-0">
            <Building className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
              <SelectTrigger className="h-7 text-xs border-dashed flex-1">
                <SelectValue placeholder="Todos os empreendimentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os empreendimentos</SelectItem>
                {empreendimentos.map((e: any) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {messages.length > 1 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500"
                onClick={() => setMessages(INITIAL_MESSAGES)} title="Limpar conversa">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-2">
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                  )}
                  <div className="max-w-[80%] space-y-1.5">
                    <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-600 text-white rounded-tr-sm"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-sm"
                    }`}>
                      <div className="space-y-0.5">
                        {msg.role === "assistant" ? renderContent(msg.content) : msg.content}
                      </div>
                      <div className={`text-[10px] mt-1 ${msg.role === "user" ? "text-white/60" : "text-gray-400"}`}>
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    {msg.documents && msg.documents.length > 0 && (
                      <div className="space-y-1">
                        {msg.documents.map(doc => <DocCard key={doc.id} doc={doc} />)}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                </div>
              ))}

              {queryMutation.isPending && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-violet-600 animate-pulse" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3 py-2">
                    <div className="flex gap-1 items-center text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Consultando banco de dados...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Suggestions (only on first message) */}
          {messages.length === 1 && !queryMutation.isPending && (
            <div className="px-3 pb-2 flex-shrink-0">
              <p className="text-[10px] text-muted-foreground mb-1.5">Sugestões:</p>
              <div className="grid grid-cols-2 gap-1">
                {SUGESTOES.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(s)}
                    className="text-left text-[10px] px-2 py-1.5 rounded-lg border border-dashed hover:bg-gray-50 dark:hover:bg-gray-800 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-1.5 border-t bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Pergunte sobre a plataforma..."
                className="flex-1 h-8 text-xs"
                disabled={queryMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || queryMutation.isPending}
                className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700 flex-shrink-0"
                size="icon"
              >
                {queryMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 hover:scale-110 active:scale-95"
        title="EcoGestor-AI"
      >
        {open ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <div className="relative">
            <Bot className="h-6 w-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  );
}
