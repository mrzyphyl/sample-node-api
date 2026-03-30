import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { ZodError as ZodErrorClass } from 'zod';

export function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  request.log.error(error);

  if (error instanceof ZodError) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors,
    });
  }

  if (error.name === 'UnauthorizedError') {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (error.name === 'ForbiddenError') {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Insufficient permissions',
    });
  }

  const statusCode = (error as any).statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  return reply.status(statusCode).send({
    statusCode,
    error: error.name || 'Error',
    message,
  });
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  name = 'UnauthorizedError';
}

export class ForbiddenError extends Error {
  statusCode = 403;
  name = 'ForbiddenError';
}

export class NotFoundError extends Error {
  statusCode = 404;
  name = 'NotFoundError';
}

export class BadRequestError extends Error {
  statusCode = 400;
  name = 'BadRequestError';
}
