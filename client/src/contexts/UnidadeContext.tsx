import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth, User } from '@/lib/auth';

export type Unidade = 'goiania' | 'salvador' | 'luiz-eduardo-magalhaes';

interface UnidadeContextType {
  unidadeSelecionada: Unidade | null;
  setUnidade: (unidade: Unidade) => void;
  limparUnidade: () => void;
  getNomeUnidade: () => string;
  isLoading: boolean;
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<Unidade | null>(null);

  useEffect(() => {
    const typedUser = user as User | null | undefined;
    if (typedUser?.unidade) {
      setUnidadeSelecionada(typedUser.unidade as Unidade);
    } else if (!authLoading && !typedUser) {
      setUnidadeSelecionada(null);
    }
  }, [user, authLoading]);

  const setUnidade = (unidade: Unidade) => {
    setUnidadeSelecionada(unidade);
  };

  const limparUnidade = () => {
    setUnidadeSelecionada(null);
  };

  const getNomeUnidade = (): string => {
    switch (unidadeSelecionada) {
      case 'goiania':
        return 'ECOBRASIL Goiânia';
      case 'salvador':
        return 'ECOBRASIL Salvador';
      case 'luiz-eduardo-magalhaes':
        return 'ECOBRASIL Luiz Eduardo Magalhães';
      default:
        return 'Todas as Unidades';
    }
  };

  return (
    <UnidadeContext.Provider value={{ unidadeSelecionada, setUnidade, limparUnidade, getNomeUnidade, isLoading: authLoading }}>
      {children}
    </UnidadeContext.Provider>
  );
}

export function useUnidade() {
  const context = useContext(UnidadeContext);
  if (context === undefined) {
    throw new Error('useUnidade deve ser usado dentro de UnidadeProvider');
  }
  return context;
}
