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
  private isLoggedIn: boolean = false;
  private lastLoginTime: Date | null = null;
  private isProcessing: boolean = false;
  private readonly SESSION_TIMEOUT_MINUTES = 25;
  private readonly LOCK_TIMEOUT_MS = 120000;

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

  private async acquireLock(): Promise<boolean> {
    const start = Date.now();
    while (this.isProcessing) {
      if (Date.now() - start > this.LOCK_TIMEOUT_MS) {
        console.log('[SEIA] Timeout aguardando lock');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.isProcessing = true;
    return true;
  }

  private releaseLock(): void {
    this.isProcessing = false;
  }

  private async initBrowser(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[SEIA] Iniciando novo navegador...');
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
      this.isLoggedIn = false;
    }
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    return page;
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      console.log('[SEIA] Fechando navegador...');
      try {
        await this.browser.close();
      } catch (e) {
        console.error('[SEIA] Erro ao fechar navegador:', e);
      }
      this.browser = null;
      this.isLoggedIn = false;
    }
  }

  private isSessionExpired(): boolean {
    if (!this.lastLoginTime) return true;
    const now = new Date();
    const diffMinutes = (now.getTime() - this.lastLoginTime.getTime()) / 1000 / 60;
    return diffMinutes > this.SESSION_TIMEOUT_MINUTES;
  }

  async login(page: Page): Promise<{ sucesso: boolean; mensagem: string }> {
    const { username, password, portalUrl } = this.getCredentials();

    if (!username || !password) {
      return {
        sucesso: false,
        mensagem: 'Credenciais do SEIA não configuradas. Configure SEIA_USERNAME e SEIA_PASSWORD.',
      };
    }

    try {
      console.log('[SEIA] Acessando página de login...');
      await page.goto(`${portalUrl}/paginas/paginaLogin.xhtml`, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const usernameInput = await page.$('input[type="text"]');
      const passwordInput = await page.$('input[type="password"]');
      
      if (!usernameInput || !passwordInput) {
        const pageContent = await page.content();
        if (pageContent.includes('Tela Inicial') || pageContent.includes('Sair') || pageContent.includes('ecobrasil')) {
          this.isLoggedIn = true;
          this.lastLoginTime = new Date();
          return { sucesso: true, mensagem: 'Já está logado' };
        }
        return { sucesso: false, mensagem: 'Campos de login não encontrados' };
      }

      console.log('[SEIA] Preenchendo credenciais...');
      await usernameInput.click({ clickCount: 3 });
      await usernameInput.type(username, { delay: 50 });

      await passwordInput.click({ clickCount: 3 });
      await passwordInput.type(password, { delay: 50 });

      console.log('[SEIA] Clicando no botão de login...');
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button[id*="entrar"], input[value*="Entrar"]');
      
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          submitButton.click(),
        ]);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const currentUrl = page.url();
      const pageContent = await page.content();
      
      const isLoggedIn = (
        !currentUrl.includes('paginaLogin') && 
        !currentUrl.includes('login') &&
        (pageContent.includes('Sair') || pageContent.includes('ecobrasil') || pageContent.includes('Tela Inicial'))
      );
      
      if (isLoggedIn) {
        this.isLoggedIn = true;
        this.lastLoginTime = new Date();
        console.log('[SEIA] Login realizado com sucesso!');
        return { sucesso: true, mensagem: 'Login realizado com sucesso' };
      } else {
        const hasError = pageContent.includes('Usuário ou senha inválidos') || 
                        pageContent.includes('incorreto') ||
                        pageContent.includes('inválido');
        
        return {
          sucesso: false,
          mensagem: hasError ? 'Usuário ou senha inválidos' : 'Falha no login - verifique as credenciais',
        };
      }

    } catch (error: any) {
      console.error('[SEIA] Erro no login:', error.message);
      return {
        sucesso: false,
        mensagem: `Erro ao fazer login: ${error.message}`,
      };
    }
  }

  async consultarProcesso(numeroProcesso: string, uf: string = 'BA', orgao?: string): Promise<ConsultaResult> {
    const inicio = Date.now();

    if (!await this.acquireLock()) {
      return {
        sucesso: false,
        numeroProcesso,
        erro: 'Sistema ocupado, tente novamente em alguns segundos',
        tempoResposta: Date.now() - inicio,
      };
    }

    let page: Page | null = null;

    try {
      page = await this.initBrowser();

      if (!this.isLoggedIn || this.isSessionExpired()) {
        const loginResult = await this.login(page);
        if (!loginResult.sucesso) {
          return {
            sucesso: false,
            numeroProcesso,
            erro: loginResult.mensagem,
            tempoResposta: Date.now() - inicio,
          };
        }
      }

      console.log(`[SEIA] Consultando processo: ${numeroProcesso}`);

      const portalUrl = process.env.SEIA_PORTAL_URL || 'https://sistema.seia.ba.gov.br';
      
      await page.goto(`${portalUrl}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const menuProcesso = await page.$('a[href*="processo"], span[id*="processo"]');
      if (menuProcesso) {
        await menuProcesso.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const menuListar = await page.$('a[href*="listarProcesso"], a[href*="consultarProcesso"]');
      if (menuListar) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          menuListar.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const numeroLimpo = numeroProcesso.replace(/[^\d]/g, '');
      
      const inputFields = await page.$$('input[type="text"]:not([readonly])');
      let processInputFound = false;
      
      for (const input of inputFields) {
        const id = await page.evaluate(el => el.id || '', input);
        const name = await page.evaluate(el => el.name || '', input);
        const placeholder = await page.evaluate(el => el.placeholder || '', input);
        
        if (id.toLowerCase().includes('processo') || 
            id.toLowerCase().includes('numero') ||
            name.toLowerCase().includes('processo') ||
            name.toLowerCase().includes('numero') ||
            placeholder.toLowerCase().includes('processo')) {
          await input.click({ clickCount: 3 });
          await input.type(numeroLimpo, { delay: 30 });
          processInputFound = true;
          break;
        }
      }

      if (!processInputFound && inputFields.length > 0) {
        await inputFields[0].click({ clickCount: 3 });
        await inputFields[0].type(numeroLimpo, { delay: 30 });
      }

      const searchButton = await page.$('button[type="submit"], input[type="submit"], button[id*="pesquisar"], button[id*="consultar"]');
      if (searchButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          searchButton.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const resultado = await page.evaluate(() => {
        const data: Record<string, any> = {
          movimentacoes: [],
          statusAtual: null,
          interessado: null,
          empreendimento: null,
          municipio: null,
          tipoProcesso: null,
          naoEncontrado: false,
        };

        const allText = document.body.innerText || '';
        if (allText.toLowerCase().includes('nenhum registro') || 
            allText.toLowerCase().includes('não encontrado') ||
            allText.toLowerCase().includes('sem resultados')) {
          data.naoEncontrado = true;
          return data;
        }

        const statusLabels = ['Status:', 'Situação:', 'Status Atual:'];
        for (const label of statusLabels) {
          const idx = allText.indexOf(label);
          if (idx !== -1) {
            const afterLabel = allText.substring(idx + label.length, idx + label.length + 100);
            const match = afterLabel.trim().split(/[\n\r\t]/)[0].trim();
            if (match && match.length < 50) {
              data.statusAtual = match;
              break;
            }
          }
        }

        const tables = document.querySelectorAll('table');
        tables.forEach((table) => {
          const rows = table.querySelectorAll('tr');
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const firstCell = cells[0]?.textContent?.trim() || '';
              const secondCell = cells[1]?.textContent?.trim() || '';
              
              const dateMatch = firstCell.match(/^\d{2}\/\d{2}\/\d{4}/);
              if (dateMatch && secondCell) {
                data.movimentacoes.push({
                  data: firstCell,
                  descricao: secondCell,
                  responsavel: cells[2]?.textContent?.trim() || undefined,
                });
              }

              if (firstCell.toLowerCase().includes('interessado') || firstCell.toLowerCase().includes('requerente')) {
                data.interessado = secondCell;
              }
              if (firstCell.toLowerCase().includes('empreendimento')) {
                data.empreendimento = secondCell;
              }
              if (firstCell.toLowerCase().includes('município') || firstCell.toLowerCase().includes('localidade')) {
                data.municipio = secondCell;
              }
              if (firstCell.toLowerCase().includes('tipo') || firstCell.toLowerCase().includes('atividade')) {
                data.tipoProcesso = secondCell;
              }
            }
          });
        });

        const allElements = document.querySelectorAll('span, label, td, div');
        allElements.forEach((el) => {
          const text = el.textContent?.trim() || '';
          const lowerText = text.toLowerCase();
          
          if (!data.statusAtual) {
            const statusMatch = text.match(/(Aguardando Enquadramento|Sendo Enquadrado|Enquadrado|Em Validação Prévia|Validado|Boleto de pagamento liberado|Comprovante Enviado|Processo Formado)/i);
            if (statusMatch) {
              data.statusAtual = statusMatch[1];
            }
          }
        });

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
      let dataUltimaMovimentacao: Date | undefined;
      
      if (ultimaMovimentacao?.data) {
        const parts = ultimaMovimentacao.data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (parts) {
          dataUltimaMovimentacao = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
        }
      }

      return {
        sucesso: true,
        numeroProcesso,
        statusAtual: resultado.statusAtual || 'Status não identificado',
        ultimaMovimentacao: ultimaMovimentacao?.descricao,
        dataUltimaMovimentacao,
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
      
      if (error.message.includes('timeout') || error.message.includes('Target closed')) {
        await this.closeBrowser();
      }

      return {
        sucesso: false,
        numeroProcesso,
        erro: error.message || 'Erro desconhecido ao consultar processo',
        tempoResposta: Date.now() - inicio,
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore page close errors
        }
      }
      this.releaseLock();
    }
  }

  async consultarEmpreendimentoPorNome(nomeEmpreendimento: string, localidade?: string): Promise<ConsultaResult[]> {
    const inicio = Date.now();

    if (!await this.acquireLock()) {
      return [{
        sucesso: false,
        numeroProcesso: '',
        erro: 'Sistema ocupado, tente novamente em alguns segundos',
        tempoResposta: Date.now() - inicio,
      }];
    }

    let page: Page | null = null;

    try {
      page = await this.initBrowser();

      if (!this.isLoggedIn || this.isSessionExpired()) {
        const loginResult = await this.login(page);
        if (!loginResult.sucesso) {
          return [{
            sucesso: false,
            numeroProcesso: '',
            erro: loginResult.mensagem,
            tempoResposta: Date.now() - inicio,
          }];
        }
      }

      console.log(`[SEIA] Consultando empreendimento: ${nomeEmpreendimento}`);

      const portalUrl = process.env.SEIA_PORTAL_URL || 'https://sistema.seia.ba.gov.br';
      await page.goto(`${portalUrl}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const menuConsultas = await page.$('a[href*="consulta"], span[id*="consulta"]');
      if (menuConsultas) {
        await menuConsultas.click();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      const menuEmpreendimento = await page.$('a[href*="empreendimento"]');
      if (menuEmpreendimento) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          menuEmpreendimento.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const nomeInput = await page.$('input[id*="nome"], input[id*="empreendimento"], input[type="text"]:first-of-type');
      if (nomeInput) {
        await nomeInput.type(nomeEmpreendimento, { delay: 50 });
      }

      if (localidade) {
        const selectElements = await page.$$('select');
        for (const sel of selectElements) {
          const options = await sel.$$('option');
          for (const opt of options) {
            const text = await page.evaluate(el => el.textContent, opt);
            if (text && text.toLowerCase().includes(localidade.toLowerCase())) {
              const value = await page.evaluate(el => el.value, opt);
              await sel.select(value);
              break;
            }
          }
        }
      }

      const consultarBtn = await page.$('button[type="submit"], input[type="submit"], button[id*="consultar"]');
      if (consultarBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          consultarBtn.click(),
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const dados = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, table tr');
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

      const resultados: ConsultaResult[] = [];
      
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
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore page close errors
        }
      }
      this.releaseLock();
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

      const { username, password } = this.getCredentials();
      const credenciaisConfiguradas = !!(username && password);

      return {
        disponivel: response.ok,
        mensagem: response.ok 
          ? `${portal.nome} disponível${credenciaisConfiguradas ? ' (credenciais configuradas)' : ' (credenciais não configuradas)'}`
          : `${portal.nome} retornou status ${response.status}`,
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
