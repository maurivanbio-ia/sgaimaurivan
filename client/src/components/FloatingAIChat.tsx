import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUnidade } from "@/contexts/UnidadeContext";
import { Link } from "wouter";
import {
  Bot, Send, X, Minimize2, Maximize2, Sparkles, User,
  Loader2, FileText, ExternalLink, Building, Trash2,
  Mic, MicOff, Paperclip, CheckCircle2, XCircle,
  AlertTriangle, Bell, ChevronRight, Zap,
} from "lucide-react";

const STORAGE_KEY = "ecogestor-ai-history-v2";
const MAX_HISTORY = 30;

interface ActionResult {
  tool: string;
  success: boolean;
  result: any;
  message: string;
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

interface ProactiveAlert {
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  daysLeft?: number;
  link: string;
}

interface PendingDoc {
  name: string;
  text: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  documents?: DocumentCard[];
  suggestions?: string[];
  actions?: ActionResult[];
  isStreaming?: boolean;
}

// ── Entity marker parser ──────────────────────────────────────────────────────
function parseEntityMarkers(text: string): Array<{ type: "text" | "entity"; content: string; entity?: { kind: string; id: string; name: string } }> {
  const parts: ReturnType<typeof parseEntityMarkers> = [];
  const regex = /\[(LICENCA|DEMANDA|EMP):(\d+):([^\]]+)\]/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    parts.push({ type: "entity", content: match[0], entity: { kind: match[1], id: match[2], name: match[3] } });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", content: text.slice(lastIndex) });
  return parts;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderContent(raw: string): JSX.Element {
  const cleanEntities = (txt: string) => txt.replace(/\[(LICENCA|DEMANDA|EMP):\d+:[^\]]+\]/g, (m) => {
    const parts = m.slice(1, -1).split(":");
    return parts[2] || parts[1] || m;
  });

  const lines = raw.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  const renderInline = (txt: string): JSX.Element => {
    const clean = cleanEntities(txt);
    const parts = clean.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <>
        {parts.map((p, pi) => {
          if (p.startsWith("**") && p.endsWith("**")) return <strong key={pi} className="font-semibold">{p.slice(2, -2)}</strong>;
          if (p.startsWith("*") && p.endsWith("*")) return <em key={pi}>{p.slice(1, -1)}</em>;
          if (p.startsWith("`") && p.endsWith("`")) return <code key={pi} className="bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 px-1 rounded text-xs font-mono">{p.slice(1, -1)}</code>;
          return <span key={pi}>{p}</span>;
        })}
      </>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|/.test(lines[i + 1])) {
      const headers = line.split("|").map(h => h.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean));
        i++;
      }
      elements.push(
        <div key={key++} className="overflow-x-auto my-2">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr>{headers.map((h, hi) => <th key={hi} className="bg-violet-600 text-white px-2 py-1 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-violet-50 dark:bg-violet-900/20" : ""}>
                  {row.map((cell, ci) => <td key={ci} className="border-b border-violet-100 dark:border-violet-800 px-2 py-1">{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length || 1;
      const text = line.replace(/^#+\s/, "");
      const cls = level === 1 ? "text-base font-bold text-violet-700 dark:text-violet-300 mt-3 mb-1" : level === 2 ? "text-sm font-semibold text-violet-600 dark:text-violet-400 mt-2 mb-1" : "text-xs font-semibold text-violet-500 mt-1";
      elements.push(<p key={key++} className={cls}>{renderInline(text)}</p>);
      i++;
      continue;
    }

    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-none space-y-0.5 my-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-1.5 text-xs">
              <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-none space-y-0.5 my-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-1.5 text-xs">
              <span className="text-violet-500 font-medium flex-shrink-0 w-4">{ii + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^>/.test(line)) {
      const text = line.replace(/^>\s?/, "");
      elements.push(
        <blockquote key={key++} className="border-l-2 border-violet-400 pl-2 my-1 text-xs italic text-gray-600 dark:text-gray-400">
          {renderInline(text)}
        </blockquote>
      );
      i++;
      continue;
    }

    if (/^---/.test(line)) {
      elements.push(<hr key={key++} className="border-violet-200 dark:border-violet-800 my-2" />);
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    elements.push(<p key={key++} className="text-xs leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

// ── Sub-components ──────────────────────────────────────────────────────────
function DocCard({ doc }: { doc: DocumentCard }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-2 text-xs">
      <div className="flex items-start gap-1.5">
        <FileText className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-blue-800 dark:text-blue-200 truncate">{doc.source}</p>
          {doc.moduleLabel && <p className="text-blue-600 dark:text-blue-400">{doc.moduleLabel}</p>}
          {doc.empreendimentoNome && <p className="text-blue-500 dark:text-blue-500 truncate flex items-center gap-1"><Building className="h-2.5 w-2.5" />{doc.empreendimentoNome}</p>}
          <p className="text-blue-600/70 dark:text-blue-400/70 mt-0.5 line-clamp-2">{doc.snippet}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px] h-4">{doc.similarity}% relevante</Badge>
            {doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                <ExternalLink className="h-2.5 w-2.5" /> Abrir
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityCard({ kind, id, name }: { kind: string; name: string; id: string }) {
  const linkMap: Record<string, string> = { LICENCA: "/licencas", DEMANDA: "/demandas", EMP: "/empreendimentos" };
  const iconMap: Record<string, string> = { LICENCA: "📋", DEMANDA: "✅", EMP: "🏗️" };
  const labelMap: Record<string, string> = { LICENCA: "Licença", DEMANDA: "Demanda", EMP: "Empreendimento" };
  return (
    <Link href={`${linkMap[kind] || "/"}?id=${id}`}>
      <span className="inline-flex items-center gap-1 bg-violet-100 dark:bg-violet-900/40 border border-violet-300 dark:border-violet-600 rounded px-1.5 py-0.5 text-xs text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800 cursor-pointer transition-colors">
        <span>{iconMap[kind]}</span>
        <span className="font-medium">{labelMap[kind]}</span>
        <span className="text-violet-500">·</span>
        <span>{name}</span>
        <ChevronRight className="h-2.5 w-2.5 opacity-60" />
      </span>
    </Link>
  );
}

function ActionCard({ action }: { action: ActionResult }) {
  const toolLabels: Record<string, string> = {
    criar_demanda: "Demanda criada",
    atualizar_status_licenca: "Status atualizado",
    registrar_lancamento: "Lançamento registrado",
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg p-2 text-xs border ${action.success ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
      {action.success
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
        : <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
      <div>
        <p className={`font-semibold ${action.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
          <Zap className="h-2.5 w-2.5 inline mr-1" />
          {toolLabels[action.tool] || action.tool}
        </p>
        <p className="text-gray-600 dark:text-gray-400">{action.message}</p>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming: boolean }) {
  const isUser = msg.role === "user";

  const renderContentWithEntities = (text: string) => {
    const parts = parseEntityMarkers(text);
    if (parts.every(p => p.type === "text")) return renderContent(text);
    return (
      <div className="space-y-1">
        {parts.map((part, i) => {
          if (part.type === "entity" && part.entity) {
            return <EntityCard key={i} kind={part.entity.kind} id={part.entity.id} name={part.entity.name} />;
          }
          return part.content.trim() ? <span key={i}>{renderContent(part.content)}</span> : null;
        })}
      </div>
    );
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-end gap-2 max-w-[85%]">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl rounded-br-sm px-3 py-2 text-xs shadow-sm">
            {msg.content}
          </div>
          <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
            <User className="h-3 w-3 text-violet-600 dark:text-violet-300" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-3 w-3 text-white" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="bg-white dark:bg-gray-800 border border-violet-100 dark:border-violet-900 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
          {msg.content ? (
            <>
              {renderContentWithEntities(msg.content)}
              {isStreaming && (
                <span className="inline-block w-1.5 h-3 bg-violet-500 rounded-sm ml-0.5 animate-pulse" />
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-violet-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Pensando...</span>
            </div>
          )}
        </div>

        {msg.actions && msg.actions.length > 0 && (
          <div className="space-y-1">
            {msg.actions.map((a, i) => <ActionCard key={i} action={a} />)}
          </div>
        )}

        {msg.documents && msg.documents.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Documentos relevantes</p>
            {msg.documents.map((doc) => <DocCard key={doc.id} doc={doc} />)}
          </div>
        )}

        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.suggestions.map((s, i) => (
              <button
                key={i}
                data-suggestion={s}
                className="suggestion-chip text-[10px] bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 rounded-full px-2 py-0.5 hover:bg-violet-100 dark:hover:bg-violet-800 transition-colors cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function FloatingAIChat() {
  const { unidadeSelecionada } = useUnidade();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<PendingDoc | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const streamingMsgIdRef = useRef<string | null>(null);

  const { data: empreendimentos = [] } = useQuery<any[]>({ queryKey: ["/api/empreendimentos"] });

  // ── localStorage persistence ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: Message[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.slice(-MAX_HISTORY));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {}
  }, [messages]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ── Open via custom event ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener("open-ai-chat", handler);
    return () => document.removeEventListener("open-ai-chat", handler);
  }, []);

  // ── Unread counter ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") setUnreadCount(c => c + 1);
    }
  }, [messages.length]);

  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  // ── Proactive alerts on open ──────────────────────────────────────────────
  useEffect(() => {
    if (open && !alertsLoaded) {
      setAlertsLoaded(true);
      fetch("/api/ai/proactive-alerts", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then((data: ProactiveAlert[]) => {
          if (data.length > 0) setAlerts(data);
        })
        .catch(() => {});
    }
  }, [open, alertsLoaded]);

  // ── Suggestion chip clicks ────────────────────────────────────────────────
  useEffect(() => {
    const handleChipClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const chip = target.closest(".suggestion-chip") as HTMLElement;
      if (chip) {
        const suggestion = chip.dataset.suggestion;
        if (suggestion) {
          setInput(suggestion);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
    };
    document.addEventListener("click", handleChipClick);
    return () => document.removeEventListener("click", handleChipClick);
  }, []);

  // ── Streaming send ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isStreaming) return;

    let finalMessage = text;
    if (pendingDoc) {
      finalMessage = `[Documento anexado: "${pendingDoc.name}"]\n\n${pendingDoc.text.substring(0, 3000)}\n\n---\n${text}`;
      setPendingDoc(null);
    }

    setInput("");
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    streamingMsgIdRef.current = assistantMsgId;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: "user", content: text, timestamp: new Date().toISOString() },
      { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date().toISOString(), isStreaming: true },
    ]);
    setIsStreaming(true);

    const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: finalMessage,
          empreendimentoId: selectedEmpId !== "all" ? parseInt(selectedEmpId) : undefined,
          history,
        }),
      });

      if (!response.ok) throw new Error("Erro na conexão com o servidor");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentContent = "";
      let suggestions: string[] = [];
      let documents: DocumentCard[] = [];
      let actions: ActionResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          let eventType = "";
          let dataStr = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (eventType === "token") {
              currentContent += parsed.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: currentContent } : m
              ));
            } else if (eventType === "action") {
              actions.push(parsed);
              if (parsed.success) {
                const toolCacheMap: Record<string, string[]> = {
                  criar_demanda: ["/api/demandas", "/api/demandas/dashboard/stats"],
                  criar_empreendimento: ["/api/empreendimentos"],
                  registrar_equipamento: ["/api/equipamentos"],
                  registrar_veiculo: ["/api/frota", "/api/frota/stats"],
                  registrar_lancamento: ["/api/financeiro/lancamentos"],
                  atualizar_status_licenca: ["/api/licencas"],
                };
                const keysToInvalidate = toolCacheMap[parsed.tool] || [];
                keysToInvalidate.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
              }
            } else if (eventType === "suggestions") {
              suggestions = Array.isArray(parsed) ? parsed : [];
            } else if (eventType === "documents") {
              documents = Array.isArray(parsed) ? parsed : [];
            } else if (eventType === "done") {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, suggestions, documents, actions, isStreaming: false } : m
              ));
            } else if (eventType === "error") {
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: `Erro: ${parsed.message}`, isStreaming: false } : m
              ));
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: "Desculpe, ocorreu um erro. Tente novamente.", isStreaming: false } : m
      ));
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsStreaming(false);
      streamingMsgIdRef.current = null;
    }
  }, [input, isStreaming, messages, selectedEmpId, pendingDoc, toast]);

  // ── Voice input ───────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voz não suportada", description: "Seu navegador não suporta entrada de voz.", variant: "destructive" });
      return;
    }
    if (isRecording) { setIsRecording(false); return; }
    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsRecording(true);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  }, [isRecording, toast]);

  // ── PDF drag & drop ───────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type !== "application/pdf" && file.type !== "text/plain") {
      toast({ title: "Formato não suportado", description: "Apenas PDF e TXT são aceitos.", variant: "destructive" });
      return;
    }
    await uploadDocFile(file);
  };

  const uploadDocFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/ai/upload-doc", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) {
        let errMsg = "Falha no upload";
        try { const errData = await res.json(); errMsg = errData.message || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      setPendingDoc({ name: file.name, text: data.text });
      toast({ title: "Documento carregado!", description: `"${file.name}" pronto para análise. Faça sua pergunta!` });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    }
  };

  // ── File picker (paperclip) ───────────────────────────────────────────────
  const handleFilePick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.txt";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      await uploadDocFile(file);
    };
    input.click();
  };

  const clearHistory = () => {
    setMessages([]);
    setAlerts([]);
    setAlertsLoaded(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const panelW = maximized ? "w-[560px]" : "w-[380px]";
  const panelH = maximized ? "h-[680px]" : "h-[520px]";

  // ── Render ────────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        aria-label="Abrir EcoGestor-AI"
      >
        <Sparkles className="h-6 w-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 ${panelW} ${panelH} flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-violet-500/20 border border-violet-200 dark:border-violet-800 transition-all duration-200 overflow-hidden`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-violet-600/80 flex flex-col items-center justify-center rounded-2xl">
          <Paperclip className="h-12 w-12 text-white mb-2" />
          <p className="text-white font-semibold text-lg">Solte para analisar</p>
          <p className="text-violet-200 text-sm">PDF ou TXT</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex-shrink-0">
        <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">EcoGestor-AI</p>
          <p className="text-[10px] text-violet-200 flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${isStreaming ? "bg-yellow-300 animate-pulse" : "bg-green-400"}`} />
            {isStreaming ? "Gerando resposta..." : "Online"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearHistory} className="h-6 w-6 rounded hover:bg-white/20 flex items-center justify-center transition-colors" title="Limpar conversa">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={() => setMaximized(m => !m)} className="h-6 w-6 rounded hover:bg-white/20 flex items-center justify-center transition-colors">
            {maximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          <button onClick={() => setOpen(false)} className="h-6 w-6 rounded hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Proactive alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Bell className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex-1">Alertas do dia</span>
            <button onClick={() => setAlerts([])} className="h-4 w-4 flex items-center justify-center text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors rounded" title="Fechar alertas">
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 3).map((alert, i) => (
              <Link key={i} href={alert.link}>
                <div className={`flex items-center gap-1.5 text-[10px] cursor-pointer hover:underline ${alert.severity === "critical" ? "text-red-600 dark:text-red-400" : alert.severity === "warning" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>
                  <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="font-medium">{alert.title}:</span>
                  <span className="truncate">{alert.message}</span>
                  {alert.daysLeft !== undefined && <span className="ml-auto font-medium flex-shrink-0">{alert.daysLeft}d</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empreendimento filter */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
          <SelectTrigger className="h-7 text-xs">
            <Building className="h-3 w-3 mr-1 text-violet-500" />
            <SelectValue placeholder="Contexto..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os empreendimentos</SelectItem>
            {(empreendimentos as any[]).map((e: any) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-violet-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Olá! Sou o EcoGestor-AI</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Posso criar demandas, consultar licenças, analisar documentos e muito mais. Pergunte algo ou arraste um PDF aqui!</p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                {["Quais licenças vencem em 30 dias?", "Crie uma demanda urgente", "Resumo financeiro do mês"].map(s => (
                  <button key={s} onClick={() => sendMessage(s)} className="text-[10px] bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 rounded-full px-2.5 py-1 hover:bg-violet-100 dark:hover:bg-violet-800 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming && msg.id === streamingMsgIdRef.current} />
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Pending doc indicator */}
      {pendingDoc && (
        <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 flex items-center gap-2 flex-shrink-0">
          <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
          <span className="text-xs text-blue-700 dark:text-blue-300 truncate flex-1">"{pendingDoc.name}" pronto para análise</span>
          <button onClick={() => setPendingDoc(null)} className="h-4 w-4 text-blue-400 hover:text-blue-600 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleFilePick}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors flex-shrink-0"
            title="Anexar PDF ou TXT"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            onClick={toggleVoice}
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${isRecording ? "text-red-500 bg-red-50 dark:bg-red-900/30 animate-pulse" : "text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30"}`}
            title={isRecording ? "Parar gravação" : "Entrada por voz"}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isRecording ? "Ouvindo..." : "Pergunte ou dê uma ordem..."}
            className="flex-1 h-8 text-xs border-gray-200 dark:border-gray-700 focus:border-violet-400 focus:ring-violet-400"
            disabled={isStreaming}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            size="sm"
            className="h-8 w-8 p-0 bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 flex-shrink-0"
          >
            {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[9px] text-gray-400 text-center mt-1.5">
          Enter para enviar • Arraste PDF para analisar • Clique em 🎤 para falar
        </p>
      </div>
    </div>
  );
}
