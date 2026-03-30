import { describe, it, expect, beforeEach } from 'bun:test';
import {
  withErrorHandling,
  Result,
  tryCatch,
  catchResult,
  createService,
} from '../src/middleware/service-wrapper';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  InternalError,
} from '../src/errors/index';

describe('Service Wrapper - withErrorHandling', () => {
  it('should pass through successful results', async () => {
    const result = await withErrorHandling(async () => {
      return { success: true, data: 'test' };
    });

    expect(result).toEqual({ success: true, data: 'test' });
  });

  it('should throw AppError as-is', async () => {
    await expect(
      withErrorHandling(async () => {
        throw new NotFoundError('User');
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should preserve AppError properties', async () => {
    try {
      await withErrorHandling(async () => {
        throw new BadRequestError('Invalid input');
      });
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).statusCode).toBe(400);
      expect((error as BadRequestError).code).toBe('BAD_REQUEST');
    }
  });

  it('should wrap Prisma P2002 as ConflictError', async () => {
    const prismaError = new Error('Unique constraint failed');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as any).code = 'P2002';

    await expect(
      withErrorHandling(async () => {
        throw prismaError;
      })
    ).rejects.toThrow('already exists');
  });

  it('should wrap Prisma P2025 as NotFoundError', async () => {
    const prismaError = new Error('Record not found');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as any).code = 'P2025';

    await expect(
      withErrorHandling(async () => {
        throw prismaError;
      })
    ).rejects.toThrow('not found');
  });

  it('should wrap Prisma P2003 as BadRequestError', async () => {
    const prismaError = new Error('Foreign key constraint failed');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as any).code = 'P2003';

    await expect(
      withErrorHandling(async () => {
        throw prismaError;
      })
    ).rejects.toThrow('Foreign key constraint failed');
  });

  it('should wrap generic ValidationError as BadRequestError', async () => {
    const validationError = new Error('Validation failed');
    validationError.name = 'ValidationError';

    await expect(
      withErrorHandling(async () => {
        throw validationError;
      })
    ).rejects.toThrow('Validation failed');
  });

  it('should use fallback error when provided', async () => {
    const fallback = new BadRequestError('Fallback error');

    await expect(
      withErrorHandling(async () => {
        throw new Error('Unknown error');
      }, fallback)
    ).rejects.toThrow('Fallback error');
  });

  it('should throw InternalError for unknown errors without fallback', async () => {
    await expect(
      withErrorHandling(async () => {
        throw new Error('Unknown error');
      })
    ).rejects.toThrow();
  });
});

describe('Result Pattern', () => {
  describe('Result.ok', () => {
    it('should create successful result with data', () => {
      const result = Result.ok({ id: 1, name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Test' });
      expect(result.error).toBeUndefined();
    });

    it('should work with primitive values', () => {
      const result = Result.ok(42);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should work with arrays', () => {
      const result = Result.ok([1, 2, 3]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('should work with null', () => {
      const result = Result.ok(null);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('Result.fail', () => {
    it('should create failed result with error', () => {
      const error = new NotFoundError('User');
      const result = Result.fail<{ id: number }>(error);

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBe(error);
    });

    it('should work with different error types', () => {
      const errors = [
        new NotFoundError('User'),
        new BadRequestError('Invalid'),
        new InternalError(),
      ];

      for (const error of errors) {
        const result = Result.fail(error);
        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
      }
    });
  });

  describe('isOk / isFail', () => {
    it('should return correct boolean values for ok result', () => {
      const result = Result.ok({ data: 'test' });
      expect(result.isOk()).toBe(true);
      expect(result.isFail()).toBe(false);
    });

    it('should return correct boolean values for failed result', () => {
      const result = Result.fail(new NotFoundError('User'));
      expect(result.isOk()).toBe(false);
      expect(result.isFail()).toBe(true);
    });
  });

  describe('unwrap', () => {
    it('should return data for ok result', () => {
      const result = Result.ok({ id: 1 });
      expect(result.unwrap()).toEqual({ id: 1 });
    });

    it('should throw for failed result', () => {
      const result = Result.fail(new NotFoundError('User'));
      expect(() => result.unwrap()).toThrow();
    });

    it('should throw error with proper message', () => {
      const result = Result.fail(new NotFoundError('User'));
      expect(() => result.unwrap()).toThrow('User not found');
    });
  });

  describe('unwrapOr', () => {
    it('should return data for ok result', () => {
      const result = Result.ok({ id: 1 });
      expect(result.unwrapOr({ default: true })).toEqual({ id: 1 });
    });

    it('should return default value for failed result', () => {
      const result = Result.fail(new NotFoundError('User'));
      expect(result.unwrapOr({ default: true })).toEqual({ default: true });
    });
  });

  describe('map', () => {
    it('should transform data for ok result', () => {
      const result = Result.ok(5);
      const mapped = result.map((n) => n * 2);

      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(10);
    });

    it('should return same error for failed result', () => {
      const error = new NotFoundError('User');
      const result = Result.fail<number>(error);
      const mapped = result.map((n) => n * 2);

      expect(mapped.isFail()).toBe(true);
      expect(mapped.error).toBe(error);
    });

    it('should work with string transformation', () => {
      const result = Result.ok('hello');
      const mapped = result.map((s) => s.toUpperCase());
      expect(mapped.unwrap()).toBe('HELLO');
    });
  });

  describe('mapError', () => {
    it('should transform error for failed result', () => {
      const originalError = new NotFoundError('User');
      const result = Result.fail<number>(originalError);
      const mapped = result.mapError((err) => new BadRequestError('Transformed'));

      expect(mapped.isFail()).toBe(true);
      expect(mapped.error).toBeInstanceOf(BadRequestError);
      expect(mapped.error?.message).toContain('Transformed');
    });

    it('should return same result for ok result', () => {
      const result = Result.ok(42);
      const mapped = result.mapError((err) => new InternalError());
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(42);
    });
  });

  describe('match', () => {
    it('should call onOk callback for successful result', () => {
      const result = Result.ok(10);
      const value = result.match(
        (n) => n * 2,
        () => 0
      );

      expect(value).toBe(20);
    });

    it('should call onFail callback for failed result', () => {
      const result = Result.fail(new NotFoundError('User'));
      const value = result.match(
        (n) => n * 2,
        (err) => -1
      );

      expect(value).toBe(-1);
    });

    it('should work with different return types', () => {
      const okResult = Result.ok('success');
      const failResult = Result.fail<number>(new InternalError());

      const okValue = okResult.match(
        (s) => ({ status: 'ok', data: s }),
        () => ({ status: 'error' })
      );

      const failValue = failResult.match(
        (n) => ({ status: 'ok', data: n }),
        () => ({ status: 'error' })
      );

      expect(okValue).toEqual({ status: 'ok', data: 'success' });
      expect(failValue).toEqual({ status: 'error' });
    });
  });
});

describe('tryCatch', () => {
  it('should return ok Result for successful function', async () => {
    const result = await tryCatch(async () => ({ id: 1, name: 'Test' }));

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ id: 1, name: 'Test' });
  });

  it('should return fail Result for throwing function', async () => {
    const result = await tryCatch(async () => {
      throw new NotFoundError('User');
    });

    expect(result.isFail()).toBe(true);
    expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('should wrap AppError as-is', async () => {
    const error = new BadRequestError('Invalid input');
    const result = await tryCatch(async () => {
      throw error;
    });

    expect(result.isFail()).toBe(true);
    expect(result.error).toBe(error);
  });

  it('should wrap unknown errors as InternalError', async () => {
    const result = await tryCatch(async () => {
      throw new Error('Unknown error');
    });

    expect(result.isFail()).toBe(true);
    expect(result.error).toBeInstanceOf(InternalError);
  });
});

describe('catchResult decorator', () => {
  it('should be a function', () => {
    expect(typeof catchResult).toBe('function');
  });

  it('should return a function', () => {
    const decorator = catchResult(new BadRequestError('Caught error'));
    expect(typeof decorator).toBe('function');
  });
});

describe('createService', () => {
  it('should be a function', () => {
    expect(typeof createService).toBe('function');
  });

  it('should create a service wrapper', () => {
    class TestService {
      getData() {
        return { data: 'test' };
      }
    }

    const wrappedService = createService(TestService);
    expect(typeof wrappedService).toBe('function');
  });
});
