import {
  users,
  empreendimentos,
  licencasAmbientais,
  condicionantes,
  entregas,
  alertConfigs,
  alertHistory,
  notifications,
  demandas,
  comentariosDemandas,
  subtarefasDemandas,
  historicoDemandasMovimentacoes,
  categoriasFinanceiras,
  financeiroLancamentos,
  solicitacoesRecursos,
  orcamentos,
  cronogramaItens,
  campanhas,
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
  type Demanda,
  type InsertDemanda,
  type ComentarioDemanda,
  type InsertComentarioDemanda,
  type SubtarefaDemanda,
  type InsertSubtarefaDemanda,
  type HistoricoMovimentacao,
  type InsertHistoricoMovimentacao,
  type CategoriaFinanceira,
  type InsertCategoriaFinanceira,
  type FinanceiroLancamento,
  type InsertFinanceiroLancamento,
  type SolicitacaoRecurso,
  type InsertSolicitacaoRecurso,
  type Orcamento,
  type InsertOrcamento,
  equipamentos,
  type Equipamento,
  type InsertEquipamento,
  veiculos,
  type Veiculo,
  type InsertVeiculo,
  rhRegistros,
  type RhRegistro,
  type InsertRhRegistro,
  contratos,
  contratoAditivos,
  contratoPagamentos,
  type Contrato,
  type InsertContrato,
  datasets,
  type Dataset,
  type InsertDataset,
  colaboradores,
  segDocumentosColaboradores,
  type Colaborador,
  type InsertColaborador,
  type SegDocumentoColaborador,
  type InsertSegDocumento,
  projetos,
  type Projeto,
  type InsertProjeto,
  membrosEquipe,
  tarefas,
  tarefaAtualizacoes,
  registroHoras,
  type MembroEquipe,
  type InsertMembroEquipe,
  type Tarefa,
  type InsertTarefa,
  type TarefaAtualizacao,
  type InsertTarefaAtualizacao,
  type RegistroHoras,
  type InsertRegistroHoras,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, lte, like, or, ilike, ne, sql, isNull } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;

  // Empreendimento operations
  getEmpreendimentos(unidade?: string): Promise<Empreendimento[]>;
  getEmpreendimento(id: number, unidade?: string): Promise<EmpreendimentoWithLicencas | undefined>;
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

  // Enhanced Stats - MULTI-TENANCY: unidade obrigatória
  getLicenseStats(unidade: string, empreendimentoId?: number): Promise<{ active: number; expiring: number; expired: number; proxVencer?: number }>;
  getCondicionanteStats(unidade: string, empreendimentoId?: number): Promise<{ pendentes: number; cumpridas: number; vencidas: number }>;
  getEntregaStats(unidade: string, empreendimentoId?: number): Promise<{ pendentes: number; entregues: number; atrasadas: number }>;
  getEntregasDoMes(): Promise<Entrega[]>;
  getAgendaPrazos(unidade: string, empreendimentoId?: number): Promise<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }>>;
  getMonthlyExpiryData(unidade: string, empreendimentoId?: number): Promise<Array<{ month: string; count: number }>>;
  getLicencasByDateRange(unidade: string, startDate: Date, endDate: Date): Promise<Array<{ id: number; tipo: string; validade: string; empreendimentoNome: string; orgaoEmissor: string; }>>;
  getFrotaStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number }>;
  getEquipamentosStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; disponiveis: number; emUso: number; manutencao: number }>;
  getRhStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; ativos: number; afastados: number }>;
  getDemandasStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; pendentes: number; emAndamento: number; concluidas: number }>;
  getContratosStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; ativos: number; valorTotal: number }>;
  getLicencasByEmpreendimento(empreendimentoId: number): Promise<LicencaAmbiental[]>;

  // Alert operations
  getAlertConfigs(): Promise<AlertConfig[]>;
  getActiveAlertConfigs(): Promise<AlertConfig[]>;
  createAlertConfig(config: InsertAlertConfig): Promise<AlertConfig>;
  updateAlertConfig(id: number, updates: Partial<InsertAlertConfig>): Promise<AlertConfig>;
  createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory>;
  checkAlertHistory(tipoItem: string, itemId: number, diasAviso: number): Promise<boolean>;

  // Notification operations
  getNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(): Promise<void>;
  updateNotificationStatus(id: number, status: string, enviadoEm?: Date): Promise<Notification>;

  // Filtered data operations  
  getLicencasByStatus(status: 'ativa' | 'expiring' | 'expired'): Promise<any[]>;
  getCondicionantesByStatus(status: 'pendente' | 'cumprida' | 'vencida'): Promise<any[]>;
  getEntregasDoMes(): Promise<any[]>;


  // Demandas operations
  getDemandas(filters?: {
    setor?: string;
    responsavel?: string;
    empreendimento?: string;
    prioridade?: string;
    status?: string;
    search?: string;
  }): Promise<Demanda[]>;
  getDemandaById(id: number): Promise<Demanda | undefined>;
  createDemanda(demanda: InsertDemanda): Promise<Demanda>;
  updateDemanda(id: number, updates: Partial<Demanda>): Promise<Demanda | undefined>;
  deleteDemanda(id: number): Promise<boolean>;
  getDemandasChartData(): Promise<{
    statusChart: Array<{ status: string; count: number }>;
    prioridadeChart: Array<{ prioridade: string; count: number }>;
    setorChart: Array<{ setor: string; count: number }>;
    evolucaoChart: Array<{ periodo: string; concluidas: number; novas: number }>;
  }>;
  
  // Histórico de demandas operations
  createHistoricoMovimentacao(historico: InsertHistoricoMovimentacao): Promise<HistoricoMovimentacao>;
  getHistoricoByDemanda(demandaId: number): Promise<HistoricoMovimentacao[]>;
  getAllHistorico(): Promise<Array<HistoricoMovimentacao & { demandaTitulo?: string; usuarioEmail?: string }>>;

  // Financial operations
  getCategorias(): Promise<CategoriaFinanceira[]>;
  createCategoria(categoria: InsertCategoriaFinanceira): Promise<CategoriaFinanceira>;
  updateCategoria(id: number, categoria: Partial<InsertCategoriaFinanceira>): Promise<CategoriaFinanceira>;
  deleteCategoria(id: number): Promise<boolean>;
  
  getLancamentos(filters?: {
    tipo?: string;
    status?: string;
    empreendimentoId?: number;
    categoriaId?: number;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FinanceiroLancamento[]>;
  createLancamento(lancamento: InsertFinanceiroLancamento): Promise<FinanceiroLancamento>;
  updateLancamento(id: number, lancamento: Partial<InsertFinanceiroLancamento>): Promise<FinanceiroLancamento>;
  deleteLancamento(id: number): Promise<boolean>;
  
  getSolicitacoes(filters?: { 
    status?: string; 
    solicitanteId?: number; 
    empreendimentoId?: number; 
  }): Promise<SolicitacaoRecurso[]>;
  createSolicitacao(solicitacao: InsertSolicitacaoRecurso): Promise<SolicitacaoRecurso>;
  updateSolicitacao(id: number, solicitacao: Partial<InsertSolicitacaoRecurso>): Promise<SolicitacaoRecurso>;
  deleteSolicitacao(id: number): Promise<boolean>;
  
  getOrcamentos(filters?: { empreendimentoId?: number; periodo?: string }): Promise<Orcamento[]>;
  createOrcamento(orcamento: InsertOrcamento): Promise<Orcamento>;
  updateOrcamento(id: number, orcamento: Partial<InsertOrcamento>): Promise<Orcamento>;
  deleteOrcamento(id: number): Promise<boolean>;
  
  getFinancialStats(empreendimentoId?: number, startDate?: Date, endDate?: Date): Promise<{
    totalReceitas: number;
    totalDespesas: number;
    totalPendente: number;
    saldoAtual: number;
    porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
    porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
    evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
    empreendimentoNome?: string;
  }>;
  
  getExpenseEvolutionByCategory(empreendimentoId?: number, categoriaId?: number): Promise<{
    categorias: Array<{ id: number; nome: string; tipo: string }>;
    evolucao: Array<{ mes: string; valores: { [categoriaId: number]: number } }>;
  }>;

  // Equipment operations
  getEquipamentos(filters?: {
    tipo?: string;
    status?: string;
    search?: string;
    localizacaoAtual?: string;
    empreendimentoId?: number;
  }): Promise<Equipamento[]>;
  getEquipamentoById(id: number): Promise<Equipamento | undefined>;
  createEquipamento(equipamento: InsertEquipamento): Promise<Equipamento>;
  updateEquipamento(id: number, updates: Partial<InsertEquipamento>): Promise<Equipamento>;
  deleteEquipamento(id: number): Promise<boolean>;

  // Veículos operations
  getVeiculos(filters?: {
    tipo?: string;
    status?: string;
    combustivel?: string;
    search?: string;
    empreendimentoId?: number;
  }): Promise<Veiculo[]>;
  getVeiculoById(id: number): Promise<Veiculo | undefined>;
  createVeiculo(veiculo: InsertVeiculo): Promise<Veiculo>;
  updateVeiculo(id: number, updates: Partial<InsertVeiculo>): Promise<Veiculo>;
  deleteVeiculo(id: number): Promise<boolean>;
  getVeiculosStats(): Promise<{
    total: number;
    disponivel: number;
    em_uso: number;
    manutencao: number;
    indisponivel: number;
  }>;

  // RH operations
  getRhRegistros(filters?: {
    status?: string;
    cargo?: string;
    search?: string;
    empreendimentoId?: number;
  }): Promise<RhRegistro[]>;
  getRhRegistroById(id: number): Promise<RhRegistro | undefined>;
  createRhRegistro(registro: InsertRhRegistro): Promise<RhRegistro>;
  updateRhRegistro(id: number, updates: Partial<InsertRhRegistro>): Promise<RhRegistro>;
  deleteRhRegistro(id: number): Promise<boolean>;

  // Contratos operations - MULTI-TENANCY
  getContratos(filters?: {
    unidade?: string;
    empreendimentoId?: number;
    status?: string;
  }): Promise<Contrato[]>;

  // Datasets operations
  getDatasets(filters?: {
    empreendimentoId?: number;
    tipo?: string;
  }): Promise<Array<Dataset & { empreendimentoNome?: string }>>;
  getDatasetById(id: number): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  deleteDataset(id: number): Promise<boolean>;

  // Segurança do Trabalho operations
  getColaboradores(filters?: {
    empreendimentoId?: number;
    status?: string;
    search?: string;
  }): Promise<Array<Colaborador & { empreendimentoNome?: string }>>;
  getColaboradorById(id: number): Promise<Colaborador | undefined>;
  createColaborador(colaborador: InsertColaborador): Promise<Colaborador>;
  updateColaborador(id: number, updates: Partial<InsertColaborador>): Promise<Colaborador>;
  deleteColaborador(id: number): Promise<boolean>;

  getSegDocumentos(filters?: {
    colaboradorId?: number;
    empreendimentoId?: number;
    status?: string;
    tipoDocumento?: string;
  }): Promise<Array<SegDocumentoColaborador & { colaboradorNome?: string; empreendimentoNome?: string }>>;
  getSegDocumentoById(id: number): Promise<SegDocumentoColaborador | undefined>;
  createSegDocumento(documento: InsertSegDocumento): Promise<SegDocumentoColaborador>;
  updateSegDocumento(id: number, updates: Partial<InsertSegDocumento>): Promise<SegDocumentoColaborador>;
  deleteSegDocumento(id: number): Promise<boolean>;

  getSegurancaIndicadores(empreendimentoId?: number): Promise<{
    totalDocumentos: number;
    documentosValidos: number;
    documentosVencidos: number;
    documentosAVencer: number;
    percentualConformidade: number;
    colaboradoresConformes: number;
    totalColaboradores: number;
  }>;

  // Projetos operations
  getProjetos(empreendimentoId?: number): Promise<Projeto[]>;
  getProjetoById(id: number): Promise<Projeto | undefined>;
  createProjeto(projeto: InsertProjeto): Promise<Projeto>;
  updateProjeto(id: number, projeto: Partial<InsertProjeto>): Promise<Projeto>;
  deleteProjeto(id: number): Promise<boolean>;
  getProjetosByUnidade(unidade: string): Promise<Projeto[]>;

  // ========== GESTÃO DE EQUIPE ==========
  getMembrosEquipe(filters?: {
    unidade?: string;
    coordenadorId?: number;
    ativo?: boolean;
  }): Promise<MembroEquipe[]>;
  getMembroEquipeById(id: number): Promise<MembroEquipe | undefined>;
  getMembroEquipeByUserId(userId: number): Promise<MembroEquipe | undefined>;
  createMembroEquipe(membro: InsertMembroEquipe): Promise<MembroEquipe>;
  updateMembroEquipe(id: number, updates: Partial<InsertMembroEquipe>): Promise<MembroEquipe>;
  deleteMembroEquipe(id: number): Promise<boolean>;
  getEquipeDoCoordenador(coordenadorId: number): Promise<MembroEquipe[]>;

  // ========== TAREFAS ==========
  getTarefas(filters?: {
    unidade?: string;
    responsavelId?: number;
    criadoPor?: number;
    status?: string;
    prioridade?: string;
    categoria?: string;
    empreendimentoId?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<Tarefa[]>;
  getTarefaById(id: number): Promise<Tarefa | undefined>;
  createTarefa(tarefa: InsertTarefa): Promise<Tarefa>;
  updateTarefa(id: number, updates: Partial<InsertTarefa>): Promise<Tarefa>;
  deleteTarefa(id: number): Promise<boolean>;
  getTarefasDoDia(responsavelId: number, data?: string): Promise<Tarefa[]>;
  getTarefasAtrasadas(responsavelId?: number, unidade?: string): Promise<Tarefa[]>;
  getEstatisticasTarefas(filters?: {
    unidade?: string;
    responsavelId?: number;
    criadoPor?: number;
  }): Promise<{
    total: number;
    pendentes: number;
    emAndamento: number;
    concluidas: number;
    atrasadas: number;
    porCategoria: Array<{ categoria: string; count: number }>;
  }>;

  // ========== ATUALIZAÇÕES DE TAREFAS ==========
  getAtualizacoesTarefa(tarefaId: number): Promise<TarefaAtualizacao[]>;
  createAtualizacaoTarefa(atualizacao: InsertTarefaAtualizacao): Promise<TarefaAtualizacao>;

  // ========== REGISTRO DE HORAS ==========
  getRegistrosHoras(filters?: {
    tarefaId?: number;
    colaboradorId?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<RegistroHoras[]>;
  createRegistroHoras(registro: InsertRegistroHoras): Promise<RegistroHoras>;
  aprovarRegistroHoras(id: number, aprovadoPor: number): Promise<RegistroHoras>;
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
  async getEmpreendimentos(unidade?: string): Promise<Empreendimento[]> {
    if (unidade) {
      return db.select().from(empreendimentos).where(
        and(
          eq(empreendimentos.unidade, unidade),
          isNull(empreendimentos.deletedAt)
        )
      ).orderBy(desc(empreendimentos.criadoEm));
    }
    return db.select().from(empreendimentos).where(isNull(empreendimentos.deletedAt)).orderBy(desc(empreendimentos.criadoEm));
  }

  async getEmpreendimento(id: number, unidade?: string): Promise<EmpreendimentoWithLicencas | undefined> {
    const conditions = [eq(empreendimentos.id, id), isNull(empreendimentos.deletedAt)];
    if (unidade) {
      conditions.push(eq(empreendimentos.unidade, unidade));
    }
    
    const [empreendimento] = await db.select().from(empreendimentos).where(and(...conditions));
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
    // Envolve toda a exclusão em cascata em uma transação para garantir atomicidade
    await db.transaction(async (tx) => {
      // Primeiro busca todas as licenças do empreendimento
      const licencasDoEmpreendimento = await tx
        .select({ id: licencasAmbientais.id })
        .from(licencasAmbientais)
        .where(eq(licencasAmbientais.empreendimentoId, id));
      
      // Para cada licença, delete condicionantes e entregas associadas
      for (const licenca of licencasDoEmpreendimento) {
        await tx.delete(condicionantes).where(eq(condicionantes.licencaId, licenca.id));
        await tx.delete(entregas).where(eq(entregas.licencaId, licenca.id));
      }
      
      // Delete todas as licenças do empreendimento
      await tx.delete(licencasAmbientais).where(eq(licencasAmbientais.empreendimentoId, id));
      
      // Delete colaboradores e seus documentos associados ao empreendimento
      const colaboradoresDoEmp = await tx
        .select({ id: colaboradores.id })
        .from(colaboradores)
        .where(eq(colaboradores.empreendimentoId, id));
      
      for (const colab of colaboradoresDoEmp) {
        await tx.delete(segDocumentosColaboradores).where(eq(segDocumentosColaboradores.colaboradorId, colab.id));
      }
      await tx.delete(colaboradores).where(eq(colaboradores.empreendimentoId, id));
      
      // Delete datasets associados ao empreendimento
      await tx.delete(datasets).where(eq(datasets.empreendimentoId, id));
      
      // Delete equipamentos associados ao empreendimento
      await tx.delete(equipamentos).where(eq(equipamentos.empreendimentoId, id));
      
      // Delete demandas associadas ao empreendimento
      const demandasDoEmp = await tx
        .select({ id: demandas.id })
        .from(demandas)
        .where(eq(demandas.empreendimentoId, id));
      
      for (const demanda of demandasDoEmp) {
        await tx.delete(comentariosDemandas).where(eq(comentariosDemandas.demandaId, demanda.id));
        await tx.delete(subtarefasDemandas).where(eq(subtarefasDemandas.demandaId, demanda.id));
        await tx.delete(historicoDemandasMovimentacoes).where(eq(historicoDemandasMovimentacoes.demandaId, demanda.id));
      }
      await tx.delete(demandas).where(eq(demandas.empreendimentoId, id));
      
      // Delete lançamentos financeiros associados ao empreendimento
      await tx.delete(financeiroLancamentos).where(eq(financeiroLancamentos.empreendimentoId, id));
      
      // Delete solicitações de recursos associadas ao empreendimento
      await tx.delete(solicitacoesRecursos).where(eq(solicitacoesRecursos.empreendimentoId, id));
      
      // Delete orçamentos associados ao empreendimento
      await tx.delete(orcamentos).where(eq(orcamentos.empreendimentoId, id));
      
      // Delete cronograma itens associados ao empreendimento
      await tx.delete(cronogramaItens).where(eq(cronogramaItens.empreendimentoId, id));
      
      // Delete campanhas associadas ao empreendimento
      await tx.delete(campanhas).where(eq(campanhas.empreendimentoId, id));
      
      // Delete projetos associados ao empreendimento
      await tx.delete(projetos).where(eq(projetos.empreendimentoId, id));
      
      // Delete contratos e suas dependências
      const contratosDoEmp = await tx
        .select({ id: contratos.id })
        .from(contratos)
        .where(eq(contratos.empreendimentoId, id));
      
      for (const contrato of contratosDoEmp) {
        await tx.delete(contratoAditivos).where(eq(contratoAditivos.contratoId, contrato.id));
        await tx.delete(contratoPagamentos).where(eq(contratoPagamentos.contratoId, contrato.id));
      }
      await tx.delete(contratos).where(eq(contratos.empreendimentoId, id));
      
      // Delete veículos associados ao empreendimento
      await tx.delete(veiculos).where(eq(veiculos.empreendimentoId, id));
      
      // Delete RH registros associados ao empreendimento
      await tx.delete(rhRegistros).where(eq(rhRegistros.empreendimentoId, id));
      
      // Finalmente delete o empreendimento
      await tx.delete(empreendimentos).where(eq(empreendimentos.id, id));
    });
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
    // Exclusão em cascata: primeiro delete condicionantes e entregas associadas
    await db.delete(condicionantes).where(eq(condicionantes.licencaId, id));
    await db.delete(entregas).where(eq(entregas.licencaId, id));
    
    // Depois delete a licença
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

  // Enhanced Stats - MULTI-TENANCY
  async getLicenseStats(unidade: string, empreendimentoId?: number): Promise<{ active: number; expiring: number; expired: number; proxVencer?: number }> {
    // Busca empreendimentos da unidade
    const emps = await db.select().from(empreendimentos).where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    // Se nenhum empreendimento da unidade, retorna zeros
    if (empIds.length === 0) {
      return { active: 0, expiring: 0, expired: 0, proxVencer: 0 };
    }
    
    // Busca licenças dos empreendimentos da unidade
    const licencas = empreendimentoId 
      ? await this.getLicencasByEmpreendimento(empreendimentoId)
      : await db.select().from(licencasAmbientais).where(sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
    
    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(now.getDate() + 90);
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(now.getDate() + 60);

    let active = 0;
    let expiring = 0;
    let expired = 0;
    let proxVencer = 0;

    licencas.forEach(licenca => {
      const validadeDate = new Date(licenca.validade);
      
      if (validadeDate < now) {
        expired++;
      } else if (validadeDate <= ninetyDaysFromNow) {
        expiring++;
        if (validadeDate <= sixtyDaysFromNow) {
          proxVencer++;
        }
      } else {
        active++;
      }
    });

    return { active, expiring, expired, proxVencer };
  }

  async getCondicionanteStats(unidade: string, empreendimentoId?: number): Promise<{ pendentes: number; cumpridas: number; vencidas: number }> {
    const emps = await db.select().from(empreendimentos).where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    if (empIds.length === 0) {
      return { pendentes: 0, cumpridas: 0, vencidas: 0 };
    }
    
    const allCondicionantes = await this.getCondicionantes();
    const licencas = await db.select().from(licencasAmbientais).where(sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
    const licencaIds = licencas.map(l => l.id);
    
    const condicionantesFiltradas = allCondicionantes.filter(c => licencaIds.includes(c.licencaId));
    
    return {
      pendentes: condicionantesFiltradas.filter(c => c.status === 'pendente').length,
      cumpridas: condicionantesFiltradas.filter(c => c.status === 'cumprida').length,
      vencidas: condicionantesFiltradas.filter(c => c.status === 'vencida').length,
    };
  }

  async getEntregaStats(unidade: string, empreendimentoId?: number): Promise<{ pendentes: number; entregues: number; atrasadas: number }> {
    const emps = await db.select().from(empreendimentos).where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    if (empIds.length === 0) {
      return { pendentes: 0, entregues: 0, atrasadas: 0 };
    }
    
    const allEntregas = await this.getEntregas();
    const licencas = await db.select().from(licencasAmbientais).where(sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
    const licencaIds = licencas.map(l => l.id);
    
    const entregasFiltradas = allEntregas.filter(e => licencaIds.includes(e.licencaId));
    
    return {
      pendentes: entregasFiltradas.filter(e => e.status === 'pendente').length,
      entregues: entregasFiltradas.filter(e => e.status === 'entregue').length,
      atrasadas: entregasFiltradas.filter(e => e.status === 'atrasada').length,
    };
  }

  async getMonthlyExpiryData(unidade: string, empreendimentoId?: number): Promise<Array<{ month: string; count: number }>> {
    const emps = await db.select().from(empreendimentos).where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    if (empIds.length === 0) {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const now = new Date();
      return monthNames.slice(now.getMonth()).concat(monthNames.slice(0, now.getMonth())).map(m => ({ month: m, count: 0 }));
    }
    
    const licencas = empreendimentoId 
      ? await this.getLicencasByEmpreendimento(empreendimentoId)
      : await db.select().from(licencasAmbientais).where(sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const monthlyData: Array<{ month: string; count: number }> = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(currentYear, now.getMonth() + i, 1);
      const monthName = monthNames[targetDate.getMonth()];
      const year = targetDate.getFullYear();
      
      const count = licencas.filter((licenca: any) => {
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


  async getAgendaPrazos(unidade: string, empreendimentoId?: number): Promise<Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }>> {
    const empsData = await this.getEmpreendimentos(unidade);
    const empIds = empsData.map(e => e.id);
    
    if (empIds.length === 0) {
      return [];
    }
    
    const allLicencas = await db.select().from(licencasAmbientais).where(sql`${licencasAmbientais.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
    const licencaIds = allLicencas.map(l => l.id);
    
    const allCondicionantes = await this.getCondicionantes();
    const allEntregas = await this.getEntregas();
    
    const licencas = allLicencas.map(l => ({ ...l, status: this.calculateLicenseStatus(l.validade) }));
    const condicionantesFiltradas = allCondicionantes.filter(c => licencaIds.includes(c.licencaId));
    const entregasFiltradas = allEntregas.filter(e => licencaIds.includes(e.licencaId));

    const agenda: Array<{ tipo: string; titulo: string; prazo: string; status: string; id: number; empreendimento?: string; orgaoEmissor?: string; }> = [];
    
    // Add licenses with upcoming expiration
    licencas.forEach(licenca => {
      if (licenca.status !== 'ativa') {
        const emp = empsData.find(e => e.id === licenca.empreendimentoId);
        agenda.push({
          tipo: 'Licença',
          titulo: `${licenca.tipo} - ${licenca.orgaoEmissor}`,
          prazo: licenca.validade,
          status: licenca.status,
          id: licenca.id,
          empreendimento: emp?.nome,
          orgaoEmissor: licenca.orgaoEmissor,
        });
      }
    });

    // Add condicionantes
    condicionantesFiltradas.forEach(condicionante => {
      const licenca = licencas.find(l => l.id === condicionante.licencaId);
      const emp = licenca ? empsData.find(e => e.id === licenca.empreendimentoId) : undefined;
      agenda.push({
        tipo: 'Condicionante',
        titulo: condicionante.descricao,
        prazo: condicionante.prazo,
        status: condicionante.status,
        id: condicionante.id,
        empreendimento: emp?.nome,
        orgaoEmissor: licenca?.orgaoEmissor,
      });
    });

    // Add entregas
    entregasFiltradas.forEach(entrega => {
      const licenca = licencas.find(l => l.id === entrega.licencaId);
      const emp = licenca ? empsData.find(e => e.id === licenca.empreendimentoId) : undefined;
      agenda.push({
        tipo: 'Entrega',
        titulo: entrega.titulo || entrega.descricao || '',
        prazo: entrega.prazo,
        status: entrega.status,
        id: entrega.id,
        empreendimento: emp?.nome,
      });
    });

    // Sort by prazo (closest first)
    return agenda.sort((a, b) => new Date(a.prazo).getTime() - new Date(b.prazo).getTime());
  }

  async getFrotaStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number }> {
    const veiculos = await this.getVeiculos(empreendimentoId ? { empreendimentoId, unidade } : { unidade });
    return {
      total: veiculos.length,
      disponiveis: veiculos.filter(v => v.status === 'disponivel').length,
      emUso: veiculos.filter(v => v.status === 'em_uso').length,
      manutencao: veiculos.filter(v => v.status === 'manutencao').length,
      alugados: veiculos.filter(v => (v as any).tipoPropriedade === 'alugado').length,
    };
  }

  async getEquipamentosStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; disponiveis: number; emUso: number; manutencao: number }> {
    const equipamentos = await this.getEquipamentos({ unidade, empreendimentoId });
    return {
      total: equipamentos.length,
      disponiveis: equipamentos.filter(e => e.status === 'disponivel').length,
      emUso: equipamentos.filter(e => e.status === 'em_uso').length,
      manutencao: equipamentos.filter(e => e.status === 'manutencao').length,
    };
  }

  async getRhStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; ativos: number; afastados: number }> {
    const rh = await this.getRhRegistros({ empreendimentoId, unidade });
    return {
      total: rh.length,
      ativos: rh.filter((r: any) => r.situacao === 'ativo').length,
      afastados: rh.filter((r: any) => r.situacao === 'afastado').length,
    };
  }

  async getDemandasStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; pendentes: number; emAndamento: number; concluidas: number }> {
    // Busca empreendimentos da unidade
    const emps = await db.select().from(empreendimentos).where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    if (empIds.length === 0) {
      return { total: 0, pendentes: 0, emAndamento: 0, concluidas: 0 };
    }
    
    const filters = empreendimentoId ? { empreendimento: empreendimentoId.toString() } : {};
    const allDemandas = await this.getDemandas(filters);
    
    // Filtra apenas demandas de empreendimentos da unidade
    const demandas = allDemandas.filter(d => {
      const empId = parseInt(d.empreendimento || '0');
      return empIds.includes(empId);
    });
    
    return {
      total: demandas.length,
      pendentes: demandas.filter(d => d.status === 'backlog' || d.status === 'a_fazer').length,
      emAndamento: demandas.filter(d => d.status === 'em_andamento' || d.status === 'em_revisao').length,
      concluidas: demandas.filter(d => d.status === 'concluida').length,
    };
  }

  async getContratosStats(unidade: string, empreendimentoId?: number): Promise<{ total: number; ativos: number; valorTotal: number }> {
    const contratos = await this.getContratos({ empreendimentoId, unidade });
    const ativos = contratos.filter(c => !c.deletedAt);
    const valorTotal = ativos.reduce((sum, c) => sum + (parseFloat(c.valorTotal || '0')), 0);
    return {
      total: contratos.length,
      ativos: ativos.length,
      valorTotal: Math.round(valorTotal * 100) / 100,
    };
  }

  async getLicencasByEmpreendimento(empreendimentoId: number): Promise<LicencaAmbiental[]> {
    const licencas = await db.select().from(licencasAmbientais)
      .where(eq(licencasAmbientais.empreendimentoId, empreendimentoId))
      .orderBy(desc(licencasAmbientais.criadoEm));
    return licencas.map(licenca => ({
      ...licenca,
      status: this.calculateLicenseStatus(licenca.validade)
    }));
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

  async updateAlertConfig(id: number, updates: Partial<InsertAlertConfig>): Promise<AlertConfig> {
    const [updated] = await db
      .update(alertConfigs)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(eq(alertConfigs.id, id))
      .returning();
    return updated;
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
  async getLicencasByStatus(status: 'ativa' | 'expiring' | 'expired'): Promise<any[]> {
    try {
      const hoje = new Date();
      const licencas = await db
        .select({
          id: licencasAmbientais.id,
          tipo: licencasAmbientais.tipo,
          orgaoEmissor: licencasAmbientais.orgaoEmissor,
          dataEmissao: licencasAmbientais.dataEmissao,
          validade: licencasAmbientais.validade,
          status: licencasAmbientais.status,
          arquivoPdf: licencasAmbientais.arquivoPdf,
          empreendimentoId: licencasAmbientais.empreendimentoId,
          criadoEm: licencasAmbientais.criadoEm,
          // Dados do empreendimento
          empreendimentoNome: empreendimentos.nome,
          empreendimentoCliente: empreendimentos.cliente,
          empreendimentoClienteEmail: empreendimentos.clienteEmail,
          empreendimentoClienteTelefone: empreendimentos.clienteTelefone,
          empreendimentoLocalizacao: empreendimentos.localizacao,
        })
        .from(licencasAmbientais)
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
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

  async getCondicionantesByStatus(status: 'pendente' | 'cumprida' | 'vencida'): Promise<any[]> {
    try {
      const hoje = new Date();
      const condicionantesList = await db
        .select({
          id: condicionantes.id,
          descricao: condicionantes.descricao,
          prazo: condicionantes.prazo,
          status: condicionantes.status,
          observacoes: condicionantes.observacoes,
          licencaId: condicionantes.licencaId,
          criadoEm: condicionantes.criadoEm,
          atualizadoEm: condicionantes.atualizadoEm,
          // Dados da licença
          licencaTipo: licencasAmbientais.tipo,
          licencaOrgaoEmissor: licencasAmbientais.orgaoEmissor,
          licencaValidade: licencasAmbientais.validade,
          // Dados do empreendimento
          empreendimentoNome: empreendimentos.nome,
          empreendimentoCliente: empreendimentos.cliente,
          empreendimentoClienteEmail: empreendimentos.clienteEmail,
          empreendimentoClienteTelefone: empreendimentos.clienteTelefone,
          empreendimentoLocalizacao: empreendimentos.localizacao,
        })
        .from(condicionantes)
        .leftJoin(licencasAmbientais, eq(condicionantes.licencaId, licencasAmbientais.id))
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
        .orderBy(desc(condicionantes.criadoEm));
      
      return condicionantesList.filter(condicionante => {
        if (!condicionante.prazo) return false;
        const dataPrazo = new Date(condicionante.prazo);
        const diffTime = dataPrazo.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (status === 'vencida') {
          return condicionante.status === 'vencida' || (condicionante.status === 'pendente' && diffDays < 0);
        } else if (status === 'cumprida') {
          return condicionante.status === 'cumprida';
        } else { // pendente
          return condicionante.status === 'pendente' && diffDays >= 0;
        }
      });
    } catch (error) {
      console.error('Error getting condicionantes by status:', error);
      return [];
    }
  }

  async getEntregasDoMes(): Promise<any[]> {
    try {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      
      const entregasList = await db
        .select({
          id: entregas.id,
          titulo: entregas.titulo,
          descricao: entregas.descricao,
          prazo: entregas.prazo,
          status: entregas.status,
          arquivoPdf: entregas.arquivoPdf,
          licencaId: entregas.licencaId,
          criadoEm: entregas.criadoEm,
          atualizadoEm: entregas.atualizadoEm,
          // Dados da licença
          licencaTipo: licencasAmbientais.tipo,
          licencaOrgaoEmissor: licencasAmbientais.orgaoEmissor,
          licencaValidade: licencasAmbientais.validade,
          // Dados do empreendimento
          empreendimentoNome: empreendimentos.nome,
          empreendimentoCliente: empreendimentos.cliente,
          empreendimentoClienteEmail: empreendimentos.clienteEmail,
          empreendimentoClienteTelefone: empreendimentos.clienteTelefone,
          empreendimentoLocalizacao: empreendimentos.localizacao,
        })
        .from(entregas)
        .leftJoin(licencasAmbientais, eq(entregas.licencaId, licencasAmbientais.id))
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
        .orderBy(desc(entregas.criadoEm));
      
      return entregasList.filter(entrega => {
        if (!entrega.prazo) return false;
        const dataPrazo = new Date(entrega.prazo);
        return dataPrazo >= inicioMes && dataPrazo <= fimMes;
      });
    } catch (error) {
      console.error('Error getting entregas do mês:', error);
      return [];
    }
  }

  async getLicencasByDateRange(unidade: string, startDate: Date, endDate: Date): Promise<Array<{ id: number; tipo: string; validade: string; empreendimentoNome: string; orgaoEmissor: string; }>> {
    try {
      const licencas = await db
        .select({
          id: licencasAmbientais.id,
          tipo: licencasAmbientais.tipo,
          validade: licencasAmbientais.validade,
          orgaoEmissor: licencasAmbientais.orgaoEmissor,
          empreendimentoNome: empreendimentos.nome,
          unidade: empreendimentos.unidade,
        })
        .from(licencasAmbientais)
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
        .where(
          and(
            eq(empreendimentos.unidade, unidade),
            gte(licencasAmbientais.validade, startDate.toISOString()),
            lte(licencasAmbientais.validade, endDate.toISOString())
          )
        )
        .orderBy(asc(licencasAmbientais.validade));
      
      return licencas.filter(licenca => licenca.validade !== null).map(licenca => ({
        id: licenca.id,
        tipo: licenca.tipo,
        validade: licenca.validade!,
        empreendimentoNome: licenca.empreendimentoNome || '',
        orgaoEmissor: licenca.orgaoEmissor || '',
      }));
    } catch (error) {
      console.error('Error getting licenças by date range:', error);
      return [];
    }
  }



  // Demandas operations
  async getDemandas(filters?: {
    setor?: string;
    responsavel?: string;
    empreendimento?: string;
    prioridade?: string;
    status?: string;
    search?: string;
  }): Promise<Demanda[]> {
    let query = db.select().from(demandas);
    const conditions = [];
    
    if (filters?.setor && filters.setor !== "todos") {
      conditions.push(eq(demandas.setor, filters.setor));
    }
    
    if (filters?.prioridade && filters.prioridade !== "todas") {
      conditions.push(eq(demandas.prioridade, filters.prioridade));
    }
    
    if (filters?.status) {
      conditions.push(eq(demandas.status, filters.status));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(demandas.titulo, `%${filters.search}%`),
          ilike(demandas.descricao, `%${filters.search}%`),
          ilike(demandas.setor, `%${filters.search}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(demandas.criadoEm));
  }

  async getDemandaById(id: number): Promise<Demanda | undefined> {
    const [demanda] = await db.select().from(demandas).where(eq(demandas.id, id));
    return demanda || undefined;
  }

  async createDemanda(demanda: InsertDemanda): Promise<Demanda> {
    const [created] = await db.insert(demandas).values(demanda).returning();
    return created;
  }

  async updateDemanda(id: number, updates: Partial<Demanda>): Promise<Demanda | undefined> {
    const [updated] = await db
      .update(demandas)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(eq(demandas.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDemanda(id: number): Promise<boolean> {
    const result = await db.delete(demandas).where(eq(demandas.id, id));
    return (result.rowCount || 0) > 0;
  }

  async createHistoricoMovimentacao(historico: InsertHistoricoMovimentacao): Promise<HistoricoMovimentacao> {
    const [created] = await db.insert(historicoDemandasMovimentacoes).values(historico).returning();
    return created;
  }

  async getHistoricoByDemanda(demandaId: number): Promise<HistoricoMovimentacao[]> {
    return await db
      .select()
      .from(historicoDemandasMovimentacoes)
      .where(eq(historicoDemandasMovimentacoes.demandaId, demandaId))
      .orderBy(desc(historicoDemandasMovimentacoes.criadoEm));
  }

  async getDemandasByDateRange(unidade: string, startDate: Date, endDate: Date): Promise<Demanda[]> {
    return await db
      .select()
      .from(demandas)
      .where(
        and(
          eq(demandas.unidade, unidade),
          gte(demandas.dataEntrega, startDate.toISOString().split('T')[0]),
          lte(demandas.dataEntrega, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(demandas.dataEntrega);
  }

  async getAllHistorico(): Promise<Array<HistoricoMovimentacao & { demandaTitulo?: string; usuarioEmail?: string }>> {
    const historico = await db
      .select({
        id: historicoDemandasMovimentacoes.id,
        demandaId: historicoDemandasMovimentacoes.demandaId,
        usuarioId: historicoDemandasMovimentacoes.usuarioId,
        acao: historicoDemandasMovimentacoes.acao,
        statusAnterior: historicoDemandasMovimentacoes.statusAnterior,
        statusNovo: historicoDemandasMovimentacoes.statusNovo,
        descricao: historicoDemandasMovimentacoes.descricao,
        criadoEm: historicoDemandasMovimentacoes.criadoEm,
        demandaTitulo: demandas.titulo,
        usuarioEmail: users.email,
      })
      .from(historicoDemandasMovimentacoes)
      .leftJoin(demandas, eq(historicoDemandasMovimentacoes.demandaId, demandas.id))
      .leftJoin(users, eq(historicoDemandasMovimentacoes.usuarioId, users.id))
      .orderBy(desc(historicoDemandasMovimentacoes.criadoEm));
    
    return historico;
  }

  async getDemandasStats(): Promise<{
    total: number;
    concluidas: number;
    emAndamento: number;
    atrasadas: number;
    porSetor: Array<{ setor: string; count: number }>;
  }> {
    const today = new Date();
    
    // Get all demandas for processing
    const allDemandas = await db.select().from(demandas);
    
    const total = allDemandas.length;
    const concluidas = allDemandas.filter(d => d.status === "concluido").length;
    const emAndamento = allDemandas.filter(d => d.status === "em_andamento").length;
    const atrasadas = allDemandas.filter(d => 
      d.status !== "concluido" && 
      d.status !== "cancelado" && 
      new Date(d.dataEntrega) < today
    ).length;
    
    // Count by setor
    const setorMap = new Map<string, number>();
    allDemandas.forEach(d => {
      setorMap.set(d.setor, (setorMap.get(d.setor) || 0) + 1);
    });
    
    const porSetor = Array.from(setorMap.entries()).map(([setor, count]) => ({ setor, count }));
    
    return {
      total,
      concluidas,
      emAndamento,
      atrasadas,
      porSetor,
    };
  }

  async getDemandasChartData(): Promise<{
    statusChart: Array<{ status: string; count: number }>;
    prioridadeChart: Array<{ prioridade: string; count: number }>;
    setorChart: Array<{ setor: string; count: number }>;
    evolucaoChart: Array<{ periodo: string; concluidas: number; novas: number }>;
  }> {
    const allDemandas = await db.select().from(demandas);
    
    // Status chart
    const statusMap = new Map<string, number>();
    allDemandas.forEach(d => {
      statusMap.set(d.status, (statusMap.get(d.status) || 0) + 1);
    });
    const statusChart = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
    
    // Priority chart
    const prioridadeMap = new Map<string, number>();
    allDemandas.forEach(d => {
      prioridadeMap.set(d.prioridade, (prioridadeMap.get(d.prioridade) || 0) + 1);
    });
    const prioridadeChart = Array.from(prioridadeMap.entries()).map(([prioridade, count]) => ({ prioridade, count }));
    
    // Setor chart (top 10)
    const setorMap = new Map<string, number>();
    allDemandas.forEach(d => {
      setorMap.set(d.setor, (setorMap.get(d.setor) || 0) + 1);
    });
    const setorChart = Array.from(setorMap.entries())
      .map(([setor, count]) => ({ setor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Evolution chart (last 6 months)
    const evolucaoChart: Array<{ periodo: string; concluidas: number; novas: number }> = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const concluidas = allDemandas.filter(d => 
        d.dataConclusao && 
        new Date(d.dataConclusao) >= date && 
        new Date(d.dataConclusao) < nextDate
      ).length;
      
      const novas = allDemandas.filter(d => 
        new Date(d.criadoEm) >= date && 
        new Date(d.criadoEm) < nextDate
      ).length;
      
      evolucaoChart.push({
        periodo: date.toLocaleDateString('pt-BR', { month: 'short' }),
        concluidas,
        novas
      });
    }
    
    return {
      statusChart,
      prioridadeChart,
      setorChart,
      evolucaoChart,
    };
  }

  // =============================================
  // FINANCIAL OPERATIONS
  // =============================================

  // Categoria operations
  async getCategorias(): Promise<CategoriaFinanceira[]> {
    return await db.select().from(categoriasFinanceiras).orderBy(asc(categoriasFinanceiras.nome));
  }

  async createCategoria(categoria: InsertCategoriaFinanceira): Promise<CategoriaFinanceira> {
    const [newCategoria] = await db.insert(categoriasFinanceiras).values(categoria).returning();
    return newCategoria;
  }

  async updateCategoria(id: number, categoria: Partial<InsertCategoriaFinanceira>): Promise<CategoriaFinanceira> {
    const [updated] = await db
      .update(categoriasFinanceiras)
      .set(categoria)
      .where(eq(categoriasFinanceiras.id, id))
      .returning();
    return updated;
  }

  async deleteCategoria(id: number): Promise<boolean> {
    const result = await db.delete(categoriasFinanceiras).where(eq(categoriasFinanceiras.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Lancamento operations
  async getLancamentos(filters?: {
    tipo?: string;
    status?: string;
    empreendimentoId?: number;
    categoriaId?: number;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FinanceiroLancamento[]> {
    const conditions = [];

    if (filters?.tipo && filters.tipo !== 'todos') {
      conditions.push(eq(financeiroLancamentos.tipo, filters.tipo));
    }
    if (filters?.status && filters.status !== 'todos') {
      conditions.push(eq(financeiroLancamentos.status, filters.status));
    }
    if (filters?.empreendimentoId) {
      conditions.push(eq(financeiroLancamentos.empreendimentoId, filters.empreendimentoId));
    }
    if (filters?.categoriaId) {
      conditions.push(eq(financeiroLancamentos.categoriaId, filters.categoriaId));
    }
    if (filters?.search) {
      conditions.push(ilike(financeiroLancamentos.descricao, `%${filters.search}%`));
    }

    let query = db.select().from(financeiroLancamentos);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(financeiroLancamentos.data));
  }

  async createLancamento(lancamento: InsertFinanceiroLancamento): Promise<FinanceiroLancamento> {
    const [newLancamento] = await db.insert(financeiroLancamentos).values(lancamento).returning();
    return newLancamento;
  }

  async updateLancamento(id: number, lancamento: Partial<InsertFinanceiroLancamento>): Promise<FinanceiroLancamento> {
    const [updated] = await db
      .update(financeiroLancamentos)
      .set({
        ...lancamento,
        atualizadoEm: new Date(),
      })
      .where(eq(financeiroLancamentos.id, id))
      .returning();
    return updated;
  }

  async deleteLancamento(id: number): Promise<boolean> {
    const result = await db.delete(financeiroLancamentos).where(eq(financeiroLancamentos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Solicitacao operations
  async getSolicitacoes(filters?: { 
    status?: string; 
    solicitanteId?: number; 
    empreendimentoId?: number; 
  }): Promise<SolicitacaoRecurso[]> {
    const conditions = [];

    if (filters?.status && filters.status !== 'todos') {
      conditions.push(eq(solicitacoesRecursos.status, filters.status));
    }
    if (filters?.solicitanteId) {
      conditions.push(eq(solicitacoesRecursos.solicitanteId, filters.solicitanteId));
    }
    if (filters?.empreendimentoId) {
      conditions.push(eq(solicitacoesRecursos.empreendimentoId, filters.empreendimentoId));
    }

    let query = db.select().from(solicitacoesRecursos);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(solicitacoesRecursos.criadoEm));
  }

  async createSolicitacao(solicitacao: InsertSolicitacaoRecurso): Promise<SolicitacaoRecurso> {
    const [newSolicitacao] = await db.insert(solicitacoesRecursos).values(solicitacao).returning();
    return newSolicitacao;
  }

  async updateSolicitacao(id: number, solicitacao: Partial<InsertSolicitacaoRecurso>): Promise<SolicitacaoRecurso> {
    const [updated] = await db
      .update(solicitacoesRecursos)
      .set(solicitacao)
      .where(eq(solicitacoesRecursos.id, id))
      .returning();
    return updated;
  }

  async deleteSolicitacao(id: number): Promise<boolean> {
    const result = await db.delete(solicitacoesRecursos).where(eq(solicitacoesRecursos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Orcamento operations
  async getOrcamentos(filters?: { empreendimentoId?: number; periodo?: string }): Promise<Orcamento[]> {
    const conditions = [];

    if (filters?.empreendimentoId) {
      conditions.push(eq(orcamentos.empreendimentoId, filters.empreendimentoId));
    }
    if (filters?.periodo) {
      conditions.push(eq(orcamentos.periodo, filters.periodo));
    }

    let query = db.select().from(orcamentos);
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.orderBy(desc(orcamentos.criadoEm));
  }

  async createOrcamento(orcamento: InsertOrcamento): Promise<Orcamento> {
    const [newOrcamento] = await db.insert(orcamentos).values(orcamento).returning();
    return newOrcamento;
  }

  async updateOrcamento(id: number, orcamento: Partial<InsertOrcamento>): Promise<Orcamento> {
    const [updated] = await db
      .update(orcamentos)
      .set({
        ...orcamento,
        atualizadoEm: new Date(),
      })
      .where(eq(orcamentos.id, id))
      .returning();
    return updated;
  }

  async deleteOrcamento(id: number): Promise<boolean> {
    const result = await db.delete(orcamentos).where(eq(orcamentos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Financial statistics
  async getFinancialStats(empreendimentoId?: number, startDate?: Date, endDate?: Date): Promise<{
    totalReceitas: number;
    totalDespesas: number;
    totalPendente: number;
    saldoAtual: number;
    porCategoria: Array<{ categoria: string; valor: number; tipo: string }>;
    porEmpreendimento: Array<{ empreendimento: string; empreendimentoId: number; receitas: number; despesas: number; lucro: number }>;
    evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }>;
    empreendimentoNome?: string;
  }> {
    // Get transactions (filtered by empreendimentoId if provided)
    let allLancamentos = await db.select().from(financeiroLancamentos);
    
    // Apply empreendimento filter if specified
    let lancamentos = empreendimentoId 
      ? allLancamentos.filter(l => l.empreendimentoId === empreendimentoId)
      : allLancamentos;
    
    // Apply date range filter if specified
    if (startDate || endDate) {
      lancamentos = lancamentos.filter(l => {
        const lDate = new Date(l.data);
        if (startDate && lDate < startDate) return false;
        if (endDate && lDate > endDate) return false;
        return true;
      });
    }
    
    // Get empreendimento name if filtering
    let empreendimentoNome: string | undefined;
    if (empreendimentoId) {
      const emp = await db.select().from(empreendimentos).where(eq(empreendimentos.id, empreendimentoId)).limit(1);
      empreendimentoNome = emp[0]?.nome;
    }
    
    const totalReceitas = lancamentos
      .filter(l => l.tipo === "receita" && l.status === "pago")
      .reduce((sum, l) => sum + Number(l.valor), 0);

    const totalDespesas = lancamentos
      .filter(l => l.tipo === "despesa" && l.status === "pago")
      .reduce((sum, l) => sum + Number(l.valor), 0);

    const totalPendente = lancamentos
      .filter(l => l.status === "aguardando")
      .reduce((sum, l) => sum + Number(l.valor), 0);

    const saldoAtual = totalReceitas - totalDespesas;

    // Get categories and empreendimentos for breakdown
    const categorias = await db.select().from(categoriasFinanceiras);
    const empreendimentosList = await db.select().from(empreendimentos);

    const porCategoria = categorias.map(cat => {
      const valor = lancamentos
        .filter(l => l.categoriaId === cat.id && l.status === "pago")
        .reduce((sum, l) => sum + Number(l.valor), 0);
      return { categoria: cat.nome, valor, tipo: cat.tipo };
    }).filter(item => item.valor > 0);

    // Per empreendimento with receitas, despesas and lucro
    const porEmpreendimento = empreendimentosList.map(emp => {
      const empLancamentos = lancamentos.filter(l => l.empreendimentoId === emp.id && l.status === "pago");
      const receitas = empLancamentos
        .filter(l => l.tipo === "receita")
        .reduce((sum, l) => sum + Number(l.valor), 0);
      const despesas = empLancamentos
        .filter(l => l.tipo === "despesa")
        .reduce((sum, l) => sum + Number(l.valor), 0);
      return { 
        empreendimento: emp.nome, 
        empreendimentoId: emp.id,
        receitas, 
        despesas, 
        lucro: receitas - despesas 
      };
    }).filter(item => item.receitas > 0 || item.despesas > 0);

    // Monthly evolution (last 12 months)
    const now = new Date();
    const evolucaoMensal: Array<{ mes: string; receitas: number; despesas: number; lucro: number }> = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const mesLancamentos = lancamentos.filter(l => {
        const lDate = new Date(l.data);
        return lDate.getMonth() === date.getMonth() && 
               lDate.getFullYear() === date.getFullYear() &&
               l.status === "pago";
      });
      
      const receitas = mesLancamentos
        .filter(l => l.tipo === "receita")
        .reduce((sum, l) => sum + Number(l.valor), 0);
      const despesas = mesLancamentos
        .filter(l => l.tipo === "despesa")
        .reduce((sum, l) => sum + Number(l.valor), 0);
      
      evolucaoMensal.push({
        mes: mesLabel,
        receitas,
        despesas,
        lucro: receitas - despesas
      });
    }

    return {
      totalReceitas,
      totalDespesas,
      totalPendente,
      saldoAtual,
      porCategoria,
      porEmpreendimento,
      evolucaoMensal,
      empreendimentoNome,
    };
  }

  async getExpenseEvolutionByCategory(empreendimentoId?: number, categoriaId?: number): Promise<{
    categorias: Array<{ id: number; nome: string; tipo: string }>;
    evolucao: Array<{
      mes: string;
      valores: { [categoriaId: number]: number };
    }>;
  }> {
    let allLancamentos = await db.select().from(financeiroLancamentos);
    
    // Apply empreendimento filter if specified
    let lancamentos = empreendimentoId 
      ? allLancamentos.filter(l => l.empreendimentoId === empreendimentoId)
      : allLancamentos;
    
    // Only include paid expenses
    lancamentos = lancamentos.filter(l => l.tipo === "despesa" && l.status === "pago");
    
    // Apply category filter if specified
    if (categoriaId) {
      lancamentos = lancamentos.filter(l => l.categoriaId === categoriaId);
    }
    
    // Get all expense categories
    const todasCategorias = await db.select().from(categoriasFinanceiras);
    const despesaCategorias = todasCategorias.filter(c => c.tipo === "despesa");
    
    // Monthly evolution (last 12 months)
    const now = new Date();
    const evolucao: Array<{ mes: string; valores: { [categoriaId: number]: number } }> = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      
      const mesLancamentos = lancamentos.filter(l => {
        const lDate = new Date(l.data);
        return lDate.getMonth() === date.getMonth() && 
               lDate.getFullYear() === date.getFullYear();
      });
      
      const valores: { [categoriaId: number]: number } = {};
      
      // Calculate value for each category
      for (const cat of despesaCategorias) {
        const catValor = mesLancamentos
          .filter(l => l.categoriaId === cat.id)
          .reduce((sum, l) => sum + Number(l.valor), 0);
        if (catValor > 0 || categoriaId === cat.id) {
          valores[cat.id] = catValor;
        }
      }
      
      evolucao.push({ mes: mesLabel, valores });
    }
    
    return {
      categorias: despesaCategorias.map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
      evolucao
    };
  }

  // Equipment operations
  async getEquipamentos(filters?: {
    tipo?: string;
    status?: string;
    search?: string;
    localizacaoAtual?: string;
    empreendimentoId?: number;
  }): Promise<Equipamento[]> {
    let query = db.select().from(equipamentos).$dynamic();

    if (filters) {
      const conditions = [];

      if (filters.tipo) {
        conditions.push(eq(equipamentos.tipo, filters.tipo));
      }

      if (filters.status) {
        conditions.push(eq(equipamentos.status, filters.status));
      }

      if (filters.localizacaoAtual) {
        conditions.push(eq(equipamentos.localizacaoAtual, filters.localizacaoAtual));
      }

      if (filters.empreendimentoId) {
        conditions.push(eq(equipamentos.empreendimentoId, filters.empreendimentoId));
      }

      if (filters.search) {
        conditions.push(
          or(
            ilike(equipamentos.nome, `%${filters.search}%`),
            ilike(equipamentos.marca, `%${filters.search}%`),
            ilike(equipamentos.modelo, `%${filters.search}%`),
            ilike(equipamentos.numeroPatrimonio, `%${filters.search}%`)
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return query.orderBy(desc(equipamentos.criadoEm));
  }

  async getEquipamentoById(id: number): Promise<Equipamento | undefined> {
    const [equipamento] = await db
      .select()
      .from(equipamentos)
      .where(eq(equipamentos.id, id));
    return equipamento || undefined;
  }

  async createEquipamento(equipamento: InsertEquipamento): Promise<Equipamento> {
    const [newEquipamento] = await db
      .insert(equipamentos)
      .values(equipamento)
      .returning();
    return newEquipamento;
  }

  async updateEquipamento(id: number, updates: Partial<InsertEquipamento>): Promise<Equipamento> {
    const [updated] = await db
      .update(equipamentos)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(equipamentos.id, id))
      .returning();
    return updated;
  }

  async deleteEquipamento(id: number): Promise<boolean> {
    const result = await db.delete(equipamentos).where(eq(equipamentos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Veículos operations
  async getVeiculos(filters?: {
    tipo?: string;
    status?: string;
    combustivel?: string;
    search?: string;
    empreendimentoId?: number;
  }): Promise<Veiculo[]> {
    let query = db.select().from(veiculos).$dynamic();

    if (filters) {
      const conditions = [];

      if (filters.tipo) {
        conditions.push(eq(veiculos.tipo, filters.tipo));
      }

      if (filters.status) {
        conditions.push(eq(veiculos.status, filters.status));
      }

      if (filters.combustivel) {
        conditions.push(eq(veiculos.combustivel, filters.combustivel));
      }

      if (filters.empreendimentoId) {
        conditions.push(eq(veiculos.empreendimentoId, filters.empreendimentoId));
      }

      if (filters.search) {
        conditions.push(
          or(
            ilike(veiculos.placa, `%${filters.search}%`),
            ilike(veiculos.marca, `%${filters.search}%`),
            ilike(veiculos.modelo, `%${filters.search}%`)
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return query.orderBy(desc(veiculos.criadoEm));
  }

  async getVeiculoById(id: number): Promise<Veiculo | undefined> {
    const [veiculo] = await db
      .select()
      .from(veiculos)
      .where(eq(veiculos.id, id));
    return veiculo || undefined;
  }

  async createVeiculo(veiculo: InsertVeiculo): Promise<Veiculo> {
    const [newVeiculo] = await db
      .insert(veiculos)
      .values(veiculo)
      .returning();
    return newVeiculo;
  }

  async updateVeiculo(id: number, updates: Partial<InsertVeiculo>): Promise<Veiculo> {
    const [updated] = await db
      .update(veiculos)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(veiculos.id, id))
      .returning();
    return updated;
  }

  async deleteVeiculo(id: number): Promise<boolean> {
    const result = await db.delete(veiculos).where(eq(veiculos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getVeiculosStats(): Promise<{
    total: number;
    disponivel: number;
    em_uso: number;
    manutencao: number;
    indisponivel: number;
  }> {
    const allVeiculos = await db.select().from(veiculos);

    const disponivel = allVeiculos.filter(v => v.status === "disponivel").length;
    const em_uso = allVeiculos.filter(v => v.status === "em_uso").length;
    const manutencao = allVeiculos.filter(v => v.status === "manutencao").length;
    const indisponivel = allVeiculos.filter(v => v.status === "indisponivel").length;

    return {
      total: allVeiculos.length,
      disponivel,
      em_uso,
      manutencao,
      indisponivel,
    };
  }

  // RH operations
  async getRhRegistros(filters?: {
    status?: string;
    cargo?: string;
    search?: string;
    empreendimentoId?: number;
  }): Promise<RhRegistro[]> {
    let query = db.select().from(rhRegistros).$dynamic();

    if (filters) {
      const conditions = [];

      if (filters.status) {
        conditions.push(eq(rhRegistros.status, filters.status));
      }

      if (filters.cargo) {
        conditions.push(eq(rhRegistros.cargo, filters.cargo));
      }

      if (filters.empreendimentoId) {
        conditions.push(eq(rhRegistros.empreendimentoId, filters.empreendimentoId));
      }

      if (filters.search) {
        conditions.push(
          or(
            ilike(rhRegistros.nome, `%${filters.search}%`),
            ilike(rhRegistros.cpf, `%${filters.search}%`)
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return query.orderBy(desc(rhRegistros.criadoEm));
  }

  async getRhRegistroById(id: number): Promise<RhRegistro | undefined> {
    const [registro] = await db
      .select()
      .from(rhRegistros)
      .where(eq(rhRegistros.id, id));
    return registro || undefined;
  }

  async createRhRegistro(registro: InsertRhRegistro): Promise<RhRegistro> {
    const [newRegistro] = await db
      .insert(rhRegistros)
      .values(registro)
      .returning();
    return newRegistro;
  }

  async updateRhRegistro(id: number, updates: Partial<InsertRhRegistro>): Promise<RhRegistro> {
    const [updated] = await db
      .update(rhRegistros)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(rhRegistros.id, id))
      .returning();
    return updated;
  }

  async deleteRhRegistro(id: number): Promise<boolean> {
    const result = await db.delete(rhRegistros).where(eq(rhRegistros.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Contratos operations - MULTI-TENANCY
  async getContratos(filters?: {
    unidade?: string;
    empreendimentoId?: number;
    status?: string;
  }): Promise<Contrato[]> {
    let query = db.select().from(contratos).$dynamic();

    if (filters) {
      const conditions = [];

      if (filters.unidade) {
        // Busca empreendimentos da unidade
        const emps = await db.select().from(empreendimentos).where(eq(empreendimentos.unidade, filters.unidade));
        const empIds = emps.map(e => e.id);
        
        if (empIds.length > 0) {
          conditions.push(sql`${contratos.empreendimentoId} IN (${sql.join(empIds.map(id => sql`${id}`), sql`, `)})`);
        } else {
          // Nenhum empreendimento da unidade, retorna vazio
          return [];
        }
      }

      if (filters.empreendimentoId) {
        conditions.push(eq(contratos.empreendimentoId, filters.empreendimentoId));
      }

      if (filters.status) {
        conditions.push(eq(contratos.status, filters.status));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return query.orderBy(desc(contratos.criadoEm));
  }

  // Datasets operations
  async getDatasets(filters?: {
    empreendimentoId?: number;
    tipo?: string;
  }): Promise<Array<Dataset & { empreendimentoNome?: string }>> {
    const result = await db
      .select({
        id: datasets.id,
        empreendimentoId: datasets.empreendimentoId,
        nome: datasets.nome,
        descricao: datasets.descricao,
        tipo: datasets.tipo,
        tamanho: datasets.tamanho,
        usuario: datasets.usuario,
        dataUpload: datasets.dataUpload,
        url: datasets.url,
        criadoEm: datasets.criadoEm,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(datasets)
      .leftJoin(empreendimentos, eq(datasets.empreendimentoId, empreendimentos.id))
      .where(
        and(
          filters?.empreendimentoId ? eq(datasets.empreendimentoId, filters.empreendimentoId) : undefined,
          filters?.tipo ? eq(datasets.tipo, filters.tipo) : undefined
        )
      )
      .orderBy(desc(datasets.dataUpload));

    return result as Array<Dataset & { empreendimentoNome?: string }>;
  }

  async getDatasetById(id: number): Promise<Dataset | undefined> {
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id));
    return dataset || undefined;
  }

  async createDataset(dataset: InsertDataset): Promise<Dataset> {
    const [newDataset] = await db
      .insert(datasets)
      .values(dataset)
      .returning();
    return newDataset;
  }

  async deleteDataset(id: number): Promise<boolean> {
    const result = await db.delete(datasets).where(eq(datasets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Segurança do Trabalho operations
  async getColaboradores(filters?: {
    empreendimentoId?: number;
    status?: string;
    search?: string;
  }): Promise<Array<Colaborador & { empreendimentoNome?: string }>> {
    const result = await db
      .select({
        id: colaboradores.id,
        nome: colaboradores.nome,
        cpf: colaboradores.cpf,
        cargo: colaboradores.cargo,
        setor: colaboradores.setor,
        empreendimentoId: colaboradores.empreendimentoId,
        dataAdmissao: colaboradores.dataAdmissao,
        status: colaboradores.status,
        email: colaboradores.email,
        telefone: colaboradores.telefone,
        criadoEm: colaboradores.criadoEm,
        atualizadoEm: colaboradores.atualizadoEm,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(colaboradores)
      .leftJoin(empreendimentos, eq(colaboradores.empreendimentoId, empreendimentos.id))
      .where(
        and(
          filters?.empreendimentoId ? eq(colaboradores.empreendimentoId, filters.empreendimentoId) : undefined,
          filters?.status ? eq(colaboradores.status, filters.status) : undefined,
          filters?.search ? or(
            ilike(colaboradores.nome, `%${filters.search}%`),
            ilike(colaboradores.cpf, `%${filters.search}%`)
          ) : undefined
        )
      )
      .orderBy(desc(colaboradores.criadoEm));

    return result as Array<Colaborador & { empreendimentoNome?: string }>;
  }

  async getColaboradorById(id: number): Promise<Colaborador | undefined> {
    const [colaborador] = await db
      .select()
      .from(colaboradores)
      .where(eq(colaboradores.id, id));
    return colaborador || undefined;
  }

  async createColaborador(colaborador: InsertColaborador): Promise<Colaborador> {
    const [newColaborador] = await db
      .insert(colaboradores)
      .values(colaborador)
      .returning();
    return newColaborador;
  }

  async updateColaborador(id: number, updates: Partial<InsertColaborador>): Promise<Colaborador> {
    const [updated] = await db
      .update(colaboradores)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(colaboradores.id, id))
      .returning();
    return updated;
  }

  async deleteColaborador(id: number): Promise<boolean> {
    const result = await db.delete(colaboradores).where(eq(colaboradores.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getSegDocumentos(filters?: {
    colaboradorId?: number;
    empreendimentoId?: number;
    status?: string;
    tipoDocumento?: string;
  }): Promise<Array<SegDocumentoColaborador & { colaboradorNome?: string; empreendimentoNome?: string }>> {
    const result = await db
      .select({
        id: segDocumentosColaboradores.id,
        colaboradorId: segDocumentosColaboradores.colaboradorId,
        empreendimentoId: segDocumentosColaboradores.empreendimentoId,
        tipoDocumento: segDocumentosColaboradores.tipoDocumento,
        descricao: segDocumentosColaboradores.descricao,
        arquivoUrl: segDocumentosColaboradores.arquivoUrl,
        dataEmissao: segDocumentosColaboradores.dataEmissao,
        dataValidade: segDocumentosColaboradores.dataValidade,
        assinaturaResponsavel: segDocumentosColaboradores.assinaturaResponsavel,
        status: segDocumentosColaboradores.status,
        criadoEm: segDocumentosColaboradores.criadoEm,
        atualizadoEm: segDocumentosColaboradores.atualizadoEm,
        colaboradorNome: colaboradores.nome,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(segDocumentosColaboradores)
      .leftJoin(colaboradores, eq(segDocumentosColaboradores.colaboradorId, colaboradores.id))
      .leftJoin(empreendimentos, eq(segDocumentosColaboradores.empreendimentoId, empreendimentos.id))
      .where(
        and(
          filters?.colaboradorId ? eq(segDocumentosColaboradores.colaboradorId, filters.colaboradorId) : undefined,
          filters?.empreendimentoId ? eq(segDocumentosColaboradores.empreendimentoId, filters.empreendimentoId) : undefined,
          filters?.status ? eq(segDocumentosColaboradores.status, filters.status) : undefined,
          filters?.tipoDocumento ? eq(segDocumentosColaboradores.tipoDocumento, filters.tipoDocumento) : undefined
        )
      )
      .orderBy(desc(segDocumentosColaboradores.criadoEm));

    return result as Array<SegDocumentoColaborador & { colaboradorNome?: string; empreendimentoNome?: string }>;
  }

  async getSegDocumentoById(id: number): Promise<SegDocumentoColaborador | undefined> {
    const [documento] = await db
      .select()
      .from(segDocumentosColaboradores)
      .where(eq(segDocumentosColaboradores.id, id));
    return documento || undefined;
  }

  async createSegDocumento(documento: InsertSegDocumento): Promise<SegDocumentoColaborador> {
    const [newDocumento] = await db
      .insert(segDocumentosColaboradores)
      .values(documento)
      .returning();
    return newDocumento;
  }

  async updateSegDocumento(id: number, updates: Partial<InsertSegDocumento>): Promise<SegDocumentoColaborador> {
    const [updated] = await db
      .update(segDocumentosColaboradores)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(segDocumentosColaboradores.id, id))
      .returning();
    return updated;
  }

  async deleteSegDocumento(id: number): Promise<boolean> {
    const result = await db.delete(segDocumentosColaboradores).where(eq(segDocumentosColaboradores.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getSegurancaIndicadores(empreendimentoId?: number): Promise<{
    totalDocumentos: number;
    documentosValidos: number;
    documentosVencidos: number;
    documentosAVencer: number;
    percentualConformidade: number;
    colaboradoresConformes: number;
    totalColaboradores: number;
  }> {
    const hoje = new Date().toISOString().split('T')[0];
    const em30Dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let queryDocumentos = db.select().from(segDocumentosColaboradores).$dynamic();
    let queryColaboradores = db.select().from(colaboradores).$dynamic();

    if (empreendimentoId) {
      queryDocumentos = queryDocumentos.where(eq(segDocumentosColaboradores.empreendimentoId, empreendimentoId));
      queryColaboradores = queryColaboradores.where(eq(colaboradores.empreendimentoId, empreendimentoId));
    }

    const documentos = await queryDocumentos;
    const colaboradoresAtivos = await queryColaboradores.where(eq(colaboradores.status, 'ativo'));

    const totalDocumentos = documentos.length;
    const documentosValidos = documentos.filter(d => d.status === 'valido').length;
    const documentosVencidos = documentos.filter(d => 
      d.dataValidade && d.dataValidade < hoje
    ).length;
    const documentosAVencer = documentos.filter(d => 
      d.dataValidade && d.dataValidade >= hoje && d.dataValidade <= em30Dias
    ).length;

    const percentualConformidade = totalDocumentos > 0 
      ? Math.round((documentosValidos / totalDocumentos) * 100) 
      : 0;

    const colaboradoresConformes = colaboradoresAtivos.filter(c => {
      const docsColaborador = documentos.filter(d => d.colaboradorId === c.id);
      return docsColaborador.length > 0 && docsColaborador.every(d => d.status === 'valido');
    }).length;

    return {
      totalDocumentos,
      documentosValidos,
      documentosVencidos,
      documentosAVencer,
      percentualConformidade,
      colaboradoresConformes,
      totalColaboradores: colaboradoresAtivos.length,
    };
  }

  // Projetos operations
  async getProjetos(empreendimentoId?: number): Promise<Projeto[]> {
    if (empreendimentoId) {
      return db.select()
        .from(projetos)
        .where(eq(projetos.empreendimentoId, empreendimentoId))
        .orderBy(desc(projetos.criadoEm));
    }
    return db.select().from(projetos).orderBy(desc(projetos.criadoEm));
  }

  async getProjetoById(id: number): Promise<Projeto | undefined> {
    const [projeto] = await db
      .select()
      .from(projetos)
      .where(eq(projetos.id, id));
    return projeto || undefined;
  }

  async createProjeto(projeto: InsertProjeto): Promise<Projeto> {
    const [newProjeto] = await db
      .insert(projetos)
      .values(projeto)
      .returning();
    return newProjeto;
  }

  async updateProjeto(id: number, updates: Partial<InsertProjeto>): Promise<Projeto> {
    const [updated] = await db
      .update(projetos)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(projetos.id, id))
      .returning();
    return updated;
  }

  async deleteProjeto(id: number): Promise<boolean> {
    const result = await db.delete(projetos).where(eq(projetos.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getProjetosByUnidade(unidade: string): Promise<Projeto[]> {
    const result = await db
      .select({
        id: projetos.id,
        empreendimentoId: projetos.empreendimentoId,
        nome: projetos.nome,
        descricao: projetos.descricao,
        status: projetos.status,
        coordenadorId: projetos.coordenadorId,
        valorContratado: projetos.valorContratado,
        valorRecebido: projetos.valorRecebido,
        orcamentoPrevisto: projetos.orcamentoPrevisto,
        metaReducaoGastos: projetos.metaReducaoGastos,
        inicioPrevisto: projetos.inicioPrevisto,
        inicioReal: projetos.inicioReal,
        fimPrevisto: projetos.fimPrevisto,
        fimReal: projetos.fimReal,
        bmmServicos: projetos.bmmServicos,
        ndReembolsaveis: projetos.ndReembolsaveis,
        criadoEm: projetos.criadoEm,
        atualizadoEm: projetos.atualizadoEm,
      })
      .from(projetos)
      .innerJoin(empreendimentos, eq(projetos.empreendimentoId, empreendimentos.id))
      .where(eq(empreendimentos.unidade, unidade))
      .orderBy(desc(projetos.criadoEm));
    return result;
  }

  // ========== GESTÃO DE EQUIPE ==========
  async getMembrosEquipe(filters?: {
    unidade?: string;
    coordenadorId?: number;
    ativo?: boolean;
  }): Promise<MembroEquipe[]> {
    let query = db.select().from(membrosEquipe).$dynamic();
    const conditions: any[] = [];

    if (filters?.unidade) {
      conditions.push(eq(membrosEquipe.unidade, filters.unidade));
    }
    if (filters?.coordenadorId) {
      conditions.push(eq(membrosEquipe.coordenadorId, filters.coordenadorId));
    }
    if (filters?.ativo !== undefined) {
      conditions.push(eq(membrosEquipe.ativo, filters.ativo));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(asc(membrosEquipe.nome));
  }

  async getMembroEquipeById(id: number): Promise<MembroEquipe | undefined> {
    const [membro] = await db
      .select()
      .from(membrosEquipe)
      .where(eq(membrosEquipe.id, id));
    return membro || undefined;
  }

  async getMembroEquipeByUserId(userId: number): Promise<MembroEquipe | undefined> {
    const [membro] = await db
      .select()
      .from(membrosEquipe)
      .where(eq(membrosEquipe.userId, userId));
    return membro || undefined;
  }

  async createMembroEquipe(membro: InsertMembroEquipe): Promise<MembroEquipe> {
    const [newMembro] = await db
      .insert(membrosEquipe)
      .values(membro)
      .returning();
    return newMembro;
  }

  async updateMembroEquipe(id: number, updates: Partial<InsertMembroEquipe>): Promise<MembroEquipe> {
    const [updated] = await db
      .update(membrosEquipe)
      .set({
        ...updates,
        atualizadoEm: new Date(),
      })
      .where(eq(membrosEquipe.id, id))
      .returning();
    return updated;
  }

  async deleteMembroEquipe(id: number): Promise<boolean> {
    const result = await db.delete(membrosEquipe).where(eq(membrosEquipe.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getEquipeDoCoordenador(coordenadorId: number): Promise<MembroEquipe[]> {
    return db
      .select()
      .from(membrosEquipe)
      .where(
        and(
          eq(membrosEquipe.coordenadorId, coordenadorId),
          eq(membrosEquipe.ativo, true)
        )
      )
      .orderBy(asc(membrosEquipe.nome));
  }

  // ========== TAREFAS ==========
  async getTarefas(filters?: {
    unidade?: string;
    responsavelId?: number;
    criadoPor?: number;
    status?: string;
    prioridade?: string;
    categoria?: string;
    empreendimentoId?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<Tarefa[]> {
    let query = db.select().from(tarefas).$dynamic();
    const conditions: any[] = [];

    if (filters?.unidade) {
      conditions.push(eq(tarefas.unidade, filters.unidade));
    }
    if (filters?.responsavelId) {
      conditions.push(eq(tarefas.responsavelId, filters.responsavelId));
    }
    if (filters?.criadoPor) {
      conditions.push(eq(tarefas.criadoPor, filters.criadoPor));
    }
    if (filters?.status) {
      conditions.push(eq(tarefas.status, filters.status));
    }
    if (filters?.prioridade) {
      conditions.push(eq(tarefas.prioridade, filters.prioridade));
    }
    if (filters?.categoria) {
      conditions.push(eq(tarefas.categoria, filters.categoria));
    }
    if (filters?.empreendimentoId) {
      conditions.push(eq(tarefas.empreendimentoId, filters.empreendimentoId));
    }
    if (filters?.dataInicio) {
      conditions.push(gte(tarefas.dataFim, filters.dataInicio));
    }
    if (filters?.dataFim) {
      conditions.push(lte(tarefas.dataInicio, filters.dataFim));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(tarefas.criadoEm));
  }

  async getTarefaById(id: number): Promise<Tarefa | undefined> {
    const [tarefa] = await db
      .select()
      .from(tarefas)
      .where(eq(tarefas.id, id));
    return tarefa || undefined;
  }

  async createTarefa(tarefa: InsertTarefa): Promise<Tarefa> {
    const [newTarefa] = await db
      .insert(tarefas)
      .values(tarefa)
      .returning();
    return newTarefa;
  }

  async updateTarefa(id: number, updates: Partial<InsertTarefa>): Promise<Tarefa> {
    const updateData: any = {
      ...updates,
      atualizadoEm: new Date(),
    };

    if (updates.status === 'em_andamento' && !updates.iniciadaEm) {
      updateData.iniciadaEm = new Date();
    }
    if (updates.status === 'concluida' && !updates.concluidaEm) {
      updateData.concluidaEm = new Date();
    }

    const [updated] = await db
      .update(tarefas)
      .set(updateData)
      .where(eq(tarefas.id, id))
      .returning();
    return updated;
  }

  async deleteTarefa(id: number): Promise<boolean> {
    const result = await db.delete(tarefas).where(eq(tarefas.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTarefasDoDia(responsavelId: number, data?: string): Promise<Tarefa[]> {
    const hoje = data || new Date().toISOString().split('T')[0];
    return db
      .select()
      .from(tarefas)
      .where(
        and(
          eq(tarefas.responsavelId, responsavelId),
          lte(tarefas.dataInicio, hoje),
          gte(tarefas.dataFim, hoje),
          ne(tarefas.status, 'concluida'),
          ne(tarefas.status, 'cancelada')
        )
      )
      .orderBy(asc(tarefas.prioridade));
  }

  async getTarefasAtrasadas(responsavelId?: number, unidade?: string): Promise<Tarefa[]> {
    const hoje = new Date().toISOString().split('T')[0];
    const conditions: any[] = [
      lte(tarefas.dataFim, hoje),
      ne(tarefas.status, 'concluida'),
      ne(tarefas.status, 'cancelada')
    ];

    if (responsavelId) {
      conditions.push(eq(tarefas.responsavelId, responsavelId));
    }
    if (unidade) {
      conditions.push(eq(tarefas.unidade, unidade));
    }

    return db
      .select()
      .from(tarefas)
      .where(and(...conditions))
      .orderBy(asc(tarefas.dataFim));
  }

  async getEstatisticasTarefas(filters?: {
    unidade?: string;
    responsavelId?: number;
    criadoPor?: number;
  }): Promise<{
    total: number;
    pendentes: number;
    emAndamento: number;
    concluidas: number;
    atrasadas: number;
    porCategoria: Array<{ categoria: string; count: number }>;
  }> {
    const conditions: any[] = [];

    if (filters?.unidade) {
      conditions.push(eq(tarefas.unidade, filters.unidade));
    }
    if (filters?.responsavelId) {
      conditions.push(eq(tarefas.responsavelId, filters.responsavelId));
    }
    if (filters?.criadoPor) {
      conditions.push(eq(tarefas.criadoPor, filters.criadoPor));
    }

    let query = db.select().from(tarefas).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const todasTarefas = await query;
    const hoje = new Date().toISOString().split('T')[0];

    const total = todasTarefas.length;
    const pendentes = todasTarefas.filter(t => t.status === 'pendente').length;
    const emAndamento = todasTarefas.filter(t => t.status === 'em_andamento').length;
    const concluidas = todasTarefas.filter(t => t.status === 'concluida').length;
    const atrasadas = todasTarefas.filter(t => 
      t.dataFim < hoje && t.status !== 'concluida' && t.status !== 'cancelada'
    ).length;

    const categoriaMap = new Map<string, number>();
    todasTarefas.forEach(t => {
      categoriaMap.set(t.categoria, (categoriaMap.get(t.categoria) || 0) + 1);
    });

    const porCategoria = Array.from(categoriaMap.entries()).map(([categoria, count]) => ({
      categoria,
      count,
    }));

    return {
      total,
      pendentes,
      emAndamento,
      concluidas,
      atrasadas,
      porCategoria,
    };
  }

  // ========== ATUALIZAÇÕES DE TAREFAS ==========
  async getAtualizacoesTarefa(tarefaId: number): Promise<TarefaAtualizacao[]> {
    return db
      .select()
      .from(tarefaAtualizacoes)
      .where(eq(tarefaAtualizacoes.tarefaId, tarefaId))
      .orderBy(desc(tarefaAtualizacoes.criadoEm));
  }

  async createAtualizacaoTarefa(atualizacao: InsertTarefaAtualizacao): Promise<TarefaAtualizacao> {
    const [newAtualizacao] = await db
      .insert(tarefaAtualizacoes)
      .values(atualizacao)
      .returning();
    return newAtualizacao;
  }

  // ========== REGISTRO DE HORAS ==========
  async getRegistrosHoras(filters?: {
    tarefaId?: number;
    colaboradorId?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<RegistroHoras[]> {
    let query = db.select().from(registroHoras).$dynamic();
    const conditions: any[] = [];

    if (filters?.tarefaId) {
      conditions.push(eq(registroHoras.tarefaId, filters.tarefaId));
    }
    if (filters?.colaboradorId) {
      conditions.push(eq(registroHoras.colaboradorId, filters.colaboradorId));
    }
    if (filters?.dataInicio) {
      conditions.push(gte(registroHoras.data, filters.dataInicio));
    }
    if (filters?.dataFim) {
      conditions.push(lte(registroHoras.data, filters.dataFim));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(registroHoras.data));
  }

  async createRegistroHoras(registro: InsertRegistroHoras): Promise<RegistroHoras> {
    const [newRegistro] = await db
      .insert(registroHoras)
      .values(registro)
      .returning();
    return newRegistro;
  }

  async aprovarRegistroHoras(id: number, aprovadoPor: number): Promise<RegistroHoras> {
    const [updated] = await db
      .update(registroHoras)
      .set({
        aprovado: true,
        aprovadoPor,
        aprovadoEm: new Date(),
      })
      .where(eq(registroHoras.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
