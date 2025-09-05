import { storage } from './storage';
import { sendEmail } from './emailService';
import { sendWhatsApp } from './whatsappService';
import { notificationService } from './notificationService';
import type { AlertConfig, AlertHistory, InsertAlertHistory } from '@shared/schema';

export class AlertService {
  // Configurações padrão de alertas
  private readonly DEFAULT_CONFIGS = [
    // Licenças
    { tipo: 'licenca', diasAviso: 90, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 60, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'licenca', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'licenca', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'licenca', diasAviso: 1, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    
    // Condicionantes
    { tipo: 'condicionante', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'condicionante', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'condicionante', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'condicionante', diasAviso: 1, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    
    // Entregas
    { tipo: 'entrega', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'entrega', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'entrega', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: true },
    { tipo: 'entrega', diasAviso: 1, ativo: true, enviarEmail: true, enviarWhatsapp: true },
  ];

  // Contatos para alertas
  private readonly EMAIL_CONTATO = 'ecobrasiloficial@gmail.com';
  private readonly WHATSAPP_CONTATO = '+5571987802223';

  // Inicializa configurações padrão de alertas
  async initializeDefaultConfigs(): Promise<void> {
    try {
      const existingConfigs = await storage.getAlertConfigs();
      
      // Se não há configurações, cria as padrão
      if (existingConfigs.length === 0) {
        for (const config of this.DEFAULT_CONFIGS) {
          await storage.createAlertConfig(config);
        }
        console.log('Configurações padrão de alertas criadas');
      }
    } catch (error) {
      console.error('Erro ao inicializar configurações de alertas:', error);
    }
  }

  // Verifica todos os prazos e envia alertas necessários
  async checkAndSendAlerts(): Promise<void> {
    try {
      console.log('Iniciando verificação de alertas...');
      
      const configs = await storage.getActiveAlertConfigs();
      
      for (const config of configs) {
        await this.processAlertsForConfig(config);
      }
      
      console.log('Verificação de alertas concluída');
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
    }
  }

  // Processa alertas para uma configuração específica
  private async processAlertsForConfig(config: AlertConfig): Promise<void> {
    try {
      let items: any[] = [];
      let getDateField: (item: any) => string;
      
      // Busca itens baseado no tipo
      switch (config.tipo) {
        case 'licenca':
          items = await storage.getLicencas();
          getDateField = (item) => item.validade;
          break;
        case 'condicionante':
          items = await storage.getCondicionantes();
          getDateField = (item) => item.prazo;
          break;
        case 'entrega':
          items = await storage.getEntregas();
          getDateField = (item) => item.prazo;
          break;
        default:
          return;
      }

      // Verifica cada item
      for (const item of items) {
        await this.checkItemForAlert(item, config, getDateField(item));
      }
    } catch (error) {
      console.error(`Erro ao processar alertas para ${config.tipo}:`, error);
    }
  }

  // Verifica se um item precisa de alerta
  private async checkItemForAlert(
    item: any, 
    config: AlertConfig, 
    dateField: string
  ): Promise<void> {
    try {
      const prazoDate = new Date(dateField);
      const hoje = new Date();
      const diasRestantes = Math.ceil((prazoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      // Verifica se está no prazo para alerta
      if (diasRestantes === config.diasAviso) {
        // Verifica se já foi enviado alerta para este item e prazo
        const jaEnviado = await storage.checkAlertHistory(
          config.tipo,
          item.id,
          config.diasAviso
        );
        
        if (!jaEnviado) {
          await this.sendAlertForItem(item, config, diasRestantes);
        }
      }
    } catch (error) {
      console.error(`Erro ao verificar item ${item.id} para alerta:`, error);
    }
  }

  // Envia alertas para um item
  private async sendAlertForItem(
    item: any, 
    config: AlertConfig, 
    diasRestantes: number
  ): Promise<void> {
    try {
      const alertData = this.buildAlertData(item, config.tipo, diasRestantes);
      
      // Criar notificação interna no sistema
      await this.createInternalNotification(item, config.tipo, diasRestantes);
      
      // Envia email se configurado
      if (config.enviarEmail) {
        try {
          await sendEmail({
            to: this.EMAIL_CONTATO,
            subject: alertData.emailSubject,
            text: alertData.emailBody,
            html: alertData.emailHtml,
          });
          
          await this.saveAlertHistory(item.id, config, 'email', 'enviado');
          console.log(`Email de alerta enviado para ${config.tipo} ID ${item.id}`);
        } catch (error) {
          await this.saveAlertHistory(item.id, config, 'email', 'erro', (error as Error).message || String(error));
          console.error(`Erro ao enviar email para ${config.tipo} ID ${item.id}:`, (error as Error).message || error);
        }
      }
      
      // Envia WhatsApp se configurado
      if (config.enviarWhatsapp) {
        try {
          await sendWhatsApp(this.WHATSAPP_CONTATO, alertData.whatsappMessage);
          
          await this.saveAlertHistory(item.id, config, 'whatsapp', 'enviado');
          console.log(`WhatsApp enviado para ${config.tipo} ID ${item.id}`);
        } catch (error) {
          await this.saveAlertHistory(item.id, config, 'whatsapp', 'erro', (error as Error).message || String(error));
          console.error(`Erro ao enviar WhatsApp para ${config.tipo} ID ${item.id}:`, (error as Error).message || error);
        }
      }
    } catch (error) {
      console.error(`Erro ao enviar alertas para item ${item.id}:`, error);
    }
  }

  // Constrói dados do alerta
  private buildAlertData(item: any, tipo: string, diasRestantes: number) {
    const tipoLabel = tipo === 'licenca' ? 'Licença' : 
                     tipo === 'condicionante' ? 'Condicionante' : 'Entrega';
    
    const titulo = tipo === 'licenca' ? `${item.tipo} - ${item.orgaoEmissor}` :
                   tipo === 'condicionante' ? item.descricao :
                   item.titulo || item.descricao;
    
    const prazoLabel = tipo === 'licenca' ? 'vencimento' : 'prazo';
    const dataField = tipo === 'licenca' ? item.validade : item.prazo;
    const dataFormatada = new Date(dataField).toLocaleDateString('pt-BR');
    
    const urgencia = diasRestantes <= 7 ? '🚨 URGENTE' : 
                     diasRestantes <= 15 ? '⚠️ ATENÇÃO' : '📋 AVISO';
    
    const emailSubject = `${urgencia} - ${tipoLabel} ${diasRestantes === 1 ? 'vence amanhã' : `vence em ${diasRestantes} dias`}`;
    
    const emailBody = `
${urgencia}

${tipoLabel}: ${titulo}
${prazoLabel.charAt(0).toUpperCase() + prazoLabel.slice(1)}: ${dataFormatada}
Dias restantes: ${diasRestantes}

Sistema LicençaFácil - EcoBrasil
    `.trim();
    
    const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #00599C, #B2CDE1); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">${urgencia}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema LicençaFácil - EcoBrasil</p>
  </div>
  
  <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
    <h2 style="color: #00599C; margin-top: 0;">${tipoLabel}</h2>
    <p style="font-size: 16px; margin: 10px 0;"><strong>${titulo}</strong></p>
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid ${diasRestantes <= 7 ? '#dc3545' : diasRestantes <= 15 ? '#ffc107' : '#6c757d'};">
      <p style="margin: 0;"><strong>${prazoLabel.charAt(0).toUpperCase() + prazoLabel.slice(1)}:</strong> ${dataFormatada}</p>
      <p style="margin: 5px 0 0 0; color: ${diasRestantes <= 7 ? '#dc3545' : diasRestantes <= 15 ? '#856404' : '#495057'};">
        <strong>Dias restantes: ${diasRestantes}</strong>
      </p>
    </div>
    
    <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
      Este é um alerta automático do sistema LicençaFácil.
    </p>
  </div>
</div>
    `.trim();
    
    const whatsappMessage = `
${urgencia}

${tipoLabel}: ${titulo}
${prazoLabel.charAt(0).toUpperCase() + prazoLabel.slice(1)}: ${dataFormatada}
Dias restantes: ${diasRestantes}

Sistema LicençaFácil - EcoBrasil
    `.trim();
    
    return {
      emailSubject,
      emailBody,
      emailHtml,
      whatsappMessage,
    };
  }

  // Cria notificação interna no sistema
  private async createInternalNotification(
    item: any,
    tipo: string,
    diasRestantes: number
  ): Promise<void> {
    try {
      const dateField = tipo === 'licenca' ? item.validade : item.prazo;
      const dataVencimento = new Date(dateField);
      
      // Buscar dados do empreendimento relacionado
      const empreendimento = item.empreendimentoId ? 
        await storage.getEmpreendimento(item.empreendimentoId) : null;
      const nomeEmpreendimento = empreendimento?.nome || 'N/A';
      
      // Buscar dados da licença se for condicionante ou entrega
      let numeroLicenca = 'N/A';
      if (tipo === 'licenca') {
        numeroLicenca = (item as any).numero || 'N/A';
      } else if (item.licencaId) {
        const licenca = await storage.getLicenca(item.licencaId);
        numeroLicenca = licenca?.numero || 'N/A';
      }
      
      switch (tipo) {
        case 'licenca':
          await notificationService.createLicenseExpiryNotification(
            item.id,
            nomeEmpreendimento,
            numeroLicenca,
            dataVencimento,
            diasRestantes
          );
          break;
        case 'condicionante':
          await notificationService.createCondicionanteExpiryNotification(
            item.id,
            item.descricao || 'Condicionante',
            nomeEmpreendimento,
            numeroLicenca,
            dataVencimento,
            diasRestantes
          );
          break;
        case 'entrega':
          await notificationService.createEntregaExpiryNotification(
            item.id,
            item.titulo || item.descricao || 'Entrega',
            nomeEmpreendimento,
            numeroLicenca,
            dataVencimento,
            diasRestantes
          );
          break;
      }
    } catch (error) {
      console.error(`Erro ao criar notificação interna para ${tipo} ID ${item.id}:`, error);
    }
  }

  // Salva histórico de alerta
  private async saveAlertHistory(
    itemId: number,
    config: AlertConfig,
    tipoNotificacao: 'email' | 'whatsapp',
    status: 'enviado' | 'erro',
    erro?: string
  ): Promise<void> {
    const alertHistory: InsertAlertHistory = {
      tipoItem: config.tipo,
      itemId,
      diasAviso: config.diasAviso,
      tipoNotificacao,
      status,
      tentativas: 1,
      ultimaTentativa: new Date(),
      erro: erro || null,
    };
    
    await storage.createAlertHistory(alertHistory);
  }
}

export const alertService = new AlertService();