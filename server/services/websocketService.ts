import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '../db';
import { realTimeNotifications } from '@shared/schema';
import { eq, and, isNull, or, lte } from 'drizzle-orm';

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  lastPing: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === 'auth') {
            this.clients.set(clientId, {
              ws,
              userId: data.userId,
              lastPing: Date.now()
            });
            
            ws.send(JSON.stringify({ 
              type: 'connected', 
              clientId,
              message: 'Conectado ao servidor de notificações'
            }));
            
            this.sendPendingNotifications(data.userId, ws);
          }
          
          if (data.type === 'ping') {
            const client = this.clients.get(clientId);
            if (client) {
              client.lastPing = Date.now();
            }
            ws.send(JSON.stringify({ type: 'pong' }));
          }
          
          if (data.type === 'mark_read') {
            this.markNotificationAsRead(data.notificationId);
          }
          
          if (data.type === 'mark_all_read') {
            this.markAllAsRead(data.userId);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(clientId);
      });
    });

    this.pingInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000);

    console.log('WebSocket server initialized for real-time notifications');
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupStaleConnections() {
    const now = Date.now();
    const timeout = 60000;

    for (const [clientId, client] of this.clients) {
      if (now - client.lastPing > timeout) {
        client.ws.terminate();
        this.clients.delete(clientId);
      }
    }
  }

  async sendPendingNotifications(userId: number, ws: WebSocket) {
    try {
      const pending = await db.select()
        .from(realTimeNotifications)
        .where(
          and(
            or(
              eq(realTimeNotifications.usuarioId, userId),
              isNull(realTimeNotifications.usuarioId)
            ),
            eq(realTimeNotifications.lida, false),
            or(
              isNull(realTimeNotifications.expiracaoEm),
              lte(new Date(), realTimeNotifications.expiracaoEm)
            )
          )
        )
        .orderBy(realTimeNotifications.criadoEm)
        .limit(50);

      if (pending.length > 0) {
        ws.send(JSON.stringify({
          type: 'pending_notifications',
          notifications: pending
        }));
      }
    } catch (error) {
      console.error('Error sending pending notifications:', error);
    }
  }

  async sendNotification(notification: {
    tipo: string;
    titulo: string;
    mensagem: string;
    link?: string;
    icone?: string;
    usuarioId?: number;
    metadados?: any;
  }) {
    try {
      const [saved] = await db.insert(realTimeNotifications).values({
        tipo: notification.tipo,
        titulo: notification.titulo,
        mensagem: notification.mensagem,
        link: notification.link,
        icone: notification.icone,
        usuarioId: notification.usuarioId,
        metadados: notification.metadados || {}
      }).returning();

      const payload = JSON.stringify({
        type: 'notification',
        notification: saved
      });

      for (const [_, client] of this.clients) {
        if (notification.usuarioId === undefined || client.userId === notification.usuarioId) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(payload);
          }
        }
      }

      return saved;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  async broadcastToAll(message: { tipo: string; titulo: string; mensagem: string; link?: string }) {
    return this.sendNotification({
      ...message,
      usuarioId: undefined
    });
  }

  async sendToUser(userId: number, message: { tipo: string; titulo: string; mensagem: string; link?: string }) {
    return this.sendNotification({
      ...message,
      usuarioId: userId
    });
  }

  async markNotificationAsRead(notificationId: number) {
    try {
      await db.update(realTimeNotifications)
        .set({ lida: true, lidaEm: new Date() })
        .where(eq(realTimeNotifications.id, notificationId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async markAllAsRead(userId: number) {
    try {
      await db.update(realTimeNotifications)
        .set({ lida: true, lidaEm: new Date() })
        .where(
          and(
            or(
              eq(realTimeNotifications.usuarioId, userId),
              isNull(realTimeNotifications.usuarioId)
            ),
            eq(realTimeNotifications.lida, false)
          )
        );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await db.select()
        .from(realTimeNotifications)
        .where(
          and(
            or(
              eq(realTimeNotifications.usuarioId, userId),
              isNull(realTimeNotifications.usuarioId)
            ),
            eq(realTimeNotifications.lida, false)
          )
        );
      return result.length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const websocketService = new WebSocketService();
