import { storage } from './storage';
import { sendEmail } from './emailService';
import { sendWhatsApp } from './whatsappService';
import { websocketService } from './services/websocketService';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
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
    
    // Programas SST (PPRA, PCMSO, PGR, LTCAT)
    { tipo: 'programa_sst', diasAviso: 60, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'programa_sst', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'programa_sst', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'programa_sst', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    
    // ASOs Ocupacionais
    { tipo: 'aso', diasAviso: 30, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'aso', diasAviso: 15, ativo: true, enviarEmail: true, enviarWhatsapp: false },
    { tipo: 'aso', diasAviso: 7, ativo: true, enviarEmail: true, enviarWhatsapp: false },
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
        case 'programa_sst':
          items = await storage.getProgramasSst();
          getDateField = (item) => item.dataValidade;
          break;
        case 'aso':
          items = await storage.getAsosOcupacionais();
          getDateField = (item) => item.dataValidade;
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

  // Busca usuários por unidade para scoping de notificações
  private async getUsersByUnidade(unidade: string): Promise<number[]> {
    try {
      const result = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.unidade, unidade));
      return result.map(u => u.id);
    } catch (error) {
      console.error('Erro ao buscar usuários por unidade:', error);
      return [];
    }
  }

  // Busca administradores para fallback de notificações sem unidade
  private async getAdminUsers(): Promise<number[]> {
    try {
      const result = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      return result.map(u => u.id);
    } catch (error) {
      console.error('Erro ao buscar administradores:', error);
      return [];
    }
  }

  // Cria notificação em tempo real via WebSocket (persistida em realTimeNotifications)
  // Notificações são escopadas por unidade para respeitar isolamento multi-tenant
  private async createInternalNotification(
    item: any,
    tipo: string,
    diasRestantes: number
  ): Promise<void> {
    try {
      const dateField = tipo === 'licenca' ? item.validade : item.prazo;
      const dataVencimento = new Date(dateField);
      
      // Buscar dados do empreendimento - para condicionante/entrega, buscar via licença
      let empreendimento = null;
      let empreendimentoId = item.empreendimentoId;
      
      if (empreendimentoId) {
        empreendimento = await storage.getEmpreendimento(empreendimentoId);
      } else if (item.licencaId) {
        // Para condicionantes e entregas, buscar empreendimento via licença
        const licenca = await storage.getLicenca(item.licencaId);
        if (licenca?.empreendimentoId) {
          empreendimentoId = licenca.empreendimentoId;
          empreendimento = await storage.getEmpreendimento(empreendimentoId);
        }
      }
      
      const nomeEmpreendimento = empreendimento?.nome || 'N/A';
      const unidadeEmpreendimento = empreendimento?.unidade || null;
      
      // Buscar dados da licença se for condicionante ou entrega
      let tipoLicenca = 'N/A';
      if (tipo === 'licenca') {
        tipoLicenca = item.tipo || 'N/A';
      } else if (item.licencaId) {
        const licenca = await storage.getLicenca(item.licencaId);
        tipoLicenca = licenca?.tipo || 'N/A';
      }
      
      // Definir severidade e ícone baseado nos dias restantes
      let notificationType = 'info';
      let icone = 'Bell';
      
      if (diasRestantes <= 0) {
        notificationType = 'erro';
        icone = 'AlertTriangle';
      } else if (diasRestantes <= 7) {
        notificationType = 'alerta';
        icone = 'AlertCircle';
      } else if (diasRestantes <= 30) {
        notificationType = 'alerta';
        icone = 'Clock';
      }
      
      // Preparar título e mensagem
      let titulo = '';
      let mensagem = '';
      const tipoLabel = tipo === 'licenca' ? 'Licença' : tipo === 'condicionante' ? 'Condicionante' : 'Entrega';
      
      switch (tipo) {
        case 'licenca':
          titulo = diasRestantes <= 0 ? 'Licença Vencida' : 'Licença Vencendo';
          mensagem = `${tipoLicenca} - ${nomeEmpreendimento}: ${diasRestantes <= 0 ? 'VENCIDA' : `${diasRestantes} dias restantes`}`;
          break;
        case 'condicionante':
          titulo = diasRestantes <= 0 ? 'Condicionante Vencida' : 'Condicionante Vencendo';
          mensagem = `${item.descricao || 'Condicionante'} - ${nomeEmpreendimento}: ${diasRestantes <= 0 ? 'VENCIDA' : `${diasRestantes} dias restantes`}`;
          break;
        case 'entrega':
          titulo = diasRestantes <= 0 ? 'Entrega Vencida' : 'Entrega Vencendo';
          mensagem = `${item.titulo || item.descricao || 'Entrega'} - ${nomeEmpreendimento}: ${diasRestantes <= 0 ? 'VENCIDA' : `${diasRestantes} dias restantes`}`;
          break;
      }
      
      // Usar o empreendimentoId resolvido (pode vir da licença)
      const resolvedEmpreendimentoId = empreendimentoId || item.empreendimentoId;
      
      const notificationPayload = {
        tipo: notificationType,
        titulo,
        mensagem,
        link: resolvedEmpreendimentoId ? `/empreendimentos/${resolvedEmpreendimentoId}` : '/empreendimentos',
        icone,
        metadados: {
          itemId: item.id,
          tipoItem: tipo,
          tipoLabel,
          diasRestantes,
          empreendimentoId: resolvedEmpreendimentoId || null,
          nomeEmpreendimento,
          dataVencimento: dataVencimento.toISOString()
        }
      };
      
      // Buscar usuários da mesma unidade para respeitar isolamento multi-tenant
      if (unidadeEmpreendimento) {
        const userIds = await this.getUsersByUnidade(unidadeEmpreendimento);
        
        // Enviar notificação para cada usuário da unidade
        for (const userId of userIds) {
          await websocketService.sendNotification({
            ...notificationPayload,
            usuarioId: userId
          });
        }
        
        console.log(`[Push] Notificação de ${tipo} enviada para ${userIds.length} usuários da unidade ${unidadeEmpreendimento}: ${titulo}`);
      } else {
        // Fallback 1: buscar unidade do item.unidade (alguns registros têm campo direto)
        const itemUnidade = item.unidade;
        if (itemUnidade) {
          const userIds = await this.getUsersByUnidade(itemUnidade);
          for (const userId of userIds) {
            await websocketService.sendNotification({
              ...notificationPayload,
              usuarioId: userId
            });
          }
          console.log(`[Push] Notificação de ${tipo} enviada (via item.unidade ${itemUnidade}): ${titulo}`);
        } else if (item.responsavelId) {
          // Fallback 2: buscar unidade do responsável e notificar todos os usuários dessa unidade
          const responsavel = await storage.getUserById(item.responsavelId);
          if (responsavel && responsavel.unidade) {
            // Notificar todos os usuários da unidade do responsável
            const userIds = await this.getUsersByUnidade(responsavel.unidade);
            for (const userId of userIds) {
              await websocketService.sendNotification({
                ...notificationPayload,
                usuarioId: userId
              });
            }
            console.log(`[Push] Notificação de ${tipo} enviada para ${userIds.length} usuários (via responsável unidade ${responsavel.unidade}): ${titulo}`);
          } else if (responsavel) {
            // Responsável existe mas não tem unidade - notificar apenas ele
            await websocketService.sendNotification({
              ...notificationPayload,
              usuarioId: responsavel.id
            });
            console.log(`[Push] Notificação de ${tipo} enviada apenas para responsável ${responsavel.id} (sem unidade): ${titulo}`);
          } else {
            console.warn(`[Push] Notificação de ${tipo} não pôde ser entregue: itemId=${item.id}, responsavelId inválido=${item.responsavelId}`);
          }
        } else {
          // Fallback final: notificar todos os administradores sobre deadline sem unidade definida
          const adminUsers = await this.getAdminUsers();
          if (adminUsers.length > 0) {
            for (const adminId of adminUsers) {
              await websocketService.sendNotification({
                ...notificationPayload,
                usuarioId: adminId,
                titulo: `[DADOS INCOMPLETOS] ${titulo}`,
                mensagem: `${mensagem} - AÇÃO NECESSÁRIA: Verificar dados do registro`
              });
            }
            console.warn(`[Push] Notificação de ${tipo} enviada para ${adminUsers.length} admins (dados incompletos): ${titulo}`);
          }
          
          // Registrar problema de higiene de dados para monitoramento
          await this.logDataHygieneIssue({
            tipo,
            itemId: item.id,
            licencaId: item.licencaId || null,
            empreendimentoId: resolvedEmpreendimentoId || null,
            responsavelId: item.responsavelId || null,
            titulo: titulo,
            dataVencimento: dataVencimento.toISOString()
          });
        }
      }
      
    } catch (error) {
      console.error(`Erro ao criar notificação interna para ${tipo} ID ${item.id}:`, error);
    }
  }

  // Registra problema de higiene de dados para monitoramento
  private async logDataHygieneIssue(issue: {
    tipo: string;
    itemId: number;
    licencaId: number | null;
    empreendimentoId: number | null;
    responsavelId: number | null;
    titulo: string;
    dataVencimento: string;
  }): Promise<void> {
    console.error(`[HIGIENE DE DADOS] Notificação não pôde ser escopada por unidade:
      - Tipo: ${issue.tipo}
      - Item ID: ${issue.itemId}
      - Licença ID: ${issue.licencaId || 'N/A'}
      - Empreendimento ID: ${issue.empreendimentoId || 'N/A'}
      - Responsável ID: ${issue.responsavelId || 'N/A'}
      - Título: ${issue.titulo}
      - Data Vencimento: ${issue.dataVencimento}
      - Ação necessária: Verificar se o registro possui licença associada com empreendimento válido`);
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