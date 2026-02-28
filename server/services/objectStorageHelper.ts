import { objectStorageClient } from '../replit_integrations/object_storage/objectStorage';

function getBucketName(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (bucketId) return bucketId;
  const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
  const parts = privateDir.split('/').filter(p => p);
  if (parts[0]) return parts[0];
  throw new Error('Object Storage não configurado');
}

export interface ObjectItem {
  key: string;
  size: number;
  lastModified: Date | null;
}

export async function listObjects(prefix?: string): Promise<ObjectItem[]> {
  try {
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles(prefix ? { prefix } : {});
    return files.map(f => ({
      key: f.name,
      size: parseInt(f.metadata?.size as string || '0', 10),
      lastModified: f.metadata?.timeCreated ? new Date(f.metadata.timeCreated as string) : null,
    }));
  } catch (err: any) {
    console.warn('[ObjectStorageHelper] Erro ao listar objetos:', err.message);
    return [];
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [data] = await file.download();
    return data as Buffer;
  } catch (err: any) {
    console.warn('[ObjectStorageHelper] Erro ao baixar objeto:', err.message);
    return null;
  }
}
