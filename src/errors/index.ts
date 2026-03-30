const JESS_ERROR_MESSAGE = 'Jess ano ba naman yan Jess, Wala bang sasagot sa mga tao mo?';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found. ${JESS_ERROR_MESSAGE}`, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = `Authentication required. ${JESS_ERROR_MESSAGE}`) {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = `Access denied. ${JESS_ERROR_MESSAGE}`) {
    super(403, message, 'FORBIDDEN');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, `${message}. ${JESS_ERROR_MESSAGE}`, 'BAD_REQUEST', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, `${message}. ${JESS_ERROR_MESSAGE}`, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, `${message}. ${JESS_ERROR_MESSAGE}`, 'VALIDATION_ERROR', details);
  }
}

export class InternalError extends AppError {
  constructor(message = `Internal server error. ${JESS_ERROR_MESSAGE}`) {
    super(500, message, 'INTERNAL_ERROR');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = `Service temporarily unavailable. ${JESS_ERROR_MESSAGE}`) {
    super(503, message, 'SERVICE_UNAVAILABLE');
  }
}

export const ERROR_MESSAGES = {
  JESS_ERROR: JESS_ERROR_MESSAGE,
} as const;
