import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ObjectUploaderProps {
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
    filePath?: string;
  }>;
  onComplete?: (result: { uploadURL: string; filePath?: string; fileName?: string }) => void;
  buttonClassName?: string;
  children?: ReactNode;
  accept?: string;
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
  accept = ".pdf"
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
        onComplete({ uploadURL: url, filePath, fileName: file.name });
      }

      toast({
        title: "Upload realizado",
        description: "Arquivo enviado com sucesso!",
      });

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
          {isUploading ? "Enviando arquivo..." : `Apenas arquivos PDF até ${Math.round(maxFileSize / 1024 / 1024)}MB`}
        </p>
      </div>
    </div>
  );
}