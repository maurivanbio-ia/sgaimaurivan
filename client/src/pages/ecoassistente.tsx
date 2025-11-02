import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function EcoAssistente() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o EcoGestor-AI, seu assistente inteligente. Posso ajudar com informações sobre licenças, contratos, demandas, frota, equipamentos e muito mais. Como posso ajudar?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const queryMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao processar pergunta');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar pergunta",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    queryMutation.mutate(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">
                EcoGestor-AI
              </h1>
              <p className="text-white/90 text-lg mt-1">
                Assistente Inteligente de Gestão Ambiental
              </p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <Card className="shadow-2xl border-2">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-green-600" />
              Conversa
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Messages */}
            <ScrollArea className="h-[500px] p-6">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                      <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {msg.role === 'user' && (
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
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Suggestions */}
            {messages.length === 1 && (
              <div className="px-6 pb-4 border-t pt-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Sugestões:</p>
                <div className="grid grid-cols-2 gap-2">
                  {sugestoes.map((sug, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2"
                      onClick={() => setInput(sug)}
                      data-testid={`button-sugestao-${idx}`}
                    >
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
                  placeholder="Digite sua pergunta..."
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
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">📊 Análise de Dados</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Consulte estatísticas e métricas do sistema
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">🔍 Busca Inteligente</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Encontre informações rapidamente em linguagem natural
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2">⚡ Ações Rápidas</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Execute comandos e gere relatórios automaticamente
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
