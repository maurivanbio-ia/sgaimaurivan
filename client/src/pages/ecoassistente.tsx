import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type AiQueryResponse =
  | { response: string }
  | { answer: string }
  | { message: string }
  | { data: { response?: string; answer?: string; message?: string } };

function extractAnswer(payload: AiQueryResponse): string {
  const anyPayload: any = payload ?? {};
  return (
    anyPayload?.response ??
    anyPayload?.answer ??
    anyPayload?.message ??
    anyPayload?.data?.response ??
    anyPayload?.data?.answer ??
    anyPayload?.data?.message ??
    ""
  );
}

async function postAiQuery(input: { unidade: string; message: string }): Promise<AiQueryResponse> {
  const res = await fetch("/api/ai/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      (json && (json.message || json.error || json.details)) ||
      `Erro HTTP ${res.status}. Falha ao processar pergunta.`;
    throw new Error(String(msg));
  }

  return (json ?? { response: "" }) as AiQueryResponse;
}

export default function EcoAssistente() {
  const { unidadeSelecionada } = useUnidade();
  const unidade = useMemo(() => String(unidadeSelecionada ?? "").trim(), [unidadeSelecionada]);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá. Sou o EcoGestor AI, seu assistente inteligente. Posso ajudar com informações sobre licenças, contratos, demandas, frota, equipamentos e muito mais. Como posso ajudar?",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const queryMutation = useMutation({
    mutationFn: async (message: string) => {
      const msg = String(message ?? "").trim();
      if (!msg) throw new Error("Digite uma pergunta.");
      if (!unidade) throw new Error("Selecione uma unidade antes de consultar o assistente.");

      return postAiQuery({ unidade, message: msg });
    },
    onSuccess: (data) => {
      const answer = extractAnswer(data).trim();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer || "Não consegui gerar uma resposta válida. Tente reformular a pergunta.",
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error: any) => {
      const msg = error?.message || "Erro ao processar pergunta";
      toast({
        title: "Erro",
        description: msg,
        variant: "destructive",
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Não consegui processar sua solicitação. ${msg}`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        timestamp: new Date(),
      },
    ]);

    setInput("");
    queryMutation.mutate(text);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sugestoes = [
    "Quais licenças vencem em 60 dias?",
    "Quantos veículos estão em manutenção?",
    "Mostre as demandas pendentes",
    "Quais equipamentos estão disponíveis?",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">EcoGestor AI</h1>
              <p className="text-white/90 text-lg mt-1">Assistente Inteligente de Gestão Ambiental</p>
              <p className="text-white/80 text-sm mt-2">
                Unidade atual. {unidade || "não selecionada"}
              </p>
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border-2">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-600" />
              Conversa
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-[500px] p-6">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={`${idx}-${msg.timestamp.getTime()}`}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    )}

                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.role === "user" ? "text-white/70" : "text-gray-500"}`}>
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {queryMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-green-600 dark:text-green-400 animate-pulse" />
                      </div>
                    </div>
                    <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {messages.length === 1 && (
              <div className="px-6 pb-4 border-t pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Sugestões.</p>
                <div className="grid grid-cols-2 gap-2">
                  {sugestoes.map((sug, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2"
                      onClick={() => {
                        setInput(sug);
                      }}
                      data-testid={`button-sugestao-${idx}`}
                    >
                      {sug}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={unidade ? "Digite sua pergunta." : "Selecione uma unidade para começar."}
                  className="flex-1"
                  disabled={queryMutation.isPending}
                  data-testid="input-chat"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || queryMutation.isPending || !unidade}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-send"
                  title={!unidade ? "Selecione uma unidade" : "Enviar"}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {!unidade && (
                <p className="text-xs text-muted-foreground mt-2">
                  Unidade não selecionada. O assistente precisa da unidade para consultar os dados corretos.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">📊 Análise de Dados</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Consulte estatísticas e métricas do sistema.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">🔍 Busca Inteligente</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Encontre informações rapidamente em linguagem natural.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">⚡ Ações Rápidas</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Execute comandos e gere relatórios automaticamente.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
