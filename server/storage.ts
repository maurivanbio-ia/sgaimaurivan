import {
  users,
  empreendimentos,
  licencasAmbientais,
  type User,
  type InsertUser,
  type Empreendimento,
  type InsertEmpreendimento,
  type LicencaAmbiental,
  type InsertLicencaAmbiental,
  type EmpreendimentoWithLicencas,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc } from "drizzle-orm";
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

  // Stats
  getLicenseStats(): Promise<{ active: number; expiring: number; expired: number }>;
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
    const updateData = { ...licenca };
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

  // Stats
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
}

export const storage = new DatabaseStorage();
