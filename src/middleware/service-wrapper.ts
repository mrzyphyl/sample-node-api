import { AppError, InternalError } from '../errors/index';

export type ServiceFn<T = unknown> = (...args: any[]) => Promise<T>;

export async function withErrorHandling<T>(
  serviceFn: ServiceFn<T>,
  fallbackError?: AppError
): Promise<T> {
  try {
    return await serviceFn();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const err = error as Error;
    
    if (err.name === 'PrismaClientKnownRequestError') {
      const prismaError = err as any;
      
      if (prismaError.code === 'P2002') {
        throw new AppError(409, 'A record with this value already exists', 'DUPLICATE_ENTRY');
      }
      if (prismaError.code === 'P2025') {
        throw new AppError(404, 'Record not found', 'NOT_FOUND');
      }
      if (prismaError.code === 'P2003') {
        throw new AppError(400, 'Foreign key constraint failed', 'CONSTRAINT_ERROR');
      }
    }

    if (err.name === 'ValidationError') {
      throw new AppError(400, err.message, 'VALIDATION_ERROR');
    }

    console.error('Unhandled service error:', err);

    if (fallbackError) {
      throw fallbackError;
    }

    throw new InternalError(
      process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message
    );
  }
}

export function createService<T extends object>(
  serviceClass: new (...args: any[]) => T
): new (...args: any[]) => T {
  const handler = {
    get(target: T, prop: keyof T, receiver: any) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value === 'function') {
        return async function (...args: any[]) {
          return withErrorHandling(() => value.apply(target, args));
        };
      }

      return value;
    },
  };

  return new Proxy(serviceClass, handler as any);
}

export class Result<T> {
  private constructor(
    public readonly success: boolean,
    public readonly data?: T,
    public readonly error?: AppError
  ) {}

  static ok<T>(data: T): Result<T> {
    return new Result(true, data);
  }

  static fail<T>(error: AppError): Result<T> {
    return new Result(false, undefined, error);
  }

  isOk(): boolean {
    return this.success;
  }

  isFail(): boolean {
    return !this.success;
  }

  unwrap(): T {
    if (!this.success) {
      throw this.error || new InternalError('Result unwrap failed');
    }
    return this.data as T;
  }

  unwrapOr(defaultValue: T): T {
    return this.success ? (this.data as T) : defaultValue;
  }

  map<U>(fn: (data: T) => U): Result<U> {
    if (this.success) {
      return Result.ok(fn(this.data as T));
    }
    return Result.fail(this.error!);
  }

  mapError(fn: (error: AppError) => AppError): Result<T> {
    if (!this.success) {
      return Result.fail(fn(this.error!));
    }
    return this;
  }

  match<U>(onOk: (data: T) => U, onFail: (error: AppError) => U): U {
    return this.success ? onOk(this.data as T) : onFail(this.error!);
  }
}

export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return Result.ok(data);
  } catch (error) {
    if (error instanceof AppError) {
      return Result.fail(error);
    }

    const err = error as Error;
    return Result.fail(new InternalError(err.message));
  }
}

export function catchResult<T>(
  error: AppError
): (target: T, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return function (
    target: T,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const original = descriptor.value as Function;

    descriptor.value = async function (...args: any[]) {
      try {
        return await original.apply(this, args);
      } catch (e) {
        if (e instanceof AppError) throw e;
        throw error;
      }
    };

    return descriptor;
  };
}
