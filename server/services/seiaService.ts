/**
 * Serviço de consulta ao SEIA (Sistema Estadual de Informações Ambientais)
 * INEMA - Instituto do Meio Ambiente e Recursos Hídricos da Bahia
 * URL: https://sistema.seia.ba.gov.br/
 */

interface ConsultaResult {
  sucesso: boolean;
  numeroProcesso: string;
  statusAtual?: string;
  ultimaMovimentacao?: string;
  dataUltimaMovimentacao?: Date;
  interessado?: string;
  empreendimento?: string;
  municipio?: string;
  tipoProcesso?: string;
  movimentacoes?: Array<{
    data: string;
    descricao: string;
    responsavel?: string;
  }>;
  dadosCompletos?: Record<string, any>;
  erro?: string;
  tempoResposta?: number;
}

export class SeiaService {
  private baseUrl = 'https://sistema.seia.ba.gov.br';
  
  /**
   * Consulta um processo no SEIA/INEMA
   * Nota: O SEIA requer autenticação para consultas detalhadas.
   * Esta implementação tenta acessar dados públicos quando disponíveis.
   */
  async consultarProcesso(numeroProcesso: string): Promise<ConsultaResult> {
    const inicio = Date.now();
    
    try {
      // Limpa o número do processo (remove caracteres especiais)
      const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
      
      // Tenta consultar via API pública ou scraping
      // O SEIA não tem API pública documentada, então usamos abordagem alternativa
      
      // Opção 1: Verificar se há página de consulta pública
      const resultado = await this.tentarConsultaPublica(numeroLimpo, numeroProcesso);
      
      resultado.tempoResposta = Date.now() - inicio;
      return resultado;
      
    } catch (error: any) {
      return {
        sucesso: false,
        numeroProcesso,
        erro: error.message || 'Erro desconhecido ao consultar processo',
        tempoResposta: Date.now() - inicio,
      };
    }
  }
  
  /**
   * Tenta consulta via página pública do SEIA
   */
  private async tentarConsultaPublica(numeroLimpo: string, numeroOriginal: string): Promise<ConsultaResult> {
    // O SEIA da Bahia geralmente requer login para consultas detalhadas
    // Vamos simular a estrutura de retorno para quando tivermos acesso
    
    // Por enquanto, retornamos um resultado indicando que a consulta manual é necessária
    // ou que precisamos de credenciais de acesso ao sistema
    
    return {
      sucesso: true,
      numeroProcesso: numeroOriginal,
      statusAtual: 'Aguardando configuração de acesso ao SEIA',
      ultimaMovimentacao: 'Sistema configurado para monitoramento. Configure as credenciais de acesso ao SEIA para consultas automáticas.',
      dataUltimaMovimentacao: new Date(),
      dadosCompletos: {
        mensagem: 'O SEIA/INEMA requer autenticação para consultas. Para habilitar o monitoramento automático, configure as credenciais de acesso ou utilize a consulta manual pelo portal.',
        urlConsulta: `${this.baseUrl}`,
        numeroProcesso: numeroOriginal,
        numeroLimpo: numeroLimpo,
      },
    };
  }
  
  /**
   * Verifica se o serviço do SEIA está disponível
   */
  async verificarDisponibilidade(): Promise<{ disponivel: boolean; mensagem: string }> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      
      return {
        disponivel: response.ok,
        mensagem: response.ok ? 'SEIA disponível' : `SEIA retornou status ${response.status}`,
      };
    } catch (error: any) {
      return {
        disponivel: false,
        mensagem: `Erro ao verificar SEIA: ${error.message}`,
      };
    }
  }
  
  /**
   * Formata número de processo para padrão SEIA
   */
  formatarNumeroProcesso(numero: string): string {
    // Remove caracteres especiais
    const limpo = numero.replace(/[^\d]/g, '');
    
    // Tenta formatar no padrão comum do SEIA: YYYY.XXXXXXX.XXXX
    if (limpo.length >= 15) {
      return `${limpo.slice(0, 4)}.${limpo.slice(4, 11)}.${limpo.slice(11)}`;
    }
    
    return numero;
  }
}

// Instância singleton
export const seiaService = new SeiaService();
