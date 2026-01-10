import cron from 'node-cron';
import { db } from '../db';
import { 
  users, empreendimentos, licencasAmbientais, condicionantes, demandas, 
  contratos, financeiroLancamentos, rhRegistros, veiculos, equipamentos,
  projetos, campanhas, propostasComerciais, amostras, fornecedores,
  treinamentos, baseConhecimento, tarefas, datasetPastas, datasets
} from '@shared/schema';
import { objectStorageClient } from '../replit_integrations/object_storage/objectStorage';
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
  
  console.log('[Backup] Backup automático agendado para 00:00 (horário de Brasília)');
}
