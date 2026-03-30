import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export async function prismaPlugin(fastify: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    await prisma.$connect();
    fastify.log.info({ msg: 'Database connected', url: process.env.SUPABASE_URL });
  } catch (error) {
    fastify.log.error({ msg: 'Database connection failed', error });
    throw error;
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
    fastify.log.info('Database disconnected');
  });
}

export default fp(prismaPlugin, {
  name: 'prisma',
});
