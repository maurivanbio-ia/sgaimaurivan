import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, FileText, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: string;
  context?: any;
  title?: string;
  description?: string;
}

export function AIAssistantModal({
  isOpen,
  onClose,
  module,
  context,
  title = "Assistente de IA",
  description = "Faça uma pergunta ou solicite uma análise dos dados",
}: AIAssistantModalProps) {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async (data: { module: string; prompt: string; context?: any }) => {
      const result = await apiRequest("/api/openai/analyze", "POST", data);
      return result;
    },
    onSuccess: (data) => {
      setResponse(data.response);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao analisar",
        description: error.message || "Não foi possível processar a análise",
        variant: "destructive",
      });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { module: string; data: any }) => {
      const result = await apiRequest("/api/openai/report", "POST", data);
      return result;
    },
    onSuccess: (data) => {
      setResponse(data.report);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message || "Não foi possível gerar o relatório",
        variant: "destructive",
      });
    },
  });

  const detectInconsistenciesMutation = useMutation({
    mutationFn: async (data: { module: string; data: any }) => {
      const result = await apiRequest("/api/openai/inconsistencies", "POST", data);
      return result;
    },
    onSuccess: (data) => {
      if (data.inconsistencies && data.inconsistencies.length > 0) {
        setResponse(data.inconsistencies.join("\n\n"));
      } else {
        setResponse("✅ Nenhuma inconsistência detectada nos dados.");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao detectar inconsistências",
        description: error.message || "Não foi possível detectar inconsistências",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!prompt.trim()) {
      toast({
        title: "Atenção",
        description: "Por favor, insira uma pergunta ou solicitação",
        variant: "destructive",
      });
      return;
    }

    analyzeMutation.mutate({
      module,
      prompt,
      context,
    });
  };

  const handleGenerateReport = () => {
    if (!context) {
      toast({
        title: "Atenção",
        description: "Não há dados disponíveis para gerar relatório",
        variant: "destructive",
      });
      return;
    }

    generateReportMutation.mutate({
      module,
      data: context,
    });
  };

  const handleDetectInconsistencies = () => {
    if (!context) {
      toast({
        title: "Atenção",
        description: "Não há dados disponíveis para análise",
        variant: "destructive",
      });
      return;
    }

    detectInconsistenciesMutation.mutate({
      module,
      data: context,
    });
  };

  const isLoading = analyzeMutation.isPending || generateReportMutation.isPending || detectInconsistenciesMutation.isPending;

  const handleClose = () => {
    if (!isLoading) {
      setPrompt("");
      setResponse("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Sua pergunta ou solicitação:</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Analise o status das licenças e identifique riscos..."
              className="min-h-[100px]"
              data-testid="ai-prompt-input"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleAnalyze}
              disabled={isLoading}
              data-testid="button-ai-analyze"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              Analisar
            </Button>

            <Button
              variant="outline"
              onClick={handleGenerateReport}
              disabled={isLoading || !context}
              data-testid="button-ai-report"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <FileText className="mr-2 h-4 w-4" />
              Gerar Relatório
            </Button>

            <Button
              variant="outline"
              onClick={handleDetectInconsistencies}
              disabled={isLoading || !context}
              data-testid="button-ai-inconsistencies"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <AlertTriangle className="mr-2 h-4 w-4" />
              Detectar Inconsistências
            </Button>
          </div>

          {response && (
            <div className="mt-6">
              <label className="text-sm font-medium mb-2 block">Resposta da IA:</label>
              <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap" data-testid="ai-response">
                {response}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Processando com IA...</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} data-testid="button-close-ai">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
