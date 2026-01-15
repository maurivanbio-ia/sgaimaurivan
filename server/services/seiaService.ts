/**
 * Serviço de consulta ao portal SEIA (Sistema Estadual de Informações Ambientais)
 * Utiliza Puppeteer para automação de login e consulta de processos
 */

import puppeteer, { Browser, Page } from 'puppeteer';

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
  urlLogin?: string;
  urlConsulta?: string;
  orgao: string;
  ativo: boolean;
}

const PORTAIS_SEIA: Record<string, PortalConfig> = {
  BA: {
    nome: 'SEIA Bahia',
    sigla: 'BA',
    url: 'https://sistema.seia.ba.gov.br',
    urlLogin: 'https://sistema.seia.ba.gov.br/paginas/paginaLogin.xhtml',
    urlConsulta: 'https://sistema.seia.ba.gov.br/paginas/processo/listarProcesso.xhtml',
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
  IBAMA: {
    nome: 'IBAMA Federal',
    sigla: 'IBAMA',
    url: 'https://www.ibama.gov.br',
    urlConsulta: 'https://servicos.ibama.gov.br/ctf',
    orgao: 'IBAMA',
    ativo: true,
  },
};

const STATUS_POSSIVEIS = [
  'Aguardando Enquadramento',
  'Sendo Enquadrado',
  'Enquadrado',
  'Em Validação Prévia',
  'Validado',
  'Boleto de pagamento liberado',
  'Comprovante Enviado',
  'Processo Formado'
];

export class SeiaService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;
  private lastLoginTime: Date | null = null;
  private readonly SESSION_TIMEOUT_MINUTES = 25;

  private getCredentials() {
    return {
      username: process.env.SEIA_USERNAME || '',
      password: process.env.SEIA_PASSWORD || '',
      portalUrl: process.env.SEIA_PORTAL_URL || 'https://sistema.seia.ba.gov.br',
    };
  }

  getPortalConfig(ufOuOrgao: string): PortalConfig | null {
    return PORTAIS_SEIA[ufOuOrgao.toUpperCase()] || null;
  }

  listarPortais(): PortalConfig[] {
    return Object.values(PORTAIS_SEIA).filter(p => p.ativo);
  }

  getStatusPossiveis(): string[] {
    return STATUS_POSSIVEIS;
  }

  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      console.log('[SEIA] Iniciando navegador...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });
      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      console.log('[SEIA] Fechando navegador...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isLoggedIn = false;
    }
  }

  private isSessionExpired(): boolean {
    if (!this.lastLoginTime) return true;
    const now = new Date();
    const diffMinutes = (now.getTime() - this.lastLoginTime.getTime()) / 1000 / 60;
    return diffMinutes > this.SESSION_TIMEOUT_MINUTES;
  }

  async login(): Promise<{ sucesso: boolean; mensagem: string }> {
    const { username, password, portalUrl } = this.getCredentials();

    if (!username || !password) {
      return {
        sucesso: false,
        mensagem: 'Credenciais do SEIA não configuradas. Configure SEIA_USERNAME e SEIA_PASSWORD.',
      };
    }

    try {
      await this.initBrowser();
      
      if (!this.page) {
        throw new Error('Página não inicializada');
      }

      console.log('[SEIA] Acessando página de login...');
      await this.page.goto(`${portalUrl}/paginas/paginaLogin.xhtml`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.page.waitForSelector('input[id*="usuario"], input[name*="usuario"], input[type="text"]', {
        timeout: 15000,
      });

      console.log('[SEIA] Preenchendo credenciais...');
      
      const usernameSelector = 'input[id*="usuario"], input[name*="usuario"], input[type="text"]';
      const passwordSelector = 'input[id*="senha"], input[name*="senha"], input[type="password"]';
      
      await this.page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        if (input) input.value = '';
      }, usernameSelector);
      await this.page.type(usernameSelector, username, { delay: 50 });

      await this.page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        if (input) input.value = '';
      }, passwordSelector);
      await this.page.type(passwordSelector, password, { delay: 50 });

      console.log('[SEIA] Clicando no botão de login...');
      const loginButton = await this.page.$('button[type="submit"], input[type="submit"], button[id*="entrar"], a[id*="entrar"]');
      
      if (loginButton) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          loginButton.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const currentUrl = this.page.url();
      const isLoggedIn = !currentUrl.includes('paginaLogin') && !currentUrl.includes('login');
      
      if (isLoggedIn) {
        this.isLoggedIn = true;
        this.lastLoginTime = new Date();
        console.log('[SEIA] Login realizado com sucesso!');
        return { sucesso: true, mensagem: 'Login realizado com sucesso' };
      } else {
        const errorMessage = await this.page.evaluate(() => {
          const error = document.querySelector('.ui-messages-error, .error-message, .mensagem-erro');
          return error ? error.textContent : null;
        });
        
        return {
          sucesso: false,
          mensagem: errorMessage || 'Falha no login - verifique as credenciais',
        };
      }

    } catch (error: any) {
      console.error('[SEIA] Erro no login:', error.message);
      await this.closeBrowser();
      return {
        sucesso: false,
        mensagem: `Erro ao fazer login: ${error.message}`,
      };
    }
  }

  async consultarProcesso(numeroProcesso: string, uf: string = 'BA', orgao?: string): Promise<ConsultaResult> {
    const inicio = Date.now();

    try {
      if (!this.isLoggedIn || this.isSessionExpired()) {
        const loginResult = await this.login();
        if (!loginResult.sucesso) {
          return {
            sucesso: false,
            numeroProcesso,
            erro: loginResult.mensagem,
            tempoResposta: Date.now() - inicio,
          };
        }
      }

      if (!this.page) {
        throw new Error('Navegador não inicializado');
      }

      console.log(`[SEIA] Consultando processo: ${numeroProcesso}`);

      const portalUrl = process.env.SEIA_PORTAL_URL || 'https://sistema.seia.ba.gov.br';
      await this.page.goto(`${portalUrl}/paginas/processo/listarProcesso.xhtml`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
      
      const inputSelector = 'input[id*="processo"], input[name*="processo"], input[id*="numero"], input.ui-inputfield';
      await this.page.waitForSelector(inputSelector, { timeout: 15000 });

      await this.page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        if (input) input.value = '';
      }, inputSelector);
      await this.page.type(inputSelector, numeroLimpo, { delay: 30 });

      const searchButton = await this.page.$('button[id*="consultar"], button[id*="pesquisar"], input[type="submit"][value*="Consultar"], button[type="submit"]');
      if (searchButton) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          searchButton.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const resultado = await this.page.evaluate(() => {
        const data: Record<string, any> = {};
        
        const statusElement = document.querySelector('span[id*="status"], td:contains("Status"), .status-processo');
        if (statusElement) {
          data.statusAtual = statusElement.textContent?.trim();
        }

        const rows = document.querySelectorAll('table tr, .ui-datatable-tablewrapper tr');
        const movimentacoes: Array<{ data: string; descricao: string; responsavel?: string }> = [];
        
        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const dataCell = cells[0]?.textContent?.trim();
            const descCell = cells[1]?.textContent?.trim();
            if (dataCell && descCell) {
              movimentacoes.push({
                data: dataCell,
                descricao: descCell,
                responsavel: cells[2]?.textContent?.trim(),
              });
            }
          }
        });

        data.movimentacoes = movimentacoes;

        const interessadoEl = document.querySelector('[id*="interessado"], [id*="requerente"]');
        if (interessadoEl) {
          data.interessado = interessadoEl.textContent?.trim();
        }

        const empreendimentoEl = document.querySelector('[id*="empreendimento"]');
        if (empreendimentoEl) {
          data.empreendimento = empreendimentoEl.textContent?.trim();
        }

        const municipioEl = document.querySelector('[id*="municipio"], [id*="localidade"]');
        if (municipioEl) {
          data.municipio = municipioEl.textContent?.trim();
        }

        const tipoEl = document.querySelector('[id*="tipo"], [id*="atividade"]');
        if (tipoEl) {
          data.tipoProcesso = tipoEl.textContent?.trim();
        }

        const noResult = document.querySelector('.ui-messages-info, .no-result, .sem-resultado');
        if (noResult && noResult.textContent?.toLowerCase().includes('nenhum')) {
          data.naoEncontrado = true;
        }

        return data;
      });

      if (resultado.naoEncontrado) {
        return {
          sucesso: false,
          numeroProcesso,
          erro: 'Processo não encontrado no portal SEIA',
          tempoResposta: Date.now() - inicio,
        };
      }

      const ultimaMovimentacao = resultado.movimentacoes?.[0];

      return {
        sucesso: true,
        numeroProcesso,
        statusAtual: resultado.statusAtual || 'Status não identificado',
        ultimaMovimentacao: ultimaMovimentacao?.descricao,
        dataUltimaMovimentacao: ultimaMovimentacao?.data ? new Date(ultimaMovimentacao.data) : undefined,
        interessado: resultado.interessado,
        empreendimento: resultado.empreendimento,
        municipio: resultado.municipio,
        tipoProcesso: resultado.tipoProcesso,
        movimentacoes: resultado.movimentacoes,
        dadosCompletos: resultado,
        tempoResposta: Date.now() - inicio,
      };

    } catch (error: any) {
      console.error(`[SEIA] Erro ao consultar processo ${numeroProcesso}:`, error.message);
      
      if (error.message.includes('timeout') || error.message.includes('navegador')) {
        await this.closeBrowser();
      }

      return {
        sucesso: false,
        numeroProcesso,
        erro: error.message || 'Erro desconhecido ao consultar processo',
        tempoResposta: Date.now() - inicio,
      };
    }
  }

  async consultarEmpreendimentoPorNome(nomeEmpreendimento: string, localidade?: string): Promise<ConsultaResult[]> {
    const inicio = Date.now();
    const resultados: ConsultaResult[] = [];

    try {
      if (!this.isLoggedIn || this.isSessionExpired()) {
        const loginResult = await this.login();
        if (!loginResult.sucesso) {
          return [{
            sucesso: false,
            numeroProcesso: '',
            erro: loginResult.mensagem,
            tempoResposta: Date.now() - inicio,
          }];
        }
      }

      if (!this.page) {
        throw new Error('Navegador não inicializado');
      }

      console.log(`[SEIA] Consultando empreendimento: ${nomeEmpreendimento}`);

      const portalUrl = process.env.SEIA_PORTAL_URL || 'https://sistema.seia.ba.gov.br';
      
      await this.page.goto(`${portalUrl}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const menuConsultas = await this.page.$('a[id*="consultas"], li:contains("Consultas")');
      if (menuConsultas) {
        await menuConsultas.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const menuEmpreendimento = await this.page.$('a[id*="empreendimento"], a:contains("Empreendimento")');
      if (menuEmpreendimento) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          menuEmpreendimento.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const nomeInput = await this.page.$('input[id*="nome"], input[id*="empreendimento"]');
      if (nomeInput) {
        await nomeInput.type(nomeEmpreendimento, { delay: 50 });
      }

      if (localidade) {
        const localidadeSelect = await this.page.$('select[id*="localidade"], select[id*="municipio"]');
        if (localidadeSelect) {
          await this.page.select('select[id*="localidade"], select[id*="municipio"]', localidade);
        }
      }

      const consultarBtn = await this.page.$('button[id*="consultar"], input[value*="Consultar"]');
      if (consultarBtn) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          consultarBtn.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const dados = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .ui-datatable-data tr');
        const lista: Array<{
          nome: string;
          requerente: string;
          localidade: string;
          status?: string;
          numeroProcesso?: string;
        }> = [];

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            lista.push({
              nome: cells[0]?.textContent?.trim() || '',
              requerente: cells[1]?.textContent?.trim() || '',
              localidade: cells[2]?.textContent?.trim() || '',
              status: cells[3]?.textContent?.trim(),
              numeroProcesso: cells[4]?.textContent?.trim(),
            });
          }
        });

        return lista;
      });

      for (const item of dados) {
        resultados.push({
          sucesso: true,
          numeroProcesso: item.numeroProcesso || '',
          empreendimento: item.nome,
          interessado: item.requerente,
          municipio: item.localidade,
          statusAtual: item.status,
          tempoResposta: Date.now() - inicio,
        });
      }

      if (resultados.length === 0) {
        resultados.push({
          sucesso: false,
          numeroProcesso: '',
          erro: 'Nenhum empreendimento encontrado',
          tempoResposta: Date.now() - inicio,
        });
      }

      return resultados;

    } catch (error: any) {
      console.error(`[SEIA] Erro ao consultar empreendimento:`, error.message);
      return [{
        sucesso: false,
        numeroProcesso: '',
        erro: error.message,
        tempoResposta: Date.now() - inicio,
      }];
    }
  }

  async verificarDisponibilidade(uf: string = 'BA'): Promise<{ disponivel: boolean; mensagem: string; portal?: PortalConfig }> {
    const portal = this.getPortalConfig(uf);

    if (!portal) {
      return {
        disponivel: false,
        mensagem: `Portal não configurado para ${uf}`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(portal.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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

  formatarNumeroProcesso(numero: string, uf: string = 'BA'): string {
    const limpo = numero.replace(/[^\d]/g, '');

    if (uf === 'BA' && limpo.length >= 15) {
      return `${limpo.slice(0, 4)}.${limpo.slice(4, 11)}.${limpo.slice(11)}`;
    }

    return numero;
  }

  getUrlConsultaManual(uf: string, numeroProcesso?: string): string {
    const portal = this.getPortalConfig(uf);
    if (!portal) return '';
    return portal.urlConsulta || portal.url;
  }

  async fecharSessao(): Promise<void> {
    await this.closeBrowser();
  }
}

export const seiaService = new SeiaService();
