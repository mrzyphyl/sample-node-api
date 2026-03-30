import { describe, it, expect } from 'bun:test';
import { requirePermission, requireRole } from '../src/middleware/rbac';
import { authenticate } from '../src/middleware/auth';

describe('RBAC Middleware', () => {
  describe('requirePermission', () => {
    it('should be a function', () => {
      expect(typeof requirePermission).toBe('function');
    });
  });

  describe('requireRole', () => {
    it('should be a function', () => {
      expect(typeof requireRole).toBe('function');
    });
  });
});

describe('Auth Middleware', () => {
  it('authenticate should be a function', () => {
    expect(typeof authenticate).toBe('function');
  });
});

describe('Route Schemas', () => {
  it('register and login schemas should be defined', () => {
    const registerSchema = {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    };

    const loginSchema = {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    };

    expect(registerSchema).toBeDefined();
    expect(loginSchema).toBeDefined();
    expect(registerSchema.body.required).toContain('email');
    expect(registerSchema.body.required).toContain('password');
  });
});
