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

// Equipamentos table
export const equipamentos = pgTable("equipamentos", {
  id: serial("id").primaryKey(),
  numeroPatrimonio: text("numero_patrimonio").notNull().unique(),
  nome: text("nome").notNull(), // Nome/título do equipamento
  tipoEquipamento: text("tipo_equipamento").notNull(),
  marca: text("marca").notNull(),
  modelo: text("modelo").notNull(),
  dataAquisicao: date("data_aquisicao").notNull(),
  quantidadeTotal: integer("quantidade_total").notNull().default(1), // Quantidade total do equipamento
  quantidadeDisponivel: integer("quantidade_disponivel").notNull().default(1), // Quantidade disponível
  status: text("status").notNull().default("ativo"), // ativo, inativo, obsoleto, em_avaliacao
  localizacaoAtual: text("localizacao_atual").notNull().default("escritorio"), // escritorio, cliente, colaborador
  localizacaoPadrao: text("localizacao_padrao").notNull().default("escritorio"), // Localização padrão do equipamento
  responsavelAtual: text("responsavel_atual"), // Nome do responsável atual
  observacoesGerais: text("observacoes_gerais"),
  qrCode: text("qr_code"), // Hash único para QR Code
  proximaManutencao: date("proxima_manutencao"),
  frequenciaManutencao: text("frequencia_manutencao"), // trimestral, semestral, anual
  vidaUtilEstimada: integer("vida_util_estimada"), // em anos
  valorAquisicao: decimal("valor_aquisicao", { precision: 10, scale: 2 }),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  criadoPor: serial("criado_por").references(() => users.id).notNull(),
});

// Movimentacoes table
export const movimentacoes = pgTable("movimentacoes", {
  id: serial("id").primaryKey(),
  equipamentoId: serial("equipamento_id").references(() => equipamentos.id).notNull(),
  tipoMovimentacao: text("tipo_movimentacao").notNull(), // entrada, retirada, devolucao, manutencao, descarte
  dataHora: timestamp("data_hora").defaultNow().notNull(),
  responsavelAcao: text("responsavel_acao").notNull(),
  quantidadeMovimentada: integer("quantidade_movimentada").notNull().default(1), // Quantidade movimentada
  finalidadeMovimentacao: text("finalidade_movimentacao"),
  observacoes: text("observacoes"),
  comprovante: text("comprovante"), // Path do arquivo de comprovante
  localizacaoOrigem: text("localizacao_origem"),
  localizacaoDestino: text("localizacao_destino"),
  statusAnterior: text("status_anterior"),
  statusPosterior: text("status_posterior"),
  statusMomento: text("status_momento"), // funcionando, com_defeito, avaria_leve, manutencao_programada
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  criadoPor: serial("criado_por").references(() => users.id).notNull(),
});

// Pendencias table - Para controlar retiradas pendentes de devolução
export const pendencias = pgTable("pendencias", {
  id: serial("id").primaryKey(),
  equipamentoId: serial("equipamento_id").references(() => equipamentos.id).notNull(),
  movimentacaoRetiradaId: serial("movimentacao_retirada_id").references(() => movimentacoes.id).notNull(),
  movimentacaoDevolucaoId: serial("movimentacao_devolucao_id").references(() => movimentacoes.id),
  quantidadePendente: integer("quantidade_pendente").notNull(),
  responsavelPendente: text("responsavel_pendente").notNull(),
  dataRetirada: timestamp("data_retirada").notNull(),
  prazoRetorno: date("prazo_retorno"), // Prazo esperado para retorno
  status: text("status").notNull().default("pendente"), // pendente, devolvido, vencido
  observacoes: text("observacoes"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  resolvidoEm: timestamp("resolvido_em"),
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

export const equipamentosRelations = relations(equipamentos, ({ one, many }) => ({
  criadoPorUser: one(users, {
    fields: [equipamentos.criadoPor],
    references: [users.id],
  }),
  movimentacoes: many(movimentacoes),
  pendencias: many(pendencias),
}));

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

export const movimentacoesRelations = relations(movimentacoes, ({ one }) => ({
  equipamento: one(equipamentos, {
    fields: [movimentacoes.equipamentoId],
    references: [equipamentos.id],
  }),
  criadoPorUser: one(users, {
    fields: [movimentacoes.criadoPor],
    references: [users.id],
  }),
}));

export const pendenciasRelations = relations(pendencias, ({ one }) => ({
  equipamento: one(equipamentos, {
    fields: [pendencias.equipamentoId],
    references: [equipamentos.id],
  }),
  movimentacaoRetirada: one(movimentacoes, {
    fields: [pendencias.movimentacaoRetiradaId],
    references: [movimentacoes.id],
  }),
  movimentacaoDevolucao: one(movimentacoes, {
    fields: [pendencias.movimentacaoDevolucaoId],
    references: [movimentacoes.id],
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

export const insertEquipamentoSchema = createInsertSchema(equipamentos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertMovimentacaoSchema = createInsertSchema(movimentacoes).omit({
  id: true,
  criadoEm: true,
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

export const insertPendenciaSchema = createInsertSchema(pendencias).omit({
  id: true,
  criadoEm: true,
  resolvidoEm: true,
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
export type InsertEquipamento = z.infer<typeof insertEquipamentoSchema>;
export type Equipamento = typeof equipamentos.$inferSelect;
export type InsertMovimentacao = z.infer<typeof insertMovimentacaoSchema>;
export type Movimentacao = typeof movimentacoes.$inferSelect;
export type InsertPendencia = z.infer<typeof insertPendenciaSchema>;
export type Pendencia = typeof pendencias.$inferSelect;

// Extended types with relations
export type EmpreendimentoWithLicencas = Empreendimento & {
  licencas: LicencaAmbiental[];
};

export type LicencaWithDetails = LicencaAmbiental & {
  condicionantes: Condicionante[];
  entregas: Entrega[];
};

export type EquipamentoWithMovimentacoes = Equipamento & {
  movimentacoes: Movimentacao[];
};

export type EquipamentoWithDetails = Equipamento & {
  movimentacoes: Movimentacao[];
  pendencias: Pendencia[];
};

export type PendenciaWithDetails = Pendencia & {
  equipamento: Equipamento;
  movimentacaoRetirada: Movimentacao;
  movimentacaoDevolucao?: Movimentacao;
};

export type MovimentacaoWithDetails = Movimentacao & {
  equipamento: Equipamento;
};
