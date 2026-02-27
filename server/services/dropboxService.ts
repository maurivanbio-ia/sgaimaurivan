// Dropbox Integration Service for EcoGestor Backups
// Uses Replit Dropbox connector (connection:conn_dropbox_01KFGSSQGDW63V3TVCW0E9ADAH)
import { Dropbox } from 'dropbox';

// Pasta compartilhada do Dropbox para backups do EcoGestor
const BACKUP_SHARED_LINK = 'https://www.dropbox.com/scl/fo/lejw1kns4jbz21sp736h7/AKpPu0B13Bt3XLW77U9PlWw?rlkey=ivtn667px17nftar2elc8jp01&dl=0';
const BACKUP_FOLDER_FALLBACK = '/EcoGestor-Backups';

let connectionSettings: any;

async function getAccessToken() {
  if (
    connectionSettings &&
    connectionSettings.settings?.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=dropbox',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error(
      'Dropbox não conectado. Verifique a integração nas configurações do Replit.'
    );
  }

  return accessToken;
}

// WARNING: Never cache this client — tokens expire.
async function getUncachableDropboxClient() {
  const accessToken = await getAccessToken();
  return new Dropbox({ accessToken });
}

// Resolve the shared folder path so we can upload into it
let resolvedBackupPath: string | null = null;

async function getBackupFolderPath(): Promise<string> {
  if (resolvedBackupPath) return resolvedBackupPath;

  try {
    const dbx = await getUncachableDropboxClient();
    const meta = await dbx.sharingGetSharedLinkMetadata({ url: BACKUP_SHARED_LINK });
    const result = meta.result as any;

    if (result['.tag'] === 'folder' && result.path_lower) {
      console.log(`[Dropbox] Pasta compartilhada resolvida: ${result.path_lower}`);
      resolvedBackupPath = result.path_lower;
      return resolvedBackupPath!;
    }
  } catch (err: any) {
    console.warn(
      '[Dropbox] Não foi possível resolver pasta compartilhada, usando caminho padrão:',
      err?.error?.error_summary || err.message
    );
  }

  resolvedBackupPath = BACKUP_FOLDER_FALLBACK;
  return BACKUP_FOLDER_FALLBACK;
}

export async function uploadToDropbox(
  fileName: string,
  content: string | Buffer
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const dbx = await getUncachableDropboxClient();
    const folder = await getBackupFolderPath();
    const path = `${folder}/${fileName}`;

    const fileContent =
      typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    const response = await dbx.filesUpload({
      path,
      contents: fileContent,
      mode: { '.tag': 'overwrite' },
      autorename: false,
    });

    console.log(`[Dropbox] Arquivo enviado: ${response.result.path_display}`);
    return { success: true, path: response.result.path_display || path };
  } catch (error: any) {
    console.error('[Dropbox] Erro ao enviar arquivo:', error.message);
    return { success: false, error: error.message };
  }
}

export async function listDropboxBackups(): Promise<{
  success: boolean;
  files?: any[];
  folderPath?: string;
  error?: string;
}> {
  try {
    const dbx = await getUncachableDropboxClient();
    const folder = await getBackupFolderPath();

    try {
      const response = await dbx.filesListFolder({ path: folder });
      const files = response.result.entries
        .filter((entry: any) => entry['.tag'] === 'file')
        .map((file: any) => ({
          name: file.name,
          path: file.path_display,
          size: file.size,
          modified: file.server_modified,
        }))
        .sort(
          (a: any, b: any) =>
            new Date(b.modified).getTime() - new Date(a.modified).getTime()
        );

      return { success: true, files, folderPath: folder };
    } catch (err: any) {
      if (
        err?.error?.error?.['.tag'] === 'path' &&
        err?.error?.error?.path?.['.tag'] === 'not_found'
      ) {
        return { success: true, files: [], folderPath: folder };
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[Dropbox] Erro ao listar backups:', error.message);
    return { success: false, error: error.message };
  }
}

export async function deleteOldDropboxBackups(
  retentionDays: number = 30
): Promise<{ deleted: number; errors: string[] }> {
  try {
    const dbx = await getUncachableDropboxClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const listResult = await listDropboxBackups();
    if (!listResult.success || !listResult.files) {
      return {
        deleted: 0,
        errors: [listResult.error || 'Failed to list files'],
      };
    }

    let deleted = 0;
    const errors: string[] = [];

    for (const file of listResult.files) {
      const fileDate = new Date(file.modified);
      if (fileDate < cutoffDate) {
        try {
          await dbx.filesDeleteV2({ path: file.path });
          deleted++;
          console.log(`[Dropbox] Backup antigo removido: ${file.name}`);
        } catch (err: any) {
          errors.push(`Failed to delete ${file.name}: ${err.message}`);
        }
      }
    }

    return { deleted, errors };
  } catch (error: any) {
    return { deleted: 0, errors: [error.message] };
  }
}

export async function testDropboxConnection(): Promise<{
  success: boolean;
  accountName?: string;
  email?: string;
  backupFolder?: string;
  error?: string;
}> {
  try {
    const dbx = await getUncachableDropboxClient();
    const response = await dbx.usersGetCurrentAccount();
    const accountName = response.result.name.display_name;
    const email = response.result.email;

    // Reset cached path so it re-resolves on next use
    resolvedBackupPath = null;
    const backupFolder = await getBackupFolderPath();

    console.log(
      `[Dropbox] Conexão testada com sucesso. Conta: ${accountName} (${email}). Pasta: ${backupFolder}`
    );
    return { success: true, accountName, email, backupFolder };
  } catch (error: any) {
    console.error('[Dropbox] Erro ao testar conexão:', error.message);
    return { success: false, error: error.message };
  }
}

// ── Folder structure utilities ─────────────────────────────────────────────

const DROPBOX_ROOT = '/ECOBRASIL_CONSULTORIA_AMBIENTAL';

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

export async function createDropboxFolder(
  path: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const dbx = await getUncachableDropboxClient();
    const fullPath = path.startsWith(DROPBOX_ROOT)
      ? path
      : `${DROPBOX_ROOT}${path}`;

    try {
      await dbx.filesCreateFolderV2({ path: fullPath, autorename: false });
      console.log(`[Dropbox] Pasta criada: ${fullPath}`);
      return { success: true, path: fullPath };
    } catch (err: any) {
      if (
        err?.error?.error?.['.tag'] === 'path' &&
        err?.error?.error?.path?.['.tag'] === 'conflict'
      ) {
        return { success: true, path: fullPath };
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[Dropbox] Erro ao criar pasta:', error.message);
    return { success: false, error: error.message };
  }
}

export async function createEmpreendimentoFolderStructure(
  cliente: string,
  uf: string,
  codigo: string,
  nome: string
): Promise<{
  success: boolean;
  path?: string;
  foldersCreated: number;
  error?: string;
}> {
  try {
    const nomeProjeto = `${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(codigo || nome)}`;
    const projetoPath = `${DROPBOX_ROOT}/03_PROJETOS/${nomeProjeto}`;

    const estruturaProjeto = [
      '01_GESTAO_E_CONTRATOS',
      '01_GESTAO_E_CONTRATOS/Contrato_Principal',
      '01_GESTAO_E_CONTRATOS/Aditivos',
      '02_PLANEJAMENTO_E_CRONOGRAMA',
      '02_PLANEJAMENTO_E_CRONOGRAMA/Cronograma',
      '02_PLANEJAMENTO_E_CRONOGRAMA/Planos_de_Trabalho',
      '03_BANCOS_DE_DADOS',
      '03_BANCOS_DE_DADOS/Campo',
      '03_BANCOS_DE_DADOS/Processados',
      '04_RELATORIOS_E_PARECERES',
      '04_RELATORIOS_E_PARECERES/Minutas',
      '04_RELATORIOS_E_PARECERES/Versoes_Finais',
      '05_MAPAS_E_GEOSPATIAL',
      '05_MAPAS_E_GEOSPATIAL/Shapefiles',
      '05_MAPAS_E_GEOSPATIAL/Mapas_Finais',
      '06_COMUNICACOES',
      '06_COMUNICACOES/Oficios',
      '06_COMUNICACOES/Emails_Relevantes',
      '07_ENTREGAS_E_PROTOCOLOS',
      '07_ENTREGAS_E_PROTOCOLOS/Enviados',
      '07_ENTREGAS_E_PROTOCOLOS/Protocolos',
    ];

    let foldersCreated = 0;

    await createDropboxFolder('/03_PROJETOS');
    await createDropboxFolder(`/03_PROJETOS/${nomeProjeto}`);
    foldersCreated++;

    for (const subpasta of estruturaProjeto) {
      const result = await createDropboxFolder(
        `/03_PROJETOS/${nomeProjeto}/${subpasta}`
      );
      if (result.success) foldersCreated++;
    }

    console.log(
      `[Dropbox] Estrutura de pastas criada para ${nomeProjeto}: ${foldersCreated} pastas`
    );
    return { success: true, path: projetoPath, foldersCreated };
  } catch (error: any) {
    console.error(
      '[Dropbox] Erro ao criar estrutura de pastas:',
      error.message
    );
    return { success: false, foldersCreated: 0, error: error.message };
  }
}

export async function createInstitutionalFolderStructure(): Promise<{
  success: boolean;
  foldersCreated: number;
  error?: string;
}> {
  try {
    const estruturaInstitucional = [
      '',
      '/01_ADMINISTRATIVO_E_JURIDICO',
      '/01_ADMINISTRATIVO_E_JURIDICO/Contratos',
      '/01_ADMINISTRATIVO_E_JURIDICO/Financeiro',
      '/01_ADMINISTRATIVO_E_JURIDICO/Recursos_Humanos',
      '/01_ADMINISTRATIVO_E_JURIDICO/Compliance_e_LGPD',
      '/02_COMERCIAL_E_CLIENTES',
      '/02_COMERCIAL_E_CLIENTES/Propostas_Enviadas',
      '/02_COMERCIAL_E_CLIENTES/Propostas_Aprovadas',
      '/02_COMERCIAL_E_CLIENTES/Leads',
      '/02_COMERCIAL_E_CLIENTES/Relacionamento',
      '/03_PROJETOS',
      '/04_BASE_TECNICA_E_REFERENCIAS',
      '/04_BASE_TECNICA_E_REFERENCIAS/Legislacao',
      '/04_BASE_TECNICA_E_REFERENCIAS/Normas_Tecnicas',
      '/04_BASE_TECNICA_E_REFERENCIAS/Artigos_Cientificos',
      '/04_BASE_TECNICA_E_REFERENCIAS/Manuais_Metodologicos',
      '/05_MODELOS_E_PADROES',
      '/05_MODELOS_E_PADROES/Templates_Relatorios',
      '/05_MODELOS_E_PADROES/Modelos_Planilhas',
      '/05_MODELOS_E_PADROES/Padroes_Graficos',
      '/05_MODELOS_E_PADROES/Termos_e_Formularios',
      '/06_SISTEMAS_E_AUTOMACOES',
      '/06_SISTEMAS_E_AUTOMACOES/Workflows_n8n',
      '/06_SISTEMAS_E_AUTOMACOES/Scripts_R_Python',
      '/06_SISTEMAS_E_AUTOMACOES/Dashboards',
      '/06_SISTEMAS_E_AUTOMACOES/Backups_Sistemas',
      '/07_ARQUIVO_MORTO',
      '/07_ARQUIVO_MORTO/Projetos_Encerrados',
      '/07_ARQUIVO_MORTO/Contratos_Finalizados',
      '/07_ARQUIVO_MORTO/Documentos_Historicos',
    ];

    let foldersCreated = 0;

    for (const pasta of estruturaInstitucional) {
      const result = await createDropboxFolder(pasta);
      if (result.success) foldersCreated++;
    }

    console.log(
      `[Dropbox] Estrutura institucional criada: ${foldersCreated} pastas`
    );
    return { success: true, foldersCreated };
  } catch (error: any) {
    console.error(
      '[Dropbox] Erro ao criar estrutura institucional:',
      error.message
    );
    return { success: false, foldersCreated: 0, error: error.message };
  }
}

export async function listDropboxFolderContents(
  path: string = ''
): Promise<{ success: boolean; entries?: any[]; error?: string }> {
  try {
    const dbx = await getUncachableDropboxClient();
    const fullPath = path ? `${DROPBOX_ROOT}${path}` : DROPBOX_ROOT;

    try {
      const response = await dbx.filesListFolder({ path: fullPath });
      const entries = response.result.entries
        .map((entry: any) => ({
          name: entry.name,
          path: entry.path_display,
          type: entry['.tag'],
          size: entry.size || 0,
          modified: entry.server_modified || null,
        }))
        .sort((a: any, b: any) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });

      return { success: true, entries };
    } catch (err: any) {
      if (
        err?.error?.error?.['.tag'] === 'path' &&
        err?.error?.error?.path?.['.tag'] === 'not_found'
      ) {
        return { success: true, entries: [] };
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[Dropbox] Erro ao listar pasta:', error.message);
    return { success: false, error: error.message };
  }
}

export async function uploadFileToEmpreendimento(
  cliente: string,
  uf: string,
  codigo: string,
  nome: string,
  subpasta: string,
  fileName: string,
  content: Buffer
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const dbx = await getUncachableDropboxClient();
    const nomeProjeto = `${normalizarTexto(cliente)}_${normalizarTexto(uf)}_${normalizarTexto(codigo || nome)}`;
    const filePath = `${DROPBOX_ROOT}/03_PROJETOS/${nomeProjeto}/${subpasta}/${fileName}`;

    const response = await dbx.filesUpload({
      path: filePath,
      contents: content,
      mode: { '.tag': 'add' },
      autorename: true,
    });

    console.log(`[Dropbox] Arquivo enviado: ${response.result.path_display}`);
    return { success: true, path: response.result.path_display || filePath };
  } catch (error: any) {
    console.error('[Dropbox] Erro ao enviar arquivo:', error.message);
    return { success: false, error: error.message };
  }
}
