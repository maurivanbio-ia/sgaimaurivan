import { db } from '../db';
import { pontuacoesGamificacao, conquistasGamificacao, usuarioConquistas, historicosPontuacao, demandas, tarefas, users } from '@shared/schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';

const PONTOS_COMPLEXIDADE = {
  baixa: 5,
  media: 15,
  alta: 30
};

const PONTOS_PRAZO = {
  antecipado: 10,
  no_prazo: 5,
  atrasado: -5
};

export async function calcularPontuacaoTarefa(tarefa: any): Promise<number> {
  let pontos = 0;
  
  const complexidade = tarefa.complexidade || 'media';
  pontos += PONTOS_COMPLEXIDADE[complexidade as keyof typeof PONTOS_COMPLEXIDADE] || 15;
  
  if (tarefa.concluidaEm && tarefa.dataFim) {
    const dataConclusao = new Date(tarefa.concluidaEm);
    const dataFim = new Date(tarefa.dataFim);
    
    if (dataConclusao < dataFim) {
      pontos += PONTOS_PRAZO.antecipado;
    } else if (dataConclusao <= dataFim) {
      pontos += PONTOS_PRAZO.no_prazo;
    } else {
      pontos += PONTOS_PRAZO.atrasado;
    }
  }
  
  return pontos;
}

export async function calcularPontuacaoDemanda(demanda: any): Promise<number> {
  let pontos = 0;
  
  const complexidade = demanda.complexidade || 'media';
  pontos += PONTOS_COMPLEXIDADE[complexidade as keyof typeof PONTOS_COMPLEXIDADE] || 15;
  
  if (demanda.dataConclusao && demanda.dataEntrega) {
    const dataConclusao = new Date(demanda.dataConclusao);
    const dataEntrega = new Date(demanda.dataEntrega);
    
    if (dataConclusao < dataEntrega) {
      pontos += PONTOS_PRAZO.antecipado;
    } else if (dataConclusao <= dataEntrega) {
      pontos += PONTOS_PRAZO.no_prazo;
    } else {
      pontos += PONTOS_PRAZO.atrasado;
    }
  }
  
  return pontos;
}

export async function getRankingGeral(periodo?: string) {
  const periodoAtual = periodo || new Date().toISOString().substring(0, 7);
  
  const ranking = await db
    .select({
      usuarioId: pontuacoesGamificacao.usuarioId,
      pontos: pontuacoesGamificacao.pontos,
      tarefasConcluidas: pontuacoesGamificacao.tarefasConcluidas,
      demandasConcluidas: pontuacoesGamificacao.demandasConcluidas,
      tarefasAtrasadas: pontuacoesGamificacao.tarefasAtrasadas,
      demandasAtrasadas: pontuacoesGamificacao.demandasAtrasadas,
      email: users.email,
    })
    .from(pontuacoesGamificacao)
    .leftJoin(users, eq(pontuacoesGamificacao.usuarioId, users.id))
    .where(eq(pontuacoesGamificacao.periodo, periodoAtual))
    .orderBy(desc(pontuacoesGamificacao.pontos))
    .limit(20);
  
  return ranking.map((r, index) => ({
    ...r,
    posicao: index + 1,
    nome: r.email?.split('@')[0] || 'Usuário'
  }));
}

export async function getDesempenhoUsuario(usuarioId: number, periodo?: string) {
  const periodoAtual = periodo || new Date().toISOString().substring(0, 7);
  
  const [pontuacao] = await db
    .select()
    .from(pontuacoesGamificacao)
    .where(and(
      eq(pontuacoesGamificacao.usuarioId, usuarioId),
      eq(pontuacoesGamificacao.periodo, periodoAtual)
    ))
    .limit(1);
  
  const conquistasUsuario = await db
    .select({
      id: conquistasGamificacao.id,
      nome: conquistasGamificacao.nome,
      descricao: conquistasGamificacao.descricao,
      icone: conquistasGamificacao.icone,
      cor: conquistasGamificacao.cor,
      conquistadoEm: usuarioConquistas.conquistadoEm,
    })
    .from(usuarioConquistas)
    .leftJoin(conquistasGamificacao, eq(usuarioConquistas.conquistaId, conquistasGamificacao.id))
    .where(eq(usuarioConquistas.usuarioId, usuarioId));
  
  const historico = await db
    .select()
    .from(historicosPontuacao)
    .where(eq(historicosPontuacao.usuarioId, usuarioId))
    .orderBy(desc(historicosPontuacao.criadoEm))
    .limit(50);
  
  return {
    pontuacao: pontuacao || {
      pontos: 0,
      tarefasConcluidas: 0,
      demandasConcluidas: 0,
      tarefasAtrasadas: 0,
      demandasAtrasadas: 0,
      tarefasAntecipadas: 0,
      demandasAntecipadas: 0,
    },
    conquistas: conquistasUsuario,
    historico
  };
}

async function verificarPontuacaoDuplicada(referenciaId: number, referenciaTipo: string): Promise<boolean> {
  const [existente] = await db
    .select()
    .from(historicosPontuacao)
    .where(and(
      eq(historicosPontuacao.referenciaId, referenciaId),
      eq(historicosPontuacao.referenciaTipo, referenciaTipo)
    ))
    .limit(1);
  
  return !!existente;
}

export async function registrarPontosTarefa(tarefaId: number, usuarioId: number, pontos: number, tipo: string) {
  const jaPontuada = await verificarPontuacaoDuplicada(tarefaId, 'tarefa');
  if (jaPontuada) {
    console.log(`[Gamificação] Tarefa ${tarefaId} já foi pontuada anteriormente, ignorando`);
    return;
  }

  const periodoAtual = new Date().toISOString().substring(0, 7);
  
  const [existente] = await db
    .select()
    .from(pontuacoesGamificacao)
    .where(and(
      eq(pontuacoesGamificacao.usuarioId, usuarioId),
      eq(pontuacoesGamificacao.periodo, periodoAtual)
    ))
    .limit(1);
  
  if (existente) {
    await db
      .update(pontuacoesGamificacao)
      .set({
        pontos: sql`${pontuacoesGamificacao.pontos} + ${pontos}`,
        tarefasConcluidas: tipo === 'tarefa_concluida' 
          ? sql`${pontuacoesGamificacao.tarefasConcluidas} + 1` 
          : pontuacoesGamificacao.tarefasConcluidas,
        atualizadoEm: new Date(),
      })
      .where(eq(pontuacoesGamificacao.id, existente.id));
  } else {
    await db.insert(pontuacoesGamificacao).values({
      usuarioId,
      pontos,
      periodo: periodoAtual,
      tarefasConcluidas: tipo === 'tarefa_concluida' ? 1 : 0,
      demandasConcluidas: 0,
      tarefasAtrasadas: 0,
      demandasAtrasadas: 0,
      tarefasAntecipadas: 0,
      demandasAntecipadas: 0,
      pontosComplexidade: 0,
      pontosPrazo: 0,
      pontosEconomia: 0,
      pontosVolume: 0,
      unidade: 'salvador',
    });
  }
  
  await db.insert(historicosPontuacao).values({
    usuarioId,
    pontos,
    tipo,
    descricao: `Pontos por ${tipo.replace(/_/g, ' ')}`,
    referenciaId: tarefaId,
    referenciaTipo: 'tarefa',
  });
  
  console.log(`[Gamificação] Tarefa ${tarefaId}: +${pontos} pontos para usuário ${usuarioId}`);
}

export async function registrarPontosDemanda(demandaId: number, usuarioId: number, pontos: number, tipo: string) {
  const jaPontuada = await verificarPontuacaoDuplicada(demandaId, 'demanda');
  if (jaPontuada) {
    console.log(`[Gamificação] Demanda ${demandaId} já foi pontuada anteriormente, ignorando`);
    return;
  }

  const periodoAtual = new Date().toISOString().substring(0, 7);
  
  const [existente] = await db
    .select()
    .from(pontuacoesGamificacao)
    .where(and(
      eq(pontuacoesGamificacao.usuarioId, usuarioId),
      eq(pontuacoesGamificacao.periodo, periodoAtual)
    ))
    .limit(1);
  
  if (existente) {
    await db
      .update(pontuacoesGamificacao)
      .set({
        pontos: sql`${pontuacoesGamificacao.pontos} + ${pontos}`,
        demandasConcluidas: tipo === 'demanda_concluida' 
          ? sql`${pontuacoesGamificacao.demandasConcluidas} + 1` 
          : pontuacoesGamificacao.demandasConcluidas,
        atualizadoEm: new Date(),
      })
      .where(eq(pontuacoesGamificacao.id, existente.id));
  } else {
    await db.insert(pontuacoesGamificacao).values({
      usuarioId,
      pontos,
      periodo: periodoAtual,
      tarefasConcluidas: 0,
      demandasConcluidas: tipo === 'demanda_concluida' ? 1 : 0,
      tarefasAtrasadas: 0,
      demandasAtrasadas: 0,
      tarefasAntecipadas: 0,
      demandasAntecipadas: 0,
      pontosComplexidade: 0,
      pontosPrazo: 0,
      pontosEconomia: 0,
      pontosVolume: 0,
      unidade: 'salvador',
    });
  }
  
  await db.insert(historicosPontuacao).values({
    usuarioId,
    pontos,
    tipo,
    descricao: `Pontos por ${tipo.replace(/_/g, ' ')}`,
    referenciaId: demandaId,
    referenciaTipo: 'demanda',
  });
  
  console.log(`[Gamificação] Demanda ${demandaId}: +${pontos} pontos para usuário ${usuarioId}`);
}

export async function processarConclusaoTarefa(tarefa: any, usuarioId: number) {
  try {
    const pontos = await calcularPontuacaoTarefa({
      ...tarefa,
      concluidaEm: new Date()
    });
    await registrarPontosTarefa(tarefa.id, usuarioId, pontos, 'tarefa_concluida');
    return pontos;
  } catch (error) {
    console.error('[Gamificação] Erro ao processar conclusão de tarefa:', error);
    return 0;
  }
}

export async function processarConclusaoDemanda(demanda: any, usuarioId: number) {
  try {
    const pontos = await calcularPontuacaoDemanda({
      ...demanda,
      dataConclusao: new Date()
    });
    await registrarPontosDemanda(demanda.id, usuarioId, pontos, 'demanda_concluida');
    return pontos;
  } catch (error) {
    console.error('[Gamificação] Erro ao processar conclusão de demanda:', error);
    return 0;
  }
}

export async function getConquistasDisponiveis() {
  return db
    .select()
    .from(conquistasGamificacao)
    .where(eq(conquistasGamificacao.ativo, true));
}

export async function getEstatisticasGerais() {
  const periodoAtual = new Date().toISOString().substring(0, 7);
  
  const [stats] = await db
    .select({
      totalPontos: sql<number>`COALESCE(SUM(${pontuacoesGamificacao.pontos}), 0)`,
      totalTarefas: sql<number>`COALESCE(SUM(${pontuacoesGamificacao.tarefasConcluidas}), 0)`,
      totalDemandas: sql<number>`COALESCE(SUM(${pontuacoesGamificacao.demandasConcluidas}), 0)`,
      totalUsuarios: sql<number>`COUNT(DISTINCT ${pontuacoesGamificacao.usuarioId})`,
    })
    .from(pontuacoesGamificacao)
    .where(eq(pontuacoesGamificacao.periodo, periodoAtual));
  
  return stats;
}

export async function seedConquistas() {
  const conquistasPadrao = [
    { nome: 'Iniciante', descricao: 'Completou sua primeira tarefa', icone: '🌱', cor: '#4CAF50', criterio: 'tarefas_concluidas', valorMinimo: 1, pontosBonus: 10 },
    { nome: 'Trabalhador', descricao: 'Completou 10 tarefas', icone: '💪', cor: '#2196F3', criterio: 'tarefas_concluidas', valorMinimo: 10, pontosBonus: 50 },
    { nome: 'Produtivo', descricao: 'Completou 50 tarefas', icone: '🚀', cor: '#9C27B0', criterio: 'tarefas_concluidas', valorMinimo: 50, pontosBonus: 200 },
    { nome: 'Pontual', descricao: 'Entregou 5 tarefas antes do prazo', icone: '⏰', cor: '#FF9800', criterio: 'tarefas_antecipadas', valorMinimo: 5, pontosBonus: 75 },
    { nome: 'Mestre', descricao: 'Acumulou 500 pontos', icone: '👑', cor: '#FFD700', criterio: 'pontos_totais', valorMinimo: 500, pontosBonus: 100 },
    { nome: 'Demandador', descricao: 'Completou 20 demandas', icone: '📋', cor: '#00BCD4', criterio: 'demandas_concluidas', valorMinimo: 20, pontosBonus: 100 },
    { nome: 'Expert', descricao: 'Completou 10 tarefas de alta complexidade', icone: '🏆', cor: '#E91E63', criterio: 'tarefas_alta_complexidade', valorMinimo: 10, pontosBonus: 150 },
  ];
  
  for (const conquista of conquistasPadrao) {
    const [existe] = await db
      .select()
      .from(conquistasGamificacao)
      .where(eq(conquistasGamificacao.nome, conquista.nome))
      .limit(1);
    
    if (!existe) {
      await db.insert(conquistasGamificacao).values(conquista);
    }
  }
  
  console.log('[Gamificação] Conquistas padrão criadas');
}
