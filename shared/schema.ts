import { sql } from "drizzle-orm";
import { pgTable, text, varchar, date, timestamp, serial, boolean, integer, decimal, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("colaborador"), // admin ou colaborador
  cargo: text("cargo").notNull().default("colaborador"), // coordenador, diretor, rh, financeiro, colaborador
  unidade: text("unidade").notNull().default("salvador"), // unidade padrão
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const empreendimentos = pgTable("empreendimentos", {
  id: serial("id").primaryKey(),
  codigo: text("codigo"), // Código único do projeto para estrutura de pastas (ex: PROJ001)
  nome: text("nome").notNull(),
  cliente: text("cliente").notNull(),
  clienteId: integer("cliente_id"),
  clienteEmail: text("cliente_email"),
  clienteTelefone: text("cliente_telefone"),
  localizacao: text("localizacao").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  responsavelInterno: text("responsavel_interno").notNull(),
  // Campos expandidos
  tipo: text("tipo").notNull().default("outro"), // hidreletrica, parque_eolico, usina_solar, termoeletrica, linha_transmissao, mina, pchs, outro
  status: text("status").notNull().default("ativo"), // ativo, em_planejamento, em_execucao, concluido, inativo
  municipio: text("municipio"),
  uf: text("uf"),
  descricao: text("descricao"),
  gestorNome: text("gestor_nome"),
  gestorEmail: text("gestor_email"),
  gestorTelefone: text("gestor_telefone"),
  visivel: boolean("visivel").notNull().default(true),
  dataInicio: date("data_inicio"),
  dataFimPrevista: date("data_fim_prevista"),
  dataFimReal: date("data_fim_real"),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  // Campos para gamificação e acompanhamento financeiro
  coordenadorId: integer("coordenador_id").references(() => users.id), // Coordenador responsável pelo projeto
  valorContratado: decimal("valor_contratado", { precision: 15, scale: 2 }).default("0"), // Valor hipotético (contrato)
  valorRecebido: decimal("valor_recebido", { precision: 15, scale: 2 }).default("0"), // Valor real (efetivamente recebido)
  orcamentoPrevisto: decimal("orcamento_previsto", { precision: 15, scale: 2 }).default("0"), // Orçamento de gastos previsto
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
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
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const condicionantes = pgTable("condicionantes", {
  id: serial("id").primaryKey(),
  descricao: text("descricao").notNull(),
  prazo: date("prazo").notNull(),
  status: text("status").notNull().default("pendente"), // pendente, cumprida, vencida
  observacoes: text("observacoes"),
  licencaId: integer("licenca_id").references(() => licencasAmbientais.id).notNull(),
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
  licencaId: integer("licenca_id").references(() => licencasAmbientais.id).notNull(),
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

// =============================================
// ARQUIVOS MODULE - Armazenamento de PDFs e documentos
// =============================================
export const arquivos = pgTable("arquivos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  mime: text("mime").notNull(),
  tamanho: integer("tamanho").notNull(), // em bytes
  caminho: text("caminho").notNull(),
  checksum: text("checksum"),
  origem: text("origem"), // contrato, licenca, condicionante, etc
  uploaderId: integer("uploader_id").references(() => users.id),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// =============================================
// CAMPANHAS MODULE
// =============================================
export const campanhas = pgTable("campanhas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  periodoInicio: date("periodo_inicio").notNull(),
  periodoFim: date("periodo_fim").notNull(),
  descricao: text("descricao"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// =============================================
// CONTRATOS MODULE
// =============================================
export const contratos = pgTable("contratos", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  numero: text("numero").notNull(),
  objeto: text("objeto").notNull(),
  centroCusto: text("centro_custo"),
  municipioUf: text("municipio_uf"),
  dataProposta: date("data_proposta"),
  referencia: text("referencia"),
  vigenciaInicio: date("vigencia_inicio").notNull(),
  vigenciaFim: date("vigencia_fim").notNull(),
  situacao: text("situacao").notNull().default("vigente"), // vigente, vencido, rescindido
  valorTotal: decimal("valor_total", { precision: 12, scale: 2 }).notNull(),
  condPagto: text("cond_pagto"),
  formaPagto: text("forma_pagto"),
  banco: text("banco"),
  agencia: text("agencia"),
  conta: text("conta"),
  observacoes: text("observacoes"),
  // Contratada
  contratadaRazao: text("contratada_razao"),
  contratadaCnpj: text("contratada_cnpj"),
  contratadaEndereco: text("contratada_endereco"),
  contratadaBairro: text("contratada_bairro"),
  contratadaMunicipioUf: text("contratada_municipio_uf"),
  // Contratante
  contratanteRazao: text("contratante_razao"),
  contratanteCnpj: text("contratante_cnpj"),
  contratanteRepresentante: text("contratante_representante"),
  contratanteCargo: text("contratante_cargo"),
  contratanteQualificacao: text("contratante_qualificacao"),
  contratanteEndereco: text("contratante_endereco"),
  contratanteMunicipioUf: text("contratante_municipio_uf"),
  contratanteContato: text("contratante_contato"),
  contratanteEmailFin: text("contratante_email_fin"),
  arquivoPdfId: integer("arquivo_pdf_id").references(() => arquivos.id),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const contratoAditivos = pgTable("contrato_aditivos", {
  id: serial("id").primaryKey(),
  contratoId: integer("contrato_id").references(() => contratos.id).notNull(),
  descricao: text("descricao").notNull(),
  valorAdicional: decimal("valor_adicional", { precision: 12, scale: 2 }),
  vigenciaNovaFim: date("vigencia_nova_fim"),
  dataAssinatura: date("data_assinatura").notNull(),
  arquivoPdfId: integer("arquivo_pdf_id").references(() => arquivos.id),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const contratoPagamentos = pgTable("contrato_pagamentos", {
  id: serial("id").primaryKey(),
  contratoId: integer("contrato_id").references(() => contratos.id).notNull(),
  descricao: text("descricao").notNull(),
  valorPrevisto: decimal("valor_previsto", { precision: 12, scale: 2 }).notNull(),
  dataPrevista: date("data_prevista").notNull(),
  valorPago: decimal("valor_pago", { precision: 12, scale: 2 }),
  dataPagamento: date("data_pagamento"),
  status: text("status").notNull().default("pendente"), // pago, pendente, atrasado
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// =============================================
// CRONOGRAMA MODULE
// =============================================
export const cronogramaItens = pgTable("cronograma_itens", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  projetoId: integer("projeto_id"), // Vinculo opcional com projeto
  demandaId: integer("demanda_id"), // Vinculo opcional com demanda
  tipo: text("tipo").notNull().default("etapa"), // campanha, relatorio, marco, etapa
  titulo: text("titulo").notNull(), // Nome do item (substituindo etapa)
  etapa: text("etapa"), // Mantido para compatibilidade
  descricao: text("descricao"),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim").notNull(),
  status: text("status").notNull().default("pendente"), // pendente, em_andamento, concluido, atrasado
  concluido: boolean("concluido").notNull().default(false),
  responsavel: text("responsavel"),
  observacoes: text("observacoes"),
  prioridade: text("prioridade").default("media"), // baixa, media, alta
  unidade: text("unidade").notNull().default('goiania'),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const cronogramaItensRelations = relations(cronogramaItens, ({ one }) => ({
  empreendimento: one(empreendimentos, {
    fields: [cronogramaItens.empreendimentoId],
    references: [empreendimentos.id],
  }),
}));

export type CronogramaItem = typeof cronogramaItens.$inferSelect;

// =============================================
// RH MODULE - Recursos Humanos por empreendimento
// =============================================
export const rhRegistros = pgTable("rh_registros", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  fornecedor: text("fornecedor"),
  nomeColaborador: text("nome_colaborador").notNull(),
  cargo: text("cargo"), // Consultor, Coordenador, Piloto Fluvial, Auxiliar de Campo, etc.
  cpf: text("cpf"),
  rg: text("rg"),
  cnh: text("cnh"),
  cnhCategoria: text("cnh_categoria"),
  cnhVencimento: date("cnh_vencimento"),
  certificadosJson: json("certificados_json").default([]),
  examesJson: json("exames_json").default([]),
  seguroNumero: text("seguro_numero"),
  valorTipo: text("valor_tipo"), // hora, dia, mes
  valor: decimal("valor", { precision: 12, scale: 2 }),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  contatoEmail: text("contato_email"),
  contatoTelefone: text("contato_telefone"),
  arquivosIdsJson: json("arquivos_ids_json").default([]),
  // Regime de Contratação
  regimeContratacao: text("regime_contratacao"), // 'CLT' ou 'PJ'
  // Documentos PJ
  contratoPjUrl: text("contrato_pj_url"), // URL do contrato de prestação de serviços
  cnpj: text("cnpj"), // CNPJ da empresa PJ
  razaoSocial: text("razao_social"), // Razão social da empresa PJ
  // Documentos CLT
  ctpsNumero: text("ctps_numero"), // Número da carteira de trabalho
  ctpsSerie: text("ctps_serie"), // Série da CTPS
  pis: text("pis"), // Número do PIS
  contratoTrabalhoUrl: text("contrato_trabalho_url"), // URL do contrato de trabalho CLT
  fichaRegistroUrl: text("ficha_registro_url"), // URL da ficha de registro
  documentosCltJson: json("documentos_clt_json").default([]), // Outros documentos CLT
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// =============================================
// JOBS AGENDADOS - Para automações
// =============================================
export const jobsAgendados = pgTable("jobs_agendados", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // alerta_licenca, relatorio_semanal, demanda_recorrente, pagamento_atrasado
  referencia: text("referencia"), // ID do item relacionado
  payloadJson: json("payload_json").default({}),
  proximaExecucaoEm: timestamp("proxima_execucao_em").notNull(),
  cron: text("cron"),
  ativo: boolean("ativo").notNull().default(true),
  ultimaExecucaoEm: timestamp("ultima_execucao_em"),
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
  complexidade: text("complexidade").notNull().default("media"), // baixa, media, alta - para gamificação
  categoria: text("categoria").notNull().default("geral"), // reuniao, relatorio_tecnico, documento, campo, vistoria, licenciamento, analise, outro
  dataEntrega: date("data_entrega").notNull(),
  dataConclusao: date("data_conclusao"),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  responsavelId: integer("responsavel_id").references(() => users.id).notNull(),
  anexos: text("anexos").array(), // URLs dos arquivos anexados
  tags: text("tags").array(), // Tags opcionais
  tempoEstimado: integer("tempo_estimado"), // em horas
  tempoReal: integer("tempo_real"), // em horas
  observacoes: text("observacoes"),
  // Campos novos para integração
  origem: text("origem"), // manual, campanha, contrato, licenca
  campanhaId: integer("campanha_id").references(() => campanhas.id),
  contratoId: integer("contrato_id").references(() => contratos.id),
  recorrente: boolean("recorrente").notNull().default(false),
  recorrenciaCron: text("recorrencia_cron"), // expressão cron para repetição
  recorrenciaFim: date("recorrencia_fim"), // data final para parar de gerar instâncias
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
});

// Comentários das demandas
export const comentariosDemandas = pgTable("comentarios_demandas", {
  id: serial("id").primaryKey(),
  demandaId: integer("demanda_id").references(() => demandas.id, { onDelete: "cascade" }).notNull(),
  autorId: integer("autor_id").references(() => users.id).notNull(),
  comentario: text("comentario").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Subtarefas das demandas
export const subtarefasDemandas = pgTable("subtarefas_demandas", {
  id: serial("id").primaryKey(),
  demandaId: integer("demanda_id").references(() => demandas.id, { onDelete: "cascade" }).notNull(),
  titulo: text("titulo").notNull(),
  concluida: boolean("concluida").default(false).notNull(),
  ordem: integer("ordem").default(0).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Histórico de movimentações das demandas (audit trail)
export const historicoDemandasMovimentacoes = pgTable("historico_demandas_movimentacoes", {
  id: serial("id").primaryKey(),
  demandaId: integer("demanda_id").references(() => demandas.id, { onDelete: "set null" }),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
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
  campanha: one(campanhas, {
    fields: [demandas.campanhaId],
    references: [campanhas.id],
  }),
  contrato: one(contratos, {
    fields: [demandas.contratoId],
    references: [contratos.id],
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

// Relations for new tables
export const arquivosRelations = relations(arquivos, ({ one }) => ({
  uploader: one(users, {
    fields: [arquivos.uploaderId],
    references: [users.id],
  }),
}));

export const campanhasRelations = relations(campanhas, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [campanhas.empreendimentoId],
    references: [empreendimentos.id],
  }),
  demandas: many(demandas),
}));

export const contratosRelations = relations(contratos, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [contratos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  arquivoPdf: one(arquivos, {
    fields: [contratos.arquivoPdfId],
    references: [arquivos.id],
  }),
  aditivos: many(contratoAditivos),
  pagamentos: many(contratoPagamentos),
  demandas: many(demandas),
}));

export const contratoAditivosRelations = relations(contratoAditivos, ({ one }) => ({
  contrato: one(contratos, {
    fields: [contratoAditivos.contratoId],
    references: [contratos.id],
  }),
  arquivoPdf: one(arquivos, {
    fields: [contratoAditivos.arquivoPdfId],
    references: [arquivos.id],
  }),
}));

export const contratoPagamentosRelations = relations(contratoPagamentos, ({ one }) => ({
  contrato: one(contratos, {
    fields: [contratoPagamentos.contratoId],
    references: [contratos.id],
  }),
}));

export const rhRegistrosRelations = relations(rhRegistros, ({ one }) => ({
  empreendimento: one(empreendimentos, {
    fields: [rhRegistros.empreendimentoId],
    references: [empreendimentos.id],
  }),
}));

// =============================================
// AI AGENT MODULE - Agente conversacional EcoGestor-AI
// =============================================
export const aiDocuments = pgTable("ai_documents", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  source: text("source").notNull(), // nome do arquivo ou módulo
  sourceType: text("source_type").notNull(), // pdf, xlsx, database, contrato, licenca, etc
  content: text("content").notNull(), // conteúdo extraído do documento
  embedding: text("embedding"), // JSON string com array de embeddings (OpenAI)
  metadata: json("metadata").default({}), // informações adicionais (data, autor, etc)
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(), // mensagem do usuário
  response: text("response").notNull(), // resposta do agente
  context: json("context").default({}), // contexto usado (empreendimento_id, etc)
  metadata: json("metadata").default({}), // informações adicionais
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const aiLogs = pgTable("ai_logs", {
  id: serial("id").primaryKey(),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // index_document, query, generate_report, etc
  details: json("details").default({}), // detalhes da ação
  status: text("status").notNull().default("success"), // success, error
  error: text("error"), // mensagem de erro se houver
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
  atualizadoEm: true,
  deletedAt: true,
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

// Insert schemas for new tables
export const insertArquivoSchema = createInsertSchema(arquivos).omit({
  id: true,
  criadoEm: true,
});

export const insertCampanhaSchema = createInsertSchema(campanhas).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertContratoSchema = createInsertSchema(contratos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
});

export const insertContratoAditivoSchema = createInsertSchema(contratoAditivos).omit({
  id: true,
  criadoEm: true,
});

export const insertContratoPagamentoSchema = createInsertSchema(contratoPagamentos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertCronogramaItemSchema = createInsertSchema(cronogramaItens).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertRhRegistroSchema = createInsertSchema(rhRegistros).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
});

export const insertJobAgendadoSchema = createInsertSchema(jobsAgendados).omit({
  id: true,
  criadoEm: true,
  ultimaExecucaoEm: true,
});

export const insertAiDocumentSchema = createInsertSchema(aiDocuments).omit({
  id: true,
  criadoEm: true,
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  criadoEm: true,
});

export const insertAiLogSchema = createInsertSchema(aiLogs).omit({
  id: true,
  criadoEm: true,
});

// =============================================
// EQUIPMENT MODULE SCHEMA
// =============================================

// Equipamentos table
export const equipamentos = pgTable("equipamentos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(), // Veículo, GPS, Drone, Armadilha, Estação Meteorológica, etc.
  localizacaoAtual: text("localizacao_atual").notNull(),
  status: text("status").notNull().default("disponivel"), // disponivel, em_uso, manutencao
  responsavel: text("responsavel"),
  ultimaManutencao: date("ultima_manutencao"),
  proximaManutencao: date("proxima_manutencao"),
  numeroPatrimonio: text("numero_patrimonio"),
  marca: text("marca"),
  modelo: text("modelo"),
  valorAquisicao: decimal("valor_aquisicao", { precision: 12, scale: 2 }),
  dataAquisicao: date("data_aquisicao"),
  observacoes: text("observacoes"),
  imagensDanoJson: text("imagens_dano_json"), // JSON array de URLs de imagens de danos/avarias
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
});

// Relations
export const equipamentosRelations = relations(equipamentos, ({ one }) => ({
  empreendimento: one(empreendimentos, {
    fields: [equipamentos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  criadoPorUser: one(users, {
    fields: [equipamentos.criadoPor],
    references: [users.id],
  }),
}));

// =============================================
// FLEET MODULE SCHEMA (Veículos)
// =============================================

export const veiculos = pgTable("veiculos", {
  id: serial("id").primaryKey(),
  placa: text("placa").notNull().unique(),
  marca: text("marca").notNull(),
  modelo: text("modelo").notNull(),
  ano: integer("ano").notNull(),
  tipo: text("tipo").notNull(), // carro, caminhonete, caminhao, van, moto
  status: text("status").notNull().default("disponivel"), // disponivel, em_uso, manutencao, indisponivel
  kmAtual: integer("km_atual").notNull().default(0),
  combustivel: text("combustivel").notNull(), // gasolina, etanol, diesel, flex
  seguro: text("seguro").notNull(),
  seguroVencimento: date("seguro_vencimento"),
  ipvaVencimento: date("ipva_vencimento"),
  licenciamentoVencimento: date("licenciamento_vencimento"),
  proximaRevisao: date("proxima_revisao").notNull(),
  kmProximaRevisao: integer("km_proxima_revisao"),
  responsavelAtual: text("responsavel_atual"),
  localizacaoAtual: text("localizacao_atual").notNull(),
  observacoes: text("observacoes"),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  tipoPropriedade: text("tipo_propriedade").notNull().default("proprio"), // proprio, alugado
  termoVistoriaId: integer("termo_vistoria_id").references(() => arquivos.id),
  dataAluguel: date("data_aluguel"),
  dataEntrega: date("data_entrega"),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
});

export const veiculosRelations = relations(veiculos, ({ one }) => ({
  empreendimento: one(empreendimentos, {
    fields: [veiculos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  criadoPorUser: one(users, {
    fields: [veiculos.criadoPor],
    references: [users.id],
  }),
}));

export type Veiculo = typeof veiculos.$inferSelect;
export type InsertVeiculo = z.infer<typeof insertVeiculoSchema>;

export const insertVeiculoSchema = createInsertSchema(veiculos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  criadoPor: true,
});

// =============================================
// PROJETOS - Projetos dentro de Empreendimentos
// =============================================

export const projetos = pgTable("projetos", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  status: text("status").notNull().default("ativo"), // ativo, em_andamento, concluido, pausado, cancelado
  coordenadorId: integer("coordenador_id").references(() => users.id),
  // Valores financeiros para gamificação
  valorContratado: decimal("valor_contratado", { precision: 15, scale: 2 }).default("0"), // Valor hipotético (contrato)
  valorRecebido: decimal("valor_recebido", { precision: 15, scale: 2 }).default("0"), // Valor real recebido
  orcamentoPrevisto: decimal("orcamento_previsto", { precision: 15, scale: 2 }).default("0"), // Orçamento de gastos previsto
  metaReducaoGastos: decimal("meta_reducao_gastos", { precision: 5, scale: 2 }).default("0"), // Meta de redução em %
  // Datas
  inicioPrevisto: date("inicio_previsto"),
  inicioReal: date("inicio_real"),
  fimPrevisto: date("fim_previsto"),
  fimReal: date("fim_real"),
  // BMM e ND
  bmmServicos: text("bmm_servicos"), // Número do BMM - Serviços
  ndReembolsaveis: text("nd_reembolsaveis"), // Número ND - Reembolsáveis
  // Timestamps
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const projetosRelations = relations(projetos, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [projetos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  coordenador: one(users, {
    fields: [projetos.coordenadorId],
    references: [users.id],
  }),
}));

export type Projeto = typeof projetos.$inferSelect;
export type InsertProjeto = z.infer<typeof insertProjetoSchema>;

export const insertProjetoSchema = createInsertSchema(projetos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
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
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  projetoId: integer("projeto_id").references(() => projetos.id), // Projeto vinculado (opcional)
  categoriaId: integer("categoria_id").references(() => categoriasFinanceiras.id).notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  data: date("data").notNull(),
  dataVencimento: date("data_vencimento"), // Data de vencimento
  dataPagamento: date("data_pagamento"), // Data em que foi efetivamente pago
  descricao: text("descricao").notNull(),
  status: text("status").notNull().default("aguardando"), // aguardando, aprovado, pago, recusado
  // BMM e ND para rastreamento
  bmmServicos: text("bmm_servicos"), // Número BMM - Serviços
  ndReembolsaveis: text("nd_reembolsaveis"), // Número ND - Reembolsáveis
  statusPagamento: text("status_pagamento").notNull().default("pendente"), // pendente, pago
  comprovanteUrl: text("comprovante_url"), // URL do arquivo de comprovante
  observacoes: text("observacoes"),
  unidade: text("unidade").notNull().default('salvador'), // unidade padrão
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Solicitações de Recursos
export const solicitacoesRecursos = pgTable("solicitacoes_recursos", {
  id: serial("id").primaryKey(),
  solicitanteId: integer("solicitante_id").references(() => users.id).notNull(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(),
  justificativa: text("justificativa").notNull(),
  tipoGasto: text("tipo_gasto").notNull(), // Ex: material, equipamento, viagem, etc.
  prazoDesejado: date("prazo_desejado"),
  status: text("status").notNull().default("pendente"), // pendente, aprovado, recusado, solicitar_ajuste
  diretorId: integer("diretor_id").references(() => users.id), // Quem aprovou/recusou
  decisao: text("decisao"), // aprovado, recusado, solicitar_ajuste
  comentarioDiretor: text("comentario_diretor"),
  aprovadomEm: timestamp("aprovado_em"),
  comprovanteUrl: text("comprovante_url"), // Orçamento ou comprovante anexado
  data: date("data").defaultNow().notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Rateio Financeiro - divisão de custos entre empresas
export const financeiroRateios = pgTable("financeiro_rateios", {
  id: serial("id").primaryKey(),
  lancamentoId: integer("lancamento_id").references(() => financeiroLancamentos.id).notNull(),
  empresaNome: text("empresa_nome").notNull(), // Nome da empresa que pagou
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull(), // Valor pago por esta empresa
  observacao: text("observacao"), // Observação opcional
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Orçamentos por Empreendimento
export const orcamentos = pgTable("orcamentos", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  valorOrcamento: decimal("valor_orcamento", { precision: 12, scale: 2 }).notNull(),
  periodo: text("periodo").notNull(), // Ex: "2024", "2024-Q1", "2024-01" 
  descricao: text("descricao"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Relations for financial tables
export const categoriasFinanceirasRelations = relations(categoriasFinanceiras, ({ many }) => ({
  lancamentos: many(financeiroLancamentos),
}));

export const financeiroLancamentosRelations = relations(financeiroLancamentos, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [financeiroLancamentos.empreendimentoId],
    references: [empreendimentos.id],
  }),
  projeto: one(projetos, {
    fields: [financeiroLancamentos.projetoId],
    references: [projetos.id],
  }),
  categoria: one(categoriasFinanceiras, {
    fields: [financeiroLancamentos.categoriaId],
    references: [categoriasFinanceiras.id],
  }),
  criadoPorUser: one(users, {
    fields: [financeiroLancamentos.criadoPor],
    references: [users.id],
  }),
  rateios: many(financeiroRateios),
}));

export const financeiroRateiosRelations = relations(financeiroRateios, ({ one }) => ({
  lancamento: one(financeiroLancamentos, {
    fields: [financeiroRateios.lancamentoId],
    references: [financeiroLancamentos.id],
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

// Equipment insert schemas
export const insertEquipamentoSchema = createInsertSchema(equipamentos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

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

export const insertFinanceiroRateioSchema = createInsertSchema(financeiroRateios).omit({
  id: true,
  criadoEm: true,
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

// Equipment types
export type InsertEquipamento = z.infer<typeof insertEquipamentoSchema>;
export type Equipamento = typeof equipamentos.$inferSelect;

// Financial types
export type InsertCategoriaFinanceira = z.infer<typeof insertCategoriaFinanceiraSchema>;
export type CategoriaFinanceira = typeof categoriasFinanceiras.$inferSelect;
export type InsertFinanceiroLancamento = z.infer<typeof insertFinanceiroLancamentoSchema>;
export type FinanceiroLancamento = typeof financeiroLancamentos.$inferSelect;
export type InsertFinanceiroRateio = z.infer<typeof insertFinanceiroRateioSchema>;
export type FinanceiroRateio = typeof financeiroRateios.$inferSelect;
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

// Types for new tables
export type InsertArquivo = z.infer<typeof insertArquivoSchema>;
export type Arquivo = typeof arquivos.$inferSelect;
export type InsertCampanha = z.infer<typeof insertCampanhaSchema>;
export type Campanha = typeof campanhas.$inferSelect;
export type InsertContrato = z.infer<typeof insertContratoSchema>;
export type Contrato = typeof contratos.$inferSelect;
export type InsertContratoAditivo = z.infer<typeof insertContratoAditivoSchema>;
export type ContratoAditivo = typeof contratoAditivos.$inferSelect;
export type InsertContratoPagamento = z.infer<typeof insertContratoPagamentoSchema>;
export type ContratoPagamento = typeof contratoPagamentos.$inferSelect;
export type InsertCronogramaItem = z.infer<typeof insertCronogramaItemSchema>;
export type CronogramaItem = typeof cronogramaItens.$inferSelect;
export type InsertRhRegistro = z.infer<typeof insertRhRegistroSchema>;
export type RhRegistro = typeof rhRegistros.$inferSelect;
export type InsertJobAgendado = z.infer<typeof insertJobAgendadoSchema>;
export type JobAgendado = typeof jobsAgendados.$inferSelect;

// =============================================
// DATASETS MODULE - GESTÃO DE DADOS
// =============================================

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").notNull(), // csv, xlsx, pdf, docx, outro
  tamanho: integer("tamanho").notNull(), // em bytes
  usuario: text("usuario").notNull(),
  dataUpload: timestamp("data_upload").defaultNow().notNull(),
  url: text("url").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  // Novos campos para código padronizado
  codigoArquivo: text("codigo_arquivo"), // Código gerado automaticamente ECOBRASIL-...
  cliente: text("cliente"),
  uf: text("uf"),
  projeto: text("projeto"),
  subprojeto: text("subprojeto"),
  disciplina: text("disciplina"), // FAU, FLO, HID, QUI, GEO, SOC, SIG, ENG, JUR, ESG, GPR
  tipoDocumento: text("tipo_documento"), // REL, NT, OF, MEM, ATA, APR, MAP, DAT, MET, LAU
  entrega: text("entrega"), // D0, D1, D2, REV, RES, PROT
  area: text("area"),
  periodo: text("periodo"),
  dataReferencia: text("data_referencia"), // AAAAMMDD
  responsavel: text("responsavel"),
  versao: text("versao").default("V0.1"),
  status: text("status").default("RASC"), // RASC, PRELIM, FINAL, ASSIN, PROTOC, ENVIADO, ARQ
  classificacao: text("classificacao").default("INT"), // PUB, INT, CONF, LGPD
  titulo: text("titulo"),
  pastaDestino: text("pasta_destino"),
  hashSha256: text("hash_sha256"),
  objectPath: text("object_path"), // Path to file in Object Storage
  pastaId: integer("pasta_id"), // Reference to datasetPastas folder
  unidade: text("unidade").notNull().default('salvador'), // Multi-tenant isolation
});

export const datasetsRelations = relations(datasets, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [datasets.empreendimentoId],
    references: [empreendimentos.id],
  }),
  versoes: many(datasetVersoes),
  auditTrail: many(datasetAuditTrail),
}));

// Tabela de versões de documentos
export const datasetVersoes = pgTable("dataset_versoes", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id").references(() => datasets.id).notNull(),
  versao: text("versao").notNull(),
  nomeArquivo: text("nome_arquivo").notNull(),
  storagePath: text("storage_path"),
  hashSha256: text("hash_sha256"),
  tamanho: integer("tamanho"),
  status: text("status"),
  criadoPor: text("criado_por").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const datasetVersoesRelations = relations(datasetVersoes, ({ one }) => ({
  dataset: one(datasets, {
    fields: [datasetVersoes.datasetId],
    references: [datasets.id],
  }),
}));

// Tabela de audit trail
export const datasetAuditTrail = pgTable("dataset_audit_trail", {
  id: serial("id").primaryKey(),
  datasetId: integer("dataset_id").references(() => datasets.id).notNull(),
  acao: text("acao").notNull(), // upload, update_status, new_version, move, delete
  userId: integer("user_id"),
  usuario: text("usuario"),
  detalhes: json("detalhes").default({}),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const datasetAuditTrailRelations = relations(datasetAuditTrail, ({ one }) => ({
  dataset: one(datasets, {
    fields: [datasetAuditTrail.datasetId],
    references: [datasets.id],
  }),
}));

// Tabela de estrutura de pastas
export const datasetPastas = pgTable("dataset_pastas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  caminho: text("caminho").notNull(),
  pai: text("pai"),
  paiId: integer("pai_id"), // Reference to parent folder
  tipo: text("tipo").notNull().default("macro"), // macro, empreendimento, projeto, subpasta
  projetoId: integer("projeto_id"),
  empreendimentoId: integer("empreendimento_id"),
  unidade: text("unidade").notNull().default('salvador'), // Multi-tenant isolation
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  criadoEm: true,
});

export const insertDatasetVersaoSchema = createInsertSchema(datasetVersoes).omit({
  id: true,
  criadoEm: true,
});

export const insertDatasetAuditTrailSchema = createInsertSchema(datasetAuditTrail).omit({
  id: true,
  criadoEm: true,
});

export const insertDatasetPastaSchema = createInsertSchema(datasetPastas).omit({
  id: true,
  criadoEm: true,
});

export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type Dataset = typeof datasets.$inferSelect;
export type InsertDatasetVersao = z.infer<typeof insertDatasetVersaoSchema>;
export type DatasetVersao = typeof datasetVersoes.$inferSelect;
export type InsertDatasetAuditTrail = z.infer<typeof insertDatasetAuditTrailSchema>;
export type DatasetAuditTrail = typeof datasetAuditTrail.$inferSelect;
export type InsertDatasetPasta = z.infer<typeof insertDatasetPastaSchema>;
export type DatasetPasta = typeof datasetPastas.$inferSelect;

// =============================================
// SEGURANÇA DO TRABALHO MODULE
// =============================================

export const colaboradores = pgTable("colaboradores", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  cargo: text("cargo").notNull(),
  setor: text("setor").notNull(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  dataAdmissao: date("data_admissao").notNull(),
  status: text("status").notNull().default("ativo"), // ativo, inativo
  email: text("email"),
  telefone: text("telefone"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const segDocumentosColaboradores = pgTable("seg_documentos_colaboradores", {
  id: serial("id").primaryKey(),
  colaboradorId: integer("colaborador_id").references(() => colaboradores.id).notNull(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  tipoDocumento: text("tipo_documento").notNull(), // ASO, Treinamento NR, EPI, LTCAT, PCMSO, etc
  descricao: text("descricao"),
  arquivoUrl: text("arquivo_url").notNull(),
  dataEmissao: date("data_emissao").notNull(),
  dataValidade: date("data_validade"),
  assinaturaResponsavel: text("assinatura_responsavel"),
  status: text("status").notNull().default("valido"), // valido, vencido, pendente
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const colaboradoresRelations = relations(colaboradores, ({ one, many }) => ({
  empreendimento: one(empreendimentos, {
    fields: [colaboradores.empreendimentoId],
    references: [empreendimentos.id],
  }),
  documentos: many(segDocumentosColaboradores),
}));

export const segDocumentosColaboradoresRelations = relations(segDocumentosColaboradores, ({ one }) => ({
  colaborador: one(colaboradores, {
    fields: [segDocumentosColaboradores.colaboradorId],
    references: [colaboradores.id],
  }),
  empreendimento: one(empreendimentos, {
    fields: [segDocumentosColaboradores.empreendimentoId],
    references: [empreendimentos.id],
  }),
}));

export const insertColaboradorSchema = createInsertSchema(colaboradores).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertSegDocumentoSchema = createInsertSchema(segDocumentosColaboradores).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertColaborador = z.infer<typeof insertColaboradorSchema>;
export type Colaborador = typeof colaboradores.$inferSelect;
export type InsertSegDocumento = z.infer<typeof insertSegDocumentoSchema>;
export type SegDocumentoColaborador = typeof segDocumentosColaboradores.$inferSelect;

// =============================================
// PORTAL DO CLIENTE - Clientes e Usuários de Cliente
// =============================================

export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  email: text("email"),
  telefone: text("telefone"),
  endereco: text("endereco"),
  cidade: text("cidade"),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 9 }),
  contatoPrincipal: text("contato_principal"),
  unidade: text("unidade").notNull().default("goiania"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const clienteUsuarios = pgTable("cliente_usuarios", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => clientes.id).notNull(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  cargo: text("cargo"),
  telefone: text("telefone"),
  role: text("role").notNull().default("visualizador"),
  ativo: boolean("ativo").notNull().default(true),
  ultimoAcesso: timestamp("ultimo_acesso"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const clienteDocumentos = pgTable("cliente_documentos", {
  id: serial("id").primaryKey(),
  clienteUsuarioId: integer("cliente_usuario_id").references(() => clienteUsuarios.id).notNull(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  arquivoUrl: text("arquivo_url").notNull(),
  tipo: text("tipo").notNull(),
  tamanho: integer("tamanho").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const clientesRelations = relations(clientes, ({ many }) => ({
  usuarios: many(clienteUsuarios),
}));

export const clienteUsuariosRelations = relations(clienteUsuarios, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [clienteUsuarios.clienteId],
    references: [clientes.id],
  }),
  documentos: many(clienteDocumentos),
}));

export const clienteDocumentosRelations = relations(clienteDocumentos, ({ one }) => ({
  clienteUsuario: one(clienteUsuarios, {
    fields: [clienteDocumentos.clienteUsuarioId],
    references: [clienteUsuarios.id],
  }),
  empreendimento: one(empreendimentos, {
    fields: [clienteDocumentos.empreendimentoId],
    references: [empreendimentos.id],
  }),
}));

export const insertClienteSchema = createInsertSchema(clientes).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export const insertClienteUsuarioSchema = createInsertSchema(clienteUsuarios).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  ultimoAcesso: true,
});

export const insertClienteDocumentoSchema = createInsertSchema(clienteDocumentos).omit({
  id: true,
  criadoEm: true,
});

export type InsertCliente = z.infer<typeof insertClienteSchema>;
export type Cliente = typeof clientes.$inferSelect;
export type InsertClienteUsuario = z.infer<typeof insertClienteUsuarioSchema>;
export type ClienteUsuario = typeof clienteUsuarios.$inferSelect;
export type InsertClienteDocumento = z.infer<typeof insertClienteDocumentoSchema>;
export type ClienteDocumento = typeof clienteDocumentos.$inferSelect;

// Extended types with relations
export type EmpreendimentoWithLicencas = Empreendimento & {
  licencas: LicencaAmbiental[];
};

export type LicencaWithDetails = LicencaAmbiental & {
  condicionantes: Condicionante[];
  entregas: Entrega[];
};

// ======== AUDIT LOG (Histórico de Alterações) ========
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tabela: text("tabela").notNull(), // nome da tabela afetada
  registroId: integer("registro_id").notNull(), // ID do registro alterado
  acao: text("acao").notNull(), // create, update, delete
  dadosAnteriores: json("dados_anteriores"), // estado anterior (para update/delete)
  dadosNovos: json("dados_novos"), // novo estado (para create/update)
  camposAlterados: text("campos_alterados").array(), // lista de campos que mudaram
  usuarioId: integer("usuario_id").references(() => users.id),
  usuarioNome: text("usuario_nome"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  criadoEm: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ======== DOCUMENTOS DIGITALIZADOS ========
export const documentos = pgTable("documentos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  arquivoUrl: text("arquivo_url").notNull(),
  arquivoNome: text("arquivo_nome").notNull(),
  arquivoTipo: text("arquivo_tipo").notNull(), // mime type
  arquivoTamanho: integer("arquivo_tamanho").notNull(), // bytes
  categoria: text("categoria").notNull().default("geral"), // licenca, contrato, relatorio, comprovante, outro
  // Vínculos opcionais (um documento pode estar vinculado a vários tipos)
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  licencaId: integer("licenca_id").references(() => licencasAmbientais.id),
  lancamentoId: integer("lancamento_id").references(() => financeiroLancamentos.id),
  contratoId: integer("contrato_id").references(() => contratos.id),
  equipamentoId: integer("equipamento_id").references(() => equipamentos.id),
  veiculoId: integer("veiculo_id").references(() => veiculos.id),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedByNome: text("uploaded_by_nome"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertDocumentoSchema = createInsertSchema(documentos).omit({
  id: true,
  criadoEm: true,
});

export type InsertDocumento = z.infer<typeof insertDocumentoSchema>;
export type Documento = typeof documentos.$inferSelect;

// ======== RELATÓRIOS AGENDADOS ========
export const scheduledReports = pgTable("scheduled_reports", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").notNull(), // financeiro, licencas, equipamentos, frota, geral
  frequencia: text("frequencia").notNull(), // diario, semanal, mensal
  diaSemana: integer("dia_semana"), // 0-6 (domingo-sábado) para semanal
  diaMes: integer("dia_mes"), // 1-31 para mensal
  horario: text("horario").notNull().default("08:00"), // HH:mm
  destinatarios: text("destinatarios").array().notNull(), // emails
  filtros: json("filtros").default({}), // filtros específicos do relatório
  formatoArquivo: text("formato_arquivo").notNull().default("pdf"), // pdf, excel
  ativo: boolean("ativo").notNull().default(true),
  ultimoEnvio: timestamp("ultimo_envio"),
  proximoEnvio: timestamp("proximo_envio"),
  criadoPor: integer("criado_por").references(() => users.id),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  ultimoEnvio: true,
  proximoEnvio: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;

// ======== NOTIFICAÇÕES EM TEMPO REAL ========
export const realTimeNotifications = pgTable("realtime_notifications", {
  id: serial("id").primaryKey(),
  tipo: text("tipo").notNull(), // alerta, info, sucesso, erro
  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  link: text("link"), // link para redirecionar ao clicar
  icone: text("icone"), // nome do ícone lucide
  usuarioId: integer("usuario_id").references(() => users.id), // null = todos os usuários
  lida: boolean("lida").notNull().default(false),
  lidaEm: timestamp("lida_em"),
  expiracaoEm: timestamp("expiracao_em"), // notificação expira após esta data
  metadados: json("metadados").default({}),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertRealTimeNotificationSchema = createInsertSchema(realTimeNotifications).omit({
  id: true,
  lida: true,
  lidaEm: true,
  criadoEm: true,
});

export type InsertRealTimeNotification = z.infer<typeof insertRealTimeNotificationSchema>;
export type RealTimeNotification = typeof realTimeNotifications.$inferSelect;

// ======== CONFIGURAÇÕES DE OFFLINE/SYNC ========
export const offlineSyncQueue = pgTable("offline_sync_queue", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  operacao: text("operacao").notNull(), // create, update, delete
  tabela: text("tabela").notNull(),
  registroId: integer("registro_id"),
  dados: json("dados").notNull(),
  status: text("status").notNull().default("pendente"), // pendente, processando, concluido, erro
  tentativas: integer("tentativas").notNull().default(0),
  erro: text("erro"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  processadoEm: timestamp("processado_em"),
});

export const insertOfflineSyncQueueSchema = createInsertSchema(offlineSyncQueue).omit({
  id: true,
  status: true,
  tentativas: true,
  erro: true,
  criadoEm: true,
  processadoEm: true,
});

export type InsertOfflineSyncQueue = z.infer<typeof insertOfflineSyncQueueSchema>;
export type OfflineSyncQueue = typeof offlineSyncQueue.$inferSelect;

// ======== GESTÃO DE EQUIPE E CRONOGRAMA ========

// Tabela de membros da equipe (vinculados a usuários do sistema e RH)
export const membrosEquipe = pgTable("membros_equipe", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  rhRegistroId: integer("rh_registro_id").references(() => rhRegistros.id), // vinculo com RH
  nome: text("nome").notNull(),
  telefone: text("telefone"),
  cargo: text("cargo").notNull().default("colaborador"), // coordenador, colaborador
  departamento: text("departamento"), // campo, escritorio, laboratorio
  coordenadorId: integer("coordenador_id").references(() => users.id), // quem é o coordenador responsável
  unidade: text("unidade").notNull().default("goiania"),
  ativo: boolean("ativo").notNull().default(true),
  dataAdmissao: date("data_admissao"),
  observacoes: text("observacoes"),
  avatar: text("avatar"), // URL da foto
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

// Tabela de vinculação de membros a empreendimentos (many-to-many)
export const membrosEmpreendimentos = pgTable("membros_empreendimentos", {
  id: serial("id").primaryKey(),
  membroEquipeId: integer("membro_equipe_id").references(() => membrosEquipe.id).notNull(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  unidade: text("unidade").notNull().default("goiania"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertMembroEmpreendimentoSchema = createInsertSchema(membrosEmpreendimentos).omit({
  id: true,
  criadoEm: true,
});

export type InsertMembroEmpreendimento = z.infer<typeof insertMembroEmpreendimentoSchema>;
export type MembroEmpreendimento = typeof membrosEmpreendimentos.$inferSelect;

// Tabela de vinculação de membros a projetos (many-to-many)
export const membrosProjetos = pgTable("membros_projetos", {
  id: serial("id").primaryKey(),
  membroEquipeId: integer("membro_equipe_id").references(() => membrosEquipe.id).notNull(),
  projetoId: integer("projeto_id").references(() => projetos.id).notNull(),
  unidade: text("unidade").notNull().default("salvador"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertMembroProjetoSchema = createInsertSchema(membrosProjetos).omit({
  id: true,
  criadoEm: true,
});

export type InsertMembroProjeto = z.infer<typeof insertMembroProjetoSchema>;
export type MembroProjeto = typeof membrosProjetos.$inferSelect;

export const insertMembroEquipeSchema = createInsertSchema(membrosEquipe).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertMembroEquipe = z.infer<typeof insertMembroEquipeSchema>;
export type MembroEquipe = typeof membrosEquipe.$inferSelect;

// Tabela de tarefas/cronograma
export const tarefas = pgTable("tarefas", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim").notNull(),
  prioridade: text("prioridade").notNull().default("media"), // baixa, media, alta, urgente
  complexidade: text("complexidade").notNull().default("media"), // baixa, media, alta - para gamificação
  status: text("status").notNull().default("pendente"), // pendente, em_andamento, concluida, cancelada, atrasada
  categoria: text("categoria").notNull().default("geral"), // campo, escritorio, relatorio, reuniao, vistoria, geral
  responsavelId: integer("responsavel_id").references(() => users.id).notNull(), // colaborador responsável
  criadoPor: integer("criado_por").references(() => users.id).notNull(), // coordenador que criou
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id), // projeto relacionado (opcional)
  unidade: text("unidade").notNull().default("salvador"),
  recorrente: boolean("recorrente").notNull().default(false),
  frequenciaRecorrencia: text("frequencia_recorrencia"), // diaria, semanal, mensal
  horasEstimadas: decimal("horas_estimadas", { precision: 5, scale: 2 }),
  horasRealizadas: decimal("horas_realizadas", { precision: 5, scale: 2 }),
  observacoesColaborador: text("observacoes_colaborador"), // notas do colaborador
  observacoesCoordenador: text("observacoes_coordenador"), // notas do coordenador
  arquivos: text("arquivos").array(), // URLs de arquivos anexados
  visivelCalendarioGeral: boolean("visivel_calendario_geral").notNull().default(false), // se aparece no calendário para todos
  iniciadaEm: timestamp("iniciada_em"),
  concluidaEm: timestamp("concluida_em"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const insertTarefaSchema = createInsertSchema(tarefas).omit({
  id: true,
  iniciadaEm: true,
  concluidaEm: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertTarefa = z.infer<typeof insertTarefaSchema>;
export type Tarefa = typeof tarefas.$inferSelect;

// Tabela de atualizações/comentários de tarefas
export const tarefaAtualizacoes = pgTable("tarefa_atualizacoes", {
  id: serial("id").primaryKey(),
  tarefaId: integer("tarefa_id").references(() => tarefas.id, { onDelete: "cascade" }).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  tipo: text("tipo").notNull().default("comentario"), // comentario, status_change, anexo
  conteudo: text("conteudo").notNull(),
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo"),
  arquivos: text("arquivos").array(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertTarefaAtualizacaoSchema = createInsertSchema(tarefaAtualizacoes).omit({
  id: true,
  criadoEm: true,
});

export type InsertTarefaAtualizacao = z.infer<typeof insertTarefaAtualizacaoSchema>;
export type TarefaAtualizacao = typeof tarefaAtualizacoes.$inferSelect;

// Tabela de registro de horas (timesheet)
export const registroHoras = pgTable("registro_horas", {
  id: serial("id").primaryKey(),
  tarefaId: integer("tarefa_id").references(() => tarefas.id, { onDelete: "cascade" }).notNull(),
  colaboradorId: integer("colaborador_id").references(() => users.id).notNull(),
  data: date("data").notNull(),
  horaInicio: text("hora_inicio").notNull(), // HH:mm
  horaFim: text("hora_fim").notNull(), // HH:mm
  duracaoMinutos: integer("duracao_minutos").notNull(),
  descricao: text("descricao"),
  aprovado: boolean("aprovado").notNull().default(false),
  aprovadoPor: integer("aprovado_por").references(() => users.id),
  aprovadoEm: timestamp("aprovado_em"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertRegistroHorasSchema = createInsertSchema(registroHoras).omit({
  id: true,
  aprovado: true,
  aprovadoPor: true,
  aprovadoEm: true,
  criadoEm: true,
});

export type InsertRegistroHoras = z.infer<typeof insertRegistroHorasSchema>;
export type RegistroHoras = typeof registroHoras.$inferSelect;

// Relations para tarefas
export const tarefasRelations = relations(tarefas, ({ one, many }) => ({
  responsavel: one(users, {
    fields: [tarefas.responsavelId],
    references: [users.id],
  }),
  criador: one(users, {
    fields: [tarefas.criadoPor],
    references: [users.id],
  }),
  empreendimento: one(empreendimentos, {
    fields: [tarefas.empreendimentoId],
    references: [empreendimentos.id],
  }),
  atualizacoes: many(tarefaAtualizacoes),
  registrosHoras: many(registroHoras),
}));

export const membrosEquipeRelations = relations(membrosEquipe, ({ one, many }) => ({
  user: one(users, {
    fields: [membrosEquipe.userId],
    references: [users.id],
  }),
  coordenador: one(users, {
    fields: [membrosEquipe.coordenadorId],
    references: [users.id],
  }),
  rhRegistro: one(rhRegistros, {
    fields: [membrosEquipe.rhRegistroId],
    references: [rhRegistros.id],
  }),
  empreendimentos: many(membrosEmpreendimentos),
  projetos: many(membrosProjetos),
}));

export const membrosEmpreendimentosRelations = relations(membrosEmpreendimentos, ({ one }) => ({
  membroEquipe: one(membrosEquipe, {
    fields: [membrosEmpreendimentos.membroEquipeId],
    references: [membrosEquipe.id],
  }),
  empreendimento: one(empreendimentos, {
    fields: [membrosEmpreendimentos.empreendimentoId],
    references: [empreendimentos.id],
  }),
}));

export const membrosProjetosRelations = relations(membrosProjetos, ({ one }) => ({
  membroEquipe: one(membrosEquipe, {
    fields: [membrosProjetos.membroEquipeId],
    references: [membrosEquipe.id],
  }),
  projeto: one(projetos, {
    fields: [membrosProjetos.projetoId],
    references: [projetos.id],
  }),
}));

// ======== SISTEMA DE REEMBOLSOS ========

export const pedidosReembolso = pgTable("pedidos_reembolso", {
  id: serial("id").primaryKey(),
  solicitanteId: integer("solicitante_id").references(() => users.id).notNull(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  categoria: text("categoria").notNull().default("outros"), // viagem, alimentacao, materiais, hospedagem, combustivel, transporte, outros
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  dataGasto: date("data_gasto").notNull(),
  comprovante: text("comprovante"), // URL do arquivo anexado
  comprovanteNome: text("comprovante_nome"), // Nome original do arquivo
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id), // Projeto relacionado (opcional)
  projetoId: integer("projeto_id").references(() => projetos.id), // Projeto relacionado (opcional)
  unidade: text("unidade").notNull().default("goiania"),
  status: text("status").notNull().default("pendente_coordenador"), 
  // pendente_coordenador, aprovado_coordenador, rejeitado_coordenador, 
  // pendente_financeiro, aprovado_financeiro, rejeitado_financeiro,
  // pendente_diretor, aprovado_diretor, rejeitado_diretor, pago
  coordenadorId: integer("coordenador_id").references(() => users.id), // Coordenador que aprovou
  coordenadorAprovadoEm: timestamp("coordenador_aprovado_em"),
  coordenadorObservacao: text("coordenador_observacao"),
  financeiroId: integer("financeiro_id").references(() => users.id), // Financeiro que revisou
  financeiroAprovadoEm: timestamp("financeiro_aprovado_em"),
  financeiroObservacao: text("financeiro_observacao"),
  diretorId: integer("diretor_id").references(() => users.id), // Diretor que aprovou
  diretorAprovadoEm: timestamp("diretor_aprovado_em"),
  diretorObservacao: text("diretor_observacao"),
  dataPagamento: date("data_pagamento"),
  formaPagamento: text("forma_pagamento"), // pix, transferencia, dinheiro
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const insertPedidoReembolsoSchema = createInsertSchema(pedidosReembolso).omit({
  id: true,
  coordenadorId: true,
  coordenadorAprovadoEm: true,
  coordenadorObservacao: true,
  financeiroId: true,
  financeiroAprovadoEm: true,
  financeiroObservacao: true,
  diretorId: true,
  diretorAprovadoEm: true,
  diretorObservacao: true,
  dataPagamento: true,
  formaPagamento: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertPedidoReembolso = z.infer<typeof insertPedidoReembolsoSchema>;
export type PedidoReembolso = typeof pedidosReembolso.$inferSelect;

export const historicoReembolso = pgTable("historico_reembolso", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").references(() => pedidosReembolso.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  acao: text("acao").notNull(), // criado, aprovado_coordenador, rejeitado_coordenador, enviado_financeiro, aprovado_financeiro, rejeitado_financeiro, aprovado_diretor, rejeitado_diretor, pago
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo").notNull(),
  observacao: text("observacao"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertHistoricoReembolsoSchema = createInsertSchema(historicoReembolso).omit({
  id: true,
  criadoEm: true,
});

export type InsertHistoricoReembolso = z.infer<typeof insertHistoricoReembolsoSchema>;
export type HistoricoReembolso = typeof historicoReembolso.$inferSelect;

export const pedidosReembolsoRelations = relations(pedidosReembolso, ({ one, many }) => ({
  solicitante: one(users, {
    fields: [pedidosReembolso.solicitanteId],
    references: [users.id],
  }),
  coordenador: one(users, {
    fields: [pedidosReembolso.coordenadorId],
    references: [users.id],
  }),
  financeiro: one(users, {
    fields: [pedidosReembolso.financeiroId],
    references: [users.id],
  }),
  diretor: one(users, {
    fields: [pedidosReembolso.diretorId],
    references: [users.id],
  }),
  empreendimento: one(empreendimentos, {
    fields: [pedidosReembolso.empreendimentoId],
    references: [empreendimentos.id],
  }),
  projeto: one(projetos, {
    fields: [pedidosReembolso.projetoId],
    references: [projetos.id],
  }),
  historico: many(historicoReembolso),
}));

export const historicoReembolsoRelations = relations(historicoReembolso, ({ one }) => ({
  pedido: one(pedidosReembolso, {
    fields: [historicoReembolso.pedidoId],
    references: [pedidosReembolso.id],
  }),
  usuario: one(users, {
    fields: [historicoReembolso.usuarioId],
    references: [users.id],
  }),
}));

// =============================================
// WHATSAPP INTEGRATION - EVOLUTION API
// =============================================

export const whatsappMessageLogs = pgTable("whatsapp_message_logs", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  direction: text("direction").notNull(), // incoming, outgoing
  messageType: text("message_type").notNull().default("text"), // text, image, document, audio, video
  content: text("content"),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, read, failed, received
  evolutionMessageId: text("evolution_message_id"),
  errorMessage: text("error_message"),
  userId: integer("user_id").references(() => users.id),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  unidade: text("unidade"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWhatsappMessageLogSchema = createInsertSchema(whatsappMessageLogs).omit({
  id: true,
});

export type InsertWhatsappMessageLog = z.infer<typeof insertWhatsappMessageLogSchema>;
export type WhatsappMessageLog = typeof whatsappMessageLogs.$inferSelect;

export const whatsappAlertConfigs = pgTable("whatsapp_alert_configs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  phone: text("phone").notNull(),
  alertType: text("alert_type").notNull(), // license_expiration, condicionante_due, task_assignment, demand_assignment
  enabled: boolean("enabled").notNull().default(true),
  daysBeforeAlert: integer("days_before_alert").default(30),
  unidade: text("unidade"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWhatsappAlertConfigSchema = createInsertSchema(whatsappAlertConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWhatsappAlertConfig = z.infer<typeof insertWhatsappAlertConfigSchema>;
export type WhatsappAlertConfig = typeof whatsappAlertConfigs.$inferSelect;

export const whatsappContactGroups = pgTable("whatsapp_contact_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  unidade: text("unidade"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const whatsappContactGroupMembers = pgTable("whatsapp_contact_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => whatsappContactGroups.id).notNull(),
  phone: text("phone").notNull(),
  name: text("name"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWhatsappContactGroupSchema = createInsertSchema(whatsappContactGroups).omit({
  id: true,
  createdAt: true,
});

export const insertWhatsappContactGroupMemberSchema = createInsertSchema(whatsappContactGroupMembers).omit({
  id: true,
  createdAt: true,
});

export type InsertWhatsappContactGroup = z.infer<typeof insertWhatsappContactGroupSchema>;
export type WhatsappContactGroup = typeof whatsappContactGroups.$inferSelect;
export type InsertWhatsappContactGroupMember = z.infer<typeof insertWhatsappContactGroupMemberSchema>;
export type WhatsappContactGroupMember = typeof whatsappContactGroupMembers.$inferSelect;

// ==================== GAMIFICAÇÃO ====================

// Tabela de pontuações de gamificação
export const pontuacoesGamificacao = pgTable("pontuacoes_gamificacao", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  pontos: integer("pontos").notNull().default(0),
  pontosComplexidade: integer("pontos_complexidade").notNull().default(0), // pontos por complexidade das tarefas
  pontosPrazo: integer("pontos_prazo").notNull().default(0), // pontos por cumprimento de prazos
  pontosEconomia: integer("pontos_economia").notNull().default(0), // pontos por economia em projetos
  pontosVolume: integer("pontos_volume").notNull().default(0), // pontos por volume de entregas
  tarefasConcluidas: integer("tarefas_concluidas").notNull().default(0),
  demandasConcluidas: integer("demandas_concluidas").notNull().default(0),
  tarefasAtrasadas: integer("tarefas_atrasadas").notNull().default(0),
  demandasAtrasadas: integer("demandas_atrasadas").notNull().default(0),
  tarefasAntecipadas: integer("tarefas_antecipadas").notNull().default(0),
  demandasAntecipadas: integer("demandas_antecipadas").notNull().default(0),
  periodo: text("periodo").notNull(), // formato: YYYY-MM (mês/ano)
  unidade: text("unidade").notNull().default("salvador"),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertPontuacaoGamificacaoSchema = createInsertSchema(pontuacoesGamificacao).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertPontuacaoGamificacao = z.infer<typeof insertPontuacaoGamificacaoSchema>;
export type PontuacaoGamificacao = typeof pontuacoesGamificacao.$inferSelect;

// Tabela de conquistas/badges
export const conquistasGamificacao = pgTable("conquistas_gamificacao", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao").notNull(),
  icone: text("icone").notNull(), // emoji ou nome do ícone
  cor: text("cor").notNull().default("#228B22"), // cor do badge
  criterio: text("criterio").notNull(), // tipo do critério: tarefas_concluidas, economia, prazo, etc
  valorMinimo: integer("valor_minimo").notNull(), // valor mínimo para desbloquear
  pontosBonus: integer("pontos_bonus").notNull().default(0), // pontos extras ao conquistar
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertConquistaGamificacaoSchema = createInsertSchema(conquistasGamificacao).omit({
  id: true,
  criadoEm: true,
});

export type InsertConquistaGamificacao = z.infer<typeof insertConquistaGamificacaoSchema>;
export type ConquistaGamificacao = typeof conquistasGamificacao.$inferSelect;

// Tabela de conquistas do usuário (many-to-many)
export const usuarioConquistas = pgTable("usuario_conquistas", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  conquistaId: integer("conquista_id").references(() => conquistasGamificacao.id).notNull(),
  conquistadoEm: timestamp("conquistado_em").defaultNow().notNull(),
});

export const insertUsuarioConquistaSchema = createInsertSchema(usuarioConquistas).omit({
  id: true,
  conquistadoEm: true,
});

export type InsertUsuarioConquista = z.infer<typeof insertUsuarioConquistaSchema>;
export type UsuarioConquista = typeof usuarioConquistas.$inferSelect;

// Histórico de pontos (para gráficos de evolução)
export const historicosPontuacao = pgTable("historicos_pontuacao", {
  id: serial("id").primaryKey(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  pontos: integer("pontos").notNull(),
  tipo: text("tipo").notNull(), // tarefa_concluida, demanda_concluida, conquista, bonus, penalidade
  descricao: text("descricao"),
  referenciaId: integer("referencia_id"), // id da tarefa/demanda/conquista
  referenciaTipo: text("referencia_tipo"), // tarefa, demanda, conquista
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertHistoricoPontuacaoSchema = createInsertSchema(historicosPontuacao).omit({
  id: true,
  criadoEm: true,
});

export type InsertHistoricoPontuacao = z.infer<typeof insertHistoricoPontuacaoSchema>;
export type HistoricoPontuacao = typeof historicosPontuacao.$inferSelect;

// ============================================
// METAS DE CUSTO MENSAL POR PROJETO (para gamificação)
// ============================================
export const metasCustoProjeto = pgTable("metas_custo_projeto", {
  id: serial("id").primaryKey(),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id).notNull(),
  coordenadorId: integer("coordenador_id").references(() => users.id).notNull(),
  periodo: text("periodo").notNull(), // formato: YYYY-MM
  orcamentoBase: decimal("orcamento_base", { precision: 15, scale: 2 }).notNull(), // orçamento mensal base (rateio do anual)
  ajusteCampanha: decimal("ajuste_campanha", { precision: 5, scale: 2 }).default("1.0"), // multiplicador para campanhas (1.0 = normal, 1.5 = campanha ativa)
  orcamentoAjustado: decimal("orcamento_ajustado", { precision: 15, scale: 2 }).notNull(), // orcamentoBase * ajusteCampanha
  gastoReal: decimal("gasto_real", { precision: 15, scale: 2 }).default("0"), // gasto efetivo no período
  economia: decimal("economia", { precision: 15, scale: 2 }).default("0"), // orcamentoAjustado - gastoReal (positivo = economia)
  percentualEconomia: decimal("percentual_economia", { precision: 5, scale: 2 }).default("0"), // (economia / orcamentoAjustado) * 100
  pontosAtribuidos: integer("pontos_atribuidos").default(0), // pontos dados/penalizados
  campanhasAtivas: integer("campanhas_ativas").default(0), // quantidade de campanhas ativas no período
  status: text("status").notNull().default("pendente"), // pendente, calculado, aprovado
  observacoes: text("observacoes"),
  unidade: text("unidade").notNull().default("salvador"),
  calculadoEm: timestamp("calculado_em"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertMetaCustoProjetoSchema = createInsertSchema(metasCustoProjeto).omit({
  id: true,
  criadoEm: true,
  calculadoEm: true,
});

export type InsertMetaCustoProjeto = z.infer<typeof insertMetaCustoProjetoSchema>;
export type MetaCustoProjeto = typeof metasCustoProjeto.$inferSelect;

// ============================================
// PROPOSTAS COMERCIAIS (Orçamentos Detalhados)
// ============================================
export const propostasComerciais = pgTable("propostas_comerciais", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  clienteNome: text("cliente_nome").notNull(),
  clienteEmail: text("cliente_email"),
  clienteTelefone: text("cliente_telefone"),
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  valorPrevisto: decimal("valor_previsto", { precision: 15, scale: 2 }).notNull(),
  valorAprovado: decimal("valor_aprovado", { precision: 15, scale: 2 }),
  valorExecutado: decimal("valor_executado", { precision: 15, scale: 2 }).default("0"),
  margemLucro: decimal("margem_lucro", { precision: 5, scale: 2 }),
  status: text("status").notNull().default("elaboracao"), // elaboracao, enviado, aprovado, recusado, em_execucao, concluido, cancelado
  dataElaboracao: date("data_elaboracao").notNull(),
  dataEnvio: date("data_envio"),
  dataAprovacao: date("data_aprovacao"),
  dataValidade: date("data_validade"),
  observacoes: text("observacoes"),
  arquivoPdf: text("arquivo_pdf"),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertPropostaComercialSchema = createInsertSchema(propostasComerciais).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
});

export type InsertPropostaComercial = z.infer<typeof insertPropostaComercialSchema>;
export type PropostaComercial = typeof propostasComerciais.$inferSelect;

// Itens da proposta comercial
export const propostaItens = pgTable("proposta_itens", {
  id: serial("id").primaryKey(),
  propostaId: integer("proposta_id").references(() => propostasComerciais.id).notNull(),
  descricao: text("descricao").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).notNull().default("1"),
  unidadeMedida: text("unidade_medida").default("un"), // un, h, km, dia, etc
  valorUnitario: decimal("valor_unitario", { precision: 15, scale: 2 }).notNull(),
  valorTotal: decimal("valor_total", { precision: 15, scale: 2 }).notNull(),
  categoria: text("categoria"), // mao_de_obra, material, equipamento, deslocamento, outros
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertPropostaItemSchema = createInsertSchema(propostaItens).omit({
  id: true,
  criadoEm: true,
});

export type InsertPropostaItem = z.infer<typeof insertPropostaItemSchema>;
export type PropostaItem = typeof propostaItens.$inferSelect;

// ============================================
// GESTÃO DE AMOSTRAS
// ============================================
export const amostras = pgTable("amostras", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull(), // código único da amostra
  tipo: text("tipo").notNull(), // agua, solo, ar, sedimento, efluente, residuo, outro
  subtipo: text("subtipo"), // agua_superficial, agua_subterranea, solo_contaminado, etc
  empreendimentoId: integer("empreendimento_id").references(() => empreendimentos.id),
  pontoColeta: text("ponto_coleta").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  dataColeta: date("data_coleta").notNull(),
  horaColeta: text("hora_coleta"),
  coletorId: integer("coletor_id").references(() => users.id),
  coletorNome: text("coletor_nome"),
  laboratorioNome: text("laboratorio_nome"),
  laboratorioId: integer("laboratorio_id"),
  dataEnvioLab: date("data_envio_lab"),
  dataPrevisaoResultado: date("data_previsao_resultado"),
  dataResultado: date("data_resultado"),
  status: text("status").notNull().default("coletada"), // coletada, enviada_lab, em_analise, resultado_parcial, concluida, descartada
  parametrosAnalisados: text("parametros_analisados"), // lista de parâmetros
  resultadoArquivo: text("resultado_arquivo"),
  laudoArquivo: text("laudo_arquivo"),
  observacoes: text("observacoes"),
  temperaturaColeta: decimal("temperatura_coleta", { precision: 5, scale: 2 }),
  phColeta: decimal("ph_coleta", { precision: 4, scale: 2 }),
  condutividade: decimal("condutividade", { precision: 10, scale: 2 }),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertAmostraSchema = createInsertSchema(amostras).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
});

export type InsertAmostra = z.infer<typeof insertAmostraSchema>;
export type Amostra = typeof amostras.$inferSelect;

// ============================================
// BANCO DE FORNECEDORES
// ============================================
export const fornecedores = pgTable("fornecedores", {
  id: serial("id").primaryKey(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnpj: text("cnpj"),
  cpf: text("cpf"),
  tipo: text("tipo").notNull(), // laboratorio, transportadora, consultoria, equipamentos, servicos, materiais, outro
  categoria: text("categoria"), // subcategoria específica
  email: text("email"),
  telefone: text("telefone"),
  celular: text("celular"),
  endereco: text("endereco"),
  cidade: text("cidade"),
  uf: text("uf"),
  cep: text("cep"),
  site: text("site"),
  contatoPrincipal: text("contato_principal"),
  contatoEmail: text("contato_email"),
  contatoTelefone: text("contato_telefone"),
  servicosPrestados: text("servicos_prestados"),
  observacoes: text("observacoes"),
  avaliacao: integer("avaliacao"), // 1-5 estrelas
  status: text("status").notNull().default("ativo"), // ativo, inativo, bloqueado
  contratoVigente: boolean("contrato_vigente").default(false),
  dataInicioContrato: date("data_inicio_contrato"),
  dataFimContrato: date("data_fim_contrato"),
  valorContrato: decimal("valor_contrato", { precision: 15, scale: 2 }),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertFornecedorSchema = createInsertSchema(fornecedores).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
});

export type InsertFornecedor = z.infer<typeof insertFornecedorSchema>;
export type Fornecedor = typeof fornecedores.$inferSelect;

// ============================================
// TREINAMENTOS E CAPACITAÇÕES
// ============================================
export const treinamentos = pgTable("treinamentos", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").notNull(), // nr, tecnico, obrigatorio, reciclagem, desenvolvimento, outro
  categoria: text("categoria"), // nr06, nr10, nr33, nr35, primeiros_socorros, etc
  cargaHoraria: integer("carga_horaria"), // em horas
  modalidade: text("modalidade").notNull().default("presencial"), // presencial, online, hibrido
  instituicao: text("instituicao"),
  instrutor: text("instrutor"),
  local: text("local"),
  dataInicio: date("data_inicio").notNull(),
  dataFim: date("data_fim"),
  dataValidade: date("data_validade"), // data de vencimento do certificado
  status: text("status").notNull().default("agendado"), // agendado, em_andamento, concluido, cancelado
  custoTotal: decimal("custo_total", { precision: 15, scale: 2 }),
  certificadoModelo: text("certificado_modelo"),
  observacoes: text("observacoes"),
  obrigatorio: boolean("obrigatorio").default(false),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertTreinamentoSchema = createInsertSchema(treinamentos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
});

export type InsertTreinamento = z.infer<typeof insertTreinamentoSchema>;
export type Treinamento = typeof treinamentos.$inferSelect;

// Participantes do treinamento
export const treinamentoParticipantes = pgTable("treinamento_participantes", {
  id: serial("id").primaryKey(),
  treinamentoId: integer("treinamento_id").references(() => treinamentos.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id),
  rhId: integer("rh_id"), // referência ao registro de RH
  nome: text("nome").notNull(),
  email: text("email"),
  presenca: boolean("presenca").default(false),
  nota: decimal("nota", { precision: 5, scale: 2 }),
  aprovado: boolean("aprovado"),
  certificadoEmitido: boolean("certificado_emitido").default(false),
  certificadoArquivo: text("certificado_arquivo"),
  dataEmissaoCertificado: date("data_emissao_certificado"),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertTreinamentoParticipanteSchema = createInsertSchema(treinamentoParticipantes).omit({
  id: true,
  criadoEm: true,
});

export type InsertTreinamentoParticipante = z.infer<typeof insertTreinamentoParticipanteSchema>;
export type TreinamentoParticipante = typeof treinamentoParticipantes.$inferSelect;

// ============================================
// BASE DE CONHECIMENTO
// ============================================
export const baseConhecimento = pgTable("base_conhecimento", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").notNull(), // modelo, procedimento, legislacao, manual, formulario, checklist, outro
  categoria: text("categoria"), // licenciamento, monitoramento, sst, rh, financeiro, etc
  subcategoria: text("subcategoria"),
  conteudo: text("conteudo"), // conteúdo em texto/markdown
  arquivoUrl: text("arquivo_url"),
  arquivoNome: text("arquivo_nome"),
  arquivoTipo: text("arquivo_tipo"), // pdf, docx, xlsx, etc
  versao: text("versao").default("1.0"),
  tags: text("tags"), // palavras-chave separadas por vírgula
  publico: boolean("publico").default(false), // visível para todos ou restrito
  destaque: boolean("destaque").default(false), // aparece em destaque
  visualizacoes: integer("visualizacoes").default(0),
  downloads: integer("downloads").default(0),
  status: text("status").notNull().default("ativo"), // ativo, rascunho, arquivado
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertBaseConhecimentoSchema = createInsertSchema(baseConhecimento).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
  visualizacoes: true,
  downloads: true,
});

export type InsertBaseConhecimento = z.infer<typeof insertBaseConhecimentoSchema>;
export type BaseConhecimento = typeof baseConhecimento.$inferSelect;

// ============================================
// PORTAL DE COMUNICAÇÃO INTERNA
// ============================================

// Murais/Quadros de avisos
export const murais = pgTable("murais", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  icone: text("icone").default("megaphone"), // ícone do mural
  cor: text("cor").default("#3b82f6"), // cor do mural
  ordem: integer("ordem").default(0),
  ativo: boolean("ativo").default(true),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const insertMuralSchema = createInsertSchema(murais).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertMural = z.infer<typeof insertMuralSchema>;
export type Mural = typeof murais.$inferSelect;

// Comunicados/Avisos
export const comunicados = pgTable("comunicados", {
  id: serial("id").primaryKey(),
  muralId: integer("mural_id").references(() => murais.id),
  titulo: text("titulo").notNull(),
  conteudo: text("conteudo").notNull(), // suporta markdown/HTML
  resumo: text("resumo"), // prévia do comunicado
  tipo: text("tipo").notNull().default("aviso"), // aviso, comunicado, urgente, informativo, celebracao
  prioridade: text("prioridade").notNull().default("normal"), // baixa, normal, alta, urgente
  fixado: boolean("fixado").default(false), // aparece sempre no topo
  destaque: boolean("destaque").default(false), // aparece em destaque
  imagemCapa: text("imagem_capa"), // imagem de capa opcional
  anexos: json("anexos").$type<{ nome: string; url: string; tipo: string }[]>().default([]),
  dataPublicacao: timestamp("data_publicacao").defaultNow().notNull(),
  dataExpiracao: timestamp("data_expiracao"), // quando o comunicado expira
  visibilidade: text("visibilidade").notNull().default("todos"), // todos, coordenadores, diretores, colaboradores
  status: text("status").notNull().default("publicado"), // rascunho, publicado, arquivado, agendado
  categoriaId: integer("categoria_id"), // referência à categoria
  tags: text("tags"), // tags separadas por vírgula
  leituraObrigatoria: boolean("leitura_obrigatoria").default(false), // exige confirmação de leitura
  temEnquete: boolean("tem_enquete").default(false), // indica se tem enquete anexada
  visualizacoes: integer("visualizacoes").default(0),
  unidade: text("unidade").notNull().default("salvador"),
  autorId: integer("autor_id").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertComunicadoSchema = createInsertSchema(comunicados).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
  visualizacoes: true,
});

export type InsertComunicado = z.infer<typeof insertComunicadoSchema>;
export type Comunicado = typeof comunicados.$inferSelect;

// Comentários em comunicados
export const comunicadoComentarios = pgTable("comunicado_comentarios", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id).notNull(),
  autorId: integer("autor_id").references(() => users.id).notNull(),
  conteudo: text("conteudo").notNull(),
  paiId: integer("pai_id"), // para respostas a comentários
  curtidas: integer("curtidas").default(0),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertComunicadoComentarioSchema = createInsertSchema(comunicadoComentarios).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  deletedAt: true,
  curtidas: true,
});

export type InsertComunicadoComentario = z.infer<typeof insertComunicadoComentarioSchema>;
export type ComunicadoComentario = typeof comunicadoComentarios.$inferSelect;

// Visualizações de comunicados (para tracking de quem viu)
export const comunicadoVisualizacoes = pgTable("comunicado_visualizacoes", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  visualizadoEm: timestamp("visualizado_em").defaultNow().notNull(),
});

// Curtidas em comunicados
export const comunicadoCurtidas = pgTable("comunicado_curtidas", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Templates de comunicados
export const comunicadoTemplates = pgTable("comunicado_templates", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  tipo: text("tipo").notNull().default("aviso"),
  conteudoModelo: text("conteudo_modelo").notNull(),
  icone: text("icone").default("file-text"),
  cor: text("cor").default("#3b82f6"),
  ativo: boolean("ativo").default(true),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertComunicadoTemplateSchema = createInsertSchema(comunicadoTemplates).omit({
  id: true,
  criadoEm: true,
});

export type InsertComunicadoTemplate = z.infer<typeof insertComunicadoTemplateSchema>;
export type ComunicadoTemplate = typeof comunicadoTemplates.$inferSelect;

// Categorias de comunicados
export const comunicadoCategorias = pgTable("comunicado_categorias", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cor: text("cor").default("#6b7280"),
  icone: text("icone").default("tag"),
  ordem: integer("ordem").default(0),
  unidade: text("unidade").notNull().default("salvador"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertComunicadoCategoriaSchema = createInsertSchema(comunicadoCategorias).omit({
  id: true,
  criadoEm: true,
});

export type InsertComunicadoCategoria = z.infer<typeof insertComunicadoCategoriaSchema>;
export type ComunicadoCategoria = typeof comunicadoCategorias.$inferSelect;

// Enquetes em comunicados
export const comunicadoEnquetes = pgTable("comunicado_enquetes", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id).notNull(),
  pergunta: text("pergunta").notNull(),
  opcoes: json("opcoes").$type<{ id: string; texto: string; votos: number }[]>().notNull(),
  multipla: boolean("multipla").default(false), // permite múltipla escolha
  anonima: boolean("anonima").default(false),
  dataFim: timestamp("data_fim"), // quando a votação encerra
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertComunicadoEnqueteSchema = createInsertSchema(comunicadoEnquetes).omit({
  id: true,
  criadoEm: true,
});

export type InsertComunicadoEnquete = z.infer<typeof insertComunicadoEnqueteSchema>;
export type ComunicadoEnquete = typeof comunicadoEnquetes.$inferSelect;

// Votos em enquetes
export const comunicadoEnqueteVotos = pgTable("comunicado_enquete_votos", {
  id: serial("id").primaryKey(),
  enqueteId: integer("enquete_id").references(() => comunicadoEnquetes.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  opcaoId: text("opcao_id").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Reações com emoji em comunicados
export const comunicadoReacoes = pgTable("comunicado_reacoes", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  emoji: text("emoji").notNull(), // 👍 ❤️ 😂 😮 😢 🎉
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Menções em comentários
export const comunicadoMencoes = pgTable("comunicado_mencoes", {
  id: serial("id").primaryKey(),
  comentarioId: integer("comentario_id").references(() => comunicadoComentarios.id).notNull(),
  usuarioMencionadoId: integer("usuario_mencionado_id").references(() => users.id).notNull(),
  lida: boolean("lida").default(false),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Leitura obrigatória
export const comunicadoLeituraObrigatoria = pgTable("comunicado_leitura_obrigatoria", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id).notNull(),
  usuarioId: integer("usuario_id").references(() => users.id).notNull(),
  obrigatorio: boolean("obrigatorio").default(true),
  lidoEm: timestamp("lido_em"),
  prazoLeitura: timestamp("prazo_leitura"),
});

// Eventos de calendário de comunicados
export const comunicadoEventos = pgTable("comunicado_eventos", {
  id: serial("id").primaryKey(),
  comunicadoId: integer("comunicado_id").references(() => comunicados.id),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  dataInicio: timestamp("data_inicio").notNull(),
  dataFim: timestamp("data_fim"),
  local: text("local"),
  cor: text("cor").default("#3b82f6"),
  lembrete: boolean("lembrete").default(true),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const insertComunicadoEventoSchema = createInsertSchema(comunicadoEventos).omit({
  id: true,
  criadoEm: true,
});

export type InsertComunicadoEvento = z.infer<typeof insertComunicadoEventoSchema>;
export type ComunicadoEvento = typeof comunicadoEventos.$inferSelect;

// ============================================
// RAMAIS E CONTATOS
// ============================================
export const ramaisContatos = pgTable("ramais_contatos", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  cargo: text("cargo"),
  departamento: text("departamento"),
  ramal: text("ramal"),
  telefone: text("telefone"),
  celular: text("celular"),
  email: text("email"),
  foto: text("foto"),
  ordem: integer("ordem").default(0),
  ativo: boolean("ativo").default(true),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const insertRamalContatoSchema = createInsertSchema(ramaisContatos).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
});

export type InsertRamalContato = z.infer<typeof insertRamalContatoSchema>;
export type RamalContato = typeof ramaisContatos.$inferSelect;

// ============================================
// LINKS ÚTEIS
// ============================================
export const linksUteis = pgTable("links_uteis", {
  id: serial("id").primaryKey(),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  url: text("url").notNull(),
  icone: text("icone").default("link"), // nome do ícone lucide
  cor: text("cor").default("#3b82f6"),
  categoria: text("categoria"), // sistemas, portais, ferramentas, documentos
  ordem: integer("ordem").default(0),
  acessos: integer("acessos").default(0),
  ativo: boolean("ativo").default(true),
  unidade: text("unidade").notNull().default("salvador"),
  criadoPor: integer("criado_por").references(() => users.id).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizado_em").defaultNow().notNull(),
});

export const insertLinkUtilSchema = createInsertSchema(linksUteis).omit({
  id: true,
  criadoEm: true,
  atualizadoEm: true,
  acessos: true,
});

export type InsertLinkUtil = z.infer<typeof insertLinkUtilSchema>;
export type LinkUtil = typeof linksUteis.$inferSelect;


