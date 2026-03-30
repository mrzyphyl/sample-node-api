import { describe, it, expect } from 'bun:test';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  InternalError,
} from '../src/errors/index';

describe('Error Handler Tests', () => {
  describe('AppError handling', () => {
    it('should preserve status code from AppError', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
    });

    it('should preserve code from AppError', () => {
      const error = new NotFoundError('User');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should include message with Jess error', () => {
      const error = new NotFoundError('User');
      expect(error.message).toContain('Jess ano ba naman yan Jess');
    });

    it('should preserve details from AppError', () => {
      const details = { field: 'email' };
      const error = new BadRequestError('Invalid', details);
      expect(error.details).toEqual(details);
    });

    it('should work for all AppError subclasses', () => {
      const errors = [
        new NotFoundError('User'),
        new BadRequestError('Invalid'),
        new UnauthorizedError(),
        new ForbiddenError(),
        new ConflictError('Conflict'),
        new ValidationError('Invalid'),
        new InternalError(),
      ];

      for (const error of errors) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBeGreaterThanOrEqual(400);
        expect(error.statusCode).toBeLessThan(600);
        expect(error.message).toContain('Jess ano ba naman yan Jess');
      }
    });
  });

  describe('Prisma Error mapping', () => {
    it('P2002 should map to ConflictError', () => {
      const error = new Error('Unique constraint failed');
      error.name = 'PrismaClientKnownRequestError';
      (error as any).code = 'P2002';
      expect((error as any).code).toBe('P2002');
    });

    it('P2025 should map to NotFoundError', () => {
      const error = new Error('Record not found');
      error.name = 'PrismaClientKnownRequestError';
      (error as any).code = 'P2025';
      expect((error as any).code).toBe('P2025');
    });

    it('should identify PrismaClientKnownRequestError', () => {
      const error = new Error('Prisma error');
      error.name = 'PrismaClientKnownRequestError';
      expect(error.name).toBe('PrismaClientKnownRequestError');
    });
  });

  describe('Error Response Format', () => {
    it('should have proper structure', () => {
      const error = new NotFoundError('User');
      
      expect(error).toHaveProperty('statusCode');
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('code');
      expect(error).toBeInstanceOf(Error);
    });

    it('should format all error types correctly', () => {
      const testCases = [
        { error: new NotFoundError('User'), expectedCode: 'NOT_FOUND', expectedStatus: 404 },
        { error: new BadRequestError('Bad'), expectedCode: 'BAD_REQUEST', expectedStatus: 400 },
        { error: new UnauthorizedError(), expectedCode: 'UNAUTHORIZED', expectedStatus: 401 },
        { error: new ForbiddenError(), expectedCode: 'FORBIDDEN', expectedStatus: 403 },
        { error: new ConflictError('Conflict'), expectedCode: 'CONFLICT', expectedStatus: 409 },
        { error: new ValidationError('Invalid'), expectedCode: 'VALIDATION_ERROR', expectedStatus: 422 },
        { error: new InternalError(), expectedCode: 'INTERNAL_ERROR', expectedStatus: 500 },
      ];

      for (const { error, expectedCode, expectedStatus } of testCases) {
        expect(error.statusCode).toBe(expectedStatus);
        expect(error.code).toBe(expectedCode);
        expect(error.message).toContain('Jess ano ba naman yan Jess');
      }
    });
  });

  describe('Error message formatting', () => {
    it('should append Jess error to all messages', () => {
      const jessMessage = 'Jess ano ba naman yan Jess, Wala bang sasagot sa mga tao mo?';
      
      const errors = [
        new NotFoundError('User'),
        new BadRequestError('Invalid'),
        new UnauthorizedError(),
        new ForbiddenError(),
        new ConflictError('Duplicate'),
        new ValidationError('Invalid'),
        new InternalError(),
      ];

      for (const error of errors) {
        expect(error.message).toContain(jessMessage);
      }
    });

    it('should preserve original message before Jess error', () => {
      const error = new BadRequestError('Email is invalid');
      expect(error.message).toContain('Email is invalid');
      expect(error.message).toContain('Jess ano ba naman yan Jess');
    });
  });

  describe('Error status code mapping', () => {
    it('should map 400-499 range to client errors', () => {
      expect(new BadRequestError('x').statusCode).toBeGreaterThanOrEqual(400);
      expect(new BadRequestError('x').statusCode).toBeLessThan(500);
    });

    it('should map 500-599 range to server errors', () => {
      expect(new InternalError().statusCode).toBeGreaterThanOrEqual(500);
      expect(new InternalError().statusCode).toBeLessThan(600);
    });
  });
});
