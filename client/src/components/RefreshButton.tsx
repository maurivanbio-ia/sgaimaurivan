import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function RefreshButton({ 
  variant = "outline", 
  size = "sm", 
  className = "" 
}: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Invalida todas as queries para forçar atualização
      await queryClient.invalidateQueries();
      
      toast({
        title: "Sistema Atualizado",
        description: "Todos os dados foram atualizados com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro na Atualização",
        description: "Erro ao atualizar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000); // Delay visual para feedback
    }
  };

  return (
    <Button
      onClick={handleRefresh}
      disabled={isRefreshing}
      variant={variant}
      size={size}
      className={`${className} ${isRefreshing ? 'animate-pulse' : ''}`}
      data-testid="button-refresh-system"
    >
      <RefreshCw 
        className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} 
      />
      {isRefreshing ? 'Atualizando...' : 'Atualizar Sistema'}
    </Button>
  );
}