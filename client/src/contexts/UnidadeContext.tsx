import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Unidade = 'goiania' | 'salvador' | 'luiz-eduardo-magalhaes';

interface UnidadeContextType {
  unidadeSelecionada: Unidade | null;
  setUnidade: (unidade: Unidade) => void;
  limparUnidade: () => void;
  getNomeUnidade: () => string;
}

const UnidadeContext = createContext<UnidadeContextType | undefined>(undefined);

export function UnidadeProvider({ children }: { children: ReactNode }) {
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<Unidade | null>(() => {
    const stored = localStorage.getItem('unidade_ecobrasil');
    return stored as Unidade | null;
  });

  useEffect(() => {
    if (unidadeSelecionada) {
      localStorage.setItem('unidade_ecobrasil', unidadeSelecionada);
    } else {
      localStorage.removeItem('unidade_ecobrasil');
    }
  }, [unidadeSelecionada]);

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
    <UnidadeContext.Provider value={{ unidadeSelecionada, setUnidade, limparUnidade, getNomeUnidade }}>
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
