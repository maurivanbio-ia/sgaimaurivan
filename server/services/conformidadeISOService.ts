import { db } from '../db';
import { 
  licencasAmbientais, 
  condicionantes,
  rhRegistros, 
  treinamentos, 
  veiculos, 
  equipamentos,
  segDocumentosColaboradores,
  programasSst,
  fornecedores,
  baseConhecimento
} from '@shared/schema';
import { eq, and, lt, gte, or, count, SQL } from 'drizzle-orm';

interface RequisitoISO {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  status: 'conforme' | 'nao_conforme' | 'em_implementacao' | 'nao_aplicavel';
  evidencias: string[];
  moduloRelacionado: string;
  indicador?: number;
  meta?: number;
}

interface AlertaConformidade {
  id: string;
  tipo: 'critico' | 'atencao' | 'info';
  mensagem: string;
  modulo: string;
  dataCriacao: string;
}

interface ConformidadeData {
  iso14001: {
    score: number;
    requisitos: RequisitoISO[];
  };
  iso9001: {
    score: number;
    requisitos: RequisitoISO[];
  };
  iso45001: {
    score: number;
    requisitos: RequisitoISO[];
  };
  alertas: AlertaConformidade[];
  resumo: {
    totalRequisitos: number;
    conformes: number;
    naoConformes: number;
    emImplementacao: number;
  };
}

async function verificarLicencas() {
  const hoje = new Date().toISOString().split('T')[0];
  const em30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [totalResult] = await db.select({ count: count() }).from(licencasAmbientais);
  const total = totalResult?.count || 0;
  
  const [vencidasResult] = await db.select({ count: count() })
    .from(licencasAmbientais)
    .where(lt(licencasAmbientais.validade, hoje));
  const vencidas = vencidasResult?.count || 0;
  
  const [aVencerResult] = await db.select({ count: count() })
    .from(licencasAmbientais)
    .where(and(
      gte(licencasAmbientais.validade, hoje),
      lt(licencasAmbientais.validade, em30dias)
    ));
  const aVencer = aVencerResult?.count || 0;
  
  return { total, vencidas, aVencer, conformidade: total > 0 ? Math.round(((total - vencidas) / total) * 100) : 100 };
}

async function verificarCondicionantes() {
  const hoje = new Date().toISOString().split('T')[0];
  
  const [totalResult] = await db.select({ count: count() }).from(condicionantes);
  const total = totalResult?.count || 0;
  
  const [cumpridasResult] = await db.select({ count: count() })
    .from(condicionantes)
    .where(eq(condicionantes.status, 'cumprida'));
  const cumpridas = cumpridasResult?.count || 0;
  
  const [vencidasResult] = await db.select({ count: count() })
    .from(condicionantes)
    .where(and(
      eq(condicionantes.status, 'pendente'),
      lt(condicionantes.prazo, hoje)
    ));
  const vencidas = vencidasResult?.count || 0;
  
  return { total, cumpridas, vencidas, conformidade: total > 0 ? Math.round((cumpridas / total) * 100) : 100 };
}

async function verificarTreinamentos() {
  const hoje = new Date().toISOString().split('T')[0];
  
  const [totalResult] = await db.select({ count: count() }).from(treinamentos);
  const total = totalResult?.count || 0;
  
  const [concluidosResult] = await db.select({ count: count() })
    .from(treinamentos)
    .where(eq(treinamentos.status, 'concluido'));
  const concluidos = concluidosResult?.count || 0;
  
  const [vencidosResult] = await db.select({ count: count() })
    .from(treinamentos)
    .where(and(
      eq(treinamentos.status, 'concluido'),
      lt(treinamentos.dataValidade, hoje)
    ));
  const vencidos = vencidosResult?.count || 0;
  
  return { total, concluidos, vencidos, conformidade: total > 0 ? Math.round(((concluidos - vencidos) / total) * 100) : 100 };
}

async function verificarRH(unidade?: string) {
  const hoje = new Date().toISOString().split('T')[0];
  
  const totalConditions: SQL[] = [];
  if (unidade) totalConditions.push(eq(rhRegistros.unidade, unidade));
  
  const [totalResult] = totalConditions.length > 0
    ? await db.select({ count: count() }).from(rhRegistros).where(and(...totalConditions))
    : await db.select({ count: count() }).from(rhRegistros);
  const total = totalResult?.count || 0;
  
  const cnhConditions: SQL[] = [lt(rhRegistros.cnhVencimento, hoje)];
  if (unidade) cnhConditions.push(eq(rhRegistros.unidade, unidade));
  const [cnhVencidaResult] = await db.select({ count: count() })
    .from(rhRegistros)
    .where(and(...cnhConditions));
  const cnhVencida = cnhVencidaResult?.count || 0;
  
  return { total, cnhVencida, conformidade: total > 0 ? Math.round(((total - cnhVencida) / total) * 100) : 100 };
}

async function verificarFrota(unidade?: string) {
  const hoje = new Date().toISOString().split('T')[0];
  
  const totalConditions: SQL[] = [];
  if (unidade) totalConditions.push(eq(veiculos.unidade, unidade));
  
  const [totalResult] = totalConditions.length > 0
    ? await db.select({ count: count() }).from(veiculos).where(and(...totalConditions))
    : await db.select({ count: count() }).from(veiculos);
  const total = totalResult?.count || 0;
  
  const docConditions: SQL[] = [
    or(
      lt(veiculos.licenciamentoVencimento, hoje),
      lt(veiculos.seguroVencimento, hoje)
    )!
  ];
  if (unidade) docConditions.push(eq(veiculos.unidade, unidade));
  const [documentosVencidosResult] = await db.select({ count: count() })
    .from(veiculos)
    .where(and(...docConditions));
  const documentosVencidos = documentosVencidosResult?.count || 0;
  
  return { total, documentosVencidos, conformidade: total > 0 ? Math.round(((total - documentosVencidos) / total) * 100) : 100 };
}

async function verificarEquipamentos(unidade?: string) {
  const hoje = new Date().toISOString().split('T')[0];
  
  const totalConditions: SQL[] = [];
  if (unidade) totalConditions.push(eq(equipamentos.unidade, unidade));
  
  const [totalResult] = totalConditions.length > 0
    ? await db.select({ count: count() }).from(equipamentos).where(and(...totalConditions))
    : await db.select({ count: count() }).from(equipamentos);
  const total = totalResult?.count || 0;
  
  const manutConditions: SQL[] = [lt(equipamentos.proximaManutencao, hoje)];
  if (unidade) manutConditions.push(eq(equipamentos.unidade, unidade));
  const [manutencaoVencidaResult] = await db.select({ count: count() })
    .from(equipamentos)
    .where(and(...manutConditions));
  const manutencaoVencida = manutencaoVencidaResult?.count || 0;
  
  const conformidade = total > 0 ? Math.round(((total - manutencaoVencida) / total) * 100) : 100;
  return { total, manutencaoVencida, conformidade: Math.max(0, conformidade) };
}

async function verificarSST() {
  const hoje = new Date().toISOString().split('T')[0];
  
  // Documentos de colaboradores
  const [totalColabResult] = await db.select({ count: count() }).from(segDocumentosColaboradores);
  const totalColab = totalColabResult?.count || 0;
  
  // Documentos gerais (PCMSO, PGR, etc.)
  const [totalGeraisResult] = await db.select({ count: count() }).from(programasSst);
  const totalGerais = totalGeraisResult?.count || 0;
  
  const total = totalColab + totalGerais;
  
  // EPIs vencidos (colaboradores)
  const [epiVencidoResult] = await db.select({ count: count() })
    .from(segDocumentosColaboradores)
    .where(and(
      eq(segDocumentosColaboradores.tipoDocumento, 'EPI'),
      lt(segDocumentosColaboradores.dataValidade, hoje)
    ));
  const epiVencido = epiVencidoResult?.count || 0;
  
  // ASOs vencidos (colaboradores)
  const [asoVencidoResult] = await db.select({ count: count() })
    .from(segDocumentosColaboradores)
    .where(and(
      eq(segDocumentosColaboradores.tipoDocumento, 'ASO'),
      lt(segDocumentosColaboradores.dataValidade, hoje)
    ));
  const asoVencido = asoVencidoResult?.count || 0;
  
  // Documentos gerais vencidos (dataValidade < hoje)
  const [geraisVencidosResult] = await db.select({ count: count() })
    .from(programasSst)
    .where(lt(programasSst.dataValidade, hoje));
  const geraisVencidos = geraisVencidosResult?.count || 0;
  
  const totalVencidos = epiVencido + asoVencido + geraisVencidos;
  const conformidade = total > 0 ? Math.round(((total - totalVencidos) / total) * 100) : 100;
  
  return { 
    total, 
    totalColab, 
    totalGerais,
    epiVencido, 
    asoVencido, 
    geraisVencidos,
    conformidade: Math.max(0, conformidade)
  };
}

async function verificarFornecedores(unidade?: string) {
  const totalConditions: SQL[] = [];
  if (unidade) totalConditions.push(eq(fornecedores.unidade, unidade));
  
  const [totalResult] = totalConditions.length > 0
    ? await db.select({ count: count() }).from(fornecedores).where(and(...totalConditions))
    : await db.select({ count: count() }).from(fornecedores);
  const total = totalResult?.count || 0;
  
  const avalConditions: SQL[] = [gte(fornecedores.avaliacao, 1)];
  if (unidade) avalConditions.push(eq(fornecedores.unidade, unidade));
  const [avaliadosResult] = await db.select({ count: count() })
    .from(fornecedores)
    .where(and(...avalConditions));
  const avaliados = avaliadosResult?.count || 0;
  
  return { total, avaliados, conformidade: total > 0 ? Math.round((avaliados / total) * 100) : 100 };
}

async function verificarDocumentos() {
  const [totalResult] = await db.select({ count: count() }).from(baseConhecimento);
  const total = totalResult?.count || 0;
  
  const [ativosResult] = await db.select({ count: count() })
    .from(baseConhecimento)
    .where(eq(baseConhecimento.status, 'ativo'));
  const ativos = ativosResult?.count || 0;
  
  return { total, ativos, conformidade: total > 0 ? Math.round((ativos / total) * 100) : 100 };
}

export async function calcularConformidadeISO(unidade?: string): Promise<ConformidadeData> {
  const alertas: AlertaConformidade[] = [];
  
  const licencas = await verificarLicencas();
  const condicionantesData = await verificarCondicionantes();
  const treinamentosData = await verificarTreinamentos();
  const rhData = await verificarRH(unidade);
  const frotaData = await verificarFrota(unidade);
  const equipamentosData = await verificarEquipamentos(unidade);
  const sstData = await verificarSST();
  const fornecedoresData = await verificarFornecedores(unidade);
  const documentosData = await verificarDocumentos();
  
  if (licencas.vencidas > 0) {
    alertas.push({
      id: 'lic-vencidas',
      tipo: 'critico',
      mensagem: `${licencas.vencidas} licença(s) ambiental(is) vencida(s)`,
      modulo: 'Licenças',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (licencas.aVencer > 0) {
    alertas.push({
      id: 'lic-avencer',
      tipo: 'atencao',
      mensagem: `${licencas.aVencer} licença(s) a vencer nos próximos 30 dias`,
      modulo: 'Licenças',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (condicionantesData.vencidas > 0) {
    alertas.push({
      id: 'cond-vencidas',
      tipo: 'critico',
      mensagem: `${condicionantesData.vencidas} condicionante(s) vencida(s) não cumprida(s)`,
      modulo: 'Condicionantes',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (treinamentosData.vencidos > 0) {
    alertas.push({
      id: 'trein-vencidos',
      tipo: 'atencao',
      mensagem: `${treinamentosData.vencidos} treinamento(s) com certificado vencido`,
      modulo: 'Treinamentos',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (sstData.asoVencido > 0) {
    alertas.push({
      id: 'aso-vencido',
      tipo: 'critico',
      mensagem: `${sstData.asoVencido} ASO(s) vencido(s)`,
      modulo: 'SST',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (equipamentosData.manutencaoVencida > 0) {
    alertas.push({
      id: 'manut-vencida',
      tipo: 'atencao',
      mensagem: `${equipamentosData.manutencaoVencida} equipamento(s) com manutenção vencida`,
      modulo: 'Equipamentos',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (sstData.epiVencido > 0) {
    alertas.push({
      id: 'epi-vencido',
      tipo: 'critico',
      mensagem: `${sstData.epiVencido} EPI(s) com validade vencida`,
      modulo: 'SST',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (frotaData.documentosVencidos > 0) {
    alertas.push({
      id: 'frota-docs',
      tipo: 'atencao',
      mensagem: `${frotaData.documentosVencidos} veículo(s) com documentação vencida`,
      modulo: 'Frota',
      dataCriacao: new Date().toISOString()
    });
  }
  
  if (rhData.cnhVencida > 0) {
    alertas.push({
      id: 'cnh-vencida',
      tipo: 'atencao',
      mensagem: `${rhData.cnhVencida} colaborador(es) com CNH vencida`,
      modulo: 'RH',
      dataCriacao: new Date().toISOString()
    });
  }
  
  const requisitosISO14001: RequisitoISO[] = [
    {
      id: '14001-4.2',
      codigo: '4.2',
      titulo: 'Entendendo as Necessidades e Expectativas de Partes Interessadas',
      descricao: 'Monitoramento de requisitos legais e regulamentares',
      status: licencas.vencidas === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [`${licencas.total} licenças cadastradas`, `${licencas.vencidas} vencidas`],
      moduloRelacionado: 'Licenças Ambientais',
      indicador: licencas.conformidade,
      meta: 100
    },
    {
      id: '14001-6.1.3',
      codigo: '6.1.3',
      titulo: 'Requisitos Legais e Outros Requisitos',
      descricao: 'Atendimento a condicionantes de licenças',
      status: condicionantesData.vencidas === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [`${condicionantesData.cumpridas} de ${condicionantesData.total} condicionantes cumpridas`],
      moduloRelacionado: 'Condicionantes',
      indicador: condicionantesData.conformidade,
      meta: 100
    },
    {
      id: '14001-7.2',
      codigo: '7.2',
      titulo: 'Competência',
      descricao: 'Treinamentos e capacitação em meio ambiente',
      status: treinamentosData.vencidos === 0 && treinamentosData.concluidos > 0 ? 'conforme' : 
              treinamentosData.total === 0 ? 'em_implementacao' : 'nao_conforme',
      evidencias: [`${treinamentosData.concluidos} treinamentos concluídos`, `${treinamentosData.vencidos} certificados vencidos`],
      moduloRelacionado: 'Treinamentos',
      indicador: treinamentosData.conformidade,
      meta: 90
    },
    {
      id: '14001-7.5',
      codigo: '7.5',
      titulo: 'Informação Documentada',
      descricao: 'Controle de documentos e registros',
      status: documentosData.total > 0 ? 'conforme' : 'em_implementacao',
      evidencias: [`${documentosData.ativos} documentos ativos na base de conhecimento`],
      moduloRelacionado: 'Base de Conhecimento',
      indicador: documentosData.conformidade,
      meta: 80
    },
    {
      id: '14001-9.1',
      codigo: '9.1',
      titulo: 'Monitoramento, Medição, Análise e Avaliação',
      descricao: 'Manutenção de equipamentos de monitoramento',
      status: equipamentosData.manutencaoVencida === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [`${equipamentosData.total} equipamentos`, `${equipamentosData.manutencaoVencida} com manutenção vencida`],
      moduloRelacionado: 'Equipamentos',
      indicador: equipamentosData.conformidade,
      meta: 100
    },
  ];
  
  const requisitosISO9001: RequisitoISO[] = [
    {
      id: '9001-7.2',
      codigo: '7.2',
      titulo: 'Competência',
      descricao: 'Competência de pessoal com base em educação, treinamento ou experiência',
      status: treinamentosData.conformidade >= 80 ? 'conforme' : 
              treinamentosData.conformidade >= 50 ? 'em_implementacao' : 'nao_conforme',
      evidencias: [`${treinamentosData.concluidos} treinamentos realizados`],
      moduloRelacionado: 'Treinamentos',
      indicador: treinamentosData.conformidade,
      meta: 80
    },
    {
      id: '9001-7.5',
      codigo: '7.5',
      titulo: 'Informação Documentada',
      descricao: 'Controle de informação documentada',
      status: documentosData.total >= 10 ? 'conforme' : 'em_implementacao',
      evidencias: [`${documentosData.total} documentos na base de conhecimento`],
      moduloRelacionado: 'Gestão de Dados',
      indicador: documentosData.conformidade,
      meta: 80
    },
    {
      id: '9001-8.4',
      codigo: '8.4',
      titulo: 'Controle de Processos, Produtos e Serviços Externos',
      descricao: 'Avaliação de fornecedores',
      status: fornecedoresData.conformidade >= 70 ? 'conforme' : 
              fornecedoresData.total === 0 ? 'em_implementacao' : 'nao_conforme',
      evidencias: [`${fornecedoresData.avaliados} de ${fornecedoresData.total} fornecedores avaliados`],
      moduloRelacionado: 'Fornecedores',
      indicador: fornecedoresData.conformidade,
      meta: 80
    },
    {
      id: '9001-7.1.5',
      codigo: '7.1.5',
      titulo: 'Recursos de Monitoramento e Medição',
      descricao: 'Manutenção de equipamentos',
      status: equipamentosData.manutencaoVencida === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [`${equipamentosData.manutencaoVencida} equipamentos com manutenção vencida`],
      moduloRelacionado: 'Equipamentos',
      indicador: equipamentosData.conformidade,
      meta: 100
    },
  ];
  
  const requisitosISO45001: RequisitoISO[] = [
    {
      id: '45001-7.2',
      codigo: '7.2',
      titulo: 'Competência',
      descricao: 'Treinamentos de segurança e saúde ocupacional',
      status: treinamentosData.conformidade >= 80 ? 'conforme' : 
              treinamentosData.conformidade >= 50 ? 'em_implementacao' : 'nao_conforme',
      evidencias: [`${treinamentosData.concluidos} treinamentos concluídos`],
      moduloRelacionado: 'Treinamentos',
      indicador: treinamentosData.conformidade,
      meta: 90
    },
    {
      id: '45001-6.1',
      codigo: '6.1',
      titulo: 'Ações para Abordar Riscos e Oportunidades',
      descricao: 'Programas de SST (PCMSO, PGR, PPRA, LTCAT)',
      status: sstData.geraisVencidos === 0 && sstData.totalGerais > 0 ? 'conforme' : 
              sstData.totalGerais === 0 ? 'em_implementacao' : 'nao_conforme',
      evidencias: [
        `${sstData.totalGerais} documentos gerais de SST`,
        `${sstData.geraisVencidos} documentos vencidos`
      ],
      moduloRelacionado: 'SST',
      indicador: sstData.totalGerais > 0 ? Math.round(((sstData.totalGerais - sstData.geraisVencidos) / sstData.totalGerais) * 100) : 0,
      meta: 100
    },
    {
      id: '45001-8.1.2',
      codigo: '8.1.2',
      titulo: 'Eliminando Perigos e Reduzindo Riscos de SSO',
      descricao: 'Controle de EPIs e equipamentos de segurança',
      status: sstData.epiVencido === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [
        `${sstData.totalColab} documentos de colaboradores`,
        `${sstData.epiVencido} EPIs vencidos`
      ],
      moduloRelacionado: 'SST',
      indicador: sstData.conformidade,
      meta: 100
    },
    {
      id: '45001-9.1.2',
      codigo: '9.1.2',
      titulo: 'Avaliação do Atendimento aos Requisitos Legais',
      descricao: 'Monitoramento de exames médicos ocupacionais (ASO)',
      status: sstData.asoVencido === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [`${sstData.asoVencido} ASOs vencidos`],
      moduloRelacionado: 'SST',
      indicador: sstData.conformidade,
      meta: 100
    },
    {
      id: '45001-7.1',
      codigo: '7.1',
      titulo: 'Recursos',
      descricao: 'Manutenção e controle de veículos',
      status: frotaData.documentosVencidos === 0 ? 'conforme' : 'nao_conforme',
      evidencias: [`${frotaData.total} veículos`, `${frotaData.documentosVencidos} com documentação vencida`],
      moduloRelacionado: 'Frota',
      indicador: frotaData.conformidade,
      meta: 100
    },
  ];
  
  const calcularScore = (requisitos: RequisitoISO[]) => {
    if (requisitos.length === 0) return 0;
    const conformes = requisitos.filter(r => r.status === 'conforme').length;
    const emImpl = requisitos.filter(r => r.status === 'em_implementacao').length;
    return Math.round(((conformes + emImpl * 0.5) / requisitos.length) * 100);
  };
  
  const todosRequisitos = [...requisitosISO14001, ...requisitosISO9001, ...requisitosISO45001];
  const conformes = todosRequisitos.filter(r => r.status === 'conforme').length;
  const naoConformes = todosRequisitos.filter(r => r.status === 'nao_conforme').length;
  const emImplementacao = todosRequisitos.filter(r => r.status === 'em_implementacao').length;
  
  return {
    iso14001: {
      score: calcularScore(requisitosISO14001),
      requisitos: requisitosISO14001
    },
    iso9001: {
      score: calcularScore(requisitosISO9001),
      requisitos: requisitosISO9001
    },
    iso45001: {
      score: calcularScore(requisitosISO45001),
      requisitos: requisitosISO45001
    },
    alertas: alertas.sort((a, b) => {
      const ordem = { critico: 0, atencao: 1, info: 2 };
      return ordem[a.tipo] - ordem[b.tipo];
    }),
    resumo: {
      totalRequisitos: todosRequisitos.length,
      conformes,
      naoConformes,
      emImplementacao
    }
  };
}
