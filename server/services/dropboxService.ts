// Dropbox Integration Service for EcoGestor Backups
import { Dropbox } from 'dropbox';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=dropbox',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Dropbox not connected');
  }
  return accessToken;
}

async function getDropboxClient() {
  const accessToken = await getAccessToken();
  return new Dropbox({ accessToken });
}

export async function uploadToDropbox(fileName: string, content: string | Buffer): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const dbx = await getDropboxClient();
    const path = `/EcoGestor-Backups/${fileName}`;
    
    const fileContent = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    
    const response = await dbx.filesUpload({
      path,
      contents: fileContent,
      mode: { '.tag': 'overwrite' },
      autorename: false
    });
    
    console.log(`[Dropbox] Arquivo enviado: ${response.result.path_display}`);
    return { success: true, path: response.result.path_display || path };
  } catch (error: any) {
    console.error('[Dropbox] Erro ao enviar arquivo:', error.message);
    return { success: false, error: error.message };
  }
}

export async function listDropboxBackups(): Promise<{ success: boolean; files?: any[]; error?: string }> {
  try {
    const dbx = await getDropboxClient();
    
    try {
      const response = await dbx.filesListFolder({ path: '/EcoGestor-Backups' });
      const files = response.result.entries
        .filter((entry: any) => entry['.tag'] === 'file')
        .map((file: any) => ({
          name: file.name,
          path: file.path_display,
          size: file.size,
          modified: file.server_modified
        }))
        .sort((a: any, b: any) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      
      return { success: true, files };
    } catch (err: any) {
      if (err?.error?.error?.['.tag'] === 'path' && err?.error?.error?.path?.['.tag'] === 'not_found') {
        return { success: true, files: [] };
      }
      throw err;
    }
  } catch (error: any) {
    console.error('[Dropbox] Erro ao listar backups:', error.message);
    return { success: false, error: error.message };
  }
}

export async function deleteOldDropboxBackups(retentionDays: number = 30): Promise<{ deleted: number; errors: string[] }> {
  try {
    const dbx = await getDropboxClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const listResult = await listDropboxBackups();
    if (!listResult.success || !listResult.files) {
      return { deleted: 0, errors: [listResult.error || 'Failed to list files'] };
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

export async function testDropboxConnection(): Promise<{ success: boolean; accountName?: string; error?: string }> {
  try {
    const dbx = await getDropboxClient();
    const response = await dbx.usersGetCurrentAccount();
    const accountName = response.result.name.display_name;
    console.log(`[Dropbox] Conexão testada com sucesso. Conta: ${accountName}`);
    return { success: true, accountName };
  } catch (error: any) {
    console.error('[Dropbox] Erro ao testar conexão:', error.message);
    return { success: false, error: error.message };
  }
}
