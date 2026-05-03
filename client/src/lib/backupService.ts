import { get, set, del } from 'idb-keyval';
import { decryptData } from './auth';

export interface BackupEntry {
  timestamp: number;
  key: string;
}

const BACKUP_HISTORY_KEY = 'backup_history';
const LAST_BACKUP_TIME_KEY = 'last_auto_backup';

const showNotification = (message: string, type: 'success' | 'error') => {
  const div = document.createElement('div');
  div.className = `fixed bottom-6 right-6 p-5 rounded-[24px] shadow-2xl z-[9999] animate-in fade-in slide-in-from-bottom-8 duration-500 border-2 ${
    type === 'success'
      ? 'bg-primary/95 backdrop-blur-md border-white/20 text-white'
      : 'bg-red-600/95 backdrop-blur-md border-white/20 text-white'
  }`;

  div.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
        ${type === 'success' ? '✓' : '⚠'}
      </div>
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-0.5">Sistema Backup</p>
        <p class="font-black text-sm tracking-tight">${message}</p>
      </div>
    </div>
  `;

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(20px)';
    div.style.transition = 'all 0.5s ease';
    setTimeout(() => div.remove(), 500);
  }, 6000);
};

export const runAutoBackup = async () => {
  try {
    const lastBackup = await get<number>(LAST_BACKUP_TIME_KEY);
    const now = Date.now();

    // Check if 24h passed (24 * 60 * 60 * 1000)
    if (lastBackup && now - lastBackup < 24 * 60 * 60 * 1000) {
      console.log("Backup automatico non necessario (meno di 24h passate)");
      return;
    }

    const encryptedData = await get<string>('cartsan_db_encrypted');
    if (!encryptedData) {
      console.log("Nessun database trovato per il backup automatico");
      return;
    }

    const timestamp = now;
    const backupKey = `auto_backup_${timestamp}`;

    await set(backupKey, encryptedData);

    const history: BackupEntry[] = (await get<BackupEntry[]>(BACKUP_HISTORY_KEY)) || [];
    history.unshift({ timestamp, key: backupKey });

    // Maintain 7 backups
    if (history.length > 7) {
      const toRemove = history.splice(7);
      for (const entry of toRemove) {
        await del(entry.key);
      }
    }

    await set(BACKUP_HISTORY_KEY, history);
    await set(LAST_BACKUP_TIME_KEY, now);

    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    showNotification(`Backup eseguito alle ${timeStr}`, 'success');
  } catch (error) {
    console.error('Backup automatico fallito:', error);
    showNotification('Errore durante il backup automatico', 'error');
  }
};

export const getBackupHistory = async (): Promise<BackupEntry[]> => {
  return (await get<BackupEntry[]>(BACKUP_HISTORY_KEY)) || [];
};

export const downloadBackup = async (entry: BackupEntry) => {
  try {
    const encryptedData = await get<string>(entry.key);
    if (!encryptedData) throw new Error("File di backup non trovato");

    const decryptedData = decryptData(encryptedData);
    const blob = new Blob([decryptedData.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartsan_auto_backup_${new Date(entry.timestamp).toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download backup fallito:', error);
    alert('Errore durante il download del backup. Assicurati di essere correttamente autenticato.');
  }
};

// Esegui backup automatico all'importazione del modulo
runAutoBackup();
