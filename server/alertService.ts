import { storage } from './storage';
import { sendEmail } from './emailService';
import { sendWhatsApp } from './whatsappService';
import { notificationService } from './notificationService';
import type { AlertConfig, AlertHistory, InsertAlertHistory } from '@shared/schema';

export class AlertService {
  // Configurações padrão de alertas (apenas email)
  private readonly DEFAULT_CONFIGS = [
    // Licenças
    { tipo: 'licenca', diasAviso: 90, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 60, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'licenca', diasAviso: 1, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    
    // Condicionantes
    { tipo: 'condicionante', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'condicionante', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'condicionante', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'condicionante', diasAviso: 1, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    
    // Entregas
    { tipo: 'entrega', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'entrega', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'entrega', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'entrega', diasAviso: 1, ativo: true, enviarEmail: true, enviarWhatsapp: false },
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
      const alertData = await this.buildAlertData(item, config.tipo, diasRestantes);
      
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
      
      // WhatsApp desabilitado
    } catch (error) {
      console.error(`Erro ao enviar alertas para item ${item.id}:`, error);
    }
  }

  // Constrói dados do alerta com informações detalhadas
  private async buildAlertData(item: any, tipo: string, diasRestantes: number) {
    const tipoLabel = tipo === 'licenca' ? 'Licença' : 
                     tipo === 'condicionante' ? 'Condicionante' : 'Entrega';
    
    const titulo = tipo === 'licenca' ? `${item.tipo} - ${item.orgaoEmissor}` :
                   tipo === 'condicionante' ? item.descricao :
                   item.titulo || item.descricao;
    
    const prazoLabel = tipo === 'licenca' ? 'vencimento' : 'prazo';
    const dataField = tipo === 'licenca' ? item.validade : item.prazo;
    const dataFormatada = new Date(dataField).toLocaleDateString('pt-BR');

    // Buscar informações do empreendimento
    let empreendimento = null;
    if (item.empreendimentoId) {
      try {
        empreendimento = await storage.getEmpreendimento(item.empreendimentoId);
      } catch (error) {
        console.error('Erro ao buscar empreendimento:', error);
      }
    } else if (tipo === 'condicionante' || tipo === 'entrega') {
      // Buscar através da licença
      try {
        if (item.licencaId) {
          const licenca = await storage.getLicenca(item.licencaId);
          if (licenca?.empreendimentoId) {
            empreendimento = await storage.getEmpreendimento(licenca.empreendimentoId);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar empreendimento via licença:', error);
      }
    }
    
    const urgencia = diasRestantes <= 7 ? '🚨 URGENTE' : 
                     diasRestantes <= 15 ? '⚠️ ATENÇÃO' : '📋 AVISO';
    
    const nomeEmpreendimento = empreendimento?.nome || 'Não informado';
    const clienteEmpreendimento = empreendimento?.cliente || 'Não informado';
    const localizacaoEmpreendimento = empreendimento?.localizacao || 'Não informada';
    
    const emailSubject = `${urgencia} - ${tipoLabel} ${diasRestantes === 1 ? 'vence amanhã' : `vence em ${diasRestantes} dias`} - ${nomeEmpreendimento}`;
    
    const emailBody = `
${urgencia}

EMPREENDIMENTO: ${nomeEmpreendimento}
Cliente: ${clienteEmpreendimento}
Localização: ${localizacaoEmpreendimento}

${tipoLabel.toUpperCase()}: ${titulo}
${prazoLabel.charAt(0).toUpperCase() + prazoLabel.slice(1)}: ${dataFormatada}
Dias restantes: ${diasRestantes}

${tipo === 'licenca' ? `Número: ${item.numero || 'N/A'}\nÓrgão Emissor: ${item.orgaoEmissor || 'N/A'}` : ''}

Sistema LicençaFácil - EcoBrasil
Contato: ecobrasiloficial@gmail.com | WhatsApp: (71) 98780-2223
    `.trim();
    
    const emailHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #00599C, #B2CDE1); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">${urgencia}</h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema LicençaFácil - EcoBrasil</p>
  </div>
  
  <div style="background: white; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
    <!-- Informações do Empreendimento -->
    <div style="background: #e8f4f8; padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #00599C;">
      <h3 style="margin: 0 0 10px 0; color: #00599C; font-size: 18px;">🏢 Empreendimento</h3>
      <p style="margin: 5px 0; font-size: 16px;"><strong>${nomeEmpreendimento}</strong></p>
      <p style="margin: 2px 0; color: #555; font-size: 14px;"><strong>Cliente:</strong> ${clienteEmpreendimento}</p>
      <p style="margin: 2px 0; color: #555; font-size: 14px;"><strong>Localização:</strong> ${localizacaoEmpreendimento}</p>
    </div>

    <!-- Informações da Licença/Condicionante/Entrega -->
    <h2 style="color: #00599C; margin: 0 0 10px 0;">${tipoLabel}</h2>
    <p style="font-size: 16px; margin: 10px 0; font-weight: 600;">${titulo}</p>
    
    ${tipo === 'licenca' ? `
    <div style="margin: 10px 0;">
      <p style="margin: 2px 0; color: #555; font-size: 14px;"><strong>Número:</strong> ${item.numero || 'N/A'}</p>
      <p style="margin: 2px 0; color: #555; font-size: 14px;"><strong>Órgão Emissor:</strong> ${item.orgaoEmissor || 'N/A'}</p>
    </div>
    ` : ''}
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid ${diasRestantes <= 7 ? '#dc3545' : diasRestantes <= 15 ? '#ffc107' : '#6c757d'};">
      <p style="margin: 0;"><strong>${prazoLabel.charAt(0).toUpperCase() + prazoLabel.slice(1)}:</strong> ${dataFormatada}</p>
      <p style="margin: 5px 0 0 0; color: ${diasRestantes <= 7 ? '#dc3545' : diasRestantes <= 15 ? '#856404' : '#495057'}; font-size: 18px;">
        <strong>⏰ Dias restantes: ${diasRestantes}</strong>
      </p>
    </div>
    
    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 14px; color: #6c757d;">
        Este é um alerta automático do sistema LicençaFácil.<br>
        <strong>Contato EcoBrasil:</strong><br>
        📧 Email: ecobrasiloficial@gmail.com<br>
        📱 WhatsApp: (71) 98780-2223
      </p>
    </div>
  </div>
</div>
    `.trim();
    
    const whatsappMessage = `
${urgencia}

🏢 EMPREENDIMENTO: ${nomeEmpreendimento}
👤 Cliente: ${clienteEmpreendimento}
📍 Local: ${localizacaoEmpreendimento}

${tipoLabel.toUpperCase()}: ${titulo}
${prazoLabel.charAt(0).toUpperCase() + prazoLabel.slice(1)}: ${dataFormatada}
⏰ Dias restantes: ${diasRestantes}

Sistema LicençaFácil - EcoBrasil
📧 ecobrasiloficial@gmail.com
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
      let tipoLicenca = 'N/A';
      if (tipo === 'licenca') {
        tipoLicenca = item.tipo || 'N/A';
      } else if (item.licencaId) {
        const licenca = await storage.getLicenca(item.licencaId);
        tipoLicenca = licenca?.tipo || 'N/A';
      }
      
      switch (tipo) {
        case 'licenca':
          await notificationService.createLicenseExpiryNotification(
            item.id,
            nomeEmpreendimento,
            tipoLicenca,
            dataVencimento,
            diasRestantes
          );
          break;
        case 'condicionante':
          await notificationService.createCondicionanteExpiryNotification(
            item.id,
            item.descricao || 'Condicionante',
            nomeEmpreendimento,
            tipoLicenca,
            dataVencimento,
            diasRestantes
          );
          break;
        case 'entrega':
          await notificationService.createEntregaExpiryNotification(
            item.id,
            item.titulo || item.descricao || 'Entrega',
            nomeEmpreendimento,
            tipoLicenca,
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

  // Função de teste de alertas
  async testAlerts(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🧪 Executando teste de alertas...');

      // Criar uma licença de teste que vence em 30 dias
      const dataVencimento = new Date();
      dataVencimento.setDate(dataVencimento.getDate() + 30);

      const licencaTeste = {
        id: 999999,
        tipo: 'Licença de Teste',
        numero: 'TEST-2025-001',
        orgaoEmissor: 'Órgão de Teste',
        validade: dataVencimento.toISOString(),
        empreendimentoId: null
      };

      // Simular o envio do alerta
      const alertData = await this.buildAlertData(licencaTeste, 'licenca', 30);
      
      let emailStatus = '';
      
      // Tentar enviar email de teste
      try {
        await sendEmail({
          to: this.EMAIL_CONTATO,
          subject: `[TESTE] ${alertData.emailSubject}`,
          text: `[TESTE DO SISTEMA]\n\n${alertData.emailBody}`,
          html: alertData.emailHtml.replace('<h1 style', '<h1 style="background: #ff9800; color: white;">🧪 TESTE DO SISTEMA</h1><h2 style'),
        });
        emailStatus = '✅ Email: Enviado com sucesso';
      } catch (emailError) {
        console.error('Erro no envio do email:', emailError);
        emailStatus = `❌ Email: Erro - ${(emailError as Error).message}`;
      }

      const message = `Teste de alertas concluído:

${emailStatus}

📧 Destinatário: ${this.EMAIL_CONTATO}

${emailStatus.includes('❌') ? 
  '\n⚠️ Há problemas de configuração. Verifique se o domínio ecobrasil.bio.br e o remetente noreply@ecobrasil.bio.br estão verificados no SendGrid.' : 
  '\n🎉 Sistema de alertas funcionando perfeitamente!'}`;

      console.log('🧪 Teste de alertas concluído');
      return { 
        success: true, 
        message 
      };
    } catch (error) {
      console.error('❌ Erro no teste de alertas:', error);
      return { 
        success: false, 
        message: `Erro geral no teste: ${(error as Error).message || String(error)}` 
      };
    }
  }
}

export const alertService = new AlertService();