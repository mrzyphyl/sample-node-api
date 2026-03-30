import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../plugins/auth';
import { requirePermission } from '../middleware/rbac';
import { NotFoundError, ForbiddenError } from '../errors/index';
import { withErrorHandling } from '../middleware/service-wrapper';
import { Permission } from '../enums/index';

export async function folderRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/', {
    preHandler: [requirePermission(Permission.FOLDER_READ)],
    schema: {
      tags: ['Folders'],
      summary: 'List folders',
      querystring: {
        type: 'object',
        properties: {
          parentId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { parentId?: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { parentId } = request.query;

      const folders = await fastify.prisma.folder.findMany({
        where: {
          ownerId: userId,
          parentId: parentId || null,
        },
        include: {
          _count: {
            select: { files: true, children: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      return reply.send({ data: folders, total: folders.length });
    });
  });

  fastify.post('/', {
    preHandler: [requirePermission(Permission.FOLDER_CREATE)],
    schema: {
      tags: ['Folders'],
      summary: 'Create a folder',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { name: string; parentId?: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { name, parentId } = request.body;

      if (parentId) {
        const parent = await fastify.prisma.folder.findFirst({
          where: { id: parentId, ownerId: userId },
        });
        if (!parent) {
          throw new NotFoundError('Parent folder');
        }
      }

      const folder = await fastify.prisma.folder.create({
        data: {
          name,
          parentId,
          ownerId: userId,
        },
      });

      return reply.status(201).send(folder);
    });
  });

  fastify.get('/:id', {
    preHandler: [requirePermission(Permission.FOLDER_READ)],
    schema: {
      tags: ['Folders'],
      summary: 'Get folder by ID',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const folder = await fastify.prisma.folder.findFirst({
        where: {
          id: request.params.id,
          OR: [{ ownerId: userId }, { isPublic: true }],
        },
        include: {
          files: true,
          children: true,
          parent: true,
        },
      });

      if (!folder) {
        throw new NotFoundError('Folder');
      }

      if (folder.ownerId !== userId && !folder.isPublic) {
        throw new ForbiddenError('Access denied to this folder');
      }

      return reply.send(folder);
    });
  });

  fastify.put('/:id', {
    preHandler: [requirePermission(Permission.FOLDER_UPDATE)],
    schema: {
      tags: ['Folders'],
      summary: 'Update folder',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          isPublic: { type: 'boolean' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; isPublic?: boolean } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { name, isPublic } = request.body;

      const folder = await fastify.prisma.folder.findFirst({
        where: { id: request.params.id, ownerId: userId },
      });

      if (!folder) {
        throw new NotFoundError('Folder');
      }

      const updated = await fastify.prisma.folder.update({
        where: { id: request.params.id },
        data: { name, isPublic },
      });

      return reply.send(updated);
    });
  });

  fastify.delete('/:id', {
    preHandler: [requirePermission(Permission.FOLDER_DELETE)],
    schema: {
      tags: ['Folders'],
      summary: 'Delete folder',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;

      const folder = await fastify.prisma.folder.findFirst({
        where: { id: request.params.id, ownerId: userId },
      });

      if (!folder) {
        throw new NotFoundError('Folder');
      }

      await fastify.prisma.folder.delete({
        where: { id: request.params.id },
      });

      return reply.status(204).send();
    });
  });
}
