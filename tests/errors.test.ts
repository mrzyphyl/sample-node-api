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
  ServiceUnavailableError,
  ERROR_MESSAGES,
} from '../src/errors/index';

describe('Error Classes', () => {
  const JESS_ERROR = ERROR_MESSAGES.JESS_ERROR;

  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError(400, 'Test error', 'TEST_CODE', { field: 'test' });

      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ field: 'test' });
      expect(error.name).toBe('AppError');
      expect(error instanceof Error).toBe(true);
    });

    it('should work without optional parameters', () => {
      const error = new AppError(500, 'Server error');

      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Server error');
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe('NotFoundError', () => {
    it('should return 404 status code', () => {
      const error = new NotFoundError('User');
      expect(error.statusCode).toBe(404);
    });

    it('should include resource name in message', () => {
      const error = new NotFoundError('User');
      expect(error.message).toContain('User not found');
    });

    it('should have NOT_FOUND code', () => {
      const error = new NotFoundError('User');
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should include Jess error message', () => {
      const error = new NotFoundError('File');
      expect(error.message).toContain(JESS_ERROR);
    });

    it('should work with different resources', () => {
      const resources = ['User', 'File', 'Folder', 'Role', 'Permission'];
      for (const resource of resources) {
        const error = new NotFoundError(resource);
        expect(error.statusCode).toBe(404);
        expect(error.message).toContain(`${resource} not found`);
      }
    });
  });

  describe('BadRequestError', () => {
    it('should return 400 status code', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.statusCode).toBe(400);
    });

    it('should include custom message', () => {
      const error = new BadRequestError('Invalid email format');
      expect(error.message).toContain('Invalid email format');
    });

    it('should have BAD_REQUEST code', () => {
      const error = new BadRequestError('Invalid');
      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should include Jess error message', () => {
      const error = new BadRequestError('Invalid data');
      expect(error.message).toContain(JESS_ERROR);
    });

    it('should accept details parameter', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new BadRequestError('Invalid', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('UnauthorizedError', () => {
    it('should return 401 status code', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
    });

    it('should have default message with Jess error', () => {
      const error = new UnauthorizedError();
      expect(error.message).toContain('Authentication required');
      expect(error.message).toContain(JESS_ERROR);
    });

    it('should accept custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toContain('Token expired');
    });

    it('should have UNAUTHORIZED code', () => {
      const error = new UnauthorizedError();
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should return 403 status code', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
    });

    it('should have default message with Jess error', () => {
      const error = new ForbiddenError();
      expect(error.message).toContain('Access denied');
      expect(error.message).toContain(JESS_ERROR);
    });

    it('should accept custom message', () => {
      const error = new ForbiddenError('Insufficient permissions');
      expect(error.message).toContain('Insufficient permissions');
    });

    it('should have FORBIDDEN code', () => {
      const error = new ForbiddenError();
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('ConflictError', () => {
    it('should return 409 status code', () => {
      const error = new ConflictError('Email already exists');
      expect(error.statusCode).toBe(409);
    });

    it('should include custom message', () => {
      const error = new ConflictError('Email already exists');
      expect(error.message).toContain('Email already exists');
    });

    it('should have CONFLICT code', () => {
      const error = new ConflictError('Duplicate entry');
      expect(error.code).toBe('CONFLICT');
    });

    it('should include Jess error message', () => {
      const error = new ConflictError('Resource conflict');
      expect(error.message).toContain(JESS_ERROR);
    });
  });

  describe('ValidationError', () => {
    it('should return 422 status code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(422);
    });

    it('should include custom message', () => {
      const error = new ValidationError('Email format invalid');
      expect(error.message).toContain('Email format invalid');
    });

    it('should have VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should include Jess error message', () => {
      const error = new ValidationError('Validation failed');
      expect(error.message).toContain(JESS_ERROR);
    });

    it('should accept details parameter', () => {
      const details = { field: 'password', constraints: { minLength: 6 } };
      const error = new ValidationError('Invalid password', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('InternalError', () => {
    it('should return 500 status code', () => {
      const error = new InternalError();
      expect(error.statusCode).toBe(500);
    });

    it('should have default message', () => {
      const error = new InternalError();
      expect(error.message).toContain('Internal server error');
    });

    it('should accept custom message', () => {
      const error = new InternalError('Database connection failed');
      expect(error.message).toContain('Database connection failed');
    });

    it('should have INTERNAL_ERROR code', () => {
      const error = new InternalError();
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should include Jess error message', () => {
      const error = new InternalError();
      expect(error.message).toContain(JESS_ERROR);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should return 503 status code', () => {
      const error = new ServiceUnavailableError();
      expect(error.statusCode).toBe(503);
    });

    it('should have default message', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toContain('Service temporarily unavailable');
    });

    it('should accept custom message', () => {
      const error = new ServiceUnavailableError('Database maintenance');
      expect(error.message).toContain('Database maintenance');
    });

    it('should have SERVICE_UNAVAILABLE code', () => {
      const error = new ServiceUnavailableError();
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should include Jess error message', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toContain(JESS_ERROR);
    });
  });

  describe('ERROR_MESSAGES constant', () => {
    it('should export JESS_ERROR constant', () => {
      expect(ERROR_MESSAGES).toBeDefined();
      expect(ERROR_MESSAGES.JESS_ERROR).toBeDefined();
    });

    it('should have correct Jess error message', () => {
      expect(ERROR_MESSAGES.JESS_ERROR).toBe('Jess ano ba naman yan Jess, Wala bang sasagot sa mga tao mo?');
    });
  });

  describe('All errors contain Jess message', () => {
    it('every error class should include Jess error message', () => {
      const errors = [
        new NotFoundError('User'),
        new BadRequestError('Invalid'),
        new UnauthorizedError(),
        new ForbiddenError(),
        new ConflictError('Conflict'),
        new ValidationError('Invalid'),
        new InternalError(),
        new ServiceUnavailableError(),
      ];

      for (const error of errors) {
        expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
      }
    });
  });
});
