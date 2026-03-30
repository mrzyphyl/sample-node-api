import { describe, it, expect } from 'bun:test';
import { requirePermission, requireRole } from '../src/middleware/rbac';
import { ForbiddenError } from '../src/errors/index';
import { Permission, Role } from '../src/enums/index';

describe('RBAC Middleware', () => {
  describe('requirePermission', () => {
    it('should be a function', () => {
      expect(typeof requirePermission).toBe('function');
    });

    it('should return a middleware function', () => {
      const middleware = requirePermission(Permission.FILE_READ);
      expect(typeof middleware).toBe('function');
    });

    it('should throw ForbiddenError when user is undefined', async () => {
      const middleware = requirePermission(Permission.FILE_READ);
      const request = { user: undefined } as any;
      
      try {
        await middleware(request, {});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
      }
    });

    it('should throw ForbiddenError when role is undefined', async () => {
      const middleware = requirePermission(Permission.FILE_READ);
      const request = { user: { id: '123' } } as any;
      
      try {
        await middleware(request, {});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
      }
    });

    it('should throw ForbiddenError for missing permission', async () => {
      const middleware = requirePermission(Permission.USER_MANAGE);
      const request = { user: { id: '123', role: Role.USER } } as any;
      
      try {
        await middleware(request, {});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
      }
    });
  });

  describe('requireRole', () => {
    it('should be a function', () => {
      expect(typeof requireRole).toBe('function');
    });

    it('should return a middleware function', () => {
      const middleware = requireRole(Role.ADMIN);
      expect(typeof middleware).toBe('function');
    });

    it('should throw ForbiddenError when user is undefined', async () => {
      const middleware = requireRole(Role.ADMIN);
      const request = { user: undefined } as any;
      
      try {
        await middleware(request, {});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
      }
    });

    it('should throw ForbiddenError for non-matching role', async () => {
      const middleware = requireRole(Role.ADMIN);
      const request = { user: { id: '123', role: Role.USER } } as any;
      
      try {
        await middleware(request, {});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
      }
    });
  });
});
