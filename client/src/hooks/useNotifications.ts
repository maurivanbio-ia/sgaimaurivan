import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  icone?: string;
  lida: boolean;
  criadoEm: string;
}

export function useNotifications() {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0, refetch: refetchUnreadCount } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 60000,
  });

  const connect = useCallback((userId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'auth', userId }));
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification') {
          setNotifications(prev => [data.notification, ...prev]);
          void refetchUnreadCount();
        }
        
        if (data.type === 'pending_notifications') {
          setNotifications(prev => [...data.notifications, ...prev]);
        }

        // ── Pilar 1: Cache invalidation silenciosa (Fim do F5) ─────────────
        // O servidor emite este sinal após mutações. O TanStack Query atualiza
        // a tela automaticamente sem o usuário precisar recarregar.
        if (data.type === 'invalidate') {
          const entityRoutes: Record<string, string[]> = {
            licencas: ['/api/licencas', '/api/licencas-ambientais'],
            condicionantes: ['/api/condicionantes'],
            demandas: ['/api/demandas'],
            equipamentos: ['/api/equipamentos'],
            empreendimentos: ['/api/empreendimentos'],
            contratos: ['/api/contratos'],
            financeiro: ['/api/financeiro'],
            frota: ['/api/veiculos'],
            rh: ['/api/rh'],
          };
          const routes = entityRoutes[data.entity] || [`/api/${data.entity}`];
          routes.forEach(r => { void queryClient.invalidateQueries({ queryKey: [r] }); });
          if (data.keys?.length) {
            data.keys.forEach((k: string) => { void queryClient.invalidateQueries({ queryKey: [k] }); });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect(userId);
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [refetchUnreadCount]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, lida: true } : n)
      );
      void refetchUnreadCount();
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'mark_read', notificationId }));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [refetchUnreadCount]);

  const markAllAsRead = useCallback(async (userId: number) => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'include'
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
      void refetchUnreadCount();
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'mark_all_read', userId }));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [refetchUnreadCount]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    notifications,
    unreadCount: typeof unreadCount === 'object' ? unreadCount.count : 0,
    connect,
    disconnect,
    markAsRead,
    markAllAsRead
  };
}
