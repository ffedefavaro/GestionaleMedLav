import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';
import { get, set } from 'idb-keyval';

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
let encryptionKey: string | null = null;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hashSync(password, 10);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compareSync(password, hash);
};

export const setEncryptionKey = (password: string) => {
  encryptionKey = CryptoJS.SHA256(password).toString();
};

export const encryptData = (data: Uint8Array): string => {
  if (!encryptionKey) throw new Error("Encryption key not set");
  // Convert Uint8Array to WordArray for CryptoJS
  const wordArray = CryptoJS.lib.WordArray.create(data);
  return CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
};

export const decryptData = (ciphertext: string): Uint8Array => {
  if (!encryptionKey) throw new Error("Encryption key not set");
  const decrypted = CryptoJS.AES.decrypt(ciphertext, encryptionKey);

  // Convert WordArray back to Uint8Array
  const typedArray = new Uint8Array(decrypted.sigBytes);
  for (let i = 0; i < decrypted.sigBytes; i++) {
    typedArray[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return typedArray;
};

export const saveEncryptedDB = async (data: Uint8Array) => {
  const encrypted = encryptData(data);
  await set('cartsan_db_encrypted', encrypted);
};

export const loadEncryptedDB = async (): Promise<Uint8Array | null> => {
  const encrypted = await get('cartsan_db_encrypted');
  if (!encrypted) return null;
  return decryptData(encrypted);
};

export const updateLastActivity = () => {
  sessionStorage.setItem('lastActivity', Date.now().toString());
};

export const checkSession = (): boolean => {
  const lastActivity = sessionStorage.getItem('lastActivity');
  if (!lastActivity) return false;
  const isTimedOut = Date.now() - parseInt(lastActivity) > SESSION_TIMEOUT;
  if (isTimedOut) {
    logout();
    return false;
  }
  return true;
};

export const logout = () => {
  encryptionKey = null;
  sessionStorage.removeItem('lastActivity');
  sessionStorage.removeItem('isLoggedIn');
};
