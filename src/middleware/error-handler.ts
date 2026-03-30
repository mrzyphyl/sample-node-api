import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError, ERROR_MESSAGES } from '../errors/index';
import { logError } from '../utils/logger';

const { JESS_ERROR } = ERROR_MESSAGES;

interface ErrorResponse {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId: string;
  path: string;
}

export function createErrorHandler(fastify: FastifyInstance) {
  return function globalErrorHandler(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply
  ): void {
    const requestId = request.id;
    const timestamp = new Date().toISOString();

    if (error instanceof AppError) {
      const response: ErrorResponse = {
        statusCode: error.statusCode,
        error: {
          code: error.code || 'ERROR',
          message: error.message,
          details: error.details,
        },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: error.statusCode,
      });

      reply.status(error.statusCode).send(response);
      return;
    }

    if (error instanceof ZodError) {
      const response: ErrorResponse = {
        statusCode: 400,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Request validation failed. ${JESS_ERROR}`,
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: 400,
      });

      reply.status(400).send(response);
      return;
    }

    if (error.name === 'UnauthorizedError' || error.message.includes('Unauthorized')) {
      const response: ErrorResponse = {
        statusCode: 401,
        error: {
          code: 'UNAUTHORIZED',
          message: `Invalid or expired authentication token. ${JESS_ERROR}`,
        },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, { requestId, method: request.method, url: request.url });

      reply.status(401).send(response);
      return;
    }

    if (error.name === 'ForbiddenError') {
      const response: ErrorResponse = {
        statusCode: 403,
        error: {
          code: 'FORBIDDEN',
          message: `You do not have permission to access this resource. ${JESS_ERROR}`,
        },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, { requestId, method: request.method, url: request.url });

      reply.status(403).send(response);
      return;
    }

    const isPrismaError = error.name === 'PrismaClientKnownRequestError' || error.name === 'PrismaClientValidationError';
    
    if (isPrismaError) {
      const prismaError = error as any;
      let statusCode = 400;
      let message = `Database operation failed. ${JESS_ERROR}`;
      let code = 'DATABASE_ERROR';

      if (prismaError.code === 'P2002') {
        statusCode = 409;
        message = `A record with this value already exists. ${JESS_ERROR}`;
        code = 'DUPLICATE_ENTRY';
      } else if (prismaError.code === 'P2025') {
        statusCode = 404;
        message = `Record not found. ${JESS_ERROR}`;
        code = 'NOT_FOUND';
      }

      const response: ErrorResponse = {
        statusCode,
        error: { code, message },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, { requestId, method: request.method, url: request.url });

      reply.status(statusCode).send(response);
      return;
    }

    if (error.name === 'SyntaxError' && 'body' in error) {
      const response: ErrorResponse = {
        statusCode: 400,
        error: {
          code: 'INVALID_JSON',
          message: `Invalid JSON in request body. ${JESS_ERROR}`,
        },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, { requestId, method: request.method, url: request.url });

      reply.status(400).send(response);
      return;
    }

    const isFastifyValidation = error.validation || error.validationContext;

    if (isFastifyValidation) {
      const response: ErrorResponse = {
        statusCode: 400,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Request validation failed. ${JESS_ERROR}`,
          details: error.validation,
        },
        timestamp,
        requestId,
        path: request.url,
      };

      logError(error, {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: 400,
      });

      reply.status(400).send(response);
      return;
    }

    const statusCode = (error as any).statusCode || 500;
    const response: ErrorResponse = {
      statusCode,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? `An unexpected error occurred. ${JESS_ERROR}`
          : `${error.message}. ${JESS_ERROR}`,
      },
      timestamp,
      requestId,
      path: request.url,
    };

    logError(error, {
      requestId,
      method: request.method,
      url: request.url,
      statusCode,
    });

    if (process.env.NODE_ENV !== 'production') {
      (response.error as any).stack = error.stack;
    }

    reply.status(statusCode).send(response);
  };
}
