import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ObjectUploaderProps {
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
    filePath?: string;
  }>;
  onComplete?: (result: { uploadURL: string; filePath?: string }) => void;
  buttonClassName?: string;
  children?: ReactNode;
  accept?: string;
  enableAnalysis?: boolean;
  onAnalysisComplete?: (analysis: any) => void;
}

/**
 * A file upload component that handles direct file uploads to object storage.
 * 
 * Features:
 * - Direct upload to presigned URLs
 * - File validation and size limits
 * - Upload progress indication
 * - Error handling and user feedback
 * 
 * @param props - Component props
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL)
 * @param props.onComplete - Callback function called when upload is complete
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 * @param props.accept - File types to accept (default: ".pdf")
 */
export function ObjectUploader({
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  accept = ".pdf",
  enableAnalysis = false,
  onAnalysisComplete
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    if (file.size > maxFileSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O arquivo deve ter no máximo ${Math.round(maxFileSize / 1024 / 1024)}MB`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Get upload URL
      const uploadParams = await onGetUploadParameters();
      const { method, url, filePath } = uploadParams;

      // Upload file
      const response = await fetch(url, {
        method,
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      // Call completion callback
      if (onComplete) {
        onComplete({ uploadURL: url, filePath });
      }

      toast({
        title: "Upload realizado",
        description: "Arquivo enviado com sucesso!",
      });

      // If analysis is enabled and we have a filePath, analyze the PDF
      if (enableAnalysis && filePath && accept.includes('.pdf')) {
        try {
          toast({
            title: "Analisando PDF...",
            description: "Extraindo informações do documento automaticamente.",
          });

          const analysisResponse = await apiRequest("POST", "/api/analyze-pdf", { filePath });
          const analysis = await analysisResponse.json();

          if (analysis && onAnalysisComplete) {
            onAnalysisComplete(analysis);
            
            toast({
              title: "Análise concluída!",
              description: `Informações extraídas com ${Math.round(analysis.confidence * 100)}% de confiança.`,
            });
          }
        } catch (analysisError) {
          console.error("Analysis error:", analysisError);
          toast({
            title: "Análise falhou",
            description: "Não foi possível extrair informações do PDF automaticamente.",
            variant: "destructive",
          });
        }
      }

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Falha ao enviar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md hover:border-primary/50 transition-colors">
      <div className="space-y-1 text-center">
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <div className="flex text-sm text-muted-foreground">
          <label className="relative cursor-pointer bg-background rounded-md font-medium text-primary hover:text-primary/80">
            <span>{children || "Faça upload do arquivo"}</span>
            <input 
              type="file" 
              accept={accept} 
              className="sr-only"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              data-testid="input-file"
            />
          </label>
          <p className="pl-1">ou arraste e solte</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {isUploading ? (
            enableAnalysis ? "Enviando e analisando arquivo..." : "Enviando arquivo..."
          ) : (
            <>
              Apenas arquivos PDF até {Math.round(maxFileSize / 1024 / 1024)}MB
              {enableAnalysis && (
                <span className="flex items-center justify-center mt-1 text-blue-600">
                  <Brain className="h-3 w-3 mr-1" />
                  Análise automática ativada
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
}