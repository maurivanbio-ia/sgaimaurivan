import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, timestamp, serial, boolean, integer, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const empreendimentos = pgTable("empreendimentos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cliente: text("cliente").notNull(),
  clienteEmail: text("cliente_email"),
  clienteTelefone: text("cliente_telefone"),
  localizacao: text("localizacao").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  responsavelInterno: text("responsavel_interno").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  criadoPor: serial("criado_por").references(() => users.id).notNull(),
});

export const licencasAmbientais = pgTable("licencas_ambientais", {
  id: serial("id").primaryKey(),
  numero: text("numero").notNull(),
  tipo: text("tipo").notNull(),
  orgaoEmissor: text("orgao_emissor").notNull(),
  dataEmissao: date("data_emissao").notNull(),
  validade: date("validade").notNull(),
  status: text("status").notNull(),
  arquivoPdf: text("arquivo_pdf"),
  empreendimentoId: serial("empreendimento_id").references(() => empreendimentos.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const condicionantes = pgTable("condicionantes", {
  id: serial("id").primaryKey(),
  descricao: text("descricao").notNull(),
  prazo: date("prazo").notNull(),
  status: text("status").notNull().default("pendente"), // pendente, cumprida, vencida
  observacoes: text("observacoes"),
  licencaId: serial("licenca_id").references(() => licencasAmbientais.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const entregas = pgTable("entregas", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  prazo: date("prazo").notNull(),
  status: text("status").notNull().default("pendente"), // pendente, entregue, atrasada
  arquivoPdf: text("arquivo_pdf"),
  licencaId: serial("licenca_id").references(() => licencasAmbientais.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Alert configurations table
export const alertConfigs = pgTable("alert_configs", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // licenca, condicionante, entrega
  diasAviso: integer("dias_aviso").notNull(), // 90, 60, 30, 15, 7, 1
  ativo: boolean("ativo").notNull().default(true),
  enviarEmail: boolean("enviar_email").notNull().default(true),
  enviarWhatsapp: boolean("enviar_whatsapp").notNull().default(false),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Notifications table for alert history  
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // licenca, condicionante, entrega
  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  canal: text("canal").notNull(), // email, whatsapp, ambos, sistema
  status: text("status").notNull().default("pendente"), // pendente, enviado, erro
  lida: boolean("lida").notNull().default(false),
  itemId: integer("item_id"), // ID do item relacionado (opcional)
  metadados: json("metadados").default({}), // Dados adicionais em JSON
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  enviadoEm: timestamp("enviado_em"),
});

// Alert history table
export const alertHistory = pgTable("alert_history", {
  id: serial("id").primaryKey(),
  tipoItem: text("tipo_item").notNull(), // licenca, condicionante, entrega
  itemId: integer("item_id").notNull(),
  diasAviso: integer("dias_aviso").notNull(),
  tipoNotificacao: text("tipo_notificacao").notNull(), // email, whatsapp
  status: text("status").notNull(), // enviado, erro, pendente
  tentativas: integer("tentativas").notNull().default(0),
  ultimaTentativa: timestamp("ultima_tentativa"),
  erro: text("erro"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});


// Relations
export const usersRelations = relations(users, ({ many }) => ({
  empreendimentos: many(empreendimentos),
}));

export const empreendimentosRelations = relations(empreendimentos, ({ one, many }) => ({
  criadoPorUser: one(users, {
    fields: [empreendimentos.criadoPor],
    references: [users.id],
  }),
  licencas: many(licencasAmbientais),
}));

export const licencasAmbientaisRelations = relations(licencasAmbientais, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [licencasAmbientais.empreendimentoId],
    references: [empreendimentos.id],
  }),
  condicionantes: many(condicionantes),
  entregas: many(entregas),
}));

export const condicionantesRelations = relations(condicionantes, ({ one }) => ({
  licenca: one(licencasAmbientais, {
    fields: [condicionantes.licencaId],
    references: [licencasAmbientais.id],
  }),
}));

export const entregasRelations = relations(entregas, ({ one }) => ({
  licenca: one(licencasAmbientais, {
    fields: [entregas.licencaId],
    references: [licencasAmbientais.id],
  }),
}));


// Demandas table - Sistema Kanban para gerenciamento de demandas
export const demandas = pgTable("demandas", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  setor: text("setor").notNull(), // Ex: Fauna, RH, Licenciamento, Engenharia
  status: text("status").notNull().default("a_fazer"), // a_fazer, em_andamento, em_revisao, concluido, cancelado
  prioridade: text("prioridade").notNull().default("media"), // baixa, media, alta
  dataEntrega: date("data_entrega").notNull(),
  dataConclusao: date("data_conclusao"),
  empreendimentoId: serial("empreendimento_id").references(() => empreendimentos.id),
  responsavelId: serial("responsavel_id").references(() => users.id).notNull(),
  anexos: text("anexos").array(), // URLs dos arquivos anexados
  tags: text("tags").array(), // Tags opcionais
  tempoEstimado: integer("tempo_estimado"), // em horas
  tempoReal: integer("tempo_real"), // em horas
  observacoes: text("observacoes"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  criadoPor: serial("criado_por").references(() => users.id).notNull(),
});

// Comentários das demandas
export const comentariosDemandas = pgTable("comentarios_demandas", {
  id: serial("id").primaryKey(),
  demandaId: serial("demanda_id").references(() => demandas.id).notNull(),
  autorId: serial("autor_id").references(() => users.id).notNull(),
  comentario: text("comentario").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Subtarefas das demandas
export const subtarefasDemandas = pgTable("subtarefas_demandas", {
  id: serial("id").primaryKey(),
  demandaId: serial("demanda_id").references(() => demandas.id).notNull(),
  titulo: text("titulo").notNull(),
  concluida: boolean("concluida").default(false).notNull(),
  ordem: integer("ordem").default(0).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Histórico de movimentações das demandas (audit trail)
export const historicoDemandasMovimentacoes = pgTable("historico_demandas_movimentacoes", {
  id: serial("id").primaryKey(),
  demandaId: serial("demanda_id").references(() => demandas.id).notNull(),
  usuarioId: serial("usuario_id").references(() => users.id).notNull(),
  acao: text("acao").notNull(), // criou, moveu, comentou, anexou, etc.
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo"),
  descricao: text("descricao"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Relations for demandas tables
export const demandasRelations = relations(demandas, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [demandas.empreendimentoId],
    references: [empreendimentos.id],
  }),
  responsavel: one(users, {
    fields: [demandas.responsavelId],
    references: [users.id],
  }),
  criadoPorUser: one(users, {
    fields: [demandas.criadoPor],
    references: [users.id],
  }),
  comentarios: many(comentariosDemandas),
  subtarefas: many(subtarefasDemandas),
  historico: many(historicoDemandasMovimentacoes),
}));

export const comentariosDemandasRelations = relations(comentariosDemandas, ({ one }) => ({
  demanda: one(demandas, {
    fields: [comentariosDemandas.demandaId],
    references: [demandas.id],
  }),
  autor: one(users, {
    fields: [comentariosDemandas.autorId],
    references: [users.id],
  }),
}));

export const subtarefasDemandasRelations = relations(subtarefasDemandas, ({ one }) => ({
  demanda: one(demandas, {
    fields: [subtarefasDemandas.demandaId],
    references: [demandas.id],
  }),
}));

export const historicoDemandasMovimentacoesRelations = relations(historicoDemandasMovimentacoes, ({ one }) => ({
  demanda: one(demandas, {
    fields: [historicoDemandasMovimentacoes.demandaId],
    references: [demandas.id],
  }),
  usuario: one(users, {
    fields: [historicoDemandasMovimentacoes.usuarioId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertEmpreendimentoSchema = createInsertSchema(empreendimentos).omit({
  id: true,
  criadoEm: true,
});

export const insertLicencaAmbientalSchema = createInsertSchema(licencasAmbientais).omit({
  id: true,
  criadoEm: true,
  status: true,
});

export const insertCondicionanteSchema = createInsertSchema(condicionantes).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertEntregaSchema = createInsertSchema(entregas).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertAlertConfigSchema = createInsertSchema(alertConfigs).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  criadoEm: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  criadoEm: true,
  enviadoEm: true,
});


export const insertDemandaSchema = createInsertSchema(demandas).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertComentarioDemandaSchema = createInsertSchema(comentariosDemandas).omit({
  id: true,
  criadoEm: true,
});

export const insertSubtarefaDemandaSchema = createInsertSchema(subtarefasDemandas).omit({
  id: true,
  criadoEm: true,
});

export const insertHistoricoMovimentacaoSchema = createInsertSchema(historicoDemandasMovimentacoes).omit({
  id: true,
  criadoEm: true,
});


// =============================================
// FINANCIAL MODULE SCHEMA
// =============================================

// Categorias Financeiras
export const categoriasFinanceiras = pgTable("categorias_financeiras", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(), // Ex: Aluguel, Veículo, Hospedagem, Material, Combustivel, Alimentação
  tipo: text("tipo").notNull(), // receita, despesa
  cor: text("cor").notNull().default("#3b82f6"), // Cor para visualização no dashboard
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Lançamentos Financeiros
export const financeiroLancamentos = pgTable("financeiro_lancamentos", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // receita, despesa, reembolso, solicitacao_recurso
  empreendimentoId: serial("empreendimento_id").references(() => empreendimentos.id).notNull(),
  categoriaId: serial("categoria_id").references(() => categoriasFinanceiras.id).notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  data: date("data").notNull(),
  descricao: text("descricao").notNull(),
  status: text("status").notNull().default("aguardando"), // aguardando, aprovado, pago, recusado
  comprovanteUrl: text("comprovante_url"), // URL do arquivo de comprovante
  observacoes: text("observacoes"),
  criadoPor: serial("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Solicitações de Recursos
export const solicitacoesRecursos = pgTable("solicitacoes_recursos", {
  id: serial("id").primaryKey(),
  solicitanteId: serial("solicitante_id").references(() => users.id).notNull(),
  empreendimentoId: serial("empreendimento_id").references(() => empreendimentos.id).notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  justificativa: text("justificativa").notNull(),
  tipoGasto: text("tipo_gasto").notNull(), // Ex: material, equipamento, viagem, etc.
  prazoDesejado: date("prazo_desejado"),
  status: text("status").notNull().default("pendente"), // pendente, aprovado, recusado, solicitar_ajuste
  diretorId: serial("diretor_id").references(() => users.id), // Quem aprovou/recusou
  decisao: text("decisao"), // aprovado, recusado, solicitar_ajuste
  comentarioDiretor: text("comentario_diretor"),
  aprovadomEm: timestamp("aprovado_em"),
  comprovanteUrl: text("comprovante_url"), // Orçamento ou comprovante anexado
  data: date("data").defaultNow().notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Orçamentos por Empreendimento
export const orcamentos = pgTable("orcamentos", {
  id: serial("id").primaryKey(),
  empreendimentoId: serial("empreendimento_id").references(() => empreendimentos.id).notNull(),
  valorOrcamento: decimal("valor_orcamento", { precision: 12, scale: 2 }).notNull(),
  periodo: text("periodo").notNull(), // Ex: "2024", "2024-Q1", "2024-01" 
  descricao: text("descricao"),
  criadoPor: serial("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Relations for financial tables
export const categoriasFinanceirasRelations = relations(categoriasFinanceiras, ({ many }) => ({
  lancamentos: many(financeiroLancamentos),
}));

export const financeiroLancamentosRelations = relations(financeiroLancamentos, ({ one }) => ({
  empreendimento: one(empreendimentos, {
    fields: [financeiroLancamentos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  categoria: one(categoriasFinanceiras, {
    fields: [financeiroLancamentos.categoriaId],
    references: [categoriasFinanceiras.id],
  }),
  criadoPorUser: one(users, {
    fields: [financeiroLancamentos.criadoPor],
    references: [users.id],
  }),
}));

export const solicitacoesRecursosRelations = relations(solicitacoesRecursos, ({ one }) => ({
  solicitante: one(users, {
    fields: [solicitacoesRecursos.solicitanteId],
    references: [users.id],
  }),
  empreendimento: one(empreendimentos, {
    fields: [solicitacoesRecursos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  diretor: one(users, {
    fields: [solicitacoesRecursos.diretorId],
    references: [users.id],
  }),
}));

export const orcamentosRelations = relations(orcamentos, ({ one }) => ({
  empreendimento: one(empreendimentos, {
    fields: [orcamentos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  criadoPorUser: one(users, {
    fields: [orcamentos.criadoPor],
    references: [users.id],
  }),
}));

// Financial insert schemas
export const insertCategoriaFinanceiraSchema = createInsertSchema(categoriasFinanceiras).omit({
  id: true,
  criadoEm: true,
});

export const insertFinanceiroLancamentoSchema = createInsertSchema(financeiroLancamentos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertSolicitacaoRecursoSchema = createInsertSchema(solicitacoesRecursos).omit({
  id: true,
  criadoEm: true,
  aprovadomEm: true,
});

export const insertOrcamentoSchema = createInsertSchema(orcamentos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

// Demandas types
export type InsertDemanda = z.infer<typeof insertDemandaSchema>;
export type Demanda = typeof demandas.$inferSelect;
export type InsertComentarioDemanda = z.infer<typeof insertComentarioDemandaSchema>;
export type ComentarioDemanda = typeof comentariosDemandas.$inferSelect;
export type InsertSubtarefaDemanda = z.infer<typeof insertSubtarefaDemandaSchema>;
export type SubtarefaDemanda = typeof subtarefasDemandas.$inferSelect;
export type InsertHistoricoMovimentacao = z.infer<typeof insertHistoricoMovimentacaoSchema>;
export type HistoricoMovimentacao = typeof historicoDemandasMovimentacoes.$inferSelect;

// Financial types
export type InsertCategoriaFinanceira = z.infer<typeof insertCategoriaFinanceiraSchema>;
export type CategoriaFinanceira = typeof categoriasFinanceiras.$inferSelect;
export type InsertFinanceiroLancamento = z.infer<typeof insertFinanceiroLancamentoSchema>;
export type FinanceiroLancamento = typeof financeiroLancamentos.$inferSelect;
export type InsertSolicitacaoRecurso = z.infer<typeof insertSolicitacaoRecursoSchema>;
export type SolicitacaoRecurso = typeof solicitacoesRecursos.$inferSelect;
export type InsertOrcamento = z.infer<typeof insertOrcamentoSchema>;
export type Orcamento = typeof orcamentos.$inferSelect;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEmpreendimento = z.infer<typeof insertEmpreendimentoSchema>;
export type Empreendimento = typeof empreendimentos.$inferSelect;
export type InsertLicencaAmbiental = z.infer<typeof insertLicencaAmbientalSchema>;
export type LicencaAmbiental = typeof licencasAmbientais.$inferSelect;
export type InsertCondicionante = z.infer<typeof insertCondicionanteSchema>;
export type Condicionante = typeof condicionantes.$inferSelect;
export type InsertEntrega = z.infer<typeof insertEntregaSchema>;
export type Entrega = typeof entregas.$inferSelect;
export type InsertAlertConfig = z.infer<typeof insertAlertConfigSchema>;
export type AlertConfig = typeof alertConfigs.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Extended types with relations
export type EmpreendimentoWithLicencas = Empreendimento & {
  licencas: LicencaAmbiental[];
};

export type LicencaWithDetails = LicencaAmbiental & {
  condicionantes: Condicionante[];
  entregas: Entrega[];
};

