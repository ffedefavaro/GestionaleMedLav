import { get, set } from 'idb-keyval';
import { encryptBinary, decryptBinary } from './auth';

const DB_KEY = 'cartsan_db_encrypted';

/**
 * Saves the database to IndexedDB with encryption.
 * @param dbData - The raw database Uint8Array.
 * @param password - The master password.
 */
export const saveEncryptedDB = async (dbData: Uint8Array, password: string): Promise<void> => {
  // Convert Uint8Array to string (Latin1) to encrypt
  const binaryString = Array.from(dbData, (byte) => String.fromCharCode(byte)).join('');
  const encrypted = encryptBinary(binaryString, password);
  await set(DB_KEY, encrypted);
};

/**
 * Loads the database from IndexedDB and decrypts it.
 * @param password - The master password.
 * @returns The decrypted Uint8Array or null if not found.
 */
export const loadEncryptedDB = async (password: string): Promise<Uint8Array | null> => {
  const encrypted = await get<string>(DB_KEY);
  if (!encrypted) return null;

  try {
    const decryptedString = decryptBinary(encrypted, password);
    if (!decryptedString) return null;

    const uint8Array = new Uint8Array(decryptedString.length);
    for (let i = 0; i < decryptedString.length; i++) {
      uint8Array[i] = decryptedString.charCodeAt(i);
    }
    return uint8Array;
  } catch (e) {
    console.error("Decryption failed:", e);
    return null;
  }
};
