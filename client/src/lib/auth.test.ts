import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  setEncryptionKey,
  encryptData,
  decryptData,
  updateLastActivity,
  checkSession,
  logout
} from './auth';

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

describe('Auth Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    logout();
  });

  describe('Password Hashing', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'mySecretPassword';
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('AES-256 Encryption', () => {
    it('should encrypt and decrypt Uint8Array data correctly', () => {
      const password = 'encryptionKey123';
      setEncryptionKey(password);

      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = encryptData(originalData);
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = decryptData(encrypted);
      expect(decrypted).toEqual(originalData);
    });

    it('should throw error if encryption key is not set', () => {
      const data = new Uint8Array([1, 2, 3]);
      expect(() => encryptData(data)).toThrow('Encryption key not set');
      expect(() => decryptData('someCiphertext')).toThrow('Encryption key not set');
    });
  });

  describe('Session Management', () => {
    it('should update last activity and check session', () => {
      updateLastActivity();
      expect(sessionStorage.getItem('lastActivity')).toBeDefined();
      expect(checkSession()).toBe(true);
    });

    it('should return false and logout if session is timed out', () => {
      const ancientDate = Date.now() - (20 * 60 * 1000); // 20 minutes ago
      sessionStorage.setItem('lastActivity', ancientDate.toString());

      expect(checkSession()).toBe(false);
      expect(sessionStorage.getItem('lastActivity')).toBeNull();
    });

    it('should return false if no last activity is set', () => {
      expect(checkSession()).toBe(false);
    });

    it('should clear session on logout', () => {
      updateLastActivity();
      sessionStorage.setItem('isLoggedIn', 'true');

      logout();
      expect(sessionStorage.getItem('lastActivity')).toBeNull();
      expect(sessionStorage.getItem('isLoggedIn')).toBeNull();
    });
  });
});
