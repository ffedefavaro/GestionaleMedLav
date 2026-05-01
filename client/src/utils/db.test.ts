import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveEncryptedDB, loadEncryptedDB } from './db';
import { get, set } from 'idb-keyval';

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

describe('Database Encryption Utils', () => {
  const password = 'test-password';
  const mockDbData = new Uint8Array([1, 2, 3, 4, 5]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save encrypted data to idb-keyval', async () => {
    await saveEncryptedDB(mockDbData, password);
    expect(vi.mocked(set)).toHaveBeenCalledWith('cartsan_db_encrypted', expect.any(String));
  });

  it('should load and decrypt data from idb-keyval', async () => {
    // First save to get the encrypted string
    let savedEncrypted: string = '';
    vi.mocked(set).mockImplementation(async (_key, value) => {
      savedEncrypted = value as string;
    });

    await saveEncryptedDB(mockDbData, password);

    vi.mocked(get).mockResolvedValue(savedEncrypted);

    const loadedData = await loadEncryptedDB(password);
    expect(loadedData).toEqual(mockDbData);
  });

  it('should return null if data is not found in idb-keyval', async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    const result = await loadEncryptedDB(password);
    expect(result).toBeNull();
  });

  it('should return null if decryption fails', async () => {
     // Save with one password
    let savedEncrypted: string = '';
    vi.mocked(set).mockImplementation(async (_key, value) => {
      savedEncrypted = value as string;
    });
    await saveEncryptedDB(mockDbData, password);

    vi.mocked(get).mockResolvedValue(savedEncrypted);

    // Try to load with another password
    const result = await loadEncryptedDB('wrong-password');
    expect(result).toBeNull();
  });
});
