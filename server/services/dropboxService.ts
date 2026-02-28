// Dropbox Integration Service for EcoGestor Backups
// Uses Replit Dropbox connector (connection:conn_dropbox_01KFGSSQGDW63V3TVCW0E9ADAH)
import { Dropbox } from 'dropbox';

// Pasta compartilhada do Dropbox para backups do EcoGestor
const BACKUP_SHARED_LINK = 'https://www.dropbox.com/scl/fo/lejw1kns4jbz21sp736h7/AKpPu0B13Bt3XLW77U9PlWw?rlkey=ivtn667px17nftar2elc8jp01&dl=0';
// For "App folder" scoped apps, the root is "" and maps to /Apps/Ecobrasilgestor/ in Dropbox
// For "Full Dropbox" apps, use an absolute path like /EcoGestor-Backups
const BACKUP_FOLDER_FALLBACK = '/Backups';
const APP_FOLDER_ROOT = '';

// Do NOT cache connectionSettings — always fetch fresh, token expires every 4h
async function getAccessToken(): Promise<string> {
  // Fallback: use DROPBOX_ACCESS_TOKEN env var if set
  if (process.env.DROPBOX_ACCESS_TOKEN) {
    console.log('[Dropbox] Using DROPBOX_ACCESS_TOKEN env var');
    return process.env.DROPBOX_ACCESS_TOKEN;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Credenciais do Replit não encontradas (REPL_IDENTITY / WEB_REPL_RENEWAL)');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=dropbox',
    {
      headers: {
        Accept: 'application/json',
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

  // Check if the token from Replit connector is expired
  const expiresAt =
    connectionSettings?.settings?.oauth?.credentials?.expires_at ||
    connectionSettings?.settings?.expires_at;

  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    const msg =
      'Token do Dropbox expirado em ' +
      new Date(expiresAt).toLocaleString('pt-BR') +
      '. Reconecte o Dropbox nas configurações do Replit ou defina a variável DROPBOX_ACCESS_TOKEN.';
    console.error('[Dropbox] ' + msg);
    throw new Error(msg);
  }

  return accessToken;
}

// WARNING: Never cache this client — tokens expire every 4h.
export async function getUncachableDropboxClient() {
  const clientId = process.env.DROPBOX_CLIENT_ID?.trim();
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET?.trim();
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN?.trim();

  // Option A: Use refresh token + client credentials (best for long-term, auto-refreshes)
  if (clientId && clientSecret && refreshToken) {
    console.log('[Dropbox] Using DropboxAuth with refresh token (auto-refresh enabled)');
    const { DropboxAuth } = await import('dropbox');
    const auth = new DropboxAuth({ clientId, clientSecret, refreshToken });
    await auth.refreshAccessToken();
    return new Dropbox({ auth });
  }

  // Option B: Static access token or Replit connector token
  const accessToken = await getAccessToken();
  return new Dropbox({ accessToken });
}

// Resolve the shared folder path so we can upload into it
let resolvedBackupPath: string | null = null;

async function getBackupFolderPath(): Promise<string> {
  if (resolvedBackupPath !== null) return resolvedBackupPath;

  const dbx = await getUncachableDropboxClient();

  // Step 1: try to resolve the shared link (Full Dropbox + sharing.read)
  try {
    const meta = await dbx.sharingGetSharedLinkMetadata({ url: BACKUP_SHARED_LINK });
    const result = meta.result as any;
    if (result['.tag'] === 'folder' && result.path_lower) {
      console.log(`[Dropbox] Pasta compartilhada resolvida: ${result.path_lower}`);
      resolvedBackupPath = result.path_lower;
      return resolvedBackupPath!;
    }
  } catch (err: any) {
    console.warn('[Dropbox] Shared link não resolvido:', err?.error?.error_summary || err.message);
  }

  // Step 2: try absolute path (Full Dropbox app)
  try {
    await dbx.filesCreateFolderV2({ path: BACKUP_FOLDER_FALLBACK, autorename: false });
    console.log(`[Dropbox] Pasta criada: ${BACKUP_FOLDER_FALLBACK}`);
    resolvedBackupPath = BACKUP_FOLDER_FALLBACK;
    return BACKUP_FOLDER_FALLBACK;
  } catch (err: any) {
    const summary = err?.error?.error_summary || '';
    if (summary.includes('path/conflict/folder')) {
      // Folder already exists — this is fine
      console.log(`[Dropbox] Pasta ${BACKUP_FOLDER_FALLBACK} já existe (Full Dropbox)`);
      resolvedBackupPath = BACKUP_FOLDER_FALLBACK;
      return BACKUP_FOLDER_FALLBACK;
    }
    // If path error mentions "not_found" for the root, it's probably an App folder app
    console.warn('[Dropbox] Caminho absoluto falhou, tentando modo pasta do app:', summary);
  }

  // Step 3: App folder mode — root is "" (maps to /Apps/Ecobrasilgestor/ in user's Dropbox)
  try {
    await dbx.filesCreateFolderV2({ path: '/Backups', autorename: false });
  } catch (err: any) {
    const summary = err?.error?.error_summary || '';
    if (!summary.includes('path/conflict/folder')) {
      console.warn('[Dropbox] Não foi possível criar subpasta /Backups no app folder:', summary);
    }
  }
  console.log('[Dropbox] Usando modo App Folder: pasta /Backups (relativa ao app)');
  resolvedBackupPath = '/Backups';
  return '/Backups';
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
  tokenSource?: string;
  error?: string;
}> {
  try {
    const tokenSource = process.env.DROPBOX_ACCESS_TOKEN
      ? 'env_var'
      : 'replit_connector';

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
    return { success: true, accountName, email, backupFolder, tokenSource };
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
    // Nomenclatura: CÓDIGO_CLIENTE_UF (código primeiro, conforme gestão documental)
    const codigoNorm = normalizarTexto(codigo || nome);
    const clienteNorm = normalizarTexto(cliente);
    const ufNorm = normalizarTexto(uf || 'BR');
    const nomeProjeto = `${codigoNorm}_${clienteNorm}_${ufNorm}`;
    const projetoPath = `${DROPBOX_ROOT}/3. PROJETOS/${nomeProjeto}`;

    // Estrutura hierárquica: 1. Pasta, 1.1. Subpasta, 1.1.1. Subsubpasta
    const estruturaProjeto = [
      '1. GESTAO_E_CONTRATOS',
      '1. GESTAO_E_CONTRATOS/1.1. Contrato_Principal',
      '1. GESTAO_E_CONTRATOS/1.2. Aditivos',
      '1. GESTAO_E_CONTRATOS/1.3. Autorizacoes',
      '2. PLANEJAMENTO_E_CRONOGRAMA',
      '2. PLANEJAMENTO_E_CRONOGRAMA/2.1. Cronograma',
      '2. PLANEJAMENTO_E_CRONOGRAMA/2.2. Planos_de_Trabalho',
      '2. PLANEJAMENTO_E_CRONOGRAMA/2.3. Atas_de_Reuniao',
      '3. BANCOS_DE_DADOS',
      '3. BANCOS_DE_DADOS/3.1. Campo',
      '3. BANCOS_DE_DADOS/3.1. Campo/3.1.1. Formularios',
      '3. BANCOS_DE_DADOS/3.1. Campo/3.1.2. Fotos',
      '3. BANCOS_DE_DADOS/3.2. Processados',
      '3. BANCOS_DE_DADOS/3.2. Processados/3.2.1. Planilhas',
      '3. BANCOS_DE_DADOS/3.2. Processados/3.2.2. Banco_Final',
      '4. RELATORIOS_E_PARECERES',
      '4. RELATORIOS_E_PARECERES/4.1. Minutas',
      '4. RELATORIOS_E_PARECERES/4.2. Versoes_Finais',
      '4. RELATORIOS_E_PARECERES/4.3. Pareceres_Tecnicos',
      '5. MAPAS_E_GEOESPACIAL',
      '5. MAPAS_E_GEOESPACIAL/5.1. Shapefiles',
      '5. MAPAS_E_GEOESPACIAL/5.2. Mapas_Finais',
      '5. MAPAS_E_GEOESPACIAL/5.3. KMZ_KML',
      '6. COMUNICACOES',
      '6. COMUNICACOES/6.1. Oficios',
      '6. COMUNICACOES/6.2. Emails_Relevantes',
      '6. COMUNICACOES/6.3. Notificacoes_Orgaos',
      '7. ENTREGAS_E_PROTOCOLOS',
      '7. ENTREGAS_E_PROTOCOLOS/7.1. Enviados',
      '7. ENTREGAS_E_PROTOCOLOS/7.2. Protocolos',
      '7. ENTREGAS_E_PROTOCOLOS/7.3. Recibos',
    ];

    let foldersCreated = 0;

    await createDropboxFolder('/3. PROJETOS');
    await createDropboxFolder(`/3. PROJETOS/${nomeProjeto}`);
    foldersCreated++;

    for (const subpasta of estruturaProjeto) {
      const result = await createDropboxFolder(
        `/3. PROJETOS/${nomeProjeto}/${subpasta}`
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
    // Estrutura institucional com numeração hierárquica (1., 1.1., 1.1.1.)
    const estruturaInstitucional = [
      '',
      '/1. ADMINISTRATIVO_E_JURIDICO',
      '/1. ADMINISTRATIVO_E_JURIDICO/1.1. Contratos',
      '/1. ADMINISTRATIVO_E_JURIDICO/1.2. Financeiro',
      '/1. ADMINISTRATIVO_E_JURIDICO/1.3. Recursos_Humanos',
      '/1. ADMINISTRATIVO_E_JURIDICO/1.4. Compliance_e_LGPD',
      '/2. COMERCIAL_E_CLIENTES',
      '/2. COMERCIAL_E_CLIENTES/2.1. Propostas_Enviadas',
      '/2. COMERCIAL_E_CLIENTES/2.2. Propostas_Aprovadas',
      '/2. COMERCIAL_E_CLIENTES/2.3. Leads',
      '/2. COMERCIAL_E_CLIENTES/2.4. Relacionamento',
      '/3. PROJETOS',
      '/4. BASE_TECNICA_E_REFERENCIAS',
      '/4. BASE_TECNICA_E_REFERENCIAS/4.1. Legislacao',
      '/4. BASE_TECNICA_E_REFERENCIAS/4.2. Normas_Tecnicas',
      '/4. BASE_TECNICA_E_REFERENCIAS/4.3. Artigos_Cientificos',
      '/4. BASE_TECNICA_E_REFERENCIAS/4.4. Manuais_Metodologicos',
      '/5. MODELOS_E_PADROES',
      '/5. MODELOS_E_PADROES/5.1. Templates_Relatorios',
      '/5. MODELOS_E_PADROES/5.2. Modelos_Planilhas',
      '/5. MODELOS_E_PADROES/5.3. Padroes_Graficos',
      '/5. MODELOS_E_PADROES/5.4. Termos_e_Formularios',
      '/6. SISTEMAS_E_AUTOMACOES',
      '/6. SISTEMAS_E_AUTOMACOES/6.1. Workflows_n8n',
      '/6. SISTEMAS_E_AUTOMACOES/6.2. Scripts_R_Python',
      '/6. SISTEMAS_E_AUTOMACOES/6.3. Dashboards',
      '/6. SISTEMAS_E_AUTOMACOES/6.4. Backups_Sistemas',
      '/7. ARQUIVO_MORTO',
      '/7. ARQUIVO_MORTO/7.1. Projetos_Encerrados',
      '/7. ARQUIVO_MORTO/7.2. Contratos_Finalizados',
      '/7. ARQUIVO_MORTO/7.3. Documentos_Historicos',
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
    // Nomenclatura: CÓDIGO_CLIENTE_UF (código primeiro)
    const codigoNorm = normalizarTexto(codigo || nome);
    const clienteNorm = normalizarTexto(cliente);
    const ufNorm = normalizarTexto(uf || 'BR');
    const nomeProjeto = `${codigoNorm}_${clienteNorm}_${ufNorm}`;
    const filePath = `${DROPBOX_ROOT}/3. PROJETOS/${nomeProjeto}/${subpasta}/${fileName}`;

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

// ── ABNT naming & module-aware sync ──────────────────────────────────────────

// Maps module names to their project subfolder (using hierarchical numbering)
const MODULE_FOLDER_MAP: Record<string, string> = {
  licenca: '7. ENTREGAS_E_PROTOCOLOS/7.2. Protocolos',
  condicionante: '7. ENTREGAS_E_PROTOCOLOS/7.2. Protocolos',
  evidencia: '7. ENTREGAS_E_PROTOCOLOS/7.1. Enviados',
  relatorio: '4. RELATORIOS_E_PARECERES/4.2. Versoes_Finais',
  minuta: '4. RELATORIOS_E_PARECERES/4.1. Minutas',
  mapa: '5. MAPAS_E_GEOESPACIAL/5.2. Mapas_Finais',
  shapefile: '5. MAPAS_E_GEOESPACIAL/5.1. Shapefiles',
  camada: '5. MAPAS_E_GEOESPACIAL/5.3. KMZ_KML',
  contrato: '1. GESTAO_E_CONTRATOS/1.1. Contrato_Principal',
  aditivo: '1. GESTAO_E_CONTRATOS/1.2. Aditivos',
  banco_de_dados: '3. BANCOS_DE_DADOS/3.2. Processados',
  campo: '3. BANCOS_DE_DADOS/3.1. Campo',
  oficio: '6. COMUNICACOES/6.1. Oficios',
  comunicacao: '6. COMUNICACOES/6.2. Emails_Relevantes',
  protocolo: '7. ENTREGAS_E_PROTOCOLOS/7.2. Protocolos',
  entrega: '7. ENTREGAS_E_PROTOCOLOS/7.1. Enviados',
  monitoramento: '3. BANCOS_DE_DADOS/3.1. Campo',
  amostra: '3. BANCOS_DE_DADOS/3.1. Campo',
  documento: '4. RELATORIOS_E_PARECERES/4.2. Versoes_Finais',
  base_conhecimento: `${DROPBOX_ROOT}/4. BASE_TECNICA_E_REFERENCIAS`,
  proposta: `${DROPBOX_ROOT}/2. COMERCIAL_E_CLIENTES/2.1. Propostas_Enviadas`,
  rh: `${DROPBOX_ROOT}/1. ADMINISTRATIVO_E_JURIDICO/1.3. Recursos_Humanos`,
  financeiro: `${DROPBOX_ROOT}/1. ADMINISTRATIVO_E_JURIDICO/1.2. Financeiro`,
};

/**
 * Generates an ABNT-compliant file name.
 * Format: ECB-[CODIGO]-[TIPO]-[YYYYMMDD]-[ORIGINAL]
 */
export function gerarNomeAbnt(
  codigoProjeto: string,
  tipoDocumento: string,
  nomeOriginal: string
): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ext = nomeOriginal.includes('.') ? nomeOriginal.split('.').pop()!.toLowerCase() : '';
  const baseName = nomeOriginal.replace(/\.[^.]+$/, '');
  const normalizado = normalizarTexto(baseName).substring(0, 40);
  const tipo = normalizarTexto(tipoDocumento).substring(0, 10);
  const codigo = normalizarTexto(codigoProjeto).substring(0, 15);
  return `ECB-${codigo}-${tipo}-${date}-${normalizado}${ext ? '.' + ext : ''}`;
}

/**
 * Universal file sync to Dropbox with ABNT naming.
 * Call this from any file upload endpoint.
 */
export async function syncFileToDropbox(params: {
  fileBuffer: Buffer;
  originalName: string;
  mimeType?: string;
  module: string;          // e.g. 'licenca', 'relatorio', 'mapa'
  empreendimento?: {
    cliente: string;
    uf: string;
    codigo: string;
    nome: string;
  };
  useAbntNaming?: boolean;
}): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { fileBuffer, originalName, module, empreendimento, useAbntNaming = true } = params;
    const dbx = await getUncachableDropboxClient();

    let targetPath: string;
    const folderKey = module.toLowerCase().replace(/\s+/g, '_');
    const subpastaRelativa = MODULE_FOLDER_MAP[folderKey];

    if (empreendimento) {
      // Nomenclatura: CÓDIGO_CLIENTE_UF (código primeiro)
      const codigoNorm = normalizarTexto(empreendimento.codigo || empreendimento.nome);
      const clienteNorm = normalizarTexto(empreendimento.cliente);
      const ufNorm = normalizarTexto(empreendimento.uf || 'BR');
      const nomeProjeto = `${codigoNorm}_${clienteNorm}_${ufNorm}`;
      const subpasta = subpastaRelativa && !subpastaRelativa.startsWith(DROPBOX_ROOT)
        ? subpastaRelativa
        : '4. RELATORIOS_E_PARECERES/4.2. Versoes_Finais';
      targetPath = `${DROPBOX_ROOT}/3. PROJETOS/${nomeProjeto}/${subpasta}`;
    } else if (subpastaRelativa && subpastaRelativa.startsWith(DROPBOX_ROOT)) {
      targetPath = subpastaRelativa;
    } else {
      targetPath = `${DROPBOX_ROOT}/6. SISTEMAS_E_AUTOMACOES/6.4. Backups_Sistemas`;
    }

    const fileName = useAbntNaming && empreendimento
      ? gerarNomeAbnt(empreendimento.codigo || empreendimento.nome, module, originalName)
      : originalName;

    const fullFilePath = `${targetPath}/${fileName}`;

    // Ensure folder exists
    try {
      await dbx.filesCreateFolderV2({ path: targetPath, autorename: false });
    } catch (e: any) {
      if (!e?.error?.error_summary?.includes('conflict/folder')) {
        console.warn(`[Dropbox] Não foi possível criar pasta ${targetPath}:`, e?.error?.error_summary);
      }
    }

    const response = await dbx.filesUpload({
      path: fullFilePath,
      contents: fileBuffer,
      mode: { '.tag': 'add' },
      autorename: true,
    });

    const finalPath = response.result.path_display || fullFilePath;
    console.log(`[Dropbox] Arquivo sincronizado: ${finalPath}`);
    return { success: true, path: finalPath };
  } catch (error: any) {
    console.error('[Dropbox] Erro ao sincronizar arquivo:', error.message);
    return { success: false, error: error.message };
  }
}
