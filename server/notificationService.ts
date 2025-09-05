import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

export interface NotificationData {
  tipo: 'licenca' | 'condicionante' | 'entrega';
  titulo: string;
  mensagem: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  itemId?: number;
  metadados?: Record<string, any>;
}

export class NotificationService {
  
  // Cria uma nova notificação no sistema
  async createNotification(data: NotificationData): Promise<void> {
    try {
      const notification: InsertNotification = {
        tipo: data.tipo,
        titulo: data.titulo,
        mensagem: data.mensagem,
        canal: 'sistema',
        itemId: data.itemId,
        metadados: data.metadados || {},
        lida: false,
        status: 'pendente',
      };

      await storage.createNotification(notification);
      console.log(`Notificação criada: ${data.titulo}`);
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
    }
  }

  // Cria notificação de licença vencendo/vencida
  async createLicenseExpiryNotification(
    licencaId: number,
    nomeEmpreendimento: string,
    numeroLicenca: string,
    dataVencimento: Date,
    diasParaVencimento: number
  ): Promise<void> {
    let titulo: string;
    let mensagem: string;
    let severidade: 'baixa' | 'media' | 'alta' | 'critica';

    if (diasParaVencimento <= 0) {
      titulo = "Licença Vencida";
      mensagem = `A licença ${numeroLicenca} do empreendimento ${nomeEmpreendimento} VENCEU em ${dataVencimento.toLocaleDateString('pt-BR')}.`;
      severidade = 'critica';
    } else if (diasParaVencimento <= 30) {
      titulo = "Licença Vencendo";
      mensagem = `A licença ${numeroLicenca} do empreendimento ${nomeEmpreendimento} vence em ${diasParaVencimento} dias (${dataVencimento.toLocaleDateString('pt-BR')}).`;
      severidade = 'alta';
    } else if (diasParaVencimento <= 90) {
      titulo = "Licença Vencendo";
      mensagem = `A licença ${numeroLicenca} do empreendimento ${nomeEmpreendimento} vence em ${diasParaVencimento} dias (${dataVencimento.toLocaleDateString('pt-BR')}).`;
      severidade = 'media';
    } else {
      return; // Não cria notificação para vencimentos distantes
    }

    await this.createNotification({
      tipo: 'licenca',
      titulo,
      mensagem,
      severidade,
      itemId: licencaId,
      metadados: {
        numeroLicenca,
        nomeEmpreendimento,
        dataVencimento: dataVencimento.toISOString(),
        diasParaVencimento
      }
    });
  }

  // Cria notificação de condicionante vencendo/vencida
  async createCondicionanteExpiryNotification(
    condicionanteId: number,
    descricao: string,
    nomeEmpreendimento: string,
    numeroLicenca: string,
    dataVencimento: Date,
    diasParaVencimento: number
  ): Promise<void> {
    let titulo: string;
    let mensagem: string;
    let severidade: 'baixa' | 'media' | 'alta' | 'critica';

    if (diasParaVencimento <= 0) {
      titulo = "Condicionante Vencida";
      mensagem = `A condicionante "${descricao}" da licença ${numeroLicenca} (${nomeEmpreendimento}) VENCEU em ${dataVencimento.toLocaleDateString('pt-BR')}.`;
      severidade = 'critica';
    } else if (diasParaVencimento <= 15) {
      titulo = "Condicionante Vencendo";
      mensagem = `A condicionante "${descricao}" da licença ${numeroLicenca} (${nomeEmpreendimento}) vence em ${diasParaVencimento} dias.`;
      severidade = 'alta';
    } else if (diasParaVencimento <= 30) {
      titulo = "Condicionante Vencendo";
      mensagem = `A condicionante "${descricao}" da licença ${numeroLicenca} (${nomeEmpreendimento}) vence em ${diasParaVencimento} dias.`;
      severidade = 'media';
    } else {
      return; // Não cria notificação para vencimentos distantes
    }

    await this.createNotification({
      tipo: 'condicionante',
      titulo,
      mensagem,
      severidade,
      itemId: condicionanteId,
      metadados: {
        descricao,
        numeroLicenca,
        nomeEmpreendimento,
        dataVencimento: dataVencimento.toISOString(),
        diasParaVencimento
      }
    });
  }

  // Cria notificação de entrega vencendo/vencida
  async createEntregaExpiryNotification(
    entregaId: number,
    descricao: string,
    nomeEmpreendimento: string,
    numeroLicenca: string,
    dataVencimento: Date,
    diasParaVencimento: number
  ): Promise<void> {
    let titulo: string;
    let mensagem: string;
    let severidade: 'baixa' | 'media' | 'alta' | 'critica';

    if (diasParaVencimento <= 0) {
      titulo = "Entrega Vencida";
      mensagem = `A entrega "${descricao}" da licença ${numeroLicenca} (${nomeEmpreendimento}) VENCEU em ${dataVencimento.toLocaleDateString('pt-BR')}.`;
      severidade = 'critica';
    } else if (diasParaVencimento <= 7) {
      titulo = "Entrega Vencendo";
      mensagem = `A entrega "${descricao}" da licença ${numeroLicenca} (${nomeEmpreendimento}) vence em ${diasParaVencimento} dias.`;
      severidade = 'alta';
    } else if (diasParaVencimento <= 15) {
      titulo = "Entrega Vencendo";
      mensagem = `A entrega "${descricao}" da licença ${numeroLicenca} (${nomeEmpreendimento}) vence em ${diasParaVencimento} dias.`;
      severidade = 'media';
    } else {
      return; // Não cria notificação para vencimentos distantes
    }

    await this.createNotification({
      tipo: 'entrega',
      titulo,
      mensagem,
      severidade,
      itemId: entregaId,
      metadados: {
        descricao,
        numeroLicenca,
        nomeEmpreendimento,
        dataVencimento: dataVencimento.toISOString(),
        diasParaVencimento
      }
    });
  }

  // Cria notificação de sistema
  async createSystemNotification(titulo: string, mensagem: string, severidade: 'baixa' | 'media' | 'alta' | 'critica' = 'baixa'): Promise<void> {
    await this.createNotification({
      tipo: 'licenca', // Tipo genérico para notificações do sistema
      titulo,
      mensagem,
      severidade,
      metadados: {
        sistema: true
      }
    });
  }

  // Marca notificação como enviada (quando o alerta foi processado)
  async markNotificationAsSent(notificationId: number): Promise<void> {
    try {
      await storage.updateNotificationStatus(notificationId, 'enviado', new Date());
      console.log(`Notificação ${notificationId} marcada como enviada`);
    } catch (error) {
      console.error('Erro ao marcar notificação como enviada:', error);
    }
  }

  // Marca notificação como erro
  async markNotificationAsError(notificationId: number, errorMessage: string): Promise<void> {
    try {
      await storage.updateNotificationStatus(notificationId, 'erro');
      console.log(`Notificação ${notificationId} marcada como erro: ${errorMessage}`);
    } catch (error) {
      console.error('Erro ao marcar notificação como erro:', error);
    }
  }
}

export const notificationService = new NotificationService();