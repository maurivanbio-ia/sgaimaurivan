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
  datasetVersoes,
  datasetAuditTrail,
  datasetPastas,
  type Dataset,
  type InsertDataset,
  type DatasetPasta,
  type InsertDatasetPasta,
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
  membrosEmpreendimentos,
  membrosProjetos,
  tarefas,
  tarefaAtualizacoes,
  registroHoras,
  type MembroEquipe,
  type InsertMembroEquipe,
  type MembroEmpreendimento,
  type MembroProjeto,
  type Tarefa,
  type InsertTarefa,
  type TarefaAtualizacao,
  type InsertTarefaAtualizacao,
  type RegistroHoras,
  type InsertRegistroHoras,
  pedidosReembolso,
  historicoReembolso,
  type PedidoReembolso,
  type InsertPedidoReembolso,
  type HistoricoReembolso,
  type InsertHistoricoReembolso,
  propostasComerciais,
  propostaItens,
  type PropostaComercial,
  type InsertPropostaComercial,
  type PropostaItem,
  type InsertPropostaItem,
  amostras,
  type Amostra,
  type InsertAmostra,
  fornecedores,
  type Fornecedor,
  type InsertFornecedor,
  treinamentos,
  treinamentoParticipantes,
  type Treinamento,
  type InsertTreinamento,
  type TreinamentoParticipante,
  type InsertTreinamentoParticipante,
  baseConhecimento,
  type BaseConhecimento,
  type InsertBaseConhecimento,
  camadasGeoespaciais,
  type CamadaGeoespacial,
  type InsertCamadaGeoespacial,
  programasSst,
  asosOcupacionais,
  catAcidentes,
  ddsRegistros,
  investigacoesIncidentes,
  type ProgramaSst,
  type InsertProgramaSst,
  type AsoOcupacional,
  type InsertAsoOcupacional,
  type CatAcidente,
  type InsertCatAcidente,
  type DdsRegistro,
  type InsertDdsRegistro,
  type InvestigacaoIncidente,
  type InsertInvestigacaoIncidente,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, gte, lte, like, or, ilike, ne, sql, isNull, inArray } from "drizzle-orm";
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
  getDemandasByResponsavel(userId: number, unidade: string): Promise<Demanda[]>;
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
    unidade?: string;
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
    unidade?: string;
    pastaId?: number;
  }): Promise<Array<Dataset & { empreendimentoNome?: string }>>;
  getDatasetById(id: number): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  updateDataset(id: number, updates: Partial<InsertDataset>): Promise<Dataset>;
  deleteDataset(id: number): Promise<boolean>;
  getDatasetsByPasta(pastaId: number, unidade: string): Promise<Dataset[]>;

  // DatasetPastas operations (folder management)
  getDatasetPastas(unidade: string): Promise<DatasetPasta[]>;
  getDatasetPastaById(id: number): Promise<DatasetPasta | undefined>;
  createDatasetPasta(pasta: InsertDatasetPasta): Promise<DatasetPasta>;
  updateDatasetPasta(id: number, updates: Partial<InsertDatasetPasta>): Promise<DatasetPasta>;
  deleteDatasetPasta(id: number): Promise<boolean>;
  getSubpastas(paiId: number): Promise<DatasetPasta[]>;

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

  // SST Avançado - Programas SST
  getProgramasSst(filters?: {
    empreendimentoId?: number;
    tipo?: string;
    status?: string;
    unidade?: string;
  }): Promise<Array<ProgramaSst & { empreendimentoNome?: string }>>;
  getProgramaSstById(id: number): Promise<ProgramaSst | undefined>;
  createProgramaSst(programa: InsertProgramaSst): Promise<ProgramaSst>;
  updateProgramaSst(id: number, updates: Partial<InsertProgramaSst>): Promise<ProgramaSst>;
  deleteProgramaSst(id: number): Promise<boolean>;

  // SST Avançado - ASO Ocupacionais
  getAsosOcupacionais(filters?: {
    colaboradorId?: number;
    empreendimentoId?: number;
    tipo?: string;
    resultado?: string;
    unidade?: string;
  }): Promise<Array<AsoOcupacional & { colaboradorNome?: string; empreendimentoNome?: string }>>;
  getAsoOcupacionalById(id: number): Promise<AsoOcupacional | undefined>;
  createAsoOcupacional(aso: InsertAsoOcupacional): Promise<AsoOcupacional>;
  updateAsoOcupacional(id: number, updates: Partial<InsertAsoOcupacional>): Promise<AsoOcupacional>;
  deleteAsoOcupacional(id: number): Promise<boolean>;

  // SST Avançado - CAT Acidentes
  getCatAcidentes(filters?: {
    colaboradorId?: number;
    empreendimentoId?: number;
    tipoAcidente?: string;
    status?: string;
    unidade?: string;
  }): Promise<Array<CatAcidente & { colaboradorNome?: string; empreendimentoNome?: string }>>;
  getCatAcidenteById(id: number): Promise<CatAcidente | undefined>;
  createCatAcidente(cat: InsertCatAcidente): Promise<CatAcidente>;
  updateCatAcidente(id: number, updates: Partial<InsertCatAcidente>): Promise<CatAcidente>;
  deleteCatAcidente(id: number): Promise<boolean>;

  // SST Avançado - DDS Registros
  getDdsRegistros(filters?: {
    empreendimentoId?: number;
    data?: string;
    unidade?: string;
  }): Promise<Array<DdsRegistro & { empreendimentoNome?: string }>>;
  getDdsRegistroById(id: number): Promise<DdsRegistro | undefined>;
  createDdsRegistro(dds: InsertDdsRegistro): Promise<DdsRegistro>;
  updateDdsRegistro(id: number, updates: Partial<InsertDdsRegistro>): Promise<DdsRegistro>;
  deleteDdsRegistro(id: number): Promise<boolean>;

  // SST Avançado - Investigações de Incidentes
  getInvestigacoesIncidentes(filters?: {
    empreendimentoId?: number;
    catId?: number;
    tipo?: string;
    status?: string;
    gravidade?: string;
    unidade?: string;
  }): Promise<Array<InvestigacaoIncidente & { empreendimentoNome?: string }>>;
  getInvestigacaoIncidenteById(id: number): Promise<InvestigacaoIncidente | undefined>;
  createInvestigacaoIncidente(investigacao: InsertInvestigacaoIncidente): Promise<InvestigacaoIncidente>;
  updateInvestigacaoIncidente(id: number, updates: Partial<InsertInvestigacaoIncidente>): Promise<InvestigacaoIncidente>;
  deleteInvestigacaoIncidente(id: number): Promise<boolean>;

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
  
  // Vinculação de membros a empreendimentos
  getMembroEmpreendimentos(membroEquipeId: number): Promise<MembroEmpreendimento[]>;
  getMembrosDoEmpreendimento(empreendimentoId: number): Promise<MembroEquipe[]>;
  vincularMembroEmpreendimento(membroEquipeId: number, empreendimentoId: number, unidade: string): Promise<MembroEmpreendimento>;
  desvincularMembroEmpreendimento(membroEquipeId: number, empreendimentoId: number): Promise<boolean>;
  
  // Vinculação de membros a projetos
  getMembroProjetos(membroEquipeId: number): Promise<MembroProjeto[]>;
  getMembrosDoProjeto(projetoId: number): Promise<MembroEquipe[]>;
  vincularMembroProjeto(membroEquipeId: number, projetoId: number, unidade: string): Promise<MembroProjeto>;
  desvincularMembroProjeto(membroEquipeId: number, projetoId: number): Promise<boolean>;

  // ========== TAREFAS ==========
  getTarefas(filters?: {
    unidade?: string;
    responsavelId?: number;
    criadoPor?: number;
    userId?: number;
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
  getTarefasDoDia(userId: number, data?: string): Promise<Tarefa[]>;
  getTarefasAtrasadas(userId?: number, unidade?: string): Promise<Tarefa[]>;
  getTarefasByDateRange(unidade: string, startDate: Date, endDate: Date, userId?: number): Promise<Tarefa[]>;
  getEstatisticasTarefas(filters?: {
    unidade?: string;
    userId?: number;
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

  // ========== REEMBOLSOS ==========
  getPedidosReembolso(filters?: {
    unidade?: string;
    solicitanteId?: number;
    status?: string;
    coordenadorPendente?: boolean;
    financeiroPendente?: boolean;
    diretorPendente?: boolean;
  }): Promise<PedidoReembolso[]>;
  getPedidoReembolsoById(id: number): Promise<PedidoReembolso | undefined>;
  createPedidoReembolso(pedido: InsertPedidoReembolso): Promise<PedidoReembolso>;
  updatePedidoReembolso(id: number, updates: Partial<PedidoReembolso>): Promise<PedidoReembolso>;
  deletePedidoReembolso(id: number): Promise<boolean>;
  aprovarReembolsoCoordenador(id: number, coordenadorId: number, observacao?: string): Promise<PedidoReembolso>;
  rejeitarReembolsoCoordenador(id: number, coordenadorId: number, observacao?: string): Promise<PedidoReembolso>;
  aprovarReembolsoFinanceiro(id: number, financeiroId: number, observacao?: string): Promise<PedidoReembolso>;
  rejeitarReembolsoFinanceiro(id: number, financeiroId: number, observacao?: string): Promise<PedidoReembolso>;
  aprovarReembolsoDiretor(id: number, diretorId: number, observacao?: string): Promise<PedidoReembolso>;
  rejeitarReembolsoDiretor(id: number, diretorId: number, observacao?: string): Promise<PedidoReembolso>;
  marcarReembolsoPago(id: number, formaPagamento: string, dataPagamento: string): Promise<PedidoReembolso>;
  getHistoricoReembolso(pedidoId: number): Promise<HistoricoReembolso[]>;
  createHistoricoReembolso(historico: InsertHistoricoReembolso): Promise<HistoricoReembolso>;
  getEstatisticasReembolso(filters?: { unidade?: string; solicitanteId?: number }): Promise<{
    total: number;
    pendenteCoordenador: number;
    pendenteFinanceiro: number;
    pendenteDiretor: number;
    aprovados: number;
    rejeitados: number;
    pagos: number;
    valorTotal: number;
    valorPago: number;
    valorPendente: number;
  }>;

  // ========== PROPOSTAS COMERCIAIS ==========
  getPropostasComerciais(filters?: { unidade?: string; status?: string; empreendimentoId?: number }): Promise<PropostaComercial[]>;
  getPropostaComercialById(id: number, unidade: string): Promise<PropostaComercial | undefined>;
  createPropostaComercial(proposta: InsertPropostaComercial): Promise<PropostaComercial>;
  updatePropostaComercial(id: number, updates: Partial<InsertPropostaComercial>, unidade: string): Promise<PropostaComercial | undefined>;
  deletePropostaComercial(id: number, unidade: string): Promise<boolean>;
  
  // Proposta Itens (with parent unidade verification)
  getPropostaItens(propostaId: number, unidade: string): Promise<PropostaItem[]>;
  createPropostaItem(item: InsertPropostaItem, unidade: string): Promise<PropostaItem | null>;
  deletePropostaItem(id: number, propostaId: number, unidade: string): Promise<boolean>;

  // ========== AMOSTRAS ==========
  getAmostras(filters?: { unidade?: string; status?: string; empreendimentoId?: number; tipo?: string }): Promise<Amostra[]>;
  getAmostraById(id: number, unidade: string): Promise<Amostra | undefined>;
  createAmostra(amostra: InsertAmostra): Promise<Amostra>;
  updateAmostra(id: number, updates: Partial<InsertAmostra>, unidade: string): Promise<Amostra | undefined>;
  deleteAmostra(id: number, unidade: string): Promise<boolean>;

  // ========== FORNECEDORES ==========
  getFornecedores(filters?: { unidade?: string; status?: string; tipo?: string }): Promise<Fornecedor[]>;
  getFornecedorById(id: number, unidade: string): Promise<Fornecedor | undefined>;
  createFornecedor(fornecedor: InsertFornecedor): Promise<Fornecedor>;
  updateFornecedor(id: number, updates: Partial<InsertFornecedor>, unidade: string): Promise<Fornecedor | undefined>;
  deleteFornecedor(id: number, unidade: string): Promise<boolean>;

  // ========== TREINAMENTOS ==========
  getTreinamentos(filters?: { unidade?: string; status?: string; tipo?: string }): Promise<Treinamento[]>;
  getTreinamentoById(id: number, unidade: string): Promise<Treinamento | undefined>;
  createTreinamento(treinamento: InsertTreinamento): Promise<Treinamento>;
  updateTreinamento(id: number, updates: Partial<InsertTreinamento>, unidade: string): Promise<Treinamento | undefined>;
  deleteTreinamento(id: number, unidade: string): Promise<boolean>;

  // Treinamento Participantes (with parent unidade verification)
  getTreinamentoParticipantes(treinamentoId: number, unidade: string): Promise<TreinamentoParticipante[]>;
  createTreinamentoParticipante(participante: InsertTreinamentoParticipante, unidade: string): Promise<TreinamentoParticipante | null>;
  updateTreinamentoParticipante(id: number, updates: Partial<InsertTreinamentoParticipante>, treinamentoId: number, unidade: string): Promise<TreinamentoParticipante | null>;
  deleteTreinamentoParticipante(id: number, treinamentoId: number, unidade: string): Promise<boolean>;

  // ========== BASE DE CONHECIMENTO ==========
  getBaseConhecimento(filters?: { unidade?: string; status?: string; tipo?: string; categoria?: string }): Promise<BaseConhecimento[]>;
  getBaseConhecimentoById(id: number, unidade: string): Promise<BaseConhecimento | undefined>;
  createBaseConhecimento(item: InsertBaseConhecimento): Promise<BaseConhecimento>;
  updateBaseConhecimento(id: number, updates: Partial<InsertBaseConhecimento>, unidade: string): Promise<BaseConhecimento | undefined>;
  deleteBaseConhecimento(id: number, unidade: string): Promise<boolean>;
  incrementBaseConhecimentoViews(id: number, unidade: string): Promise<void>;
  incrementBaseConhecimentoDownloads(id: number, unidade: string): Promise<void>;
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
    // Use the same filtering logic as getDemandas for consistency
    // This ensures dashboard stats match the demandas page
    const filters: {
      unidade?: string;
      empreendimento?: string;
    } = { unidade };
    
    if (empreendimentoId) {
      filters.empreendimento = empreendimentoId.toString();
    }
    
    const allDemandas = await this.getDemandas(filters);
    
    return {
      total: allDemandas.length,
      pendentes: allDemandas.filter(d => d.status === 'backlog' || d.status === 'a_fazer').length,
      emAndamento: allDemandas.filter(d => d.status === 'em_andamento' || d.status === 'em_revisao').length,
      concluidas: allDemandas.filter(d => d.status === 'concluida').length,
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
    unidade?: string; // Add unidade filter for multi-tenant isolation
  }): Promise<(Demanda & { responsavel?: string })[]> {
    const conditions = [];
    
    // TEMPORARY FIX: Disable multi-tenant filtering to diagnose the issue
    // Will re-enable after confirming demandas appear correctly
    // Multi-tenant isolation temporarily disabled for debugging
    console.log('[DEBUG getDemandas] Filters received:', JSON.stringify(filters));
    
    // DO NOT FILTER BY UNIDADE FOR NOW - just log the attempt
    if (filters?.unidade) {
      console.log('[DEBUG getDemandas] Would filter by unidade:', filters.unidade, '- but SKIPPING for now');
    }
    
    if (filters?.empreendimento && filters.empreendimento !== "todos") {
      const empId = parseInt(filters.empreendimento);
      if (!isNaN(empId)) {
        conditions.push(eq(demandas.empreendimentoId, empId));
      }
    }
    
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
    
    let results;
    console.log('[DEBUG getDemandas] Conditions count:', conditions.length);
    
    if (conditions.length > 0) {
      results = await db
        .select({
          demanda: demandas,
          responsavelNome: users.nome,
        })
        .from(demandas)
        .leftJoin(users, eq(demandas.responsavelId, users.id))
        .where(and(...conditions))
        .orderBy(desc(demandas.criadoEm));
    } else {
      results = await db
        .select({
          demanda: demandas,
          responsavelNome: users.nome,
        })
        .from(demandas)
        .leftJoin(users, eq(demandas.responsavelId, users.id))
        .orderBy(desc(demandas.criadoEm));
    }
    
    console.log('[DEBUG getDemandas] Results count:', results.length);
    if (results.length > 0) {
      console.log('[DEBUG getDemandas] First result:', JSON.stringify(results[0]));
    }
    
    return results.map(r => ({
      ...r.demanda,
      responsavel: r.responsavelNome || undefined,
    }));
  }

  async getDemandaById(id: number): Promise<Demanda | undefined> {
    const [demanda] = await db.select().from(demandas).where(eq(demandas.id, id));
    return demanda || undefined;
  }

  async getDemandasByResponsavel(userId: number, unidade: string): Promise<Demanda[]> {
    return await db
      .select()
      .from(demandas)
      .where(
        and(
          eq(demandas.responsavelId, userId),
          eq(demandas.unidade, unidade)
        )
      )
      .orderBy(desc(demandas.criadoEm));
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

  async clearDemandasHistorico(): Promise<{ count: number }> {
    const result = await db.delete(historicoDemandasMovimentacoes);
    return { count: result.rowCount || 0 };
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

  async getTarefasByDateRange(unidade: string, startDate: Date, endDate: Date, userId?: number): Promise<Tarefa[]> {
    const baseConditions = [
      eq(tarefas.unidade, unidade),
      gte(tarefas.dataFim, startDate.toISOString().split('T')[0]),
      lte(tarefas.dataFim, endDate.toISOString().split('T')[0])
    ];
    
    if (userId) {
      return await db
        .select()
        .from(tarefas)
        .where(
          and(
            ...baseConditions,
            or(
              eq(tarefas.responsavelId, userId),
              eq(tarefas.criadoPor, userId),
              eq(tarefas.visivelCalendarioGeral, true)
            )
          )
        )
        .orderBy(tarefas.dataFim);
    }
    
    return await db
      .select()
      .from(tarefas)
      .where(and(...baseConditions))
      .orderBy(tarefas.dataFim);
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
    empreendimentoIds?: number[];
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
    // Filtro por lista de empreendimentos acessíveis (multi-tenancy)
    if (filters?.empreendimentoIds !== undefined) {
      if (filters.empreendimentoIds.length === 0) {
        // Se não há empreendimentos acessíveis, retornar lista vazia
        return [];
      }
      conditions.push(sql`${financeiroLancamentos.empreendimentoId} IN (${sql.join(filters.empreendimentoIds.map(id => sql`${id}`), sql`, `)})`);
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
    unidade?: string;
  }): Promise<RhRegistro[]> {
    let query = db.select().from(rhRegistros).$dynamic();

    const conditions: SQL[] = [isNull(rhRegistros.deletedAt)];

    if (filters) {
      if (filters.status) {
        conditions.push(eq(rhRegistros.status, filters.status));
      }

      if (filters.cargo) {
        conditions.push(eq(rhRegistros.cargo, filters.cargo));
      }

      if (filters.empreendimentoId) {
        conditions.push(eq(rhRegistros.empreendimentoId, filters.empreendimentoId));
      }

      if (filters.unidade) {
        conditions.push(eq(rhRegistros.unidade, filters.unidade));
      }

      if (filters.search) {
        conditions.push(
          or(
            ilike(rhRegistros.nomeColaborador, `%${filters.search}%`),
            ilike(rhRegistros.cpf, `%${filters.search}%`)
          )!
        );
      }
    }

    query = query.where(and(...conditions));

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
    // Primeiro excluir registros relacionados
    await db.delete(datasetVersoes).where(eq(datasetVersoes.datasetId, id));
    await db.delete(datasetAuditTrail).where(eq(datasetAuditTrail.datasetId, id));
    
    // Depois excluir o dataset
    const result = await db.delete(datasets).where(eq(datasets.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateDataset(id: number, updates: Partial<InsertDataset>): Promise<Dataset> {
    const [updated] = await db
      .update(datasets)
      .set(updates)
      .where(eq(datasets.id, id))
      .returning();
    return updated;
  }

  async getDatasetsByPasta(pastaId: number, unidade: string): Promise<Dataset[]> {
    // Get empreendimento IDs belonging to this unidade for fallback matching
    const emps = await db.select({ id: empreendimentos.id })
      .from(empreendimentos)
      .where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    if (empIds.length > 0) {
      // Match datasets that either have the unidade field set OR belong to an empreendimento of this unidade
      return db.select()
        .from(datasets)
        .where(and(
          eq(datasets.pastaId, pastaId),
          or(
            eq(datasets.unidade, unidade),
            inArray(datasets.empreendimentoId, empIds)
          )
        ))
        .orderBy(desc(datasets.dataUpload));
    }
    
    return db.select()
      .from(datasets)
      .where(and(
        eq(datasets.pastaId, pastaId),
        eq(datasets.unidade, unidade)
      ))
      .orderBy(desc(datasets.dataUpload));
  }

  // DatasetPastas operations (folder management)
  async getDatasetPastas(unidade: string): Promise<DatasetPasta[]> {
    // Get empreendimento IDs belonging to this unidade for fallback matching
    const emps = await db.select({ id: empreendimentos.id })
      .from(empreendimentos)
      .where(eq(empreendimentos.unidade, unidade));
    const empIds = emps.map(e => e.id);
    
    if (empIds.length > 0) {
      // Match pastas that either have the unidade field set OR belong to an empreendimento of this unidade
      return db.select()
        .from(datasetPastas)
        .where(
          or(
            eq(datasetPastas.unidade, unidade),
            inArray(datasetPastas.empreendimentoId, empIds)
          )
        )
        .orderBy(asc(datasetPastas.caminho));
    }
    
    // No empreendimentos in this unidade, filter by unidade field only
    return db.select()
      .from(datasetPastas)
      .where(eq(datasetPastas.unidade, unidade))
      .orderBy(asc(datasetPastas.caminho));
  }

  async getDatasetPastaById(id: number): Promise<DatasetPasta | undefined> {
    const [pasta] = await db.select()
      .from(datasetPastas)
      .where(eq(datasetPastas.id, id));
    return pasta || undefined;
  }

  async createDatasetPasta(pasta: InsertDatasetPasta): Promise<DatasetPasta> {
    const [newPasta] = await db.insert(datasetPastas)
      .values(pasta)
      .returning();
    return newPasta;
  }

  async updateDatasetPasta(id: number, updates: Partial<InsertDatasetPasta>): Promise<DatasetPasta> {
    const [updated] = await db.update(datasetPastas)
      .set(updates)
      .where(eq(datasetPastas.id, id))
      .returning();
    return updated;
  }

  async deleteDatasetPasta(id: number): Promise<boolean> {
    // First delete all files in this folder
    await db.delete(datasets).where(eq(datasets.pastaId, id));
    // Then delete subfolders
    await db.delete(datasetPastas).where(eq(datasetPastas.paiId, id));
    // Finally delete the folder itself
    const result = await db.delete(datasetPastas).where(eq(datasetPastas.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getSubpastas(paiId: number): Promise<DatasetPasta[]> {
    return db.select()
      .from(datasetPastas)
      .where(eq(datasetPastas.paiId, paiId))
      .orderBy(asc(datasetPastas.nome));
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

  // ========== SST AVANÇADO - Programas SST ==========
  async getProgramasSst(filters?: {
    empreendimentoId?: number;
    tipo?: string;
    status?: string;
    unidade?: string;
  }): Promise<Array<ProgramaSst & { empreendimentoNome?: string }>> {
    const conditions = [];
    if (filters?.empreendimentoId) conditions.push(eq(programasSst.empreendimentoId, filters.empreendimentoId));
    if (filters?.tipo) conditions.push(eq(programasSst.tipo, filters.tipo));
    if (filters?.status) conditions.push(eq(programasSst.status, filters.status));
    if (filters?.unidade) conditions.push(eq(programasSst.unidade, filters.unidade));

    const result = await db
      .select({
        id: programasSst.id,
        empreendimentoId: programasSst.empreendimentoId,
        tipo: programasSst.tipo,
        nome: programasSst.nome,
        descricao: programasSst.descricao,
        responsavelTecnico: programasSst.responsavelTecnico,
        registroProfissional: programasSst.registroProfissional,
        dataElaboracao: programasSst.dataElaboracao,
        dataValidade: programasSst.dataValidade,
        status: programasSst.status,
        arquivoPath: programasSst.arquivoPath,
        observacoes: programasSst.observacoes,
        unidade: programasSst.unidade,
        criadoEm: programasSst.criadoEm,
        atualizadoEm: programasSst.atualizadoEm,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(programasSst)
      .leftJoin(empreendimentos, eq(programasSst.empreendimentoId, empreendimentos.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(programasSst.criadoEm));

    return result;
  }

  async getProgramaSstById(id: number): Promise<ProgramaSst | undefined> {
    const [programa] = await db.select().from(programasSst).where(eq(programasSst.id, id));
    return programa || undefined;
  }

  async createProgramaSst(programa: InsertProgramaSst): Promise<ProgramaSst> {
    const [newPrograma] = await db.insert(programasSst).values(programa).returning();
    return newPrograma;
  }

  async updateProgramaSst(id: number, updates: Partial<InsertProgramaSst>): Promise<ProgramaSst> {
    const [updated] = await db.update(programasSst).set({ ...updates, atualizadoEm: new Date() }).where(eq(programasSst.id, id)).returning();
    return updated;
  }

  async deleteProgramaSst(id: number): Promise<boolean> {
    const result = await db.delete(programasSst).where(eq(programasSst.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========== SST AVANÇADO - ASO Ocupacionais ==========
  async getAsosOcupacionais(filters?: {
    colaboradorId?: number;
    empreendimentoId?: number;
    tipo?: string;
    resultado?: string;
    unidade?: string;
  }): Promise<Array<AsoOcupacional & { colaboradorNome?: string; empreendimentoNome?: string }>> {
    const conditions = [];
    if (filters?.colaboradorId) conditions.push(eq(asosOcupacionais.colaboradorId, filters.colaboradorId));
    if (filters?.empreendimentoId) conditions.push(eq(asosOcupacionais.empreendimentoId, filters.empreendimentoId));
    if (filters?.tipo) conditions.push(eq(asosOcupacionais.tipo, filters.tipo));
    if (filters?.resultado) conditions.push(eq(asosOcupacionais.resultado, filters.resultado));
    if (filters?.unidade) conditions.push(eq(asosOcupacionais.unidade, filters.unidade));

    const result = await db
      .select({
        id: asosOcupacionais.id,
        colaboradorId: asosOcupacionais.colaboradorId,
        empreendimentoId: asosOcupacionais.empreendimentoId,
        tipo: asosOcupacionais.tipo,
        dataExame: asosOcupacionais.dataExame,
        dataValidade: asosOcupacionais.dataValidade,
        resultado: asosOcupacionais.resultado,
        restricoes: asosOcupacionais.restricoes,
        medicoResponsavel: asosOcupacionais.medicoResponsavel,
        crm: asosOcupacionais.crm,
        clinica: asosOcupacionais.clinica,
        examesRealizados: asosOcupacionais.examesRealizados,
        arquivoPath: asosOcupacionais.arquivoPath,
        observacoes: asosOcupacionais.observacoes,
        unidade: asosOcupacionais.unidade,
        criadoEm: asosOcupacionais.criadoEm,
        atualizadoEm: asosOcupacionais.atualizadoEm,
        colaboradorNome: colaboradores.nome,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(asosOcupacionais)
      .leftJoin(colaboradores, eq(asosOcupacionais.colaboradorId, colaboradores.id))
      .leftJoin(empreendimentos, eq(asosOcupacionais.empreendimentoId, empreendimentos.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(asosOcupacionais.dataExame));

    return result;
  }

  async getAsoOcupacionalById(id: number): Promise<AsoOcupacional | undefined> {
    const [aso] = await db.select().from(asosOcupacionais).where(eq(asosOcupacionais.id, id));
    return aso || undefined;
  }

  async createAsoOcupacional(aso: InsertAsoOcupacional): Promise<AsoOcupacional> {
    const [newAso] = await db.insert(asosOcupacionais).values(aso).returning();
    return newAso;
  }

  async updateAsoOcupacional(id: number, updates: Partial<InsertAsoOcupacional>): Promise<AsoOcupacional> {
    const [updated] = await db.update(asosOcupacionais).set({ ...updates, atualizadoEm: new Date() }).where(eq(asosOcupacionais.id, id)).returning();
    return updated;
  }

  async deleteAsoOcupacional(id: number): Promise<boolean> {
    const result = await db.delete(asosOcupacionais).where(eq(asosOcupacionais.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========== SST AVANÇADO - CAT Acidentes ==========
  async getCatAcidentes(filters?: {
    colaboradorId?: number;
    empreendimentoId?: number;
    tipoAcidente?: string;
    status?: string;
    unidade?: string;
  }): Promise<Array<CatAcidente & { colaboradorNome?: string; empreendimentoNome?: string }>> {
    const conditions = [];
    if (filters?.colaboradorId) conditions.push(eq(catAcidentes.colaboradorId, filters.colaboradorId));
    if (filters?.empreendimentoId) conditions.push(eq(catAcidentes.empreendimentoId, filters.empreendimentoId));
    if (filters?.tipoAcidente) conditions.push(eq(catAcidentes.tipoAcidente, filters.tipoAcidente));
    if (filters?.status) conditions.push(eq(catAcidentes.status, filters.status));
    if (filters?.unidade) conditions.push(eq(catAcidentes.unidade, filters.unidade));

    const result = await db
      .select({
        id: catAcidentes.id,
        colaboradorId: catAcidentes.colaboradorId,
        empreendimentoId: catAcidentes.empreendimentoId,
        numeroCat: catAcidentes.numeroCat,
        dataAcidente: catAcidentes.dataAcidente,
        horaAcidente: catAcidentes.horaAcidente,
        tipoAcidente: catAcidentes.tipoAcidente,
        localAcidente: catAcidentes.localAcidente,
        descricao: catAcidentes.descricao,
        parteCorpoAtingida: catAcidentes.parteCorpoAtingida,
        agenteCausador: catAcidentes.agenteCausador,
        naturezaLesao: catAcidentes.naturezaLesao,
        houveAfastamento: catAcidentes.houveAfastamento,
        diasAfastamento: catAcidentes.diasAfastamento,
        dataRetorno: catAcidentes.dataRetorno,
        testemunhas: catAcidentes.testemunhas,
        medidasImediatas: catAcidentes.medidasImediatas,
        status: catAcidentes.status,
        arquivoPath: catAcidentes.arquivoPath,
        unidade: catAcidentes.unidade,
        criadoEm: catAcidentes.criadoEm,
        atualizadoEm: catAcidentes.atualizadoEm,
        colaboradorNome: colaboradores.nome,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(catAcidentes)
      .leftJoin(colaboradores, eq(catAcidentes.colaboradorId, colaboradores.id))
      .leftJoin(empreendimentos, eq(catAcidentes.empreendimentoId, empreendimentos.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(catAcidentes.dataAcidente));

    return result;
  }

  async getCatAcidenteById(id: number): Promise<CatAcidente | undefined> {
    const [cat] = await db.select().from(catAcidentes).where(eq(catAcidentes.id, id));
    return cat || undefined;
  }

  async createCatAcidente(cat: InsertCatAcidente): Promise<CatAcidente> {
    const [newCat] = await db.insert(catAcidentes).values(cat).returning();
    return newCat;
  }

  async updateCatAcidente(id: number, updates: Partial<InsertCatAcidente>): Promise<CatAcidente> {
    const [updated] = await db.update(catAcidentes).set({ ...updates, atualizadoEm: new Date() }).where(eq(catAcidentes.id, id)).returning();
    return updated;
  }

  async deleteCatAcidente(id: number): Promise<boolean> {
    const result = await db.delete(catAcidentes).where(eq(catAcidentes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========== SST AVANÇADO - DDS Registros ==========
  async getDdsRegistros(filters?: {
    empreendimentoId?: number;
    data?: string;
    unidade?: string;
  }): Promise<Array<DdsRegistro & { empreendimentoNome?: string }>> {
    const conditions = [];
    if (filters?.empreendimentoId) conditions.push(eq(ddsRegistros.empreendimentoId, filters.empreendimentoId));
    if (filters?.data) conditions.push(eq(ddsRegistros.data, filters.data));
    if (filters?.unidade) conditions.push(eq(ddsRegistros.unidade, filters.unidade));

    const result = await db
      .select({
        id: ddsRegistros.id,
        empreendimentoId: ddsRegistros.empreendimentoId,
        data: ddsRegistros.data,
        horario: ddsRegistros.horario,
        duracao: ddsRegistros.duracao,
        tema: ddsRegistros.tema,
        conteudo: ddsRegistros.conteudo,
        responsavelId: ddsRegistros.responsavelId,
        responsavelNome: ddsRegistros.responsavelNome,
        participantes: ddsRegistros.participantes,
        totalParticipantes: ddsRegistros.totalParticipantes,
        observacoes: ddsRegistros.observacoes,
        arquivoPath: ddsRegistros.arquivoPath,
        unidade: ddsRegistros.unidade,
        criadoEm: ddsRegistros.criadoEm,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(ddsRegistros)
      .leftJoin(empreendimentos, eq(ddsRegistros.empreendimentoId, empreendimentos.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ddsRegistros.data));

    return result;
  }

  async getDdsRegistroById(id: number): Promise<DdsRegistro | undefined> {
    const [dds] = await db.select().from(ddsRegistros).where(eq(ddsRegistros.id, id));
    return dds || undefined;
  }

  async createDdsRegistro(dds: InsertDdsRegistro): Promise<DdsRegistro> {
    const [newDds] = await db.insert(ddsRegistros).values(dds).returning();
    return newDds;
  }

  async updateDdsRegistro(id: number, updates: Partial<InsertDdsRegistro>): Promise<DdsRegistro> {
    const [updated] = await db.update(ddsRegistros).set({ ...updates }).where(eq(ddsRegistros.id, id)).returning();
    return updated;
  }

  async deleteDdsRegistro(id: number): Promise<boolean> {
    const result = await db.delete(ddsRegistros).where(eq(ddsRegistros.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========== SST AVANÇADO - Investigações de Incidentes ==========
  async getInvestigacoesIncidentes(filters?: {
    empreendimentoId?: number;
    catId?: number;
    tipo?: string;
    status?: string;
    gravidade?: string;
    unidade?: string;
  }): Promise<Array<InvestigacaoIncidente & { empreendimentoNome?: string }>> {
    const conditions = [];
    if (filters?.empreendimentoId) conditions.push(eq(investigacoesIncidentes.empreendimentoId, filters.empreendimentoId));
    if (filters?.catId) conditions.push(eq(investigacoesIncidentes.catId, filters.catId));
    if (filters?.tipo) conditions.push(eq(investigacoesIncidentes.tipo, filters.tipo));
    if (filters?.status) conditions.push(eq(investigacoesIncidentes.status, filters.status));
    if (filters?.gravidade) conditions.push(eq(investigacoesIncidentes.gravidade, filters.gravidade));
    if (filters?.unidade) conditions.push(eq(investigacoesIncidentes.unidade, filters.unidade));

    const result = await db
      .select({
        id: investigacoesIncidentes.id,
        empreendimentoId: investigacoesIncidentes.empreendimentoId,
        catId: investigacoesIncidentes.catId,
        titulo: investigacoesIncidentes.titulo,
        dataIncidente: investigacoesIncidentes.dataIncidente,
        localIncidente: investigacoesIncidentes.localIncidente,
        descricao: investigacoesIncidentes.descricao,
        gravidade: investigacoesIncidentes.gravidade,
        tipo: investigacoesIncidentes.tipo,
        metodologia: investigacoesIncidentes.metodologia,
        analise: investigacoesIncidentes.analise,
        causaRaiz: investigacoesIncidentes.causaRaiz,
        equipeInvestigadora: investigacoesIncidentes.equipeInvestigadora,
        acoesCorretivas: investigacoesIncidentes.acoesCorretivas,
        prazoAcoes: investigacoesIncidentes.prazoAcoes,
        responsavelAcoes: investigacoesIncidentes.responsavelAcoes,
        statusAcoes: investigacoesIncidentes.statusAcoes,
        licoesAprendidas: investigacoesIncidentes.licoesAprendidas,
        status: investigacoesIncidentes.status,
        arquivosPath: investigacoesIncidentes.arquivosPath,
        unidade: investigacoesIncidentes.unidade,
        criadoEm: investigacoesIncidentes.criadoEm,
        atualizadoEm: investigacoesIncidentes.atualizadoEm,
        empreendimentoNome: empreendimentos.nome,
      })
      .from(investigacoesIncidentes)
      .leftJoin(empreendimentos, eq(investigacoesIncidentes.empreendimentoId, empreendimentos.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(investigacoesIncidentes.dataIncidente));

    return result;
  }

  async getInvestigacaoIncidenteById(id: number): Promise<InvestigacaoIncidente | undefined> {
    const [investigacao] = await db.select().from(investigacoesIncidentes).where(eq(investigacoesIncidentes.id, id));
    return investigacao || undefined;
  }

  async createInvestigacaoIncidente(investigacao: InsertInvestigacaoIncidente): Promise<InvestigacaoIncidente> {
    const [newInvestigacao] = await db.insert(investigacoesIncidentes).values(investigacao).returning();
    return newInvestigacao;
  }

  async updateInvestigacaoIncidente(id: number, updates: Partial<InsertInvestigacaoIncidente>): Promise<InvestigacaoIncidente> {
    const [updated] = await db.update(investigacoesIncidentes).set({ ...updates, atualizadoEm: new Date() }).where(eq(investigacoesIncidentes.id, id)).returning();
    return updated;
  }

  async deleteInvestigacaoIncidente(id: number): Promise<boolean> {
    const result = await db.delete(investigacoesIncidentes).where(eq(investigacoesIncidentes.id, id));
    return result.rowCount !== null && result.rowCount > 0;
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

  // ========== VINCULAÇÃO MEMBROS-EMPREENDIMENTOS ==========
  async getMembroEmpreendimentos(membroEquipeId: number): Promise<MembroEmpreendimento[]> {
    return db
      .select()
      .from(membrosEmpreendimentos)
      .where(eq(membrosEmpreendimentos.membroEquipeId, membroEquipeId));
  }

  async getMembrosDoEmpreendimento(empreendimentoId: number): Promise<MembroEquipe[]> {
    const vinculacoes = await db
      .select()
      .from(membrosEmpreendimentos)
      .where(eq(membrosEmpreendimentos.empreendimentoId, empreendimentoId));
    
    if (vinculacoes.length === 0) return [];
    
    const membroIds = vinculacoes.map(v => v.membroEquipeId);
    return db
      .select()
      .from(membrosEquipe)
      .where(and(
        sql`${membrosEquipe.id} IN (${sql.join(membroIds.map(id => sql`${id}`), sql`, `)})`,
        eq(membrosEquipe.ativo, true)
      ));
  }

  async vincularMembroEmpreendimento(membroEquipeId: number, empreendimentoId: number, unidade: string): Promise<MembroEmpreendimento> {
    const [vinculacao] = await db
      .insert(membrosEmpreendimentos)
      .values({ membroEquipeId, empreendimentoId, unidade })
      .returning();
    return vinculacao;
  }

  async desvincularMembroEmpreendimento(membroEquipeId: number, empreendimentoId: number): Promise<boolean> {
    const result = await db
      .delete(membrosEmpreendimentos)
      .where(and(
        eq(membrosEmpreendimentos.membroEquipeId, membroEquipeId),
        eq(membrosEmpreendimentos.empreendimentoId, empreendimentoId)
      ));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========== VINCULAÇÃO MEMBROS-PROJETOS ==========
  async getMembroProjetos(membroEquipeId: number): Promise<MembroProjeto[]> {
    return db
      .select()
      .from(membrosProjetos)
      .where(eq(membrosProjetos.membroEquipeId, membroEquipeId));
  }

  async getMembrosDoProjeto(projetoId: number): Promise<MembroEquipe[]> {
    const vinculacoes = await db
      .select()
      .from(membrosProjetos)
      .where(eq(membrosProjetos.projetoId, projetoId));
    
    if (vinculacoes.length === 0) return [];
    
    const membroIds = vinculacoes.map(v => v.membroEquipeId);
    return db
      .select()
      .from(membrosEquipe)
      .where(and(
        sql`${membrosEquipe.id} IN (${sql.join(membroIds.map(id => sql`${id}`), sql`, `)})`,
        eq(membrosEquipe.ativo, true)
      ));
  }

  async vincularMembroProjeto(membroEquipeId: number, projetoId: number, unidade: string): Promise<MembroProjeto> {
    const [vinculacao] = await db
      .insert(membrosProjetos)
      .values({ membroEquipeId, projetoId, unidade })
      .returning();
    return vinculacao;
  }

  async desvincularMembroProjeto(membroEquipeId: number, projetoId: number): Promise<boolean> {
    const result = await db
      .delete(membrosProjetos)
      .where(and(
        eq(membrosProjetos.membroEquipeId, membroEquipeId),
        eq(membrosProjetos.projetoId, projetoId)
      ));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ========== TAREFAS ==========
  async getTarefas(filters?: {
    unidade?: string;
    responsavelId?: number;
    criadoPor?: number;
    userId?: number;
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
    if (filters?.userId) {
      conditions.push(
        or(
          eq(tarefas.responsavelId, filters.userId),
          eq(tarefas.criadoPor, filters.userId)
        )
      );
    } else {
      if (filters?.responsavelId) {
        conditions.push(eq(tarefas.responsavelId, filters.responsavelId));
      }
      if (filters?.criadoPor) {
        conditions.push(eq(tarefas.criadoPor, filters.criadoPor));
      }
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

  async getTarefasDoDia(userId: number, data?: string): Promise<Tarefa[]> {
    const hoje = data || new Date().toISOString().split('T')[0];
    return db
      .select()
      .from(tarefas)
      .where(
        and(
          or(
            eq(tarefas.responsavelId, userId),
            eq(tarefas.criadoPor, userId)
          ),
          lte(tarefas.dataInicio, hoje),
          gte(tarefas.dataFim, hoje),
          ne(tarefas.status, 'concluida'),
          ne(tarefas.status, 'cancelada')
        )
      )
      .orderBy(asc(tarefas.prioridade));
  }

  async getTarefasAtrasadas(userId?: number, unidade?: string): Promise<Tarefa[]> {
    const hoje = new Date().toISOString().split('T')[0];
    const conditions: any[] = [
      lte(tarefas.dataFim, hoje),
      ne(tarefas.status, 'concluida'),
      ne(tarefas.status, 'cancelada')
    ];

    if (userId) {
      conditions.push(
        or(
          eq(tarefas.responsavelId, userId),
          eq(tarefas.criadoPor, userId)
        )
      );
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
    userId?: number;
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
    if (filters?.userId) {
      conditions.push(
        or(
          eq(tarefas.responsavelId, filters.userId),
          eq(tarefas.criadoPor, filters.userId)
        )
      );
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

  // ========== REEMBOLSOS ==========
  async getPedidosReembolso(filters?: {
    unidade?: string;
    solicitanteId?: number;
    status?: string;
    coordenadorPendente?: boolean;
    financeiroPendente?: boolean;
    diretorPendente?: boolean;
  }): Promise<PedidoReembolso[]> {
    let query = db.select().from(pedidosReembolso).$dynamic();
    const conditions: any[] = [];

    if (filters?.unidade) {
      conditions.push(eq(pedidosReembolso.unidade, filters.unidade));
    }
    if (filters?.solicitanteId) {
      conditions.push(eq(pedidosReembolso.solicitanteId, filters.solicitanteId));
    }
    if (filters?.status) {
      conditions.push(eq(pedidosReembolso.status, filters.status));
    }
    if (filters?.coordenadorPendente) {
      conditions.push(eq(pedidosReembolso.status, 'pendente_coordenador'));
    }
    if (filters?.financeiroPendente) {
      conditions.push(eq(pedidosReembolso.status, 'pendente_financeiro'));
    }
    if (filters?.diretorPendente) {
      conditions.push(eq(pedidosReembolso.status, 'pendente_diretor'));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(pedidosReembolso.criadoEm));
  }

  async getPedidoReembolsoById(id: number): Promise<PedidoReembolso | undefined> {
    const [pedido] = await db
      .select()
      .from(pedidosReembolso)
      .where(eq(pedidosReembolso.id, id));
    return pedido || undefined;
  }

  async createPedidoReembolso(pedido: InsertPedidoReembolso): Promise<PedidoReembolso> {
    const [newPedido] = await db
      .insert(pedidosReembolso)
      .values({
        ...pedido,
        status: 'pendente_coordenador',
      })
      .returning();
    return newPedido;
  }

  async updatePedidoReembolso(id: number, updates: Partial<PedidoReembolso>): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async deletePedidoReembolso(id: number): Promise<boolean> {
    const result = await db
      .delete(pedidosReembolso)
      .where(eq(pedidosReembolso.id, id));
    return true;
  }

  async aprovarReembolsoCoordenador(id: number, coordenadorId: number, observacao?: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'pendente_financeiro',
        coordenadorId,
        coordenadorAprovadoEm: new Date(),
        coordenadorObservacao: observacao,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async rejeitarReembolsoCoordenador(id: number, coordenadorId: number, observacao?: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'rejeitado_coordenador',
        coordenadorId,
        coordenadorAprovadoEm: new Date(),
        coordenadorObservacao: observacao,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async aprovarReembolsoFinanceiro(id: number, financeiroId: number, observacao?: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'pendente_diretor',
        financeiroId,
        financeiroAprovadoEm: new Date(),
        financeiroObservacao: observacao,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async rejeitarReembolsoFinanceiro(id: number, financeiroId: number, observacao?: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'rejeitado_financeiro',
        financeiroId,
        financeiroAprovadoEm: new Date(),
        financeiroObservacao: observacao,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async aprovarReembolsoDiretor(id: number, diretorId: number, observacao?: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'aprovado_diretor',
        diretorId,
        diretorAprovadoEm: new Date(),
        diretorObservacao: observacao,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async rejeitarReembolsoDiretor(id: number, diretorId: number, observacao?: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'rejeitado_diretor',
        diretorId,
        diretorAprovadoEm: new Date(),
        diretorObservacao: observacao,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async marcarReembolsoPago(id: number, formaPagamento: string, dataPagamento: string): Promise<PedidoReembolso> {
    const [updated] = await db
      .update(pedidosReembolso)
      .set({
        status: 'pago',
        formaPagamento,
        dataPagamento,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidosReembolso.id, id))
      .returning();
    return updated;
  }

  async getHistoricoReembolso(pedidoId: number): Promise<HistoricoReembolso[]> {
    return db
      .select()
      .from(historicoReembolso)
      .where(eq(historicoReembolso.pedidoId, pedidoId))
      .orderBy(desc(historicoReembolso.criadoEm));
  }

  async createHistoricoReembolso(historico: InsertHistoricoReembolso): Promise<HistoricoReembolso> {
    const [newHistorico] = await db
      .insert(historicoReembolso)
      .values(historico)
      .returning();
    return newHistorico;
  }

  async getEstatisticasReembolso(filters?: { unidade?: string; solicitanteId?: number }): Promise<{
    total: number;
    pendenteCoordenador: number;
    pendenteFinanceiro: number;
    pendenteDiretor: number;
    aprovados: number;
    rejeitados: number;
    pagos: number;
    valorTotal: number;
    valorPago: number;
    valorPendente: number;
  }> {
    const conditions: any[] = [];
    if (filters?.unidade) {
      conditions.push(eq(pedidosReembolso.unidade, filters.unidade));
    }
    if (filters?.solicitanteId) {
      conditions.push(eq(pedidosReembolso.solicitanteId, filters.solicitanteId));
    }

    let query = db.select().from(pedidosReembolso).$dynamic();
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const pedidos = await query;

    const total = pedidos.length;
    const pendenteCoordenador = pedidos.filter(p => p.status === 'pendente_coordenador').length;
    const pendenteFinanceiro = pedidos.filter(p => p.status === 'pendente_financeiro').length;
    const pendenteDiretor = pedidos.filter(p => p.status === 'pendente_diretor').length;
    const aprovados = pedidos.filter(p => p.status === 'aprovado_diretor').length;
    const rejeitados = pedidos.filter(p => 
      p.status === 'rejeitado_coordenador' || 
      p.status === 'rejeitado_financeiro' || 
      p.status === 'rejeitado_diretor'
    ).length;
    const pagos = pedidos.filter(p => p.status === 'pago').length;

    const valorTotal = pedidos.reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0);
    const valorPago = pedidos
      .filter(p => p.status === 'pago')
      .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0);
    const valorPendente = pedidos
      .filter(p => !['pago', 'rejeitado_coordenador', 'rejeitado_financeiro', 'rejeitado_diretor'].includes(p.status))
      .reduce((acc, p) => acc + parseFloat(p.valor || '0'), 0);

    return {
      total,
      pendenteCoordenador,
      pendenteFinanceiro,
      pendenteDiretor,
      aprovados,
      rejeitados,
      pagos,
      valorTotal,
      valorPago,
      valorPendente,
    };
  }

  // ========== PROPOSTAS COMERCIAIS ==========
  async getPropostasComerciais(filters?: { unidade?: string; status?: string; empreendimentoId?: number }): Promise<PropostaComercial[]> {
    const conditions: any[] = [isNull(propostasComerciais.deletedAt)];
    
    if (filters?.unidade) {
      conditions.push(eq(propostasComerciais.unidade, filters.unidade));
    }
    if (filters?.status) {
      conditions.push(eq(propostasComerciais.status, filters.status));
    }
    if (filters?.empreendimentoId) {
      conditions.push(eq(propostasComerciais.empreendimentoId, filters.empreendimentoId));
    }
    
    return db.select().from(propostasComerciais)
      .where(and(...conditions))
      .orderBy(desc(propostasComerciais.criadoEm));
  }

  async getPropostaComercialById(id: number, unidade: string): Promise<PropostaComercial | undefined> {
    const [proposta] = await db.select().from(propostasComerciais)
      .where(and(
        eq(propostasComerciais.id, id), 
        eq(propostasComerciais.unidade, unidade),
        isNull(propostasComerciais.deletedAt)
      ));
    return proposta || undefined;
  }

  async createPropostaComercial(proposta: InsertPropostaComercial): Promise<PropostaComercial> {
    const [newProposta] = await db.insert(propostasComerciais).values(proposta).returning();
    return newProposta;
  }

  async updatePropostaComercial(id: number, updates: Partial<InsertPropostaComercial>, unidade: string): Promise<PropostaComercial | undefined> {
    const [updated] = await db.update(propostasComerciais)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(and(
        eq(propostasComerciais.id, id), 
        eq(propostasComerciais.unidade, unidade),
        isNull(propostasComerciais.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deletePropostaComercial(id: number, unidade: string): Promise<boolean> {
    const [deleted] = await db.update(propostasComerciais)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(propostasComerciais.id, id),
        eq(propostasComerciais.unidade, unidade)
      ))
      .returning();
    return !!deleted;
  }

  // Proposta Itens - verify parent unidade before operations
  async getPropostaItens(propostaId: number, unidade: string): Promise<PropostaItem[]> {
    const proposta = await this.getPropostaComercialById(propostaId, unidade);
    if (!proposta) return [];
    return db.select().from(propostaItens)
      .where(eq(propostaItens.propostaId, propostaId))
      .orderBy(asc(propostaItens.id));
  }

  async createPropostaItem(item: InsertPropostaItem, unidade: string): Promise<PropostaItem | null> {
    const proposta = await this.getPropostaComercialById(item.propostaId, unidade);
    if (!proposta) return null;
    const [newItem] = await db.insert(propostaItens).values(item).returning();
    return newItem;
  }

  async deletePropostaItem(id: number, propostaId: number, unidade: string): Promise<boolean> {
    const proposta = await this.getPropostaComercialById(propostaId, unidade);
    if (!proposta) return false;
    await db.delete(propostaItens).where(and(eq(propostaItens.id, id), eq(propostaItens.propostaId, propostaId)));
    return true;
  }

  // ========== AMOSTRAS ==========
  async getAmostras(filters?: { unidade?: string; status?: string; empreendimentoId?: number; tipo?: string }): Promise<Amostra[]> {
    const conditions: any[] = [isNull(amostras.deletedAt)];
    
    if (filters?.unidade) {
      conditions.push(eq(amostras.unidade, filters.unidade));
    }
    if (filters?.status) {
      conditions.push(eq(amostras.status, filters.status));
    }
    if (filters?.empreendimentoId) {
      conditions.push(eq(amostras.empreendimentoId, filters.empreendimentoId));
    }
    if (filters?.tipo) {
      conditions.push(eq(amostras.tipo, filters.tipo));
    }
    
    return db.select().from(amostras)
      .where(and(...conditions))
      .orderBy(desc(amostras.criadoEm));
  }

  async getAmostraById(id: number, unidade: string): Promise<Amostra | undefined> {
    const [amostra] = await db.select().from(amostras)
      .where(and(
        eq(amostras.id, id), 
        eq(amostras.unidade, unidade),
        isNull(amostras.deletedAt)
      ));
    return amostra || undefined;
  }

  async createAmostra(amostra: InsertAmostra): Promise<Amostra> {
    const [newAmostra] = await db.insert(amostras).values(amostra).returning();
    return newAmostra;
  }

  async updateAmostra(id: number, updates: Partial<InsertAmostra>, unidade: string): Promise<Amostra | undefined> {
    const [updated] = await db.update(amostras)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(and(
        eq(amostras.id, id), 
        eq(amostras.unidade, unidade),
        isNull(amostras.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteAmostra(id: number, unidade: string): Promise<boolean> {
    const [deleted] = await db.update(amostras)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(amostras.id, id),
        eq(amostras.unidade, unidade)
      ))
      .returning();
    return !!deleted;
  }

  // ========== FORNECEDORES ==========
  async getFornecedores(filters?: { unidade?: string; status?: string; tipo?: string }): Promise<Fornecedor[]> {
    const conditions: any[] = [isNull(fornecedores.deletedAt)];
    
    if (filters?.unidade) {
      conditions.push(eq(fornecedores.unidade, filters.unidade));
    }
    if (filters?.status) {
      conditions.push(eq(fornecedores.status, filters.status));
    }
    if (filters?.tipo) {
      conditions.push(eq(fornecedores.tipo, filters.tipo));
    }
    
    return db.select().from(fornecedores)
      .where(and(...conditions))
      .orderBy(desc(fornecedores.criadoEm));
  }

  async getFornecedorById(id: number, unidade: string): Promise<Fornecedor | undefined> {
    const [fornecedor] = await db.select().from(fornecedores)
      .where(and(
        eq(fornecedores.id, id), 
        eq(fornecedores.unidade, unidade),
        isNull(fornecedores.deletedAt)
      ));
    return fornecedor || undefined;
  }

  async createFornecedor(fornecedor: InsertFornecedor): Promise<Fornecedor> {
    const [newFornecedor] = await db.insert(fornecedores).values(fornecedor).returning();
    return newFornecedor;
  }

  async updateFornecedor(id: number, updates: Partial<InsertFornecedor>, unidade: string): Promise<Fornecedor | undefined> {
    const [updated] = await db.update(fornecedores)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(and(
        eq(fornecedores.id, id), 
        eq(fornecedores.unidade, unidade),
        isNull(fornecedores.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteFornecedor(id: number, unidade: string): Promise<boolean> {
    const [deleted] = await db.update(fornecedores)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(fornecedores.id, id),
        eq(fornecedores.unidade, unidade)
      ))
      .returning();
    return !!deleted;
  }

  // ========== TREINAMENTOS ==========
  async getTreinamentos(filters?: { unidade?: string; status?: string; tipo?: string }): Promise<Treinamento[]> {
    const conditions: any[] = [isNull(treinamentos.deletedAt)];
    
    if (filters?.unidade) {
      conditions.push(eq(treinamentos.unidade, filters.unidade));
    }
    if (filters?.status) {
      conditions.push(eq(treinamentos.status, filters.status));
    }
    if (filters?.tipo) {
      conditions.push(eq(treinamentos.tipo, filters.tipo));
    }
    
    return db.select().from(treinamentos)
      .where(and(...conditions))
      .orderBy(desc(treinamentos.criadoEm));
  }

  async getTreinamentoById(id: number, unidade: string): Promise<Treinamento | undefined> {
    const [treinamento] = await db.select().from(treinamentos)
      .where(and(
        eq(treinamentos.id, id), 
        eq(treinamentos.unidade, unidade),
        isNull(treinamentos.deletedAt)
      ));
    return treinamento || undefined;
  }

  async createTreinamento(treinamento: InsertTreinamento): Promise<Treinamento> {
    const [newTreinamento] = await db.insert(treinamentos).values(treinamento).returning();
    return newTreinamento;
  }

  async updateTreinamento(id: number, updates: Partial<InsertTreinamento>, unidade: string): Promise<Treinamento | undefined> {
    const [updated] = await db.update(treinamentos)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(and(
        eq(treinamentos.id, id), 
        eq(treinamentos.unidade, unidade),
        isNull(treinamentos.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteTreinamento(id: number, unidade: string): Promise<boolean> {
    const [deleted] = await db.update(treinamentos)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(treinamentos.id, id),
        eq(treinamentos.unidade, unidade)
      ))
      .returning();
    return !!deleted;
  }

  // Treinamento Participantes - verify parent unidade before operations
  async getTreinamentoParticipantes(treinamentoId: number, unidade: string): Promise<TreinamentoParticipante[]> {
    const treinamento = await this.getTreinamentoById(treinamentoId, unidade);
    if (!treinamento) return [];
    return db.select().from(treinamentoParticipantes)
      .where(eq(treinamentoParticipantes.treinamentoId, treinamentoId))
      .orderBy(asc(treinamentoParticipantes.nome));
  }

  async createTreinamentoParticipante(participante: InsertTreinamentoParticipante, unidade: string): Promise<TreinamentoParticipante | null> {
    const treinamento = await this.getTreinamentoById(participante.treinamentoId, unidade);
    if (!treinamento) return null;
    const [newParticipante] = await db.insert(treinamentoParticipantes).values(participante).returning();
    return newParticipante;
  }

  async updateTreinamentoParticipante(id: number, updates: Partial<InsertTreinamentoParticipante>, treinamentoId: number, unidade: string): Promise<TreinamentoParticipante | null> {
    const treinamento = await this.getTreinamentoById(treinamentoId, unidade);
    if (!treinamento) return null;
    const [updated] = await db.update(treinamentoParticipantes)
      .set(updates)
      .where(and(eq(treinamentoParticipantes.id, id), eq(treinamentoParticipantes.treinamentoId, treinamentoId)))
      .returning();
    return updated || null;
  }

  async deleteTreinamentoParticipante(id: number, treinamentoId: number, unidade: string): Promise<boolean> {
    const treinamento = await this.getTreinamentoById(treinamentoId, unidade);
    if (!treinamento) return false;
    await db.delete(treinamentoParticipantes).where(and(eq(treinamentoParticipantes.id, id), eq(treinamentoParticipantes.treinamentoId, treinamentoId)));
    return true;
  }

  // ========== BASE DE CONHECIMENTO ==========
  async getBaseConhecimento(filters?: { unidade?: string; status?: string; tipo?: string; categoria?: string }): Promise<BaseConhecimento[]> {
    const conditions: any[] = [isNull(baseConhecimento.deletedAt)];
    
    if (filters?.unidade) {
      conditions.push(eq(baseConhecimento.unidade, filters.unidade));
    }
    if (filters?.status) {
      conditions.push(eq(baseConhecimento.status, filters.status));
    }
    if (filters?.tipo) {
      conditions.push(eq(baseConhecimento.tipo, filters.tipo));
    }
    if (filters?.categoria) {
      conditions.push(eq(baseConhecimento.categoria, filters.categoria));
    }
    
    return db.select().from(baseConhecimento)
      .where(and(...conditions))
      .orderBy(desc(baseConhecimento.criadoEm));
  }

  async getBaseConhecimentoById(id: number, unidade: string): Promise<BaseConhecimento | undefined> {
    const [item] = await db.select().from(baseConhecimento)
      .where(and(
        eq(baseConhecimento.id, id), 
        eq(baseConhecimento.unidade, unidade),
        isNull(baseConhecimento.deletedAt)
      ));
    return item || undefined;
  }

  async createBaseConhecimento(item: InsertBaseConhecimento): Promise<BaseConhecimento> {
    const [newItem] = await db.insert(baseConhecimento).values(item).returning();
    return newItem;
  }

  async updateBaseConhecimento(id: number, updates: Partial<InsertBaseConhecimento>, unidade: string): Promise<BaseConhecimento | undefined> {
    const [updated] = await db.update(baseConhecimento)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(and(
        eq(baseConhecimento.id, id), 
        eq(baseConhecimento.unidade, unidade),
        isNull(baseConhecimento.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteBaseConhecimento(id: number, unidade: string): Promise<boolean> {
    const [deleted] = await db.update(baseConhecimento)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(baseConhecimento.id, id),
        eq(baseConhecimento.unidade, unidade)
      ))
      .returning();
    return !!deleted;
  }

  async incrementBaseConhecimentoViews(id: number, unidade: string): Promise<void> {
    await db.update(baseConhecimento)
      .set({ visualizacoes: sql`COALESCE(${baseConhecimento.visualizacoes}, 0) + 1` })
      .where(and(
        eq(baseConhecimento.id, id),
        eq(baseConhecimento.unidade, unidade)
      ));
  }

  async incrementBaseConhecimentoDownloads(id: number, unidade: string): Promise<void> {
    await db.update(baseConhecimento)
      .set({ downloads: sql`COALESCE(${baseConhecimento.downloads}, 0) + 1` })
      .where(and(
        eq(baseConhecimento.id, id),
        eq(baseConhecimento.unidade, unidade)
      ));
  }

  // =============================================
  // CAMADAS GEOESPACIAIS
  // =============================================
  
  async getCamadasGeoespaciais(unidade: string): Promise<CamadaGeoespacial[]> {
    return await db.select()
      .from(camadasGeoespaciais)
      .where(and(
        eq(camadasGeoespaciais.unidade, unidade),
        eq(camadasGeoespaciais.ativo, true)
      ))
      .orderBy(asc(camadasGeoespaciais.ordem), asc(camadasGeoespaciais.nome));
  }

  async getCamadaGeoespacial(id: number, unidade: string): Promise<CamadaGeoespacial | undefined> {
    const [camada] = await db.select()
      .from(camadasGeoespaciais)
      .where(and(
        eq(camadasGeoespaciais.id, id),
        eq(camadasGeoespaciais.unidade, unidade)
      ));
    return camada;
  }

  async createCamadaGeoespacial(camada: InsertCamadaGeoespacial): Promise<CamadaGeoespacial> {
    const [newCamada] = await db.insert(camadasGeoespaciais).values(camada).returning();
    return newCamada;
  }

  async updateCamadaGeoespacial(id: number, updates: Partial<InsertCamadaGeoespacial>, unidade: string): Promise<CamadaGeoespacial | undefined> {
    const [updated] = await db.update(camadasGeoespaciais)
      .set({ ...updates, atualizadoEm: new Date() })
      .where(and(
        eq(camadasGeoespaciais.id, id),
        eq(camadasGeoespaciais.unidade, unidade)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteCamadaGeoespacial(id: number, unidade: string): Promise<boolean> {
    const [deleted] = await db.delete(camadasGeoespaciais)
      .where(and(
        eq(camadasGeoespaciais.id, id),
        eq(camadasGeoespaciais.unidade, unidade)
      ))
      .returning();
    return !!deleted;
  }
}

export const storage = new DatabaseStorage();
