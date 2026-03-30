import { describe, it, expect } from 'bun:test';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyToken,
} from '../src/utils/helpers';

describe('Helpers', () => {
  describe('hashPassword', () => {
    it('should return a hashed password', async () => {
      const hash = await hashPassword('password123');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should return different hash for same password (salt)', async () => {
      const hash1 = await hashPassword('password123');
      const hash2 = await hashPassword('password123');

      expect(hash1).not.toBe(hash2);
    });

    it('should include salt in hash', () => {
      return hashPassword('password123').then((hash) => {
        expect(hash).toContain('.');
        const parts = hash.split('.');
        expect(parts.length).toBe(2);
        expect(parts[0].length).toBeGreaterThan(0);
        expect(parts[1].length).toBeGreaterThan(0);
      });
    });

    it('should return different hashes for different passwords', async () => {
      const hash1 = await hashPassword('password1');
      const hash2 = await hashPassword('password2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle long password', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await hashPassword(longPassword);
      expect(hash).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const hash = await hashPassword('密码测试123');
      expect(hash).toBeDefined();
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const hash = await hashPassword('password123');
      const isValid = await verifyPassword('password123', hash);

      expect(isValid).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const hash = await hashPassword('password123');
      const isValid = await verifyPassword('wrongpassword', hash);

      expect(isValid).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hash = await hashPassword('password123');
      const isValid = await verifyPassword('', hash);

      expect(isValid).toBe(false);
    });

    it('should return false for invalid hash format', async () => {
      const isValid = await verifyPassword('password', 'invalid-hash');
      expect(isValid).toBe(false);
    });

    it('should work with unicode passwords', async () => {
      const password = '密码测试123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should return false for case-sensitive mismatches', async () => {
      const hash = await hashPassword('Password123');
      const isValid = await verifyPassword('password123', hash);

      expect(isValid).toBe(false);
    });

    it('should handle special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });
  });

  describe('generateTokens', () => {
    it('should return access and refresh tokens', () => {
      const mockFastify = {
        jwt: {
          sign: (payload: any) => `mock-token-${payload.sub}-${payload.type}`,
        },
      } as any;

      const tokens = generateTokens('user-123', mockFastify);

      expect(tokens).toBeDefined();
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('should return string tokens', () => {
      const mockFastify = {
        jwt: {
          sign: (payload: any) => `mock-token-${payload.sub}`,
        },
      } as any;

      const tokens = generateTokens('user-123', mockFastify);

      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should include userId in accessToken', () => {
      const mockFastify = {
        jwt: {
          sign: (payload: any) => `mock-token-${payload.sub}`,
        },
      } as any;

      const tokens = generateTokens('user-456', mockFastify);

      expect(tokens.accessToken).toContain('user-456');
    });

    it('should generate 64-character refresh token', () => {
      const mockFastify = {
        jwt: {
          sign: (payload: any) => `mock-token-${payload.sub}`,
        },
      } as any;

      const tokens = generateTokens('user-123', mockFastify);

      expect(tokens.refreshToken.length).toBe(128);
    });

    it('should generate different refresh tokens each time', () => {
      const mockFastify = {
        jwt: {
          sign: (payload: any) => `mock-token-${payload.sub}`,
        },
      } as any;

      const tokens1 = generateTokens('user-123', mockFastify);
      const tokens2 = generateTokens('user-123', mockFastify);

      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('should return decoded payload for valid token', () => {
      const mockFastify = {
        jwt: {
          verify: (token: string) => ({ sub: 'user-123', exp: Date.now() + 3600 }),
        },
      } as any;

      const result = verifyToken('valid-token', mockFastify);

      expect(result).toBeDefined();
      expect(result).toEqual({ sub: 'user-123', exp: expect.any(Number) });
    });

    it('should return null for invalid token', () => {
      const mockFastify = {
        jwt: {
          verify: () => {
            throw new Error('Invalid token');
          },
        },
      } as any;

      const result = verifyToken('invalid-token', mockFastify);

      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      const mockFastify = {
        jwt: {
          verify: () => {
            throw new Error('Token expired');
          },
        },
      } as any;

      const result = verifyToken('expired-token', mockFastify);

      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      const mockFastify = {
        jwt: {
          verify: () => {
            throw new Error('Malformed token');
          },
        },
      } as any;

      const result = verifyToken('malformed-token', mockFastify);

      expect(result).toBeNull();
    });
  });
});
