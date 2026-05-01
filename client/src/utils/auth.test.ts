import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, hashPassword, verifyPassword } from './auth';

describe('Cryptography Utils', () => {
  const secret = 'super-secret-password';
  const rawText = 'Hello World! 123';

  describe('AES-256 Encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const encrypted = encryptData(rawText, secret);
      expect(encrypted).not.toBe(rawText);

      const decrypted = decryptData(encrypted, secret);
      expect(decrypted).toBe(rawText);
    });

    it('should return empty string if decryption fails with wrong key', () => {
      const encrypted = encryptData(rawText, secret);
      const decrypted = decryptData(encrypted, 'wrong-password');
      expect(decrypted).toBe('');
    });
  });

  describe('Bcrypt Hashing', () => {
    it('should hash and verify password correctly', async () => {
      const password = 'my-password';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrong-password', hash);
      expect(isInvalid).toBe(false);
    });
  });
});
