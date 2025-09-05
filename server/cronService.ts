import { alertService } from './alertService';

class CronService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60 * 60 * 1000; // 1 hora em millisegundos

  // Inicia o serviço de verificação de alertas
  start(): void {
    console.log('Iniciando serviço de alertas automáticos...');
    
    // Inicializa configurações padrão
    alertService.initializeDefaultConfigs();
    
    // Executa primeira verificação após 1 minuto
    setTimeout(() => {
      this.runAlertCheck();
    }, 60 * 1000);
    
    // Configura execução a cada hora
    this.intervalId = setInterval(() => {
      this.runAlertCheck();
    }, this.CHECK_INTERVAL);
    
    console.log(`Serviço de alertas configurado para executar a cada ${this.CHECK_INTERVAL / 1000 / 60} minutos`);
  }

  // Para o serviço
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Serviço de alertas parado');
    }
  }

  // Executa verificação de alertas
  private async runAlertCheck(): void {
    try {
      console.log(`[${new Date().toLocaleString('pt-BR')}] Executando verificação de alertas...`);
      await alertService.checkAndSendAlerts();
    } catch (error) {
      console.error('Erro na verificação de alertas:', error);
    }
  }

  // Executa verificação manual (para testes)
  async runManualCheck(): Promise<void> {
    console.log('Executando verificação manual de alertas...');
    await this.runAlertCheck();
  }
}

export const cronService = new CronService();