import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { 
  licencasAmbientais, 
  empreendimentos, 
  contratos,
  rhRegistros,
  veiculos,
  equipamentos,
  demandas,
  projetos,
  tarefas,
  users,
  condicionantes,
  segDocumentosColaboradores,
  colaboradores,
  financeiroLancamentos
} from "@shared/schema";
import { sql, eq, and, lt, gte, lte } from "drizzle-orm";
import { generatePlatformReportPDF, generateFinanceReportPDF, sendReportByEmail } from "../services/reportPdfService";

const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const N8N_API_KEY = process.env.N8N_API_KEY;
  
  // Accept API key from multiple sources: header, query param, body, or Authorization header
  const apiKey = 
    req.headers['x-api-key'] || 
    req.query.api_key || 
    req.body?.api_key ||
    req.body?.apiKey ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  
  if (!N8N_API_KEY) {
    console.error("[n8n Webhooks] N8N_API_KEY não configurada");
    return res.status(503).json({ 
      error: "Serviço não disponível", 
      message: "API Key do n8n não está configurada no servidor. Configure a variável N8N_API_KEY." 
    });
  }
  
  if (!apiKey) {
    return res.status(401).json({ 
      error: "API Key não fornecida", 
      message: "Inclua: header X-API-Key, Authorization: Bearer <key>, query param api_key, ou body.api_key" 
    });
  }
  
  if (apiKey !== N8N_API_KEY) {
    return res.status(401).json({ error: "API Key inválida" });
  }
  
  next();
};

// Helper to extract params from query or body (for GET/POST compatibility)
const getParams = (req: Request) => {
  return { ...req.query, ...req.body };
};

export function registerN8nWebhooks(app: Express) {
  
  // ==========================================
  // LICENÇAS AMBIENTAIS (GET + POST)
  // ==========================================
  
  const handleLicencasVencendo = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { dias = 30, unidade } = params;
      const diasNum = parseInt(dias as string) || 30;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const licencas = await db
        .select({
          id: licencasAmbientais.id,
          numero: licencasAmbientais.numero,
          tipo: licencasAmbientais.tipo,
          validade: licencasAmbientais.validade,
          status: licencasAmbientais.status,
          empreendimentoId: licencasAmbientais.empreendimentoId,
          empreendimentoNome: empreendimentos.nome,
          responsavelInterno: empreendimentos.responsavelInterno,
          unidade: empreendimentos.unidade,
        })
        .from(licencasAmbientais)
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
        .where(
          and(
            lte(licencasAmbientais.validade, dataLimite.toISOString().split('T')[0]),
            gte(licencasAmbientais.validade, hoje.toISOString().split('T')[0]),
            eq(licencasAmbientais.status, 'ativa')
          )
        );
      
      const resultado = unidade 
        ? licencas.filter(l => l.unidade === unidade)
        : licencas;
      
      res.json({
        data: resultado.map(l => ({
          ...l,
          diasParaVencer: Math.ceil((new Date(l.validade!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
          urgencia: calcularUrgencia(l.validade!)
        }))
      });
    } catch (error) {
      console.error("Webhook licenças vencendo error:", error);
      res.json({ data: [] });
    }
  };
  
  // Register both GET and POST for n8n compatibility
  app.get("/api/webhooks/n8n/licencas/vencendo", requireApiKey, handleLicencasVencendo);
  app.post("/api/webhooks/n8n/licencas/vencendo", requireApiKey, handleLicencasVencendo);

  const handleLicencasVencidas = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { unidade } = params;
      const hoje = new Date();
      
      const licencas = await db
        .select({
          id: licencasAmbientais.id,
          numero: licencasAmbientais.numero,
          tipo: licencasAmbientais.tipo,
          validade: licencasAmbientais.validade,
          status: licencasAmbientais.status,
          empreendimentoId: licencasAmbientais.empreendimentoId,
          empreendimentoNome: empreendimentos.nome,
          responsavelInterno: empreendimentos.responsavelInterno,
          unidade: empreendimentos.unidade,
        })
        .from(licencasAmbientais)
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
        .where(
          and(
            lt(licencasAmbientais.validade, hoje.toISOString().split('T')[0]),
            eq(licencasAmbientais.status, 'ativa')
          )
        );
      
      const resultado = unidade 
        ? licencas.filter(l => l.unidade === unidade)
        : licencas;
      
      res.json({
        data: resultado.map(l => ({
          ...l,
          diasVencida: Math.ceil((hoje.getTime() - new Date(l.validade!).getTime()) / (1000 * 60 * 60 * 24))
        }))
      });
    } catch (error) {
      console.error("Webhook licenças vencidas error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/licencas/vencidas", requireApiKey, handleLicencasVencidas);
  app.post("/api/webhooks/n8n/licencas/vencidas", requireApiKey, handleLicencasVencidas);

  // ==========================================
  // CONDICIONANTES (GET + POST)
  // ==========================================
  
  const handleCondicionantesPendentes = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { dias = 30 } = params;
      const diasNum = parseInt(dias as string) || 30;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const condicionantes = await storage.getCondicionantesByStatus('pendente');
      
      const resultado = condicionantes
        .filter(c => {
          if (!c.prazo) return false;
          const prazoDate = new Date(c.prazo);
          return prazoDate >= hoje && prazoDate <= dataLimite;
        })
        .map(c => ({
          ...c,
          diasParaVencer: Math.ceil((new Date(c.prazo!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
          urgencia: calcularUrgencia(c.prazo!)
        }));
      
      res.json({ data: resultado });
    } catch (error) {
      console.error("Webhook condicionantes pendentes error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/condicionantes/pendentes", requireApiKey, handleCondicionantesPendentes);
  app.post("/api/webhooks/n8n/condicionantes/pendentes", requireApiKey, handleCondicionantesPendentes);

  // ==========================================
  // CONTRATOS (GET + POST)
  // ==========================================
  
  const handleContratosVencendo = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { dias = 60 } = params;
      const diasNum = parseInt(dias as string) || 60;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const contratosData = await db
        .select({
          id: contratos.id,
          numero: contratos.numero,
          objeto: contratos.objeto,
          vigenciaInicio: contratos.vigenciaInicio,
          vigenciaFim: contratos.vigenciaFim,
          situacao: contratos.situacao,
          valorTotal: contratos.valorTotal,
          empreendimentoId: contratos.empreendimentoId,
          empreendimentoNome: empreendimentos.nome,
          unidade: empreendimentos.unidade,
        })
        .from(contratos)
        .leftJoin(empreendimentos, eq(contratos.empreendimentoId, empreendimentos.id))
        .where(
          and(
            lte(contratos.vigenciaFim, dataLimite.toISOString().split('T')[0]),
            gte(contratos.vigenciaFim, hoje.toISOString().split('T')[0]),
            eq(contratos.situacao, 'vigente')
          )
        );
      
      res.json({
        data: contratosData.map(c => ({
          ...c,
          diasParaVencer: Math.ceil((new Date(c.vigenciaFim!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        }))
      });
    } catch (error) {
      console.error("Webhook contratos vencendo error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/contratos/vencendo", requireApiKey, handleContratosVencendo);
  app.post("/api/webhooks/n8n/contratos/vencendo", requireApiKey, handleContratosVencendo);

  const handlePagamentosPendentes = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { dias = 7 } = params;
      const diasNum = parseInt(dias as string) || 7;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const pagamentos = await db.execute(sql`
        SELECT 
          cp.*,
          c.numero as contrato_numero,
          c.objeto as contrato_objeto,
          e.nome as empreendimento_nome,
          e.unidade
        FROM contrato_pagamentos cp
        LEFT JOIN contratos c ON cp.contrato_id = c.id
        LEFT JOIN empreendimentos e ON c.empreendimento_id = e.id
        WHERE cp.status = 'pendente'
        AND cp.data_vencimento <= ${dataLimite.toISOString().split('T')[0]}
        AND cp.data_vencimento >= ${hoje.toISOString().split('T')[0]}
        ORDER BY cp.data_vencimento ASC
      `);
      
      res.json({ data: pagamentos.rows || [] });
    } catch (error) {
      console.error("Webhook pagamentos pendentes error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/contratos/pagamentos-pendentes", requireApiKey, handlePagamentosPendentes);
  app.post("/api/webhooks/n8n/contratos/pagamentos-pendentes", requireApiKey, handlePagamentosPendentes);

  // ==========================================
  // RH - RECURSOS HUMANOS (GET + POST)
  // ==========================================
  
  const handleRhColaboradores = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { unidade } = params;
      
      const rh = await db.select().from(rhRegistros);
      
      const resultado = unidade 
        ? rh.filter(r => r.unidade === unidade)
        : rh;
      
      res.json({
        data: resultado.map(r => ({
          id: r.id,
          nome: r.nomeColaborador,
          regimeContratacao: r.regimeContratacao,
          dataInicio: r.dataInicio,
          dataFim: r.dataFim,
          unidade: r.unidade
        }))
      });
    } catch (error) {
      console.error("Webhook RH colaboradores error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/rh/colaboradores", requireApiKey, handleRhColaboradores);
  app.post("/api/webhooks/n8n/rh/colaboradores", requireApiKey, handleRhColaboradores);

  // ==========================================
  // FROTA - VEÍCULOS (GET + POST)
  // ==========================================
  
  const handleFrotaRevisaoPendente = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { dias = 30, unidade } = params;
      const diasNum = parseInt(dias as string) || 30;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const veiculosList = await db.select().from(veiculos);
      
      const alertas = veiculosList
        .filter(v => {
          if (unidade && v.unidade !== unidade) return false;
          if (!v.proximaRevisao) return false;
          const venc = new Date(v.proximaRevisao);
          return venc >= hoje && venc <= dataLimite;
        })
        .map(v => ({
          id: v.id,
          veiculo: `${v.marca} ${v.modelo}`,
          placa: v.placa,
          proximaRevisao: v.proximaRevisao,
          kmAtual: v.kmAtual,
          diasParaRevisao: Math.ceil((new Date(v.proximaRevisao!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
          unidade: v.unidade
        }));
      
      res.json({ data: alertas.sort((a, b) => a.diasParaRevisao - b.diasParaRevisao) });
    } catch (error) {
      console.error("Webhook frota revisão error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/frota/revisao-pendente", requireApiKey, handleFrotaRevisaoPendente);
  app.post("/api/webhooks/n8n/frota/revisao-pendente", requireApiKey, handleFrotaRevisaoPendente);

  // ==========================================
  // EQUIPAMENTOS (GET + POST)
  // ==========================================
  
  const handleEquipamentosManutencao = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { dias = 30, unidade } = params;
      const diasNum = parseInt(dias as string) || 30;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const equipamentosList = await db.select().from(equipamentos);
      
      const alertas = equipamentosList
        .filter(e => {
          if (unidade && e.unidade !== unidade) return false;
          if (!e.proximaManutencao) return false;
          const venc = new Date(e.proximaManutencao);
          return venc >= hoje && venc <= dataLimite;
        })
        .map(e => ({
          id: e.id,
          nome: e.nome,
          tipo: e.tipo,
          numeroPatrimonio: e.numeroPatrimonio,
          proximaManutencao: e.proximaManutencao,
          diasParaManutencao: Math.ceil((new Date(e.proximaManutencao!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)),
          unidade: e.unidade
        }));
      
      res.json({ data: alertas.sort((a, b) => a.diasParaManutencao - b.diasParaManutencao) });
    } catch (error) {
      console.error("Webhook equipamentos manutenção error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/equipamentos/manutencao-pendente", requireApiKey, handleEquipamentosManutencao);
  app.post("/api/webhooks/n8n/equipamentos/manutencao-pendente", requireApiKey, handleEquipamentosManutencao);

  // ==========================================
  // DEMANDAS (GET + POST)
  // ==========================================
  
  const handleDemandasPendentes = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { unidade, dias = 7 } = params;
      const diasNum = parseInt(dias as string) || 7;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const demandasList = await db
        .select()
        .from(demandas)
        .where(eq(demandas.status, 'a_fazer'));
      
      const resultado = demandasList
        .filter(d => {
          if (unidade && d.unidade !== unidade) return false;
          if (!d.dataEntrega) return true;
          const entrega = new Date(d.dataEntrega);
          return entrega <= dataLimite;
        })
        .map(d => ({
          ...d,
          diasParaEntrega: d.dataEntrega 
            ? Math.ceil((new Date(d.dataEntrega).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            : null
        }));
      
      res.json({ data: resultado });
    } catch (error) {
      console.error("Webhook demandas pendentes error:", error);
      res.json({ data: [] });
    }
  };
  
  app.get("/api/webhooks/n8n/demandas/pendentes", requireApiKey, handleDemandasPendentes);
  app.post("/api/webhooks/n8n/demandas/pendentes", requireApiKey, handleDemandasPendentes);

  // ==========================================
  // RESUMO CONSOLIDADO POR UNIDADE (GET + POST)
  // ==========================================
  
  const handleResumoUnidade = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const unidade = req.params.unidade || params.unidade as string;
      const hoje = new Date();
      const em30dias = new Date();
      em30dias.setDate(hoje.getDate() + 30);
      
      const [
        licencasVencendo,
        licencasVencidas,
        condicionantesPendentes,
        demandasPendentes,
        projetosAtivos,
        tarefasPendentes
      ] = await Promise.all([
        db.select().from(licencasAmbientais)
          .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
          .where(and(
            eq(empreendimentos.unidade, unidade),
            lte(licencasAmbientais.validade, em30dias.toISOString().split('T')[0]),
            gte(licencasAmbientais.validade, hoje.toISOString().split('T')[0]),
            eq(licencasAmbientais.status, 'ativa')
          )),
        db.select().from(licencasAmbientais)
          .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
          .where(and(
            eq(empreendimentos.unidade, unidade),
            lt(licencasAmbientais.validade, hoje.toISOString().split('T')[0]),
            eq(licencasAmbientais.status, 'ativa')
          )),
        storage.getCondicionantesByStatus('pendente'),
        db.select().from(demandas).where(and(
          eq(demandas.unidade, unidade),
          eq(demandas.status, 'a_fazer')
        )),
        db.select().from(projetos).where(eq(projetos.status, 'em_andamento')),
        db.select().from(tarefas).where(and(
          eq(tarefas.unidade, unidade),
          eq(tarefas.status, 'pendente')
        ))
      ]);
      
      res.json({
        unidade,
        dataConsulta: new Date().toISOString(),
        resumo: {
          licencas: {
            vencendo30dias: licencasVencendo.length,
            vencidas: licencasVencidas.length,
            critico: licencasVencidas.length > 0
          },
          condicionantes: {
            pendentes: condicionantesPendentes.length
          },
          demandas: {
            pendentes: demandasPendentes.length
          },
          projetos: {
            emAndamento: projetosAtivos.filter(p => (p as any).unidade === unidade).length
          },
          tarefas: {
            pendentes: tarefasPendentes.length
          }
        },
        alertasCriticos: [
          ...(licencasVencidas.length > 0 ? [`${licencasVencidas.length} licença(s) vencida(s)!`] : []),
          ...(licencasVencendo.filter(l => {
            const dias = Math.ceil((new Date(l.licencas_ambientais.validade!).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            return dias <= 7;
          }).length > 0 ? [`Licenças vencendo em menos de 7 dias!`] : [])
        ]
      });
    } catch (error) {
      console.error("Webhook resumo unidade error:", error);
      res.status(500).json({ error: "Erro ao gerar resumo" });
    }
  };
  
  app.get("/api/webhooks/n8n/resumo/:unidade", requireApiKey, handleResumoUnidade);
  app.post("/api/webhooks/n8n/resumo/:unidade", requireApiKey, handleResumoUnidade);
  app.post("/api/webhooks/n8n/resumo", requireApiKey, handleResumoUnidade);

  // ==========================================
  // WEBHOOK RECEIVERS (para n8n enviar dados)
  // ==========================================
  
  app.post("/api/webhooks/n8n/criar-demanda", requireApiKey, async (req: Request, res: Response) => {
    try {
      const { titulo, descricao, setor, prioridade, dataEntrega, empreendimentoId, unidade, responsavelId } = req.body;
      
      if (!titulo || !setor || !dataEntrega || !responsavelId || !unidade) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: titulo, setor, dataEntrega, responsavelId, unidade" 
        });
      }
      
      const novaDemanda = await db.insert(demandas).values({
        titulo,
        descricao: descricao || null,
        setor,
        prioridade: prioridade || 'media',
        status: 'a_fazer',
        dataEntrega,
        empreendimentoId: empreendimentoId || null,
        unidade,
        responsavelId,
        criadoPor: responsavelId,
      }).returning();
      
      res.json({
        success: true,
        message: "Demanda criada com sucesso",
        demanda: novaDemanda[0]
      });
    } catch (error) {
      console.error("Webhook criar demanda error:", error);
      res.status(500).json({ error: "Erro ao criar demanda" });
    }
  });

  app.post("/api/webhooks/n8n/criar-tarefa", requireApiKey, async (req, res) => {
    try {
      const { titulo, descricao, categoria, prioridade, responsavelId, criadoPor, dataInicio, dataFim, empreendimentoId, unidade } = req.body;
      
      if (!titulo || !responsavelId || !criadoPor || !dataInicio || !dataFim || !unidade) {
        return res.status(400).json({ 
          error: "Campos obrigatórios: titulo, responsavelId, criadoPor, dataInicio, dataFim, unidade" 
        });
      }
      
      const novaTarefa = await db.insert(tarefas).values({
        titulo,
        descricao: descricao || null,
        categoria: categoria || 'geral',
        prioridade: prioridade || 'media',
        status: 'pendente',
        responsavelId,
        criadoPor,
        dataInicio,
        dataFim,
        empreendimentoId: empreendimentoId || null,
        unidade,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      }).returning();
      
      res.json({
        success: true,
        message: "Tarefa criada com sucesso",
        tarefa: novaTarefa[0]
      });
    } catch (error) {
      console.error("Webhook criar tarefa error:", error);
      res.status(500).json({ error: "Erro ao criar tarefa" });
    }
  });

  app.post("/api/webhooks/n8n/notificar", requireApiKey, async (req, res) => {
    try {
      const { tipo, mensagem, destinatarios, dados } = req.body;
      
      console.log(`[n8n Webhook] Notificação recebida: ${tipo}`, { mensagem, destinatarios, dados });
      
      res.json({
        success: true,
        message: "Notificação registrada",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Webhook notificar error:", error);
      res.status(500).json({ error: "Erro ao processar notificação" });
    }
  });

  // ==========================================
  // CNH VENCENDO (Motoristas)
  // ==========================================
  
  app.get("/api/webhooks/n8n/rh/cnh-vencendo", requireApiKey, async (req, res) => {
    try {
      const { dias = 60, unidade } = req.query;
      const diasNum = parseInt(dias as string) || 60;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const colaboradores = await db
        .select({
          id: rhRegistros.id,
          nome: rhRegistros.nomeColaborador,
          cnh: rhRegistros.cnh,
          cnhCategoria: rhRegistros.cnhCategoria,
          cnhVencimento: rhRegistros.cnhVencimento,
          email: rhRegistros.contatoEmail,
          telefone: rhRegistros.contatoTelefone,
          unidade: rhRegistros.unidade,
        })
        .from(rhRegistros)
        .where(
          and(
            lte(rhRegistros.cnhVencimento, dataLimite.toISOString().split('T')[0]),
            gte(rhRegistros.cnhVencimento, hoje.toISOString().split('T')[0]),
            sql`${rhRegistros.deletedAt} IS NULL`
          )
        );
      
      const resultado = unidade 
        ? colaboradores.filter(c => c.unidade === unidade)
        : colaboradores;
      
      res.json({
        data: resultado.map(c => ({
          ...c,
          diasParaVencer: c.cnhVencimento 
            ? Math.ceil((new Date(c.cnhVencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            : null,
          urgencia: c.cnhVencimento ? calcularUrgencia(c.cnhVencimento) : null
        }))
      });
    } catch (error) {
      console.error("Webhook CNH vencendo error:", error);
      res.json({ data: [] });
    }
  });

  // ==========================================
  // IPVA/LICENCIAMENTO/SEGURO VEÍCULOS
  // ==========================================
  
  app.get("/api/webhooks/n8n/frota/documentos-vencendo", requireApiKey, async (req, res) => {
    try {
      const { dias = 60, unidade, tipo } = req.query; // tipo: ipva, licenciamento, seguro
      const diasNum = parseInt(dias as string) || 60;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const veiculosData = await db
        .select({
          id: veiculos.id,
          placa: veiculos.placa,
          marca: veiculos.marca,
          modelo: veiculos.modelo,
          ipvaVencimento: veiculos.ipvaVencimento,
          licenciamentoVencimento: veiculos.licenciamentoVencimento,
          seguroVencimento: veiculos.seguroVencimento,
          unidade: veiculos.unidade,
        })
        .from(veiculos);
      
      const resultado = veiculosData
        .filter(v => !unidade || v.unidade === unidade)
        .map(v => {
          const alertas: any[] = [];
          
          if (v.ipvaVencimento && (!tipo || tipo === 'ipva')) {
            const dias = Math.ceil((new Date(v.ipvaVencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            if (dias <= diasNum && dias >= 0) {
              alertas.push({ tipo: 'IPVA', vencimento: v.ipvaVencimento, diasParaVencer: dias, urgencia: calcularUrgencia(v.ipvaVencimento) });
            }
          }
          
          if (v.licenciamentoVencimento && (!tipo || tipo === 'licenciamento')) {
            const dias = Math.ceil((new Date(v.licenciamentoVencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            if (dias <= diasNum && dias >= 0) {
              alertas.push({ tipo: 'Licenciamento', vencimento: v.licenciamentoVencimento, diasParaVencer: dias, urgencia: calcularUrgencia(v.licenciamentoVencimento) });
            }
          }
          
          if (v.seguroVencimento && (!tipo || tipo === 'seguro')) {
            const dias = Math.ceil((new Date(v.seguroVencimento).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            if (dias <= diasNum && dias >= 0) {
              alertas.push({ tipo: 'Seguro', vencimento: v.seguroVencimento, diasParaVencer: dias, urgencia: calcularUrgencia(v.seguroVencimento) });
            }
          }
          
          return alertas.length > 0 ? { veiculo: { id: v.id, placa: v.placa, marca: v.marca, modelo: v.modelo, unidade: v.unidade }, alertas } : null;
        })
        .filter(Boolean);
      
      res.json({ data: resultado });
    } catch (error) {
      console.error("Webhook documentos frota vencendo error:", error);
      res.json({ data: [] });
    }
  });

  // ==========================================
  // ASO E EXAMES OCUPACIONAIS VENCENDO
  // ==========================================
  
  app.get("/api/webhooks/n8n/sst/exames-vencendo", requireApiKey, async (req, res) => {
    try {
      const { dias = 30, unidade, tipo } = req.query; // tipo: ASO, Treinamento NR, EPI, etc
      const diasNum = parseInt(dias as string) || 30;
      const hoje = new Date();
      const dataLimite = new Date();
      dataLimite.setDate(hoje.getDate() + diasNum);
      
      const documentos = await db
        .select({
          id: segDocumentosColaboradores.id,
          tipoDocumento: segDocumentosColaboradores.tipoDocumento,
          descricao: segDocumentosColaboradores.descricao,
          dataValidade: segDocumentosColaboradores.dataValidade,
          status: segDocumentosColaboradores.status,
          colaboradorId: segDocumentosColaboradores.colaboradorId,
          colaboradorNome: colaboradores.nome,
          colaboradorCargo: colaboradores.cargo,
          empreendimentoId: segDocumentosColaboradores.empreendimentoId,
          empreendimentoNome: empreendimentos.nome,
          unidade: empreendimentos.unidade,
        })
        .from(segDocumentosColaboradores)
        .leftJoin(colaboradores, eq(segDocumentosColaboradores.colaboradorId, colaboradores.id))
        .leftJoin(empreendimentos, eq(segDocumentosColaboradores.empreendimentoId, empreendimentos.id))
        .where(
          and(
            lte(segDocumentosColaboradores.dataValidade, dataLimite.toISOString().split('T')[0]),
            gte(segDocumentosColaboradores.dataValidade, hoje.toISOString().split('T')[0])
          )
        );
      
      let resultado = documentos;
      if (unidade) {
        resultado = resultado.filter(d => d.unidade === unidade);
      }
      if (tipo) {
        resultado = resultado.filter(d => d.tipoDocumento === tipo);
      }
      
      res.json({
        data: resultado.map(d => ({
          ...d,
          diasParaVencer: d.dataValidade 
            ? Math.ceil((new Date(d.dataValidade).getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
            : null,
          urgencia: d.dataValidade ? calcularUrgencia(d.dataValidade) : null
        }))
      });
    } catch (error) {
      console.error("Webhook exames SST vencendo error:", error);
      res.json({ data: [] });
    }
  });

  // ==========================================
  // COORDENADORES POR UNIDADE (com emails)
  // ==========================================
  
  app.get("/api/webhooks/n8n/coordenadores", requireApiKey, async (req, res) => {
    try {
      const { unidade } = req.query;
      
      const coordenadores = await db
        .select({
          id: users.id,
          email: users.email,
          cargo: users.cargo,
          unidade: users.unidade,
        })
        .from(users)
        .where(eq(users.cargo, 'coordenador'));
      
      const resultado = unidade 
        ? coordenadores.filter(c => c.unidade === unidade)
        : coordenadores;
      
      res.json({ data: resultado });
    } catch (error) {
      console.error("Webhook coordenadores error:", error);
      res.json({ data: [] });
    }
  });

  // ==========================================
  // RELATÓRIO FINANCEIRO CONSOLIDADO
  // ==========================================
  
  app.get("/api/webhooks/n8n/financeiro/relatorio-mensal", requireApiKey, async (req, res) => {
    try {
      const { mes, ano, unidade } = req.query;
      const mesNum = parseInt(mes as string) || new Date().getMonth() + 1;
      const anoNum = parseInt(ano as string) || new Date().getFullYear();
      
      const dataInicio = new Date(anoNum, mesNum - 1, 1);
      const dataFim = new Date(anoNum, mesNum, 0);
      
      const lancamentos = await db
        .select({
          id: financeiroLancamentos.id,
          tipo: financeiroLancamentos.tipo,
          categoriaId: financeiroLancamentos.categoriaId,
          descricao: financeiroLancamentos.descricao,
          valor: financeiroLancamentos.valor,
          data: financeiroLancamentos.data,
          empreendimentoId: financeiroLancamentos.empreendimentoId,
          empreendimentoNome: empreendimentos.nome,
          unidade: empreendimentos.unidade,
        })
        .from(financeiroLancamentos)
        .leftJoin(empreendimentos, eq(financeiroLancamentos.empreendimentoId, empreendimentos.id))
        .where(
          and(
            gte(financeiroLancamentos.data, dataInicio.toISOString().split('T')[0]),
            lte(financeiroLancamentos.data, dataFim.toISOString().split('T')[0])
          )
        );
      
      let resultado = lancamentos;
      if (unidade) {
        resultado = resultado.filter(l => l.unidade === unidade);
      }
      
      const receitas = resultado.filter(l => l.tipo === 'receita').reduce((acc, l) => acc + parseFloat(l.valor || '0'), 0);
      const despesas = resultado.filter(l => l.tipo === 'despesa').reduce((acc, l) => acc + parseFloat(l.valor || '0'), 0);
      
      // Agrupar despesas por categoria
      const despesasPorCategoria: { [key: string]: number } = {};
      resultado.filter(l => l.tipo === 'despesa').forEach(l => {
        const cat = `Categoria ${l.categoriaId}` || 'Outros';
        despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + parseFloat(l.valor || '0');
      });
      
      // Agrupar receitas por empreendimento
      const receitasPorEmpreendimento: { [key: string]: number } = {};
      resultado.filter(l => l.tipo === 'receita').forEach(l => {
        const emp = l.empreendimentoNome || 'Sem empreendimento';
        receitasPorEmpreendimento[emp] = (receitasPorEmpreendimento[emp] || 0) + parseFloat(l.valor || '0');
      });
      
      res.json({
        periodo: { mes: mesNum, ano: anoNum },
        filtro: { unidade: unidade || 'todas' },
        resumo: {
          totalReceitas: receitas,
          totalDespesas: despesas,
          lucro: receitas - despesas,
          percentualLucro: receitas > 0 ? ((receitas - despesas) / receitas * 100).toFixed(2) : 0
        },
        despesasPorCategoria,
        receitasPorEmpreendimento,
        totalLancamentos: resultado.length
      });
    } catch (error) {
      console.error("Webhook relatório financeiro error:", error);
      res.status(500).json({ error: "Erro ao gerar relatório financeiro" });
    }
  });

  // ==========================================
  // CRIAR DEMANDA DE CONDICIONANTE
  // ==========================================
  
  app.post("/api/webhooks/n8n/condicionantes/criar-demanda", requireApiKey, async (req, res) => {
    try {
      const { condicionanteId, responsavelId, observacao } = req.body;
      
      if (!condicionanteId || !responsavelId) {
        return res.status(400).json({ error: "Campos obrigatórios: condicionanteId, responsavelId" });
      }
      
      // Buscar dados da condicionante
      const condicionante = await db
        .select({
          id: condicionantes.id,
          descricao: condicionantes.descricao,
          prazo: condicionantes.prazo,
          licencaId: condicionantes.licencaId,
          empreendimentoNome: empreendimentos.nome,
          unidade: empreendimentos.unidade,
        })
        .from(condicionantes)
        .leftJoin(licencasAmbientais, eq(condicionantes.licencaId, licencasAmbientais.id))
        .leftJoin(empreendimentos, eq(licencasAmbientais.empreendimentoId, empreendimentos.id))
        .where(eq(condicionantes.id, parseInt(condicionanteId)))
        .limit(1);
      
      if (condicionante.length === 0) {
        return res.status(404).json({ error: "Condicionante não encontrada" });
      }
      
      const cond = condicionante[0];
      
      // Criar demanda automaticamente
      const novaDemanda = await db.insert(demandas).values({
        titulo: `[AUTO] Condicionante: ${cond.descricao?.substring(0, 50)}...`,
        descricao: `Demanda automática criada para condicionante.\n\nDescrição: ${cond.descricao}\nEmpreendimento: ${cond.empreendimentoNome}\nPrazo: ${cond.prazo}\n\n${observacao || ''}`,
        setor: 'licenciamento',
        prioridade: 'alta',
        status: 'a_fazer',
        dataEntrega: cond.prazo || new Date().toISOString().split('T')[0],
        unidade: cond.unidade || 'goiania',
        responsavelId: parseInt(responsavelId),
        criadoPor: parseInt(responsavelId),
      }).returning();
      
      res.json({
        success: true,
        message: "Demanda criada a partir da condicionante",
        demanda: novaDemanda[0],
        condicionante: cond
      });
    } catch (error) {
      console.error("Webhook criar demanda condicionante error:", error);
      res.status(500).json({ error: "Erro ao criar demanda de condicionante" });
    }
  });

  // ==========================================
  // FROTA: REVISÃO POR QUILOMETRAGEM
  // ==========================================
  
  app.get("/api/webhooks/n8n/frota/revisao-km", requireApiKey, async (req, res) => {
    try {
      const { margem = 1000, unidade } = req.query; // margem em km antes da revisão
      const margemNum = parseInt(margem as string) || 1000;
      
      const veiculosData = await db
        .select({
          id: veiculos.id,
          placa: veiculos.placa,
          marca: veiculos.marca,
          modelo: veiculos.modelo,
          kmAtual: veiculos.kmAtual,
          kmProximaRevisao: veiculos.kmProximaRevisao,
          proximaRevisao: veiculos.proximaRevisao,
          unidade: veiculos.unidade,
          responsavelAtual: veiculos.responsavelAtual,
        })
        .from(veiculos)
        .where(sql`${veiculos.kmProximaRevisao} IS NOT NULL`);
      
      const resultado = veiculosData
        .filter(v => !unidade || v.unidade === unidade)
        .filter(v => v.kmProximaRevisao && v.kmAtual >= (v.kmProximaRevisao - margemNum))
        .map(v => ({
          ...v,
          kmRestantes: (v.kmProximaRevisao || 0) - v.kmAtual,
          status: v.kmAtual >= (v.kmProximaRevisao || 0) ? 'ATRASADO' : 'PROXIMO'
        }));
      
      res.json({
        total: resultado.length,
        filtro: { margemKm: margemNum, unidade: unidade || 'todas' },
        veiculos: resultado
      });
    } catch (error) {
      console.error("Webhook revisão por km error:", error);
      res.status(500).json({ error: "Erro ao buscar veículos para revisão por km" });
    }
  });

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  
  app.get("/api/webhooks/n8n/health", requireApiKey, async (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      endpoints: [
        // Licenças
        "GET /api/webhooks/n8n/licencas/vencendo?dias=30&unidade=goiania",
        "GET /api/webhooks/n8n/licencas/vencidas?unidade=goiania",
        // Condicionantes
        "GET /api/webhooks/n8n/condicionantes/pendentes?dias=30",
        "POST /api/webhooks/n8n/condicionantes/criar-demanda",
        // Contratos
        "GET /api/webhooks/n8n/contratos/vencendo?dias=60",
        "GET /api/webhooks/n8n/contratos/pagamentos-pendentes?dias=7",
        // RH
        "GET /api/webhooks/n8n/rh/colaboradores?unidade=goiania",
        "GET /api/webhooks/n8n/rh/cnh-vencendo?dias=60&unidade=goiania",
        // Frota
        "GET /api/webhooks/n8n/frota/revisao-pendente?dias=30&unidade=goiania",
        "GET /api/webhooks/n8n/frota/documentos-vencendo?dias=60&tipo=ipva|licenciamento|seguro",
        "GET /api/webhooks/n8n/frota/revisao-km?margem=1000&unidade=goiania",
        // SST/Segurança
        "GET /api/webhooks/n8n/sst/exames-vencendo?dias=30&tipo=ASO",
        // Equipamentos
        "GET /api/webhooks/n8n/equipamentos/manutencao-pendente?dias=30&unidade=goiania",
        // Demandas
        "GET /api/webhooks/n8n/demandas/pendentes?dias=7&unidade=goiania",
        // Financeiro
        "GET /api/webhooks/n8n/financeiro/relatorio-mensal?mes=1&ano=2026&unidade=goiania",
        // Coordenadores
        "GET /api/webhooks/n8n/coordenadores?unidade=goiania",
        // Resumo
        "GET /api/webhooks/n8n/resumo-unidade?unidade=goiania",
        // Ações
        "POST /api/webhooks/n8n/criar-demanda",
        "POST /api/webhooks/n8n/criar-tarefa",
        "POST /api/webhooks/n8n/notificar"
      ]
    });
  });

  // Rota de teste SEM autenticação para debug
  app.get("/api/webhooks/n8n/test/sst", async (req, res) => {
    try {
      const documentos = await db
        .select()
        .from(segDocumentosColaboradores)
        .limit(5);
      
      res.json({ 
        success: true, 
        total: documentos.length,
        data: documentos
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rota de teste para verificar schema de condicionantes
  app.get("/api/webhooks/n8n/test/condicionantes", requireApiKey, async (req, res) => {
    try {
      const sample = await db.select().from(condicionantes).limit(1);
      res.json({ 
        success: true, 
        schema: sample.length > 0 ? Object.keys(sample[0]) : [],
        sample: sample[0] || null
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // RELATÓRIOS PDF (GET + POST)
  // ==========================================

  const handleRelatorio360PDF = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { unidade, email, enviarEmail } = params;
      
      const pdfBuffer = await generatePlatformReportPDF({ unidade: unidade as string });
      const filename = `Relatorio_360_EcoBrasil_${new Date().toISOString().split('T')[0]}.pdf`;
      
      if (enviarEmail === 'true' && email) {
        const enviado = await sendReportByEmail(
          pdfBuffer,
          filename,
          email as string,
          'Relatório 360° EcoBrasil - Semanal',
          `Segue em anexo o Relatório 360° EcoBrasil gerado automaticamente.\n\nData: ${new Date().toLocaleDateString('pt-BR')}\n${unidade ? `Unidade: ${unidade}` : 'Todas as unidades'}\n\nEste é um email automático do sistema EcoGestor.`
        );
        
        return res.json({
          success: enviado,
          message: enviado ? 'Relatório enviado por email com sucesso' : 'Erro ao enviar email',
          filename,
          recipientEmail: email
        });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Erro ao gerar relatório 360:", error);
      res.status(500).json({ error: error.message });
    }
  };

  app.get("/api/webhooks/n8n/relatorios/360", requireApiKey, handleRelatorio360PDF);
  app.post("/api/webhooks/n8n/relatorios/360", requireApiKey, handleRelatorio360PDF);

  const handleRelatorioFinanceiroPDF = async (req: Request, res: Response) => {
    try {
      const params = getParams(req);
      const { unidade, mes, ano, email, enviarEmail } = params;
      
      const pdfBuffer = await generateFinanceReportPDF({
        unidade: unidade as string,
        mes: mes ? parseInt(mes as string) : undefined,
        ano: ano ? parseInt(ano as string) : undefined
      });
      
      const mesNum = mes ? parseInt(mes as string) : new Date().getMonth() + 1;
      const anoNum = ano ? parseInt(ano as string) : new Date().getFullYear();
      const filename = `Relatorio_Financeiro_${anoNum}_${String(mesNum).padStart(2, '0')}.pdf`;
      
      if (enviarEmail === 'true' && email) {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        const enviado = await sendReportByEmail(
          pdfBuffer,
          filename,
          email as string,
          `Relatório Financeiro - ${monthNames[mesNum - 1]} ${anoNum}`,
          `Segue em anexo o Relatório Financeiro gerado automaticamente.\n\nPeríodo: ${monthNames[mesNum - 1]} de ${anoNum}\n${unidade ? `Unidade: ${unidade}` : 'Todas as unidades'}\n\nEste é um email automático do sistema EcoGestor.`
        );
        
        return res.json({
          success: enviado,
          message: enviado ? 'Relatório enviado por email com sucesso' : 'Erro ao enviar email',
          filename,
          recipientEmail: email,
          periodo: `${monthNames[mesNum - 1]} ${anoNum}`
        });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Erro ao gerar relatório financeiro:", error);
      res.status(500).json({ error: error.message });
    }
  };

  app.get("/api/webhooks/n8n/relatorios/financeiro", requireApiKey, handleRelatorioFinanceiroPDF);
  app.post("/api/webhooks/n8n/relatorios/financeiro", requireApiKey, handleRelatorioFinanceiroPDF);

  console.log("[n8n Webhooks] Rotas registradas com sucesso");
}

function calcularUrgencia(dataVencimento: string): string {
  const hoje = new Date();
  const vencimento = new Date(dataVencimento);
  const dias = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  
  if (dias <= 7) return 'CRITICA';
  if (dias <= 15) return 'ALTA';
  if (dias <= 30) return 'MEDIA';
  return 'BAIXA';
}
