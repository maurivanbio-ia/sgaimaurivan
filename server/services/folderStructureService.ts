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

export const ESTRUTURA_INSTITUCIONAL = {
  raiz: "ECOBRASIL_CONSULTORIA_AMBIENTAL",
  nivel1: [
    {
      codigo: "01_ADMINISTRATIVO_E_JURIDICO",
      subpastas: ["Contratos", "Financeiro", "Recursos_Humanos", "Compliance_e_LGPD"]
    },
    {
      codigo: "02_COMERCIAL_E_CLIENTES",
      subpastas: ["Propostas_Enviadas", "Propostas_Aprovadas", "Leads", "Relacionamento"]
    },
    {
      codigo: "03_PROJETOS",
      subpastas: []
    },
    {
      codigo: "04_BASE_TECNICA_E_REFERENCIAS",
      subpastas: ["Legislacao", "Normas_Tecnicas", "Artigos_Cientificos", "Manuais_Metodologicos"]
    },
    {
      codigo: "05_MODELOS_E_PADROES",
      subpastas: ["Templates_Relatorios", "Modelos_Planilhas", "Padroes_Graficos", "Termos_e_Formularios"]
    },
    {
      codigo: "06_SISTEMAS_E_AUTOMACOES",
      subpastas: ["Workflows_n8n", "Scripts_R_Python", "Dashboards", "Backups_Sistemas"]
    },
    {
      codigo: "07_ARQUIVO_MORTO",
      subpastas: ["Projetos_Encerrados", "Contratos_Finalizados", "Documentos_Historicos"]
    }
  ]
};

export const ESTRUTURA_PROJETO = [
  {
    codigo: "01_GESTAO_E_CONTRATOS",
    subpastas: ["Contrato_Principal", "Aditivos"]
  },
  {
    codigo: "02_PLANEJAMENTO_E_CRONOGRAMA",
    subpastas: ["Cronograma", "Planos_de_Trabalho"]
  },
  {
    codigo: "03_BANCOS_DE_DADOS",
    subpastas: ["Campo", "Processados"]
  },
  {
    codigo: "04_RELATORIOS_E_PARECERES",
    subpastas: ["Minutas", "Versoes_Finais"]
  },
  {
    codigo: "05_MAPAS_E_GEOSPATIAL",
    subpastas: ["Shapefiles", "Mapas_Finais"]
  },
  {
    codigo: "06_COMUNICACOES",
    subpastas: ["Oficios", "Emails_Relevantes"]
  },
  {
    codigo: "07_ENTREGAS_E_PROTOCOLOS",
    subpastas: ["Enviados", "Protocolos"]
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
    const nomeProjeto = `${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(codigoProjeto)}`;
    const raizPath = `/${ESTRUTURA_INSTITUCIONAL.raiz}`;
    
    // Tentar encontrar pasta de projetos existente (pode ser 02_PROJETOS ou 03_PROJETOS)
    const possiveisPastasProjetos = [
      `${raizPath}/02_PROJETOS`,
      `${raizPath}/03_PROJETOS`,
      `${raizPath}/PROJETOS`
    ];
    
    let projetosPath = `${raizPath}/03_PROJETOS`;
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
  codigo?: string | null
): Promise<{ success: boolean; path: string }> {
  // Usar código do projeto se disponível, senão usar nome normalizado
  const codigoProjeto = codigo || nome;
  const result = await criarEstruturaProjeto(cliente, uf, codigoProjeto, empreendimentoId);
  return {
    success: result.success,
    path: result.path
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
