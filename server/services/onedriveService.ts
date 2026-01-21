import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=onedrive',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('OneDrive not connected');
  }
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
const PROJECTS_FOLDER = "03_PROJETOS";

const ESTRUTURA_INSTITUCIONAL = [
  { codigo: "01_ADMINISTRATIVO_E_JURIDICO", subpastas: ["Contratos", "Financeiro", "Recursos_Humanos", "Compliance_e_LGPD"] },
  { codigo: "02_COMERCIAL_E_CLIENTES", subpastas: ["Propostas_Enviadas", "Propostas_Aprovadas", "Leads", "Relacionamento"] },
  { codigo: "03_PROJETOS", subpastas: [] },
  { codigo: "04_BASE_TECNICA_E_REFERENCIAS", subpastas: ["Legislacao", "Normas_Tecnicas", "Artigos_Cientificos", "Manuais_Metodologicos"] },
  { codigo: "05_MODELOS_E_PADROES", subpastas: ["Templates_Relatorios", "Modelos_Planilhas", "Padroes_Graficos", "Termos_e_Formularios"] },
  { codigo: "06_SISTEMAS_E_AUTOMACOES", subpastas: ["Workflows_n8n", "Scripts_R_Python", "Dashboards", "Backups_Sistemas"] },
  { codigo: "07_ARQUIVO_MORTO", subpastas: ["Projetos_Encerrados", "Contratos_Finalizados", "Documentos_Historicos"] }
];

const ESTRUTURA_PROJETO = [
  { codigo: "01_GESTAO_E_CONTRATOS", subpastas: ["Contrato_Principal", "Aditivos"] },
  { codigo: "02_PLANEJAMENTO_E_CRONOGRAMA", subpastas: ["Cronograma", "Planos_de_Trabalho"] },
  { codigo: "03_BANCOS_DE_DADOS", subpastas: ["Campo", "Processados"] },
  { codigo: "04_RELATORIOS_E_PARECERES", subpastas: ["Minutas", "Versoes_Finais"] },
  { codigo: "05_MAPAS_E_GEOSPATIAL", subpastas: ["Shapefiles", "Mapas_Finais"] },
  { codigo: "06_COMUNICACOES", subpastas: ["Oficios", "Emails_Relevantes"] },
  { codigo: "07_ENTREGAS_E_PROTOCOLOS", subpastas: ["Enviados", "Protocolos"] }
];

export async function checkOneDriveConnection(): Promise<{ connected: boolean; user?: string; email?: string; error?: string }> {
  try {
    const client = await getOneDriveClient();
    const user = await client.api('/me').get();
    return {
      connected: true,
      user: user.displayName,
      email: user.mail || user.userPrincipalName
    };
  } catch (error: any) {
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
