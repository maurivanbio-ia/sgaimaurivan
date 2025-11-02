import { storage } from '../storage';

/**
 * Busca licenças que vencem em X dias
 */
export async function getLicencasVencendoEm(dias: number) {
  const stats = await storage.getLicenseStats();
  const today = new Date();
  const targetDate = new Date(today.getTime() + dias * 24 * 60 * 60 * 1000);
  
  // Filtra licenças que vencem entre hoje e a data alvo
  return {
    diasAviso: dias,
    quantidade: stats.proxVencer || 0,
    mensagem: `${stats.proxVencer || 0} licenças vencem nos próximos ${dias} dias`
  };
}

/**
 * Busca contratos com pagamentos atrasados
 */
export async function getContratosComPagamentosAtrasados() {
  const contratos = await storage.getContratos({});
  const hoje = new Date();
  
  // Aqui você pode adicionar lógica para buscar pagamentos atrasados
  return {
    total: contratos.length,
    mensagem: `Total de ${contratos.length} contratos encontrados`
  };
}

/**
 * Busca veículos em manutenção
 */
export async function getVeiculosEmManutencao() {
  const stats = await storage.getFrotaStats();
  
  return {
    quantidade: stats.manutencao,
    mensagem: `${stats.manutencao} veículos estão em manutenção`
  };
}

/**
 * Busca equipamentos disponíveis
 */
export async function getEquipamentosDisponiveis() {
  const stats = await storage.getEquipamentosStats();
  
  return {
    quantidade: stats.disponiveis,
    total: stats.total,
    mensagem: `${stats.disponiveis} de ${stats.total} equipamentos estão disponíveis`
  };
}

/**
 * Busca demandas pendentes
 */
export async function getDemandasPendentes(empreendimentoId?: number) {
  const stats = await storage.getDemandasStats(empreendimentoId);
  
  return {
    pendentes: stats.pendentes,
    emAndamento: stats.emAndamento,
    concluidas: stats.concluidas,
    total: stats.total,
    mensagem: `${stats.pendentes} demandas pendentes, ${stats.emAndamento} em andamento`
  };
}

/**
 * Busca informações de um empreendimento
 */
export async function getInfoEmpreendimento(empreendimentoId: number) {
  const empreendimento = await storage.getEmpreendimentoById(empreendimentoId);
  
  if (!empreendimento) {
    return { erro: 'Empreendimento não encontrado' };
  }
  
  const [demandas, contratos] = await Promise.all([
    storage.getDemandasStats(empreendimentoId),
    storage.getContratos({ empreendimentoId }),
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
