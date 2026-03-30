import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/', {
    schema: {
      tags: ['Health'],
      summary: 'Basic health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  fastify.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok' });
  });

  fastify.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            database: { type: 'string' },
            redis: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            database: { type: 'string' },
            redis: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    let dbStatus = 'connected';
    let redisStatus = 'connected';

    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'disconnected';
    }

    try {
      await fastify.redis.ping();
    } catch {
      redisStatus = 'disconnected';
    }

    const isReady = dbStatus === 'connected' && redisStatus === 'connected';

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not_ready',
      database: dbStatus,
      redis: redisStatus,
    });
  });
}
