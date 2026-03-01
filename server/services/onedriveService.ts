// OneDrive integration using Replit's official connector (connection:conn_onedrive_01KFGT24ZPH1DSCD6K1XVZ2H53)
import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  console.log('[OneDrive] Connector hostname:', hostname);
  
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    console.log('[OneDrive] Token type - REPL_IDENTITY:', !!process.env.REPL_IDENTITY, 'WEB_REPL_RENEWAL:', !!process.env.WEB_REPL_RENEWAL);
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  if (!hostname) {
    throw new Error('REPLIT_CONNECTORS_HOSTNAME not configured');
  }

  console.log('[OneDrive] Fetching connection settings...');
  
  // Use official Replit connector endpoint with connector_names filter
  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=onedrive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  console.log('[OneDrive] Connection response status:', response.status);
  console.log('[OneDrive] Found connections:', data.items?.length || 0);
  
  // Get first OneDrive connection
  connectionSettings = data.items?.[0];
  
  if (connectionSettings) {
    console.log('[OneDrive] Found OneDrive connection:', connectionSettings.id);
  } else {
    console.log('[OneDrive] No OneDrive connection found');
  }

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    console.log('[OneDrive] No connection or access token found');
    throw new Error('OneDrive not connected - please configure OneDrive in Replit integrations');
  }
  
  console.log('[OneDrive] Successfully retrieved access token');
  return accessToken;
}

async function getOneDriveClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

function normalizePath(path: string): string {
  return path
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\/\-\.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

const ROOT_FOLDER = "ECOBRASIL_CONSULTORIA_AMBIENTAL";
const PROJECTS_FOLDER = "3. PROJETOS";

// Espelha a mesma estrutura do Dropbox
const ESTRUTURA_INSTITUCIONAL = [
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
  // Módulos: Propostas Comerciais, Leads/CRM, Fornecedores
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
  { codigo: "3. PROJETOS", subpastas: [] },
  // Módulos: Frota, Equipamentos
  {
    codigo: "4. RECURSOS_E_PATRIMONIO",
    subpastas: ["4.1. FROTA", "4.2. EQUIPAMENTOS"]
  },
  // Módulo: Base de Conhecimento
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
];

// Estrutura de cada projeto em /3. PROJETOS/{PROJETO}/
const ESTRUTURA_PROJETO = [
  // Módulos: Contratos, Aditivos, Autorizações
  { codigo: "1. GESTAO_E_CONTRATOS", subpastas: ["1.1. CONTRATO_PRINCIPAL", "1.2. ADITIVOS", "1.3. AUTORIZACOES"] },
  // Módulos: Cronograma, Atas de Reunião
  { codigo: "2. PLANEJAMENTO_E_CRONOGRAMA", subpastas: ["2.1. CRONOGRAMA", "2.2. PLANOS_DE_TRABALHO", "2.3. ATAS_DE_REUNIAO"] },
  // Módulo: Licenças, Condicionantes, Evidências
  { codigo: "3. LICENCAS_E_CONDICIONANTES", subpastas: ["3.1. LICENCAS_ATIVAS", "3.2. CONDICIONANTES", "3.3. EVIDENCIAS_E_COMPROVANTES", "3.4. PROTOCOLOS"] },
  // Módulo: Amostras, Monitoramento Ambiental
  { codigo: "4. MONITORAMENTO_E_AMOSTRAS", subpastas: ["4.1. CAMPO", "4.2. PROCESSADOS", "4.3. LAUDOS_LABORATORIAIS"] },
  // Módulo: Relatórios, Documentos Técnicos
  { codigo: "5. RELATORIOS_E_PARECERES", subpastas: ["5.1. MINUTAS", "5.2. VERSOES_FINAIS", "5.3. PARECERES_TECNICOS"] },
  // Módulo: Camadas Geoespaciais
  { codigo: "6. MAPAS_E_GEOESPACIAL", subpastas: ["6.1. SHAPEFILES", "6.2. MAPAS_FINAIS", "6.3. KMZ_KML"] },
  // Módulo: Comunicação Interna, Ofícios
  { codigo: "7. COMUNICACOES", subpastas: ["7.1. OFICIOS", "7.2. EMAILS_RELEVANTES", "7.3. NOTIFICACOES_ORGAOS"] },
  // Módulo: Entregas, Financeiro de Projeto, Recibos
  { codigo: "8. ENTREGAS_E_FINANCEIRO", subpastas: ["8.1. ENVIADOS", "8.2. PROTOCOLOS_RECEBIDOS", "8.3. RECIBOS", "8.4. NOTAS_FISCAIS"] }
];

export async function checkOneDriveConnection(): Promise<{ connected: boolean; user?: string; email?: string; error?: string }> {
  try {
    console.log('[OneDrive] Checking connection...');
    const client = await getOneDriveClient();
    console.log('[OneDrive] Client created, fetching user info...');
    const user = await client.api('/me').get();
    console.log('[OneDrive] User info retrieved:', user.displayName, user.mail || user.userPrincipalName);
    return {
      connected: true,
      user: user.displayName,
      email: user.mail || user.userPrincipalName
    };
  } catch (error: any) {
    console.error('[OneDrive] Connection check failed:', error.message);
    return {
      connected: false,
      error: error.message
    };
  }
}

async function createFolderIfNotExists(client: Client, parentPath: string, folderName: string): Promise<{ success: boolean; path: string }> {
  try {
    const fullPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    
    try {
      await client.api(`/me/drive/root:/${fullPath}`).get();
      return { success: true, path: fullPath };
    } catch (e: any) {
      if (e.statusCode !== 404) {
        throw e;
      }
    }

    const parentApiPath = parentPath 
      ? `/me/drive/root:/${parentPath}:/children`
      : '/me/drive/root/children';
    
    await client.api(parentApiPath).post({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail"
    });

    console.log(`[OneDrive] Pasta criada: ${fullPath}`);
    return { success: true, path: fullPath };
  } catch (error: any) {
    if (error.statusCode === 409 || error.code === 'nameAlreadyExists') {
      return { success: true, path: `${parentPath}/${folderName}` };
    }
    console.error(`[OneDrive] Erro ao criar pasta ${folderName}:`, error.message);
    return { success: false, path: '' };
  }
}

export async function createInstitutionalStructure(): Promise<{ success: boolean; foldersCreated: number }> {
  try {
    const client = await getOneDriveClient();
    let foldersCreated = 0;

    await createFolderIfNotExists(client, '', ROOT_FOLDER);
    foldersCreated++;

    for (const nivel1 of ESTRUTURA_INSTITUCIONAL) {
      await createFolderIfNotExists(client, ROOT_FOLDER, nivel1.codigo);
      foldersCreated++;

      for (const subpasta of nivel1.subpastas) {
        await createFolderIfNotExists(client, `${ROOT_FOLDER}/${nivel1.codigo}`, subpasta);
        foldersCreated++;
      }
    }

    console.log(`[OneDrive] Estrutura institucional criada com ${foldersCreated} pastas`);
    return { success: true, foldersCreated };
  } catch (error: any) {
    console.error('[OneDrive] Erro ao criar estrutura institucional:', error);
    return { success: false, foldersCreated: 0 };
  }
}

export async function createEmpreendimentoFolderStructure(
  cliente: string,
  uf: string,
  codigo: string,
  nome: string
): Promise<{ success: boolean; path: string; foldersCreated: number }> {
  try {
    const client = await getOneDriveClient();
    
    const clienteNorm = normalizePath(cliente || nome);
    const ufNorm = (uf || 'BR').toUpperCase();
    const codigoNorm = normalizePath(codigo || nome);
    const projectName = `${clienteNorm}_${ufNorm}_${codigoNorm}`;
    
    const projectsPath = `${ROOT_FOLDER}/${PROJECTS_FOLDER}`;
    const projectPath = `${projectsPath}/${projectName}`;

    await createFolderIfNotExists(client, '', ROOT_FOLDER);
    await createFolderIfNotExists(client, ROOT_FOLDER, PROJECTS_FOLDER);
    await createFolderIfNotExists(client, projectsPath, projectName);

    let foldersCreated = 1;

    for (const nivel of ESTRUTURA_PROJETO) {
      await createFolderIfNotExists(client, projectPath, nivel.codigo);
      foldersCreated++;

      for (const subpasta of nivel.subpastas) {
        await createFolderIfNotExists(client, `${projectPath}/${nivel.codigo}`, subpasta);
        foldersCreated++;
      }
    }

    console.log(`[OneDrive] Estrutura do empreendimento ${projectName} criada com ${foldersCreated} pastas`);
    return { success: true, path: projectPath, foldersCreated };
  } catch (error: any) {
    console.error('[OneDrive] Erro ao criar estrutura do empreendimento:', error);
    return { success: false, path: '', foldersCreated: 0 };
  }
}

export async function syncAllEmpreendimentosToOneDrive(empreendimentos: Array<{ id: number; cliente: string | null; uf: string | null; codigo: string | null; nome: string }>): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    await createInstitutionalStructure();
  } catch (e) {
    console.error('[OneDrive] Erro ao criar estrutura institucional:', e);
  }

  for (const emp of empreendimentos) {
    try {
      const result = await createEmpreendimentoFolderStructure(
        emp.cliente || emp.nome,
        emp.uf || 'BR',
        emp.codigo || '',
        emp.nome
      );
      if (result.success) {
        synced++;
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`[OneDrive] Erro ao sincronizar ${emp.codigo || emp.nome}:`, error);
      errors++;
    }
  }

  return { synced, errors };
}

export async function listOneDriveFolders(path?: string): Promise<{ success: boolean; folders: any[]; error?: string }> {
  try {
    const client = await getOneDriveClient();
    const apiPath = path 
      ? `/me/drive/root:/${path}:/children`
      : '/me/drive/root/children';
    
    const response = await client.api(apiPath)
      .filter("folder ne null")
      .select("id,name,folder,createdDateTime,lastModifiedDateTime")
      .get();

    return {
      success: true,
      folders: response.value || []
    };
  } catch (error: any) {
    console.error('[OneDrive] Erro ao listar pastas:', error);
    return {
      success: false,
      folders: [],
      error: error.message
    };
  }
}

export async function uploadFileToOneDrive(
  filePath: string,
  fileContent: Buffer,
  fileName: string
): Promise<{ success: boolean; webUrl?: string; error?: string }> {
  try {
    const client = await getOneDriveClient();
    const uploadPath = `/me/drive/root:/${filePath}/${fileName}:/content`;
    
    const response = await client.api(uploadPath)
      .put(fileContent);

    console.log(`[OneDrive] Arquivo enviado: ${filePath}/${fileName}`);
    return {
      success: true,
      webUrl: response.webUrl
    };
  } catch (error: any) {
    console.error('[OneDrive] Erro ao enviar arquivo:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function uploadFileToEmpreendimento(
  cliente: string,
  uf: string,
  codigo: string,
  nome: string,
  subFolder: string,
  fileContent: Buffer,
  fileName: string
): Promise<{ success: boolean; webUrl?: string; error?: string }> {
  const clienteNorm = normalizePath(cliente || nome);
  const ufNorm = (uf || 'BR').toUpperCase();
  const codigoNorm = normalizePath(codigo || nome);
  const projectName = `${clienteNorm}_${ufNorm}_${codigoNorm}`;
  
  const filePath = `${ROOT_FOLDER}/${PROJECTS_FOLDER}/${projectName}/${subFolder}`;
  
  return uploadFileToOneDrive(filePath, fileContent, fileName);
}
