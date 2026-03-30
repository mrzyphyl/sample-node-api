import { FastifyInstance, FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
    controllerName?: string;
  }
}

export function analyticsMiddleware(fastify: FastifyInstance) {
  return async function trackRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    request.startTime = Date.now();

    reply.addHook('onSend', async () => {
      const responseTime = Date.now() - (request.startTime || Date.now());
      const userId = (request.user as { id?: string } | undefined)?.id;

      try {
        await analyticsService.trackRequest(
          request.method,
          request.url,
          reply.statusCode,
          responseTime,
          userId
        );

        if (responseTime > 2000) {
          logger.warn({
            message: 'Slow request detected',
            method: request.method,
            url: request.url,
            responseTime,
            controller: request.controllerName,
            userId,
          });
        }

        if (reply.statusCode >= 500) {
          logger.error({
            message: 'Server error occurred',
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            responseTime,
            controller: request.controllerName,
          });
        }
      } catch (error) {
        logger.error({
          message: 'Failed to track analytics',
          error,
        });
      }
    });

    reply.addHook('onError', async (request, reply, error) => {
      const responseTime = Date.now() - (request.startTime || Date.now());
      const userId = (request.user as { id?: string } | undefined)?.id;

      logger.error({
        message: 'Request failed with error',
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime,
        controller: request.controllerName,
        userId,
        error: error.message,
        stack: error.stack,
      });

      try {
        await analyticsService.trackRequest(
          request.method,
          request.url,
          reply.statusCode || 500,
          responseTime,
          userId
        );
      } catch (trackError) {
        logger.error({ message: 'Failed to track error analytics', trackError });
      }
    });
  };
}

export function controller(name: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      const req = args[0] as FastifyRequest;
      if (req && typeof req === 'object') {
        req.controllerName = name;
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}
