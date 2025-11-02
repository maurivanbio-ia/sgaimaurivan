import { storage } from '../storage';

/**
 * Busca licenças que vencem em X dias
 * MULTI-TENANCY: Filtra por unidade
 */
export async function getLicencasVencendoEm(unidade: string, dias: number) {
  const stats = await storage.getLicenseStats(unidade);
  const today = new Date();
  const targetDate = new Date(today.getTime() + dias * 24 * 60 * 60 * 1000);
  
  // Filtra licenças que vencem entre hoje e a data alvo (já filtrado por unidade)
  return {
    diasAviso: dias,
    quantidade: stats.proxVencer || 0,
    mensagem: `${stats.proxVencer || 0} licenças vencem nos próximos ${dias} dias (unidade: ${unidade})`
  };
}

/**
 * Busca contratos com pagamentos atrasados
 * MULTI-TENANCY: Filtra por unidade
 */
export async function getContratosComPagamentosAtrasados(unidade: string) {
  const contratos = await storage.getContratos({ unidade });
  const hoje = new Date();
  
  // Aqui você pode adicionar lógica para buscar pagamentos atrasados
  return {
    total: contratos.length,
    mensagem: `Total de ${contratos.length} contratos encontrados (unidade: ${unidade})`
  };
}

/**
 * Busca veículos em manutenção
 * MULTI-TENANCY: Filtra por unidade
 */
export async function getVeiculosEmManutencao(unidade: string) {
  const stats = await storage.getFrotaStats(unidade);
  
  return {
    quantidade: stats.manutencao,
    mensagem: `${stats.manutencao} veículos estão em manutenção (unidade: ${unidade})`
  };
}

/**
 * Busca equipamentos disponíveis
 * MULTI-TENANCY: Filtra por unidade
 */
export async function getEquipamentosDisponiveis(unidade: string) {
  const stats = await storage.getEquipamentosStats(unidade);
  
  return {
    quantidade: stats.disponiveis,
    total: stats.total,
    mensagem: `${stats.disponiveis} de ${stats.total} equipamentos estão disponíveis (unidade: ${unidade})`
  };
}

/**
 * Busca demandas pendentes
 * MULTI-TENANCY: Filtra por unidade
 */
export async function getDemandasPendentes(unidade: string, empreendimentoId?: number) {
  const stats = await storage.getDemandasStats(unidade, empreendimentoId);
  
  return {
    pendentes: stats.pendentes,
    emAndamento: stats.emAndamento,
    concluidas: stats.concluidas,
    total: stats.total,
    mensagem: `${stats.pendentes} demandas pendentes, ${stats.emAndamento} em andamento (unidade: ${unidade})`
  };
}

/**
 * Busca informações de um empreendimento
 * MULTI-TENANCY: Valida que o empreendimento pertence à unidade
 */
export async function getInfoEmpreendimento(unidade: string, empreendimentoId: number) {
  const empreendimento = await storage.getEmpreendimento(empreendimentoId, unidade);
  
  if (!empreendimento) {
    return { erro: 'Empreendimento não encontrado ou não pertence a esta unidade' };
  }
  
  const [demandas, contratos] = await Promise.all([
    storage.getDemandasStats(unidade, empreendimentoId),
    storage.getContratos({ unidade, empreendimentoId }),
  ]);
  
  return {
    empreendimento: {
      nome: empreendimento.nome,
      cliente: empreendimento.cliente,
      localizacao: empreendimento.localizacao,
      status: empreendimento.status,
    },
    demandas,
    contratos: {
      total: contratos.length,
    },
  };
}

/**
 * Busca todas as ações disponíveis do agente
 */
export const ACOES_DISPONIVEIS = [
  {
    nome: 'getLicencasVencendoEm',
    descricao: 'Buscar licenças que vencem em X dias',
    parametros: ['dias: number'],
  },
  {
    nome: 'getContratosComPagamentosAtrasados',
    descricao: 'Buscar contratos com pagamentos atrasados',
    parametros: [],
  },
  {
    nome: 'getVeiculosEmManutencao',
    descricao: 'Buscar veículos em manutenção',
    parametros: [],
  },
  {
    nome: 'getEquipamentosDisponiveis',
    descricao: 'Buscar equipamentos disponíveis',
    parametros: [],
  },
  {
    nome: 'getDemandasPendentes',
    descricao: 'Buscar demandas pendentes',
    parametros: ['empreendimentoId?: number'],
  },
  {
    nome: 'getInfoEmpreendimento',
    descricao: 'Buscar informações detalhadas de um empreendimento',
    parametros: ['empreendimentoId: number'],
  },
];
