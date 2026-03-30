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
  ERROR_MESSAGES 
} from '../src/errors/index';
import { hashPassword, verifyPassword, generateTokens } from '../src/utils/helpers';
import { Result } from '../src/middleware/service-wrapper';

describe('Error Classes', () => {
  it('AppError should have correct properties', () => {
    const error = new AppError(400, 'Test error', 'TEST_CODE', { field: 'test' });
    
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ field: 'test' });
    expect(error.name).toBe('AppError');
  });

  it('NotFoundError should return 404 with Jess message', () => {
    const error = new NotFoundError('User');
    
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('User not found');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('BadRequestError should return 400 with Jess message', () => {
    const error = new BadRequestError('Invalid input');
    
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toContain('Invalid input');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('UnauthorizedError should return 401 with Jess message', () => {
    const error = new UnauthorizedError();
    
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('ForbiddenError should return 403 with Jess message', () => {
    const error = new ForbiddenError();
    
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('ConflictError should return 409 with Jess message', () => {
    const error = new ConflictError('Email already exists');
    
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toContain('Email already exists');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('ValidationError should return 422 with Jess message', () => {
    const error = new ValidationError('Invalid email format', { field: 'email' });
    
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('InternalError should return 500 with Jess message', () => {
    const error = new InternalError();
    
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('ServiceUnavailableError should return 503 with Jess message', () => {
    const error = new ServiceUnavailableError();
    
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
    expect(error.message).toContain(ERROR_MESSAGES.JESS_ERROR);
  });

  it('all errors should contain Jess error message', () => {
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

describe('Service Wrapper - Result Pattern', () => {
  it('Result.ok should create successful result', () => {
    const result = Result.ok({ data: 'test' });
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ data: 'test' });
    expect(result.error).toBeUndefined();
    expect(result.isOk()).toBe(true);
    expect(result.isFail()).toBe(false);
  });

  it('Result.fail should create failed result', () => {
    const error = new NotFoundError('User');
    const result = Result.fail<{ data: string }>(error);
    
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.isOk()).toBe(false);
    expect(result.isFail()).toBe(true);
  });

  it('Result.unwrap should return data for ok result', () => {
    const result = Result.ok({ id: 1 });
    expect(result.unwrap()).toEqual({ id: 1 });
  });

  it('Result.unwrap should throw for failed result', () => {
    const result = Result.fail(new NotFoundError('User'));
    expect(() => result.unwrap()).toThrow();
  });

  it('Result.unwrapOr should return default for failed result', () => {
    const result = Result.fail(new NotFoundError('User'));
    expect(result.unwrapOr({ default: true })).toEqual({ default: true });
  });

  it('Result.map should transform ok result', () => {
    const result = Result.ok(5);
    const mapped = result.map((n) => n * 2);
    
    expect(mapped.isOk()).toBe(true);
    expect(mapped.unwrap()).toBe(10);
  });

  it('Result.match should call correct callback', () => {
    const okResult = Result.ok(10);
    const failResult = Result.fail(new NotFoundError('User'));

    const okValue = okResult.match((n) => n * 2, () => 0);
    const failValue = failResult.match((n) => n * 2, () => 0);

    expect(okValue).toBe(20);
    expect(failValue).toBe(0);
  });
});

describe('Helpers', () => {
  it('hashPassword should return hashed password', async () => {
    const hash = await hashPassword('password123');
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe('password123');
    expect(hash).toContain('.');
  });

  it('verifyPassword should correctly verify password', async () => {
    const hash = await hashPassword('password123');
    
    const isValid = await verifyPassword('password123', hash);
    const isInvalid = await verifyPassword('wrongpassword', hash);
    
    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });

  it('generateTokens should return access and refresh tokens', () => {
    const mockFastify = {
      jwt: {
        sign: (payload: any) => `mock-token-${payload.sub}`,
      },
    } as any;

    const tokens = generateTokens('user-123', mockFastify);
    
    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(typeof tokens.refreshToken).toBe('string');
    expect(tokens.refreshToken.length).toBe(128);
  });
});
