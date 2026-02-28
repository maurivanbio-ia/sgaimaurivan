import cron from 'node-cron';
import { db } from '../db';
import { 
  users, empreendimentos, licencasAmbientais, condicionantes, demandas, 
  contratos, financeiroLancamentos, rhRegistros, veiculos, equipamentos,
  projetos, campanhas, propostasComerciais, amostras, fornecedores,
  treinamentos, baseConhecimento, tarefas, datasetPastas, datasets
} from '@shared/schema';
import { objectStorageClient } from '../replit_integrations/object_storage/objectStorage';
import { uploadToDropbox, deleteOldDropboxBackups } from './dropboxService';
import { format } from 'date-fns';

interface BackupResult {
  success: boolean;
  timestamp: string;
  tables: { [key: string]: number };
  filePath?: string;
  error?: string;
}

interface ObjectInfo {
  key: string;
  lastModified: Date | null;
  size: number;
}

async function exportTableData(tableName: string, table: any): Promise<any[]> {
  try {
    const data = await db.select().from(table);
    return data;
  } catch (error) {
    console.error(`[Backup] Erro ao exportar tabela ${tableName}:`, error);
    return [];
  }
}

function getBackupBucketPath(): string {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
  if (!privateDir) {
    throw new Error('PRIVATE_OBJECT_DIR not configured for backups');
  }
  const parts = privateDir.split('/').filter(p => p);
  return parts[0] || '';
}

export async function performBackup(): Promise<BackupResult> {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  console.log(`[Backup] Iniciando backup do sistema - ${timestamp}`);
  
  try {
    const tables: { [key: string]: number } = {};
    const backupData: { [key: string]: any[] } = {};
    
    const tablesToBackup = [
      { name: 'users', table: users },
      { name: 'empreendimentos', table: empreendimentos },
      { name: 'licencasAmbientais', table: licencasAmbientais },
      { name: 'condicionantes', table: condicionantes },
      { name: 'demandas', table: demandas },
      { name: 'contratos', table: contratos },
      { name: 'financeiroLancamentos', table: financeiroLancamentos },
      { name: 'rhRegistros', table: rhRegistros },
      { name: 'veiculos', table: veiculos },
      { name: 'equipamentos', table: equipamentos },
      { name: 'projetos', table: projetos },
      { name: 'campanhas', table: campanhas },
      { name: 'propostasComerciais', table: propostasComerciais },
      { name: 'amostras', table: amostras },
      { name: 'fornecedores', table: fornecedores },
      { name: 'treinamentos', table: treinamentos },
      { name: 'baseConhecimento', table: baseConhecimento },
      { name: 'tarefas', table: tarefas },
      { name: 'datasetPastas', table: datasetPastas },
      { name: 'datasets', table: datasets },
    ];
    
    for (const { name, table } of tablesToBackup) {
      const data = await exportTableData(name, table);
      backupData[name] = data;
      tables[name] = data.length;
      console.log(`[Backup] ${name}: ${data.length} registros`);
    }
    
    const backupJson = JSON.stringify({
      timestamp,
      generatedAt: new Date().toISOString(),
      version: '1.0',
      tables: backupData,
    }, null, 2);
    
    const bucketName = getBackupBucketPath();
    const fileName = `backups/backup_${timestamp}.json`;
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(fileName);
    
    await file.save(backupJson, {
      contentType: 'application/json',
      metadata: {
        timestamp,
        type: 'database_backup',
      },
    });
    
    const filePath = `/${bucketName}/${fileName}`;
    console.log(`[Backup] Backup salvo com sucesso: ${filePath}`);
    
    await cleanupOldBackups(bucketName);
    
    try {
      const dropboxFileName = `backup_${timestamp}.json`;
      const dropboxResult = await uploadToDropbox(dropboxFileName, backupJson);
      if (dropboxResult.success) {
        console.log(`[Backup] Sincronizado com Dropbox: ${dropboxResult.path}`);
        await deleteOldDropboxBackups(30);
      } else {
        console.warn(`[Backup] Dropbox não disponível (normal se não conectado): ${dropboxResult.error}`);
      }
    } catch (dropboxError) {
      console.warn('[Backup] Dropbox sync ignorado (não conectado):', dropboxError instanceof Error ? dropboxError.message : dropboxError);
    }
    
    return {
      success: true,
      timestamp,
      tables,
      filePath,
    };
  } catch (error) {
    console.error('[Backup] Erro durante backup:', error);
    return {
      success: false,
      timestamp,
      tables: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function cleanupOldBackups(bucketName: string) {
  try {
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: 'backups/' });
    
    if (files.length <= 30) {
      return;
    }
    
    const sortedFiles = files
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        file: f,
        name: f.name,
        metadata: f.metadata,
      }))
      .sort((a, b) => {
        const dateA = a.metadata?.timeCreated ? new Date(a.metadata.timeCreated).getTime() : 0;
        const dateB = b.metadata?.timeCreated ? new Date(b.metadata.timeCreated).getTime() : 0;
        return dateB - dateA;
      });
    
    const filesToDelete = sortedFiles.slice(30);
    
    for (const fileInfo of filesToDelete) {
      await fileInfo.file.delete();
      console.log(`[Backup] Arquivo antigo removido: ${fileInfo.name}`);
    }
    
    console.log(`[Backup] Limpeza concluída: ${filesToDelete.length} arquivos removidos`);
  } catch (error) {
    console.error('[Backup] Erro na limpeza de backups antigos:', error);
  }
}

export async function listBackups(): Promise<ObjectInfo[]> {
  try {
    const bucketName = getBackupBucketPath();
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: 'backups/' });
    
    return files
      .filter(f => f.name.endsWith('.json'))
      .map(f => ({
        key: f.name,
        lastModified: f.metadata?.timeCreated ? new Date(f.metadata.timeCreated) : null,
        size: parseInt(String(f.metadata?.size || '0'), 10),
      }))
      .sort((a, b) => (b.lastModified?.getTime() || 0) - (a.lastModified?.getTime() || 0));
  } catch (error) {
    console.error('[Backup] Erro ao listar backups:', error);
    return [];
  }
}

export async function downloadBackup(fileName: string): Promise<string | null> {
  try {
    const bucketName = getBackupBucketPath();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(`backups/${fileName}`);
    
    const [content] = await file.download();
    return content.toString('utf-8');
  } catch (error) {
    console.error('[Backup] Erro ao baixar backup:', error);
    return null;
  }
}

export async function syncFilesToDropbox(): Promise<{ success: boolean; synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!privateDir) {
      return { success: false, synced: 0, errors: ['PRIVATE_OBJECT_DIR não configurado'] };
    }

    const parts = privateDir.split('/').filter(p => p);
    const bucketName = parts[0];
    const bucket = objectStorageClient.bucket(bucketName);

    const [allFiles] = await bucket.getFiles();
    const nonBackupFiles = allFiles.filter(f => !f.name.startsWith('backups/') && !f.name.endsWith('/'));

    console.log(`[Backup] Sincronizando ${nonBackupFiles.length} arquivos com Dropbox...`);

    for (const file of nonBackupFiles) {
      try {
        const [content] = await file.download();
        const dropboxPath = `arquivos/${file.name}`;
        const result = await uploadToDropbox(dropboxPath, content);
        if (result.success) {
          synced++;
        } else {
          errors.push(`Falha ao enviar ${file.name}: ${result.error}`);
        }
      } catch (err: any) {
        errors.push(`Erro no arquivo ${file.name}: ${err.message}`);
      }
    }

    console.log(`[Backup] Sincronização de arquivos concluída: ${synced} arquivos enviados`);
    return { success: true, synced, errors };
  } catch (error: any) {
    console.error('[Backup] Erro na sincronização de arquivos:', error.message);
    return { success: false, synced, errors: [error.message] };
  }
}

export function initBackupService() {
  console.log('[Backup] Inicializando serviço de backup automático...');
  
  cron.schedule('0 0 * * *', async () => {
    console.log('[Backup] Executando backup automático diário (00:00)...');
    const result = await performBackup();
    
    if (result.success) {
      console.log(`[Backup] Backup diário concluído com sucesso: ${result.filePath}`);
    } else {
      console.error(`[Backup] Falha no backup diário: ${result.error}`);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  cron.schedule('0 2 * * 0', async () => {
    console.log('[Backup] Executando sincronização semanal de arquivos com Dropbox (domingo 02:00)...');
    try {
      // Sync Object Storage files
      const result = await syncFilesToDropbox();
      if (result.success) {
        console.log(`[Backup] Object Storage → Dropbox: ${result.synced} arquivos enviados`);
      }
    } catch (err) {
      console.warn('[Backup] Sincronização Object Storage ignorada:', err);
    }

    try {
      // Sync all uploaded files (arquivos table) using the full sync service
      const { syncAllFilesToDropbox } = await import('./dropboxSyncService');
      const fullResult = await syncAllFilesToDropbox();
      console.log(`[Backup] Arquivos DB → Dropbox: ${fullResult.synced} sincronizados, ${fullResult.errors} erros`);
    } catch (err: any) {
      console.warn('[Backup] Sync completo de arquivos ignorado:', err.message);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });
  
  console.log('[Backup] Backup automático agendado para 00:00 (horário de Brasília)');
  console.log('[Backup] Sincronização de arquivos agendada para domingos às 02:00 (horário de Brasília)');
}
