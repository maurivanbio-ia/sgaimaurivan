import {
  users,
  empreendimentos,
  licencasAmbientais,
  condicionantes,
  entregas,
  alertConfigs,
  alertHistory,
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

    const licencas = await db
      .select()
      .from(licencasAmbientais)
      .where(eq(licencasAmbientais.empreendimentoId, id))
      .orderBy(desc(licencasAmbientais.criadoEm));

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
    return db.select().from(licencasAmbientais).orderBy(desc(licencasAmbientais.criadoEm));
  }

  async getLicenca(id: number): Promise<LicencaAmbiental | undefined> {
    const [licenca] = await db.select().from(licencasAmbientais).where(eq(licencasAmbientais.id, id));
    return licenca || undefined;
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
    return db.select().from(condicionantes).orderBy(desc(condicionantes.criadoEm));
  }

  async getCondicionante(id: number): Promise<Condicionante | undefined> {
    const [condicionante] = await db.select().from(condicionantes).where(eq(condicionantes.id, id));
    return condicionante || undefined;
  }

  async getCondicionantesByLicenca(licencaId: number): Promise<Condicionante[]> {
    return db
      .select()
      .from(condicionantes)
      .where(eq(condicionantes.licencaId, licencaId))
      .orderBy(asc(condicionantes.prazo));
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
    return db.select().from(entregas).orderBy(desc(entregas.criadoEm));
  }

  async getEntrega(id: number): Promise<Entrega | undefined> {
    const [entrega] = await db.select().from(entregas).where(eq(entregas.id, id));
    return entrega || undefined;
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

  async getAgendaPrazos(): Promise<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; }>> {
    const [licencas, condicionantes, entregas] = await Promise.all([
      this.getLicencas(),
      this.getCondicionantes(),
      this.getEntregas(),
    ]);

    const agenda: Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; }> = [];
    
    // Add licenses with upcoming expiration
    licencas.forEach(licenca => {
      if (licenca.status !== 'ativa') {
        agenda.push({
          tipo: 'Licença',
          titulo: `${licenca.tipo} - ${licenca.orgaoEmissor}`,
          prazo: licenca.validade,
          status: licenca.status,
          id: licenca.id,
        });
      }
    });

    // Add condicionantes
    condicionantes.forEach(condicionante => {
      agenda.push({
        tipo: 'Condicionante',
        titulo: condicionante.descricao,
        prazo: condicionante.prazo,
        status: condicionante.status,
        id: condicionante.id,
      });
    });

    // Add entregas
    entregas.forEach(entrega => {
      agenda.push({
        tipo: 'Entrega',
        titulo: entrega.titulo || entrega.descricao || '',
        prazo: entrega.prazo,
        status: entrega.status,
        id: entrega.id,
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
}

export const storage = new DatabaseStorage();
