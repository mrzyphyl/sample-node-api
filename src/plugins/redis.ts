import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import { cacheService } from '../services/cache.service';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    cache: typeof cacheService;
  }
}

export async function redisPlugin(fastify: FastifyInstance): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    fastify.log.info('Redis connected');
  } catch (error) {
    fastify.log.error('Redis connection failed', error);
    throw error;
  }

  fastify.decorate('redis', redis);
  fastify.decorate('cache', cacheService);

  fastify.addHook('onClose', async () => {
    await redis.quit();
    fastify.log.info('Redis disconnected');
  });
}

export default fp(redisPlugin, {
  name: 'redis',
});
