import { get, set, del } from 'idb-keyval';
import { saveAs } from 'file-saver';
import { getDB } from './db';

export interface BackupMetadata {
  id: string;
  timestamp: string;
  size: number;
}

const BACKUP_HISTORY_KEY = 'cartsan_backup_history';
const LAST_BACKUP_TIME_KEY = 'cartsan_last_backup_time';

export const getBackupHistory = async (): Promise<BackupMetadata[]> => {
  return (await get<BackupMetadata[]>(BACKUP_HISTORY_KEY)) || [];
};

export const performBackup = async (): Promise<BackupMetadata> => {
  const db = getDB();
  if (!db) throw new Error("Database non inizializzato");

  const data = db.export();
  const timestamp = new Date().toISOString();
  const id = `backup_${timestamp.replace(/[:.]/g, '-')}`;

  const metadata: BackupMetadata = {
    id,
    timestamp,
    size: data.length
  };

  // Save the binary data
  await set(`cartsan_data_${id}`, data);

  // Update history and rotate (keep last 7)
  const history = await getBackupHistory();
  const newHistory = [metadata, ...history].slice(0, 7);

  // Cleanup old backups from IndexedDB
  if (history.length >= 7) {
    const newIds = new Set(newHistory.map(m => m.id));
    for (const old of history) {
      if (!newIds.has(old.id)) {
        await del(`cartsan_data_${old.id}`);
      }
    }
  }

  await set(BACKUP_HISTORY_KEY, newHistory);
  localStorage.setItem(LAST_BACKUP_TIME_KEY, timestamp);

  return metadata;
};

export const runAutomaticBackup = async (): Promise<BackupMetadata | null> => {
  const lastBackup = localStorage.getItem(LAST_BACKUP_TIME_KEY);
  const now = new Date();

  if (lastBackup) {
    const lastDate = new Date(lastBackup);
    const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) return null;
  }

  return await performBackup();
};

export const downloadBackup = async (id: string) => {
  const data = await get<Uint8Array>(`cartsan_data_${id}`);
  if (!data) throw new Error("Dati backup non trovati");

  // Use any cast to satisfy BlobPart type constraints in this environment
  const blob = new Blob([data as any], { type: 'application/x-sqlite3' });
  saveAs(blob, `${id}.sqlite`);
};
