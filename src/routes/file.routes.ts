import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { FileService } from '../services/file.service';
import { authenticate } from '../plugins/auth';
import { requirePermission } from '../middleware/rbac';
import { NotFoundError } from '../errors/index';
import { withErrorHandling } from '../middleware/service-wrapper';
import { Permission } from '../enums/index';

export async function fileRoutes(fastify: FastifyInstance) {
  const fileService = new FileService(fastify.prisma);

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', {
    preHandler: [requirePermission(Permission.FILE_READ)],
    schema: {
      tags: ['Files'],
      summary: 'List user files',
      querystring: {
        type: 'object',
        properties: {
          folderId: { type: 'string' },
          fileType: { type: 'string', enum: ['PDF', 'IMAGE', 'WORD', 'OTHER'] },
          search: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { folderId, fileType, search, page, limit } = request.query;

      const result = await fileService.listFiles(userId, { folderId, fileType, search, page, limit });

      return reply.send(result);
    });
  });

  fastify.post('/', {
    preHandler: [requirePermission(Permission.FILE_UPLOAD)],
    schema: {
      tags: ['Files'],
      summary: 'Upload a file',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const data = await request.file();

      if (!data) {
        throw new NotFoundError('File');
      }

      const buffer = await data.toBuffer();
      const file = {
        buffer,
        originalname: data.filename,
        mimetype: data.mimetype,
      };

      const uploadedFile = await fileService.upload(file, userId);

      return reply.status(201).send(uploadedFile);
    });
  });

  fastify.get('/:id', {
    preHandler: [requirePermission(Permission.FILE_READ)],
    schema: {
      tags: ['Files'],
      summary: 'Get file by ID',
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
      const file = await fileService.getFile(request.params.id, userId);

      if (!file) {
        throw new NotFoundError('File');
      }

      return reply.send(file);
    });
  });

  fastify.delete('/:id', {
    preHandler: [requirePermission(Permission.FILE_DELETE)],
    schema: {
      tags: ['Files'],
      summary: 'Delete a file',
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
      await fileService.deleteFile(request.params.id, userId);

      return reply.status(204).send();
    });
  });

  fastify.get('/:id/download', {
    preHandler: [requirePermission(Permission.FILE_DOWNLOAD)],
    schema: {
      tags: ['Files'],
      summary: 'Get download URL',
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
      const url = await fileService.getDownloadUrl(request.params.id, userId);

      return reply.send({ url });
    });
  });
}
