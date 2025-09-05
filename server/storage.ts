import {
  users,
  empreendimentos,
  licencasAmbientais,
  condicionantes,
  entregas,
  alertConfigs,
  alertHistory,
  notifications,
  type User,
  type InsertUser,
  type Empreendimento,
  type InsertEmpreendimento,
  type LicencaAmbiental,
  type InsertLicencaAmbiental,
  type EmpreendimentoWithLicencas,
  type Condicionante,
  type InsertCondicionante,
  type Entrega,
  type InsertEntrega,
  type LicencaWithDetails,
  type AlertConfig,
  type InsertAlertConfig,
  type AlertHistory,
  type InsertAlertHistory,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;

  // Empreendimento operations
  getEmpreendimentos(): Promise<Empreendimento[]>;
  getEmpreendimento(id: number): Promise<EmpreendimentoWithLicencas | undefined>;
  createEmpreendimento(empreendimento: InsertEmpreendimento): Promise<Empreendimento>;
  updateEmpreendimento(id: number, empreendimento: Partial<InsertEmpreendimento>): Promise<Empreendimento>;
  deleteEmpreendimento(id: number): Promise<void>;

  // Licenca operations
  getLicencas(): Promise<LicencaAmbiental[]>;
  getLicenca(id: number): Promise<LicencaAmbiental | undefined>;
  createLicenca(licenca: InsertLicencaAmbiental): Promise<LicencaAmbiental>;
  updateLicenca(id: number, licenca: Partial<InsertLicencaAmbiental>): Promise<LicencaAmbiental>;
  deleteLicenca(id: number): Promise<void>;

  // Condicionante operations
  getCondicionantes(): Promise<Condicionante[]>;
  getCondicionante(id: number): Promise<Condicionante | undefined>;
  getCondicionantesByLicenca(licencaId: number): Promise<Condicionante[]>;
  createCondicionante(condicionante: InsertCondicionante): Promise<Condicionante>;
  updateCondicionante(id: number, condicionante: Partial<InsertCondicionante>): Promise<Condicionante>;
  deleteCondicionante(id: number): Promise<void>;

  // Entrega operations
  getEntregas(): Promise<Entrega[]>;
  getEntrega(id: number): Promise<Entrega | undefined>;
  getEntregasByLicenca(licencaId: number): Promise<Entrega[]>;
  createEntrega(entrega: InsertEntrega): Promise<Entrega>;
  updateEntrega(id: number, entrega: Partial<InsertEntrega>): Promise<Entrega>;
  deleteEntrega(id: number): Promise<void>;

  // Enhanced Stats
  getLicenseStats(): Promise<{ active: number; expiring: number; expired: number }>;
  getCondicionanteStats(): Promise<{ pendentes: number; cumpridas: number; vencidas: number }>;
  getEntregaStats(): Promise<{ pendentes: number; entregues: number; atrasadas: number }>;
  getEntregasDoMes(): Promise<Entrega[]>;
  getAgendaPrazos(): Promise<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; }>>;
  getMonthlyExpiryData(): Promise<Array<{ month: string; count: number }>>;

  // Alert operations
  getAlertConfigs(): Promise<AlertConfig[]>;
  getActiveAlertConfigs(): Promise<AlertConfig[]>;
  createAlertConfig(config: InsertAlertConfig): Promise<AlertConfig>;
  createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory>;
  checkAlertHistory(tipoItem: string, itemId: number, diasAviso: number): Promise<boolean>;

  // Notification operations
  getNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(): Promise<void>;
  updateNotificationStatus(id: number, status: string, enviadoEm?: Date): Promise<Notification>;

  // Filtered data operations
  getLicencasByStatus(status: 'ativa' | 'expiring' | 'expired'): Promise<LicencaAmbiental[]>;
  getCondicionantesByStatus(status: 'pendente' | 'cumprida' | 'vencida'): Promise<Condicionante[]>;
  getEntregasDoMes(): Promise<Entrega[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.passwordHash, 10);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, passwordHash: hashedPassword })
      .returning();
    return user;
  }

  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Empreendimento operations
  async getEmpreendimentos(): Promise<Empreendimento[]> {
    return db.select().from(empreendimentos).orderBy(desc(empreendimentos.criadoEm));
  }

  async getEmpreendimento(id: number): Promise<EmpreendimentoWithLicencas | undefined> {
    const [empreendimento] = await db.select().from(empreendimentos).where(eq(empreendimentos.id, id));
    if (!empreendimento) return undefined;

    const licencasData = await db
      .select()
      .from(licencasAmbientais)
      .where(eq(licencasAmbientais.empreendimentoId, id))
      .orderBy(desc(licencasAmbientais.criadoEm));

    // Recalcula status das licenças baseado na data atual
    const licencas = licencasData.map(licenca => ({
      ...licenca,
      status: this.calculateLicenseStatus(licenca.validade)
    }));

    return { ...empreendimento, licencas };
  }

  async createEmpreendimento(empreendimento: InsertEmpreendimento): Promise<Empreendimento> {
    const [created] = await db.insert(empreendimentos).values(empreendimento).returning();
    return created;
  }

  async updateEmpreendimento(id: number, empreendimento: Partial<InsertEmpreendimento>): Promise<Empreendimento> {
    const [updated] = await db
      .update(empreendimentos)
      .set(empreendimento)
      .where(eq(empreendimentos.id, id))
      .returning();
    return updated;
  }

  async deleteEmpreendimento(id: number): Promise<void> {
    await db.delete(empreendimentos).where(eq(empreendimentos.id, id));
  }

  // Licenca operations
  async getLicencas(): Promise<LicencaAmbiental[]> {
    const licencas = await db.select().from(licencasAmbientais).orderBy(desc(licencasAmbientais.criadoEm));
    // Recalcula status baseado na data atual
    return licencas.map(licenca => ({
      ...licenca,
      status: this.calculateLicenseStatus(licenca.validade)
    }));
  }

  async getLicenca(id: number): Promise<LicencaAmbiental | undefined> {
    const [licenca] = await db.select().from(licencasAmbientais).where(eq(licencasAmbientais.id, id));
    if (!licenca) return undefined;
    // Recalcula status baseado na data atual
    return {
      ...licenca,
      status: this.calculateLicenseStatus(licenca.validade)
    };
  }

  async createLicenca(licenca: InsertLicencaAmbiental): Promise<LicencaAmbiental> {
    const status = this.calculateLicenseStatus(licenca.validade);
    const [created] = await db
      .insert(licencasAmbientais)
      .values({ ...licenca, status })
      .returning();
    return created;
  }

  async updateLicenca(id: number, licenca: Partial<InsertLicencaAmbiental>): Promise<LicencaAmbiental> {
    const updateData: any = { ...licenca };
    if (licenca.validade) {
      updateData.status = this.calculateLicenseStatus(licenca.validade);
    }
    
    const [updated] = await db
      .update(licencasAmbientais)
      .set(updateData)
      .where(eq(licencasAmbientais.id, id))
      .returning();
    return updated;
  }

  async deleteLicenca(id: number): Promise<void> {
    await db.delete(licencasAmbientais).where(eq(licencasAmbientais.id, id));
  }

  // Condicionante operations
  async getCondicionantes(): Promise<Condicionante[]> {
    const condicionantesData = await db.select().from(condicionantes).orderBy(desc(condicionantes.criadoEm));
    // Recalcula status baseado na data atual
    return condicionantesData.map(condicionante => ({
      ...condicionante,
      status: this.calculateCondicionanteStatus(condicionante.prazo)
    }));
  }

  async getCondicionante(id: number): Promise<Condicionante | undefined> {
    const [condicionante] = await db.select().from(condicionantes).where(eq(condicionantes.id, id));
    if (!condicionante) return undefined;
    // Recalcula status baseado na data atual
    return {
      ...condicionante,
      status: this.calculateCondicionanteStatus(condicionante.prazo)
    };
  }

  async getCondicionantesByLicenca(licencaId: number): Promise<Condicionante[]> {
    const condicionantesData = await db
      .select()
      .from(condicionantes)
      .where(eq(condicionantes.licencaId, licencaId))
      .orderBy(asc(condicionantes.prazo));
    // Recalcula status baseado na data atual
    return condicionantesData.map(condicionante => ({
      ...condicionante,
      status: this.calculateCondicionanteStatus(condicionante.prazo)
    }));
  }

  async createCondicionante(condicionante: InsertCondicionante): Promise<Condicionante> {
    const status = this.calculateCondicionanteStatus(condicionante.prazo);
    const [created] = await db
      .insert(condicionantes)
      .values({ ...condicionante, status })
      .returning();
    return created;
  }

  async updateCondicionante(id: number, condicionante: Partial<InsertCondicionante>): Promise<Condicionante> {
    const updateData: any = { ...condicionante, atualizadoEm: new Date() };
    if (condicionante.prazo) {
      updateData.status = this.calculateCondicionanteStatus(condicionante.prazo);
    }
    
    const [updated] = await db
      .update(condicionantes)
      .set(updateData)
      .where(eq(condicionantes.id, id))
      .returning();
    return updated;
  }

  async deleteCondicionante(id: number): Promise<void> {
    await db.delete(condicionantes).where(eq(condicionantes.id, id));
  }

  // Entrega operations
  async getEntregas(): Promise<Entrega[]> {
    const entregasData = await db.select().from(entregas).orderBy(desc(entregas.criadoEm));
    // Recalcula status baseado na data atual
    return entregasData.map(entrega => ({
      ...entrega,
      status: this.calculateEntregaStatus(entrega.prazo)
    }));
  }

  async getEntrega(id: number): Promise<Entrega | undefined> {
    const [entrega] = await db.select().from(entregas).where(eq(entregas.id, id));
    if (!entrega) return undefined;
    // Recalcula status baseado na data atual
    return {
      ...entrega,
      status: this.calculateEntregaStatus(entrega.prazo)
    };
  }

  async getEntregasByLicenca(licencaId: number): Promise<Entrega[]> {
    return db
      .select()
      .from(entregas)
      .where(eq(entregas.licencaId, licencaId))
      .orderBy(asc(entregas.prazo));
  }

  async createEntrega(entrega: InsertEntrega): Promise<Entrega> {
    const status = this.calculateEntregaStatus(entrega.prazo);
    const [created] = await db
      .insert(entregas)
      .values({ ...entrega, status })
      .returning();
    return created;
  }

  async updateEntrega(id: number, entrega: Partial<InsertEntrega>): Promise<Entrega> {
    const updateData: any = { ...entrega, atualizadoEm: new Date() };
    if (entrega.prazo) {
      updateData.status = this.calculateEntregaStatus(entrega.prazo);
    }
    
    const [updated] = await db
      .update(entregas)
      .set(updateData)
      .where(eq(entregas.id, id))
      .returning();
    return updated;
  }

  async deleteEntrega(id: number): Promise<void> {
    await db.delete(entregas).where(eq(entregas.id, id));
  }

  // Enhanced Stats
  async getLicenseStats(): Promise<{ active: number; expiring: number; expired: number }> {
    const licencas = await this.getLicencas();
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);

    let active = 0;
    let expiring = 0;
    let expired = 0;

    licencas.forEach(licenca => {
      const validadeDate = new Date(licenca.validade);
      
      if (validadeDate < now) {
        expired++;
      } else if (validadeDate <= ninetyDaysFromNow) {
        expiring++;
      } else {
        active++;
      }
    });

    return { active, expiring, expired };
  }

  async getCondicionanteStats(): Promise<{ pendentes: number; cumpridas: number; vencidas: number }> {
    const condicionantes = await this.getCondicionantes();
    return {
      pendentes: condicionantes.filter(c => c.status === 'pendente').length,
      cumpridas: condicionantes.filter(c => c.status === 'cumprida').length,
      vencidas: condicionantes.filter(c => c.status === 'vencida').length,
    };
  }

  async getEntregaStats(): Promise<{ pendentes: number; entregues: number; atrasadas: number }> {
    const entregas = await this.getEntregas();
    return {
      pendentes: entregas.filter(e => e.status === 'pendente').length,
      entregues: entregas.filter(e => e.status === 'entregue').length,
      atrasadas: entregas.filter(e => e.status === 'atrasada').length,
    };
  }

  async getMonthlyExpiryData(): Promise<Array<{ month: string; count: number }>> {
    const licencas = await this.getLicencas();
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Create array for next 12 months starting from current month
    const monthlyData: Array<{ month: string; count: number }> = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(currentYear, now.getMonth() + i, 1);
      const monthName = monthNames[targetDate.getMonth()];
      const year = targetDate.getFullYear();
      
      // Count licences expiring in this month
      const count = licencas.filter(licenca => {
        const validadeDate = new Date(licenca.validade);
        return validadeDate.getMonth() === targetDate.getMonth() && 
               validadeDate.getFullYear() === year;
      }).length;
      
      monthlyData.push({
        month: year === currentYear ? monthName : `${monthName}/${year.toString().slice(-2)}`,
        count
      });
    }
    
    return monthlyData;
  }

  async getEntregasDoMes(): Promise<Entrega[]> {
    const entregas = await this.getEntregas();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return entregas.filter(entrega => {
      const prazo = new Date(entrega.prazo);
      return prazo >= startOfMonth && prazo <= endOfMonth;
    });
  }

  async getAgendaPrazos(): Promise<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }>> {
    const [licencas, condicionantes, entregas, empreendimentos] = await Promise.all([
      this.getLicencas(),
      this.getCondicionantes(),
      this.getEntregas(),
      this.getEmpreendimentos(),
    ]);

    const agenda: Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }> = [];
    
    // Add licenses with upcoming expiration
    licencas.forEach(licenca => {
      if (licenca.status !== 'ativa') {
        const empreendimento = empreendimentos.find(e => e.id === licenca.empreendimentoId);
        agenda.push({
          tipo: 'Licença',
          titulo: `${licenca.tipo} - ${licenca.orgaoEmissor}`,
          prazo: licenca.validade,
          status: licenca.status,
          id: licenca.id,
          empreendimento: empreendimento?.nome,
          orgaoEmissor: licenca.orgaoEmissor,
        });
      }
    });

    // Add condicionantes
    condicionantes.forEach(condicionante => {
      // Find the license and empreendimento for this condicionante
      const licenca = licencas.find(l => l.id === condicionante.licencaId);
      const empreendimento = licenca ? empreendimentos.find(e => e.id === licenca.empreendimentoId) : undefined;
      agenda.push({
        tipo: 'Condicionante',
        titulo: condicionante.descricao,
        prazo: condicionante.prazo,
        status: condicionante.status,
        id: condicionante.id,
        empreendimento: empreendimento?.nome,
        orgaoEmissor: licenca?.orgaoEmissor,
      });
    });

    // Add entregas
    entregas.forEach(entrega => {
      const empreendimento = empreendimentos.find(e => e.id === entrega.empreendimentoId);
      agenda.push({
        tipo: 'Entrega',
        titulo: entrega.titulo || entrega.descricao || '',
        prazo: entrega.prazo,
        status: entrega.status,
        id: entrega.id,
        empreendimento: empreendimento?.nome,
      });
    });

    // Sort by prazo (closest first)
    return agenda.sort((a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime());
  }

  private calculateCondicionanteStatus(prazo: string): string {
    const now = new Date();
    const prazoDate = new Date(prazo);
    
    if (prazoDate < now) {
      return 'vencida';
    }
    return 'pendente';
  }

  private calculateEntregaStatus(prazo: string): string {
    const now = new Date();
    const prazoDate = new Date(prazo);
    
    if (prazoDate < now) {
      return 'atrasada';
    }
    return 'pendente';
  }

  private calculateLicenseStatus(validade: string): string {
    const now = new Date();
    const validadeDate = new Date(validade);
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);

    if (validadeDate < now) {
      return "vencido";
    } else if (validadeDate <= ninetyDaysFromNow) {
      return "a_vencer";
    } else {
      return "ativo";
    }
  }

  // Alert operations
  async getAlertConfigs(): Promise<AlertConfig[]> {
    return db.select().from(alertConfigs).orderBy(asc(alertConfigs.tipo), asc(alertConfigs.diasAviso));
  }

  async getActiveAlertConfigs(): Promise<AlertConfig[]> {
    return db.select().from(alertConfigs).where(eq(alertConfigs.ativo, true)).orderBy(asc(alertConfigs.tipo), asc(alertConfigs.diasAviso));
  }

  async createAlertConfig(config: InsertAlertConfig): Promise<AlertConfig> {
    const [created] = await db
      .insert(alertConfigs)
      .values(config)
      .returning();
    return created;
  }

  async createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory> {
    const [created] = await db
      .insert(alertHistory)
      .values(history)
      .returning();
    return created;
  }

  async checkAlertHistory(tipoItem: string, itemId: number, diasAviso: number): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(alertHistory)
      .where(
        and(
          eq(alertHistory.tipoItem, tipoItem),
          eq(alertHistory.itemId, itemId),
          eq(alertHistory.diasAviso, diasAviso),
          eq(alertHistory.status, 'enviado')
        )
      )
      .limit(1);
    
    return !!existing;
  }

  // Notification operations
  async getNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).orderBy(desc(notifications.criadoEm));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set({ lida: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await db
      .update(notifications)
      .set({ lida: true })
      .where(eq(notifications.lida, false));
  }

  async updateNotificationStatus(id: number, status: string, enviadoEm?: Date): Promise<Notification> {
    const updateData: any = { status };
    if (enviadoEm) {
      updateData.enviadoEm = enviadoEm;
    }
    
    const [updated] = await db
      .update(notifications)
      .set(updateData)
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  // Filtered data operations
  async getLicencasByStatus(status: 'ativa' | 'expiring' | 'expired'): Promise<LicencaAmbiental[]> {
    try {
      const hoje = new Date();
      const licencas = await db
        .select()
        .from(licencasAmbientais)
        .orderBy(desc(licencasAmbientais.criadoEm));
      
      return licencas.filter(licenca => {
        if (!licenca.validade) return false;
        const dataVencimento = new Date(licenca.validade);
        const diffTime = dataVencimento.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (status === 'expired') {
          return diffDays < 0;
        } else if (status === 'expiring') {
          return diffDays >= 0 && diffDays <= 90;
        } else { // ativa
          return diffDays > 90;
        }
      });
    } catch (error) {
      console.error('Error getting licenças by status:', error);
      return [];
    }
  }

  async getCondicionantesByStatus(status: 'pendente' | 'cumprida' | 'vencida'): Promise<Condicionante[]> {
    try {
      const hoje = new Date();
      const condicionantes = await db
        .select()
        .from(condicionantes)
        .orderBy(desc(condicionantes.criadoEm));
      
      return condicionantes.filter(condicionante => {
        if (!condicionante.prazo) return false;
        const dataPrazo = new Date(condicionante.prazo);
        const diffTime = dataPrazo.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (status === 'vencida') {
          return diffDays < 0;
        } else if (status === 'cumprida') {
          return condicionante.cumprida;
        } else { // pendente
          return !condicionante.cumprida && diffDays >= 0;
        }
      });
    } catch (error) {
      console.error('Error getting condicionantes by status:', error);
      return [];
    }
  }

  async getEntregasDoMes(): Promise<Entrega[]> {
    try {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      
      const entregas = await db
        .select()
        .from(entregas)
        .orderBy(desc(entregas.criadoEm));
      
      return entregas.filter(entrega => {
        if (!entrega.prazo) return false;
        const dataPrazo = new Date(entrega.prazo);
        return dataPrazo >= inicioMes && dataPrazo <= fimMes;
      });
    } catch (error) {
      console.error('Error getting entregas do mês:', error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
