import cron from 'node-cron';
import { db } from '../db';
import { licencasAmbientais, demandas, alertHistory, users } from '@shared/schema';
import { eq, and, gte, lte, isNull, or } from 'drizzle-orm';
import { sendEmail } from '../emailService';
import { websocketService } from './websocketService';

// ──────────────────────────────────────────────────────────────────────────────
// Pilar 4 — Automações e Background Jobs
// ──────────────────────────────────────────────────────────────────────────────

const EMAILS_GESTORES = [
  'ecobrasil@ecobrasil.bio.br',
  'flavia@ecobrasil.bio.br',
  'maurivan@ecobrasil.bio.br',
];

// ── Alerta 150 dias antes do vencimento de licenças ──────────────────────────
async function verificarLicencas150Dias(): Promise<void> {
  try {
    const hoje = new Date();
    const alvo = new Date(hoje);
    alvo.setDate(alvo.getDate() + 150);
    const alvoStr = alvo.toISOString().split('T')[0];
    const alvoMaisum = new Date(alvo);
    alvoMaisum.setDate(alvoMaisum.getDate() + 1);
    const alvoMaisumStr = alvoMaisum.toISOString().split('T')[0];

    const licencasProximas = await db
      .select()
      .from(licencasAmbientais)
      .where(
        and(
          gte(licencasAmbientais.validade, alvoStr),
          lte(licencasAmbientais.validade, alvoMaisumStr),
          or(
            eq(licencasAmbientais.status, 'vigente'),
            eq(licencasAmbientais.status, 'ativa'),
          )
        )
      );

    for (const licenca of licencasProximas) {
      // Verificar se já enviamos alerta de 150 dias para esta licença
      const jaEnviado = await db
        .select()
        .from(alertHistory)
        .where(
          and(
            eq(alertHistory.tipoItem, 'licenca'),
            eq(alertHistory.itemId, licenca.id),
            eq(alertHistory.diasAviso, 150),
            eq(alertHistory.status, 'enviado')
          )
        );

      if (jaEnviado.length > 0) continue;

      const assunto = `⚠️ Alerta 150 dias: Licença ${licenca.numero} vence em ${new Date(licenca.validade).toLocaleDateString('pt-BR')}`;
      const corpo = `
        <h2>Alerta Antecipado de Vencimento de Licença</h2>
        <p>A licença abaixo vencerá em <strong>150 dias</strong>. Recomendamos iniciar o processo de renovação imediatamente.</p>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif;">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Licença</td><td style="padding:8px;border:1px solid #ddd">${licenca.numero}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Tipo</td><td style="padding:8px;border:1px solid #ddd">${licenca.tipo}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Órgão Emissor</td><td style="padding:8px;border:1px solid #ddd">${licenca.orgaoEmissor}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Vencimento</td><td style="padding:8px;border:1px solid #ddd">${new Date(licenca.validade).toLocaleDateString('pt-BR')}</td></tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px">EcoGestor — Ecobrasil Consultoria Ambiental</p>
      `;

      for (const email of EMAILS_GESTORES) {
        try {
          await sendEmail({ to: email, subject: assunto, html: corpo });
        } catch {}
      }

      // Registrar no histórico para não duplicar
      await db.insert(alertHistory).values({
        tipoItem: 'licenca',
        itemId: licenca.id,
        diasAviso: 150,
        tipoNotificacao: 'email',
        status: 'enviado',
        tentativas: 1,
        ultimaTentativa: new Date(),
      });

      console.log(`[Automação] Alerta 150 dias enviado: licença ${licenca.numero}`);
    }
  } catch (error) {
    console.error('[Automação] Erro no alerta de 150 dias:', error);
  }
}

// ── Criação automática de instâncias de demandas recorrentes ─────────────────
// Lógica: para cada demanda marcada como recorrente e concluída (ou com prazo vencido),
// verifica se deve criar uma nova instância baseada na periodicidade.
async function criarInstanciasDemandaRecorrente(): Promise<void> {
  try {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    // Buscar demandas recorrentes que foram concluídas e cujo prazo de recorrência não expirou
    const demandasRecorrentes = await db
      .select()
      .from(demandas)
      .where(
        and(
          eq(demandas.recorrente, true),
          eq(demandas.status, 'concluido'),
          or(
            isNull(demandas.recorrenciaFim),
            gte(demandas.recorrenciaFim!, hojeStr)
          )
        )
      );

    for (const demanda of demandasRecorrentes) {
      if (!demanda.recorrenciaCron) continue;

      // Calcular próximo prazo baseado na periodicidade (simplificado)
      const proximoPrazo = calcularProximoPrazo(demanda.dataEntrega, demanda.recorrenciaCron);
      if (!proximoPrazo) continue;

      // Verificar se já existe uma instância futura desta demanda recorrente
      const jaExiste = await db
        .select()
        .from(demandas)
        .where(
          and(
            eq(demandas.titulo, demanda.titulo),
            eq(demandas.responsavelId, demanda.responsavelId),
            or(
              eq(demandas.status, 'a_fazer'),
              eq(demandas.status, 'em_andamento')
            )
          )
        );

      if (jaExiste.length > 0) continue;

      // Criar nova instância
      await db.insert(demandas).values({
        titulo: demanda.titulo,
        descricao: demanda.descricao,
        setor: demanda.setor,
        status: 'a_fazer',
        prioridade: demanda.prioridade,
        complexidade: demanda.complexidade,
        categoria: demanda.categoria,
        dataInicio: hojeStr,
        dataEntrega: proximoPrazo,
        empreendimentoId: demanda.empreendimentoId,
        responsavelId: demanda.responsavelId,
        origem: demanda.origem || 'manual',
        licencaId: demanda.licencaId,
        condicionanteId: demanda.condicionanteId,
        recorrente: true,
        recorrenciaCron: demanda.recorrenciaCron,
        recorrenciaFim: demanda.recorrenciaFim,
        unidade: demanda.unidade,
        criadoPor: demanda.criadoPor,
      });

      console.log(`[Automação] Nova instância criada: "${demanda.titulo}" → prazo ${proximoPrazo}`);

      // Sinalizar para o frontend invalidar o cache
      websocketService.broadcastInvalidate('demandas', demanda.unidade);
    }
  } catch (error) {
    console.error('[Automação] Erro na criação de demandas recorrentes:', error);
  }
}

function calcularProximoPrazo(ultimoPrazo: string | null, cron: string): string | null {
  if (!ultimoPrazo) return null;
  const base = new Date(ultimoPrazo);
  
  if (cron.includes('monthly') || cron === '0 0 1 * *' || cron.match(/0 0 \d+ \* \*/)) {
    base.setMonth(base.getMonth() + 1);
  } else if (cron.includes('weekly') || cron === '0 0 * * 1' || cron.match(/0 0 \* \* \d/)) {
    base.setDate(base.getDate() + 7);
  } else if (cron.includes('quarterly') || cron.includes('trimestral')) {
    base.setMonth(base.getMonth() + 3);
  } else if (cron.includes('biannual') || cron.includes('semestral')) {
    base.setMonth(base.getMonth() + 6);
  } else if (cron.includes('annual') || cron.includes('anual')) {
    base.setFullYear(base.getFullYear() + 1);
  } else {
    // Default: mensal
    base.setMonth(base.getMonth() + 1);
  }

  return base.toISOString().split('T')[0];
}

// ── Recalcular status de contratos com pagamentos atrasados ──────────────────
async function recalcularStatusPagamentos(): Promise<void> {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    // Atualizar status de pagamentos vencidos (usando raw SQL para segurança)
    // Esta query atualiza pagamentos com vencimento passado e status pendente
    const result = await db.execute(
      `UPDATE pagamentos_contratos 
       SET status = 'atrasado' 
       WHERE status = 'pendente' 
       AND data_vencimento < '${hoje}'`
    ).catch(() => null); // Tabela pode não existir em alguns ambientes

    if (result) {
      console.log('[Automação] Status de pagamentos recalculados');
    }
  } catch (error) {
    // Silencioso — tabela pode não existir
  }
}

// ── Inicialização dos cron jobs ───────────────────────────────────────────────
export function inicializarAutomacoes(): void {
  // Diariamente às 06:00 (Brasília = UTC-3 → 09:00 UTC)
  cron.schedule('0 9 * * *', async () => {
    console.log('[Automação] Executando rotinas diárias 06:00 BRT...');
    await verificarLicencas150Dias();
    await criarInstanciasDemandaRecorrente();
    await recalcularStatusPagamentos();
  }, { timezone: 'America/Bahia' });

  console.log('[Automação] Cron de rotinas diárias agendado para 06:00 BRT');
  console.log('[Automação] → Alerta 150 dias para licenças');
  console.log('[Automação] → Criação de instâncias de demandas recorrentes');
  console.log('[Automação] → Recalcular status de pagamentos');
}
