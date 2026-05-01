import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Encrypts a string using AES-256.
 * @param text - The text to encrypt.
 * @param secretKey - The master password/key.
 * @returns The encrypted string in Base64.
 */
export const encryptData = (text: string, secretKey: string): string => {
  return CryptoJS.AES.encrypt(text, secretKey).toString();
};

/**
 * Encrypts binary data (provided as a Latin1 string) using AES-256.
 * @param data - The data string (Latin1) to encrypt.
 * @param secretKey - The master password/key.
 * @returns The encrypted string in Base64.
 */
export const encryptBinary = (data: string, secretKey: string): string => {
  const cipher = CryptoJS.AES.encrypt(CryptoJS.enc.Latin1.parse(data), secretKey);
  return cipher.toString();
};

/**
 * Decrypts an AES-256 encrypted string to a UTF-8 string.
 * @param ciphertext - The encrypted string (Base64).
 * @param secretKey - The master password/key.
 * @returns The decrypted text.
 */
export const decryptData = (ciphertext: string, secretKey: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};

/**
 * Decrypts an AES-256 encrypted string to a Latin1 string (for binary data).
 * @param ciphertext - The encrypted string (Base64).
 * @param secretKey - The master password/key.
 * @returns The decrypted data string.
 */
export const decryptBinary = (ciphertext: string, secretKey: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    return bytes.toString(CryptoJS.enc.Latin1);
  } catch (e) {
    return '';
  }
};

/**
 * Hashes a password using bcrypt.
 * @param password - The password to hash.
 * @returns The hashed password.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verifies a password against a bcrypt hash.
 * @param password - The password to verify.
 * @param hash - The stored hash.
 * @returns True if the password matches.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};
