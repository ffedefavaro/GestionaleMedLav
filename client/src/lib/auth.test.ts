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

describe('auth.ts', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    // Reset internal state if possible, or just be aware of it
    // auth.ts has a module-level encryptionKey, we might need to set it for each test
  });

  describe('bcrypt operations', () => {
    it('should hash and verify a password', async () => {
      const password = 'test-password';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrong-password', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('AES-256 operations', () => {
    it('should encrypt and decrypt data', () => {
      const password = 'encryption-secret';
      setEncryptionKey(password);

      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const encrypted = encryptData(originalData);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptData(encrypted);
      expect(decrypted).toEqual(originalData);
    });

    it('should throw error if encryption key is not set', () => {
      // Since encryptionKey is module-level and persists between tests,
      // and we don't have a way to reset it in auth.ts, we test the logout behavior
      // which should set it back to null.
      logout();
      const data = new Uint8Array([1, 2, 3]);
      expect(() => encryptData(data)).toThrow("Encryption key not set");
      expect(() => decryptData("some-ciphertext")).toThrow("Encryption key not set");
    });
  });

  describe('session management', () => {
    it('should update last activity', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      updateLastActivity();

      expect(sessionStorage.setItem).toHaveBeenCalledWith('lastActivity', now.toString());
    });

    it('should return true for valid session', () => {
      const lastActivity = Date.now() - 5 * 60 * 1000; // 5 mins ago
      vi.mocked(sessionStorage.getItem).mockReturnValue(lastActivity.toString());

      const isValid = checkSession();
      expect(isValid).toBe(true);
    });

    it('should return false and logout for timed out session', () => {
      const lastActivity = Date.now() - 20 * 60 * 1000; // 20 mins ago (timeout is 15)
      vi.mocked(sessionStorage.getItem).mockReturnValue(lastActivity.toString());

      const isValid = checkSession();
      expect(isValid).toBe(false);
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('lastActivity');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('isLoggedIn');
    });

    it('should clear session on logout', () => {
      logout();
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('lastActivity');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('isLoggedIn');
    });
  });
});
