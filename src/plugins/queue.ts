import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Queue, Worker } from 'bullmq';
import { conversionWorker } from '../workers/conversion.worker';

declare module 'fastify' {
  interface FastifyInstance {
    conversionQueue: Queue;
  }
}

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export async function queuePlugin(fastify: FastifyInstance): Promise<void> {
  const conversionQueue = new Queue('conversion', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 7200,
      },
    },
  });

  new Worker('conversion', conversionWorker, {
    connection,
    concurrency: 5,
  });

  fastify.decorate('conversionQueue', conversionQueue);

  fastify.addHook('onClose', async () => {
    await conversionQueue.close();
    fastify.log.info('Queue disconnected');
  });
}

export default fp(queuePlugin, {
  name: 'queue',
});
