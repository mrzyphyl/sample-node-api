import { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import { prismaPlugin } from '../plugins/prisma';
import { redisPlugin } from '../plugins/redis';
import { queuePlugin } from '../plugins/queue';
import { docsPlugin } from '../plugins/docs';
import supabasePlugin from '../plugins/supabase';
import { createErrorHandler } from '../middleware/error-handler';
import { createRequestLogger } from '../utils/logger';
import { analyticsMiddleware } from '../middleware/analytics';
import { analyticsRoutes } from '../routes/analytics.routes';
import { authRoutes } from '../routes/auth.routes';
import { userRoutes } from '../routes/user.routes';
import { fileRoutes } from '../routes/file.routes';
import { folderRoutes } from '../routes/folder.routes';
import { conversionRoutes } from '../routes/conversion.routes';
import { healthRoutes } from '../routes/health.routes';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
      ...(isDevelopment && !isProduction
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(queuePlugin);
  await app.register(supabasePlugin);

  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || 
    (isDevelopment ? ['http://localhost:3000', 'http://localhost:8080'] : []);

  await app.register(fastifyCors, {
    origin: isProduction ? corsOrigins : '*',
    credentials: true,
  });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: Number(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
    },
  });

  const rateLimitConfig = isProduction
    ? { max: 100, timeWindow: '1 minute' }
    : { max: 1000, timeWindow: '1 minute' };

  await app.register(fastifyRateLimit, {
    ...rateLimitConfig,
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
  });

  if (!isProduction || process.env.ENABLE_DOCS === 'true') {
    await app.register(docsPlugin);
  }

  app.setErrorHandler(createErrorHandler(app));

  app.addHook('onRequest', createRequestLogger());
  app.addHook('preHandler', analyticsMiddleware(app));

  await app.register(healthRoutes, { prefix: '/api/v1/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(fileRoutes, { prefix: '/api/v1/files' });
  await app.register(folderRoutes, { prefix: '/api/v1/folders' });
  await app.register(conversionRoutes, { prefix: '/api/v1/conversions' });
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });

  app.log.info(`Environment: ${process.env.NODE_ENV}`);
  app.log.info(`Docs enabled: ${!isProduction || process.env.ENABLE_DOCS === 'true'}`);

  return app;
}

export { isProduction, isDevelopment };
