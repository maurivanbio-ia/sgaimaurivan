import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { eq, desc, and, gte, lte, or, ilike } from 'drizzle-orm';

interface AuditLogEntry {
  tabela: string;
  registroId: number;
  acao: 'create' | 'update' | 'delete';
  dadosAnteriores?: any;
  dadosNovos?: any;
  camposAlterados?: string[];
  usuarioId?: number;
  usuarioNome?: string;
  ipAddress?: string;
  userAgent?: string;
}

class AuditLogService {
  async log(entry: AuditLogEntry) {
    try {
      const [saved] = await db.insert(auditLogs).values({
        tabela: entry.tabela,
        registroId: entry.registroId,
        acao: entry.acao,
        dadosAnteriores: entry.dadosAnteriores,
        dadosNovos: entry.dadosNovos,
        camposAlterados: entry.camposAlterados,
        usuarioId: entry.usuarioId,
        usuarioNome: entry.usuarioNome,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      }).returning();

      return saved;
    } catch (error) {
      console.error('Error saving audit log:', error);
    }
  }

  async logCreate(tabela: string, registroId: number, dados: any, userId?: number, userName?: string, req?: any) {
    return this.log({
      tabela,
      registroId,
      acao: 'create',
      dadosNovos: dados,
      usuarioId: userId,
      usuarioNome: userName,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent']
    });
  }

  async logUpdate(tabela: string, registroId: number, dadosAnteriores: any, dadosNovos: any, userId?: number, userName?: string, req?: any) {
    const camposAlterados = this.getChangedFields(dadosAnteriores, dadosNovos);
    
    return this.log({
      tabela,
      registroId,
      acao: 'update',
      dadosAnteriores,
      dadosNovos,
      camposAlterados,
      usuarioId: userId,
      usuarioNome: userName,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent']
    });
  }

  async logDelete(tabela: string, registroId: number, dadosAnteriores: any, userId?: number, userName?: string, req?: any) {
    return this.log({
      tabela,
      registroId,
      acao: 'delete',
      dadosAnteriores,
      usuarioId: userId,
      usuarioNome: userName,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent']
    });
  }

  getChangedFields(before: any, after: any): string[] {
    if (!before || !after) return [];
    
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    for (const key of allKeys) {
      const beforeVal = JSON.stringify(before[key]);
      const afterVal = JSON.stringify(after[key]);
      
      if (beforeVal !== afterVal) {
        changed.push(key);
      }
    }
    
    return changed;
  }

  async getHistory(filters: {
    tabela?: string;
    registroId?: number;
    acao?: string;
    usuarioId?: number;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const conditions = [];
      
      if (filters.tabela) {
        conditions.push(eq(auditLogs.tabela, filters.tabela));
      }
      
      if (filters.registroId) {
        conditions.push(eq(auditLogs.registroId, filters.registroId));
      }
      
      if (filters.acao) {
        conditions.push(eq(auditLogs.acao, filters.acao));
      }
      
      if (filters.usuarioId) {
        conditions.push(eq(auditLogs.usuarioId, filters.usuarioId));
      }
      
      if (filters.startDate) {
        conditions.push(gte(auditLogs.criadoEm, filters.startDate));
      }
      
      if (filters.endDate) {
        conditions.push(lte(auditLogs.criadoEm, filters.endDate));
      }
      
      if (filters.search) {
        conditions.push(
          or(
            ilike(auditLogs.tabela, `%${filters.search}%`),
            ilike(auditLogs.usuarioNome, `%${filters.search}%`)
          )
        );
      }

      let query = db.select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.criadoEm));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit) as any;
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset) as any;
      }

      return await query;
    } catch (error) {
      console.error('Error getting audit history:', error);
      return [];
    }
  }

  async getRecordHistory(tabela: string, registroId: number) {
    return this.getHistory({ tabela, registroId, limit: 100 });
  }

  formatActionLabel(acao: string): string {
    const labels: Record<string, string> = {
      'create': 'Criação',
      'update': 'Atualização',
      'delete': 'Exclusão'
    };
    return labels[acao] || acao;
  }

  formatTableLabel(tabela: string): string {
    const labels: Record<string, string> = {
      'empreendimentos': 'Empreendimento',
      'licencas_ambientais': 'Licença Ambiental',
      'condicionantes': 'Condicionante',
      'entregas': 'Entrega',
      'financeiro_lancamentos': 'Lançamento Financeiro',
      'equipamentos': 'Equipamento',
      'veiculos': 'Veículo',
      'contratos': 'Contrato',
      'users': 'Usuário'
    };
    return labels[tabela] || tabela;
  }
}

export const auditLogService = new AuditLogService();
