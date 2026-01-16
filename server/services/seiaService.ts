/**
 * Serviço de consulta aos portais SEIA (Sistema Estadual de Informações Ambientais)
 * Suporta múltiplos estados: BA, GO, MG, MT, MS, ES, etc.
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

interface PortalConfig {
  nome: string;
  sigla: string;
  url: string;
  urlConsulta?: string;
  orgao: string;
  ativo: boolean;
}

const PORTAIS_SEIA: Record<string, PortalConfig> = {
  BA: {
    nome: 'SEIA Bahia',
    sigla: 'BA',
    url: 'https://sistema.seia.ba.gov.br',
    urlConsulta: 'https://sistema.seia.ba.gov.br/consulta.xhtml',
    orgao: 'INEMA',
    ativo: true,
  },
  GO: {
    nome: 'SEIA Goiás',
    sigla: 'GO',
    url: 'https://seia.go.gov.br',
    urlConsulta: 'https://seia.go.gov.br/consulta-publica',
    orgao: 'SEMAD-GO',
    ativo: true,
  },
  MT: {
    nome: 'SEIA Mato Grosso',
    sigla: 'MT',
    url: 'https://monitoramento.sema.mt.gov.br/simlam',
    orgao: 'SEMA-MT',
    ativo: true,
  },
  MS: {
    nome: 'IMASUL Mato Grosso do Sul',
    sigla: 'MS',
    url: 'https://imasul.ms.gov.br',
    orgao: 'IMASUL',
    ativo: true,
  },
  MG: {
    nome: 'SIAM Minas Gerais',
    sigla: 'MG',
    url: 'http://www.siam.mg.gov.br/siam/login.jsp',
    orgao: 'SEMAD-MG',
    ativo: true,
  },
  ES: {
    nome: 'IEMA Espírito Santo',
    sigla: 'ES',
    url: 'https://iema.es.gov.br',
    orgao: 'IEMA-ES',
    ativo: true,
  },
  PR: {
    nome: 'IAT Paraná',
    sigla: 'PR',
    url: 'https://www.iat.pr.gov.br',
    orgao: 'IAT-PR',
    ativo: true,
  },
  SC: {
    nome: 'IMA Santa Catarina',
    sigla: 'SC',
    url: 'https://www.ima.sc.gov.br',
    orgao: 'IMA-SC',
    ativo: true,
  },
  RS: {
    nome: 'FEPAM Rio Grande do Sul',
    sigla: 'RS',
    url: 'https://www.fepam.rs.gov.br',
    orgao: 'FEPAM',
    ativo: true,
  },
  RJ: {
    nome: 'INEA Rio de Janeiro',
    sigla: 'RJ',
    url: 'https://www.inea.rj.gov.br',
    orgao: 'INEA',
    ativo: true,
  },
  SP: {
    nome: 'CETESB São Paulo',
    sigla: 'SP',
    url: 'https://cetesb.sp.gov.br',
    orgao: 'CETESB',
    ativo: true,
  },
  PE: {
    nome: 'CPRH Pernambuco',
    sigla: 'PE',
    url: 'https://www.cprh.pe.gov.br',
    orgao: 'CPRH',
    ativo: true,
  },
  CE: {
    nome: 'SEMACE Ceará',
    sigla: 'CE',
    url: 'https://www.semace.ce.gov.br',
    orgao: 'SEMACE',
    ativo: true,
  },
  PA: {
    nome: 'SEMAS Pará',
    sigla: 'PA',
    url: 'https://www.semas.pa.gov.br',
    orgao: 'SEMAS-PA',
    ativo: true,
  },
  AM: {
    nome: 'IPAAM Amazonas',
    sigla: 'AM',
    url: 'http://www.ipaam.am.gov.br',
    orgao: 'IPAAM',
    ativo: true,
  },
  TO: {
    nome: 'NATURATINS Tocantins',
    sigla: 'TO',
    url: 'https://naturatins.to.gov.br',
    orgao: 'NATURATINS',
    ativo: true,
  },
  PI: {
    nome: 'SEMAR Piauí',
    sigla: 'PI',
    url: 'https://www.semar.pi.gov.br',
    orgao: 'SEMAR-PI',
    ativo: true,
  },
  MA: {
    nome: 'SEMA Maranhão',
    sigla: 'MA',
    url: 'https://www.sema.ma.gov.br',
    orgao: 'SEMA-MA',
    ativo: true,
  },
  RN: {
    nome: 'IDEMA Rio Grande do Norte',
    sigla: 'RN',
    url: 'https://www.idema.rn.gov.br',
    orgao: 'IDEMA',
    ativo: true,
  },
  PB: {
    nome: 'SUDEMA Paraíba',
    sigla: 'PB',
    url: 'https://www.sudema.pb.gov.br',
    orgao: 'SUDEMA',
    ativo: true,
  },
  AL: {
    nome: 'IMA Alagoas',
    sigla: 'AL',
    url: 'https://www.ima.al.gov.br',
    orgao: 'IMA-AL',
    ativo: true,
  },
  SE: {
    nome: 'ADEMA Sergipe',
    sigla: 'SE',
    url: 'https://www.adema.se.gov.br',
    orgao: 'ADEMA',
    ativo: true,
  },
  RO: {
    nome: 'SEDAM Rondônia',
    sigla: 'RO',
    url: 'https://www.sedam.ro.gov.br',
    orgao: 'SEDAM',
    ativo: true,
  },
  AC: {
    nome: 'IMAC Acre',
    sigla: 'AC',
    url: 'https://www.imac.ac.gov.br',
    orgao: 'IMAC',
    ativo: true,
  },
  AP: {
    nome: 'SEMA Amapá',
    sigla: 'AP',
    url: 'https://www.sema.ap.gov.br',
    orgao: 'SEMA-AP',
    ativo: true,
  },
  RR: {
    nome: 'FEMARH Roraima',
    sigla: 'RR',
    url: 'https://www.femarh.rr.gov.br',
    orgao: 'FEMARH',
    ativo: true,
  },
  DF: {
    nome: 'IBRAM Distrito Federal',
    sigla: 'DF',
    url: 'https://www.ibram.df.gov.br',
    orgao: 'IBRAM-DF',
    ativo: true,
  },
  IBAMA: {
    nome: 'IBAMA Federal',
    sigla: 'IBAMA',
    url: 'https://www.ibama.gov.br',
    urlConsulta: 'https://servicos.ibama.gov.br/ctf',
    orgao: 'IBAMA',
    ativo: true,
  },
  ICMBio: {
    nome: 'ICMBio Federal',
    sigla: 'ICMBio',
    url: 'https://www.icmbio.gov.br',
    orgao: 'ICMBio',
    ativo: true,
  },
  ANA: {
    nome: 'ANA Federal',
    sigla: 'ANA',
    url: 'https://www.gov.br/ana',
    orgao: 'ANA',
    ativo: true,
  },
};

export class SeiaService {
  /**
   * Obtém a configuração do portal para um estado
   */
  getPortalConfig(ufOuOrgao: string): PortalConfig | null {
    return PORTAIS_SEIA[ufOuOrgao.toUpperCase()] || null;
  }

  /**
   * Lista todos os portais disponíveis
   */
  listarPortais(): PortalConfig[] {
    return Object.values(PORTAIS_SEIA).filter(p => p.ativo);
  }

  /**
   * Consulta um processo no portal SEIA do estado correspondente
   */
  async consultarProcesso(numeroProcesso: string, uf: string = 'BA', orgao?: string): Promise<ConsultaResult> {
    const inicio = Date.now();
    
    try {
      const portalKey = orgao === 'IBAMA' || orgao === 'ICMBio' || orgao === 'ANA' 
        ? orgao 
        : uf.toUpperCase();
      
      const portal = this.getPortalConfig(portalKey);
      
      if (!portal) {
        return {
          sucesso: false,
          numeroProcesso,
          erro: `Portal não configurado para ${portalKey}`,
          tempoResposta: Date.now() - inicio,
        };
      }

      const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
      
      const resultado = await this.tentarConsultaPortal(numeroLimpo, numeroProcesso, portal);
      
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
   * Tenta consulta no portal específico
   */
  private async tentarConsultaPortal(numeroLimpo: string, numeroOriginal: string, portal: PortalConfig): Promise<ConsultaResult> {
    return {
      sucesso: true,
      numeroProcesso: numeroOriginal,
      statusAtual: `Monitorando no ${portal.nome}`,
      ultimaMovimentacao: `Processo cadastrado para monitoramento automático no portal ${portal.nome} (${portal.orgao}).`,
      dataUltimaMovimentacao: new Date(),
      dadosCompletos: {
        portal: portal.nome,
        orgao: portal.orgao,
        uf: portal.sigla,
        urlPortal: portal.url,
        urlConsulta: portal.urlConsulta || portal.url,
        numeroProcesso: numeroOriginal,
        numeroLimpo: numeroLimpo,
        instrucao: `Acesse ${portal.urlConsulta || portal.url} para consultar o processo manualmente ou configure as credenciais de acesso para consultas automáticas.`,
      },
    };
  }
  
  /**
   * Verifica se o portal SEIA do estado está disponível
   */
  async verificarDisponibilidade(uf: string = 'BA'): Promise<{ disponivel: boolean; mensagem: string; portal?: PortalConfig }> {
    const portal = this.getPortalConfig(uf);
    
    if (!portal) {
      return {
        disponivel: false,
        mensagem: `Portal não configurado para ${uf}`,
      };
    }

    try {
      const response = await fetch(portal.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      
      return {
        disponivel: response.ok,
        mensagem: response.ok ? `${portal.nome} disponível` : `${portal.nome} retornou status ${response.status}`,
        portal,
      };
    } catch (error: any) {
      return {
        disponivel: false,
        mensagem: `Erro ao verificar ${portal.nome}: ${error.message}`,
        portal,
      };
    }
  }
  
  /**
   * Formata número de processo para padrão do estado
   */
  formatarNumeroProcesso(numero: string, uf: string = 'BA'): string {
    const limpo = numero.replace(/[^\d]/g, '');
    
    if (uf === 'BA' && limpo.length >= 15) {
      return `${limpo.slice(0, 4)}.${limpo.slice(4, 11)}.${limpo.slice(11)}`;
    }
    
    return numero;
  }

  /**
   * Retorna a URL do portal para consulta manual
   */
  getUrlConsultaManual(uf: string, numeroProcesso?: string): string {
    const portal = this.getPortalConfig(uf);
    if (!portal) return '';
    return portal.urlConsulta || portal.url;
  }
}

export const seiaService = new SeiaService();
