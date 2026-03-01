import { db } from '../db';
import { datasetPastas, empreendimentos, projetos } from '@shared/schema';
import { eq } from 'drizzle-orm';

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

// Estrutura espelhando exatamente as pastas do Dropbox
export const ESTRUTURA_INSTITUCIONAL = {
  raiz: "ECOBRASIL_CONSULTORIA_AMBIENTAL",
  nivel1: [
    // Módulos: Contratos, Financeiro, RH, SST, Treinamentos, ISO/LGPD
    {
      codigo: "1. ADMINISTRATIVO_E_JURIDICO",
      subpastas: [
        "1.1. CONTRATOS",
        "1.2. FINANCEIRO",
        "1.3. RECURSOS_HUMANOS",
        "1.4. SST",
        "1.5. TREINAMENTOS_E_CAPACITACAO",
        "1.6. COMPLIANCE_E_LGPD",
      ]
    },
    // Módulos: Propostas Comerciais, Leads/CRM, Relacionamento, Fornecedores
    {
      codigo: "2. COMERCIAL_E_CLIENTES",
      subpastas: [
        "2.1. PROPOSTAS_ENVIADAS",
        "2.2. PROPOSTAS_APROVADAS",
        "2.3. LEADS_E_CRM",
        "2.4. RELACIONAMENTO_E_ATAS",
        "2.5. FORNECEDORES",
      ]
    },
    // Módulo: Empreendimentos / Projetos
    {
      codigo: "3. PROJETOS",
      subpastas: []
    },
    // Módulos: Frota, Equipamentos
    {
      codigo: "4. RECURSOS_E_PATRIMONIO",
      subpastas: [
        "4.1. FROTA",
        "4.2. EQUIPAMENTOS",
      ]
    },
    // Módulo: Base de Conhecimento, Legislação, Normas
    {
      codigo: "5. BASE_TECNICA_E_REFERENCIAS",
      subpastas: [
        "5.1. LEGISLACAO",
        "5.2. NORMAS_TECNICAS",
        "5.3. ARTIGOS_CIENTIFICOS",
        "5.4. MANUAIS_METODOLOGICOS",
        "5.5. LINKS_E_REFERENCIAS",
      ]
    },
    // Módulo: Gestão de Dados — templates e modelos
    {
      codigo: "6. MODELOS_E_PADROES",
      subpastas: [
        "6.1. TEMPLATES_RELATORIOS",
        "6.2. MODELOS_PLANILHAS",
        "6.3. PADROES_GRAFICOS",
        "6.4. TERMOS_E_FORMULARIOS",
      ]
    },
    // Módulos: N8N, Backups, ISO Conformidade, Newsletter
    {
      codigo: "7. SISTEMAS_E_AUTOMACOES",
      subpastas: [
        "7.1. WORKFLOWS_N8N",
        "7.2. SCRIPTS_R_PYTHON",
        "7.3. DASHBOARDS",
        "7.4. BACKUPS_SISTEMAS",
        "7.5. ISO_CONFORMIDADE",
        "7.6. NEWSLETTER_E_BLOG",
      ]
    },
    {
      codigo: "8. ARQUIVO_MORTO",
      subpastas: [
        "8.1. PROJETOS_ENCERRADOS",
        "8.2. CONTRATOS_FINALIZADOS",
        "8.3. COLABORADORES_DESLIGADOS",
        "8.4. DOCUMENTOS_HISTORICOS",
      ]
    }
  ]
};

// Estrutura de projeto espelhando as pastas do Dropbox em /3. PROJETOS/{PROJETO}/
export const ESTRUTURA_PROJETO = [
  // Módulos: Contratos, Aditivos, Autorizações
  {
    codigo: "1. GESTAO_E_CONTRATOS",
    subpastas: ["1.1. CONTRATO_PRINCIPAL", "1.2. ADITIVOS", "1.3. AUTORIZACOES"]
  },
  // Módulos: Cronograma, Demandas, Atas de Reunião
  {
    codigo: "2. PLANEJAMENTO_E_CRONOGRAMA",
    subpastas: ["2.1. CRONOGRAMA", "2.2. PLANOS_DE_TRABALHO", "2.3. ATAS_DE_REUNIAO"]
  },
  // Módulo: Licenças, Condicionantes, Evidências
  {
    codigo: "3. LICENCAS_E_CONDICIONANTES",
    subpastas: [
      "3.1. LICENCAS_ATIVAS",
      "3.2. CONDICIONANTES",
      "3.3. EVIDENCIAS_E_COMPROVANTES",
      "3.4. PROTOCOLOS",
    ]
  },
  // Módulo: Amostras, Monitoramento Ambiental
  {
    codigo: "4. MONITORAMENTO_E_AMOSTRAS",
    subpastas: ["4.1. CAMPO", "4.2. PROCESSADOS", "4.3. LAUDOS_LABORATORIAIS"]
  },
  // Módulo: Relatórios, Documentos Técnicos
  {
    codigo: "5. RELATORIOS_E_PARECERES",
    subpastas: ["5.1. MINUTAS", "5.2. VERSOES_FINAIS", "5.3. PARECERES_TECNICOS"]
  },
  // Módulo: Camadas Geoespaciais
  {
    codigo: "6. MAPAS_E_GEOESPACIAL",
    subpastas: ["6.1. SHAPEFILES", "6.2. MAPAS_FINAIS", "6.3. KMZ_KML"]
  },
  // Módulo: Comunicação Interna, Ofícios
  {
    codigo: "7. COMUNICACOES",
    subpastas: ["7.1. OFICIOS", "7.2. EMAILS_RELEVANTES", "7.3. NOTIFICACOES_ORGAOS"]
  },
  // Módulo: Financeiro de Projeto, Entregas, Recibos
  {
    codigo: "8. ENTREGAS_E_FINANCEIRO",
    subpastas: ["8.1. ENVIADOS", "8.2. PROTOCOLOS_RECEBIDOS", "8.3. RECIBOS", "8.4. NOTAS_FISCAIS"]
  }
];

async function getOrCreateFolder(
  nome: string, 
  caminho: string, 
  paiId: number | null, 
  tipo: string,
  empreendimentoId?: number | null,
  projetoId?: number | null
): Promise<number> {
  const existing = await db.select().from(datasetPastas).where(eq(datasetPastas.caminho, caminho)).limit(1);
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  const pai = paiId ? (await db.select().from(datasetPastas).where(eq(datasetPastas.id, paiId)).limit(1))[0]?.caminho : null;
  
  const [inserted] = await db.insert(datasetPastas).values({
    nome,
    caminho,
    pai,
    paiId,
    tipo,
    empreendimentoId: empreendimentoId || null,
    projetoId: projetoId || null,
  }).returning();
  
  return inserted.id;
}

export async function criarEstruturaInstitucional(): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;
  
  const raizPath = `/${ESTRUTURA_INSTITUCIONAL.raiz}`;
  const raizId = await getOrCreateFolder(
    ESTRUTURA_INSTITUCIONAL.raiz,
    raizPath,
    null,
    "macro"
  );
  
  const existingRaiz = await db.select().from(datasetPastas).where(eq(datasetPastas.caminho, raizPath)).limit(1);
  if (existingRaiz.length === 1 && existingRaiz[0].id === raizId) {
    existing++;
  } else {
    created++;
  }
  
  for (const nivel1 of ESTRUTURA_INSTITUCIONAL.nivel1) {
    const nivel1Path = `${raizPath}/${nivel1.codigo}`;
    const nivel1Id = await getOrCreateFolder(nivel1.codigo, nivel1Path, raizId, "macro");
    
    for (const subpasta of nivel1.subpastas) {
      const subpastaPath = `${nivel1Path}/${subpasta}`;
      await getOrCreateFolder(subpasta, subpastaPath, nivel1Id, "subpasta");
      created++;
    }
  }
  
  return { created, existing };
}

export async function criarEstruturaProjeto(
  cliente: string,
  uf: string,
  codigoProjeto: string,
  empreendimentoId: number,
  projetoId?: number
): Promise<{ success: boolean; path: string; foldersCreated: number }> {
  try {
    // Nomenclatura: CÓDIGO_CLIENTE_UF (código primeiro, conforme gestão documental)
    const codigoNorm = normalizarTexto(codigoProjeto);
    const clienteNorm = normalizarTexto(cliente);
    const ufNorm = normalizarTexto(uf || 'BR');
    const nomeProjeto = `${codigoNorm}_${clienteNorm}_${ufNorm}`;
    const raizPath = `/${ESTRUTURA_INSTITUCIONAL.raiz}`;
    
    // Pasta de projetos conforme estrutura atual
    const possiveisPastasProjetos = [
      `${raizPath}/3. PROJETOS`,
      `${raizPath}/03_PROJETOS`,
      `${raizPath}/02_PROJETOS`,
      `${raizPath}/PROJETOS`
    ];
    
    let projetosPath = `${raizPath}/3. PROJETOS`;
    let projetosPasta = null;
    
    for (const path of possiveisPastasProjetos) {
      const pasta = await db.select().from(datasetPastas).where(eq(datasetPastas.caminho, path)).limit(1);
      if (pasta.length > 0) {
        projetosPath = path;
        projetosPasta = pasta[0];
        break;
      }
    }
    
    // Se não encontrou nenhuma pasta de projetos, criar estrutura institucional
    if (!projetosPasta) {
      console.log('[Folder Structure] Pasta de projetos não encontrada, criando estrutura institucional...');
      await criarEstruturaInstitucional();
      projetosPath = `${raizPath}/03_PROJETOS`;
    }
    
    const projetoPath = `${projetosPath}/${nomeProjeto}`;
    
    const projetosPastaAtual = await db.select().from(datasetPastas).where(eq(datasetPastas.caminho, projetosPath)).limit(1);
    const projetosPaiId = projetosPastaAtual.length > 0 ? projetosPastaAtual[0].id : null;
    
    const projetoPastaId = await getOrCreateFolder(
      nomeProjeto,
      projetoPath,
      projetosPaiId,
      "projeto",
      empreendimentoId,
      projetoId
    );
    
    let foldersCreated = 1;
    
    for (const nivel3 of ESTRUTURA_PROJETO) {
      const nivel3Path = `${projetoPath}/${nivel3.codigo}`;
      const nivel3Id = await getOrCreateFolder(
        nivel3.codigo,
        nivel3Path,
        projetoPastaId,
        "subpasta",
        empreendimentoId,
        projetoId
      );
      foldersCreated++;
      
      for (const subpasta of nivel3.subpastas) {
        const nivel4Path = `${nivel3Path}/${subpasta}`;
        await getOrCreateFolder(
          subpasta,
          nivel4Path,
          nivel3Id,
          "subpasta",
          empreendimentoId,
          projetoId
        );
        foldersCreated++;
      }
    }
    
    console.log(`[Folder Structure] Projeto ${nomeProjeto} criado com ${foldersCreated} pastas`);
    
    return {
      success: true,
      path: projetoPath,
      foldersCreated
    };
  } catch (error) {
    console.error('[Folder Structure] Erro ao criar estrutura de projeto:', error);
    return {
      success: false,
      path: '',
      foldersCreated: 0
    };
  }
}

export async function criarPastasParaEmpreendimento(
  empreendimentoId: number,
  cliente: string,
  uf: string,
  nome: string,
  codigo?: string | null,
  syncCloud: boolean = true
): Promise<{ success: boolean; path: string; cloudSync?: boolean }> {
  // Usar código do projeto se disponível, senão usar nome normalizado
  const codigoProjeto = codigo || nome;
  const result = await criarEstruturaProjeto(cliente, uf, codigoProjeto, empreendimentoId);
  
  let cloudSyncResult = false;
  if (syncCloud && result.success) {
    // Sync with OneDrive
    try {
      const { createEmpreendimentoFolderStructure } = await import('./onedriveService');
      const cloudResult = await createEmpreendimentoFolderStructure(cliente, uf, codigo || '', nome);
      cloudSyncResult = cloudResult.success;
      if (cloudResult.success) {
        console.log(`[Folder Structure] Pastas sincronizadas com OneDrive para ${codigo || nome}`);
      }
    } catch (err) {
      console.log(`[Folder Structure] OneDrive não configurado ou erro na sincronização: ${err}`);
    }

    // Sync with Dropbox
    try {
      const { createEmpreendimentoFolderStructure: createDropboxFolders } = await import('./dropboxService');
      const dropboxResult = await createDropboxFolders(cliente, uf, codigo || '', nome);
      if (dropboxResult.success) {
        console.log(`[Folder Structure] Pastas criadas no Dropbox para ${codigo || nome} (${dropboxResult.foldersCreated} pastas)`);
        cloudSyncResult = true;
      }
    } catch (err) {
      console.log(`[Folder Structure] Dropbox não configurado ou erro na sincronização: ${err}`);
    }
  }
  
  return {
    success: result.success,
    path: result.path,
    cloudSync: cloudSyncResult
  };
}

export async function sincronizarPastasExistentes(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;
  
  try {
    await criarEstruturaInstitucional();
    
    const emps = await db.select().from(empreendimentos);
    
    for (const emp of emps) {
      try {
        await criarPastasParaEmpreendimento(
          emp.id,
          emp.cliente || emp.nome,
          emp.uf || 'BR',
          emp.nome,
          emp.codigo
        );
        synced++;
      } catch (error) {
        console.error(`[Folder Structure] Erro ao sincronizar empreendimento ${emp.codigo || emp.nome}:`, error);
        errors++;
      }
    }
    
    return { synced, errors };
  } catch (error) {
    console.error('[Folder Structure] Erro na sincronização:', error);
    return { synced, errors: errors + 1 };
  }
}
