import { storage } from "./storage";
import { db } from "./db";
import { notifications } from "@shared/schema";
import { eq, and, sql, gte } from "drizzle-orm";
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
  
  // Verifica se já existe uma notificação similar não lida para o mesmo item
  private async checkExistingNotification(tipo: string, itemId?: number, titulo?: string): Promise<boolean> {
    try {
      if (!itemId) return false;
      
      // Verificar notificações criadas nas últimas 24 horas para o mesmo item
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const existing = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.tipo, tipo),
            eq(notifications.itemId, itemId),
            eq(notifications.lida, false),
            gte(notifications.criadoEm, oneDayAgo)
          )
        )
        .limit(1);
      
      return existing.length > 0;
    } catch (error) {
      console.error('Erro ao verificar notificação existente:', error);
      return false;
    }
  }
  
  // Cria uma nova notificação no sistema (com verificação de duplicata)
  async createNotification(data: NotificationData): Promise<void> {
    try {
      // Verificar se já existe notificação similar para evitar duplicatas
      const exists = await this.checkExistingNotification(data.tipo, data.itemId, data.titulo);
      
      if (exists) {
        console.log(`Notificação duplicada ignorada: ${data.titulo} para item ${data.itemId}`);
        return;
      }
      
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

  // Limpa notificações duplicadas mantendo apenas a mais recente por item
  async cleanupDuplicateNotifications(): Promise<number> {
    try {
      // Encontrar todas as notificações não lidas
      const allNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.lida, false));
      
      // Agrupar por tipo + itemId, manter apenas a mais recente
      const seen = new Map<string, { id: number; criadoEm: Date }>();
      const toDelete: number[] = [];
      
      for (const notif of allNotifications) {
        const key = `${notif.tipo}-${notif.itemId || 'system'}`;
        const existing = seen.get(key);
        
        if (existing) {
          // Comparar datas e deletar a mais antiga
          if (notif.criadoEm && existing.criadoEm && notif.criadoEm > existing.criadoEm) {
            toDelete.push(existing.id);
            seen.set(key, { id: notif.id, criadoEm: notif.criadoEm });
          } else {
            toDelete.push(notif.id);
          }
        } else {
          seen.set(key, { id: notif.id, criadoEm: notif.criadoEm || new Date() });
        }
      }
      
      // Deletar notificações duplicadas
      for (const id of toDelete) {
        await db.delete(notifications).where(eq(notifications.id, id));
      }
      
      console.log(`${toDelete.length} notificações duplicadas removidas`);
      return toDelete.length;
    } catch (error) {
      console.error('Erro ao limpar notificações duplicadas:', error);
      return 0;
    }
  }

  // Limpa todas as notificações antigas (mais de 30 dias)
  async cleanupOldNotifications(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const result = await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.lida, true),
            sql`${notifications.criadoEm} < ${thirtyDaysAgo}`
          )
        );
      
      console.log('Notificações antigas limpas');
      return 0;
    } catch (error) {
      console.error('Erro ao limpar notificações antigas:', error);
      return 0;
    }
  }

  // Limpa TODAS as notificações (para reset completo)
  async clearAllPendingNotifications(): Promise<number> {
    try {
      const result = await db.delete(notifications);
      
      console.log('Todas as notificações foram limpas');
      return 0;
    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
      return 0;
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

  // Cria notificação de teste para verificar funcionamento
  async createTestNotification(): Promise<void> {
    await this.createSystemNotification(
      "🧪 Teste do Sistema",
      "Esta é uma notificação de teste para verificar se o sistema está funcionando corretamente. Criado em " + new Date().toLocaleString('pt-BR'),
      'baixa'
    );
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
