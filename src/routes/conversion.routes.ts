import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ConversionStatus } from '@prisma/client';
import { authenticate } from '../plugins/auth';
import { requirePermission } from '../middleware/rbac';
import { NotFoundError } from '../errors/index';
import { withErrorHandling } from '../middleware/service-wrapper';
import { Permission } from '../enums/index';

export async function conversionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.post('/pdf-to-word', {
    preHandler: [requirePermission(Permission.CONVERSION_PDF_TO_WORD)],
    schema: {
      tags: ['Conversions'],
      summary: 'Convert PDF to Word',
      body: {
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { fileId: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { fileId } = request.body;

      const file = await fastify.prisma.file.findFirst({
        where: { id: fileId, ownerId: userId, fileType: 'PDF' },
      });

      if (!file) {
        throw new NotFoundError('PDF file');
      }

      const job = await fastify.prisma.conversionJob.create({
        data: {
          userId,
          sourceFileId: fileId,
          targetFormat: 'DOCX',
          status: ConversionStatus.PENDING,
        },
      });

      await fastify.conversionQueue.add('convert', {
        jobId: job.id,
        userId,
        sourceFileId: fileId,
        targetFormat: 'DOCX',
      });

      return reply.status(202).send({
        jobId: job.id,
        status: job.status,
        message: 'Conversion job queued',
      });
    });
  });

  fastify.post('/image-to-word', {
    preHandler: [requirePermission(Permission.CONVERSION_IMAGE_TO_WORD)],
    schema: {
      tags: ['Conversions'],
      summary: 'Convert Image to Word',
      body: {
        type: 'object',
        required: ['fileId'],
        properties: {
          fileId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { fileId: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { fileId } = request.body;

      const file = await fastify.prisma.file.findFirst({
        where: { id: fileId, ownerId: userId, fileType: 'IMAGE' },
      });

      if (!file) {
        throw new NotFoundError('Image file');
      }

      const job = await fastify.prisma.conversionJob.create({
        data: {
          userId,
          sourceFileId: fileId,
          targetFormat: 'DOCX',
          status: ConversionStatus.PENDING,
        },
      });

      await fastify.conversionQueue.add('convert', {
        jobId: job.id,
        userId,
        sourceFileId: fileId,
        targetFormat: 'DOCX',
      });

      return reply.status(202).send({
        jobId: job.id,
        status: job.status,
        message: 'Conversion job queued',
      });
    });
  });

  fastify.get('/', {
    preHandler: [requirePermission(Permission.CONVERSION_PDF_TO_WORD)],
    schema: {
      tags: ['Conversions'],
      summary: 'List conversion jobs',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;
      const { status, page = 1, limit = 20 } = request.query;

      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      const [jobs, total] = await Promise.all([
        fastify.prisma.conversionJob.findMany({
          where,
          include: {
            sourceFile: {
              select: { id: true, name: true, originalName: true },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        fastify.prisma.conversionJob.count({ where }),
      ]);

      return reply.send({
        data: jobs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    });
  });

  fastify.get('/:jobId', {
    preHandler: [requirePermission(Permission.CONVERSION_PDF_TO_WORD)],
    schema: {
      tags: ['Conversions'],
      summary: 'Get conversion job status',
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;

      const job = await fastify.prisma.conversionJob.findFirst({
        where: { id: request.params.jobId, userId },
        include: {
          sourceFile: {
            select: { id: true, name: true, originalName: true },
          },
        },
      });

      if (!job) {
        throw new NotFoundError('Conversion job');
      }

      return reply.send(job);
    });
  });

  fastify.get('/:jobId/download', {
    preHandler: [requirePermission(Permission.CONVERSION_PDF_TO_WORD)],
    schema: {
      tags: ['Conversions'],
      summary: 'Download converted file',
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;

      const job = await fastify.prisma.conversionJob.findFirst({
        where: { id: request.params.jobId, userId },
        include: {
          sourceFile: true,
        },
      });

      if (!job) {
        throw new NotFoundError('Conversion job');
      }

      if (job.status !== ConversionStatus.COMPLETED) {
        throw new NotFoundError('Converted file not ready');
      }

      const { data: fileData, error } = await fastify.supabase.storage
        .from(process.env.SUPABASE_BUCKET!)
        .download(job.resultPath!);

      if (error || !fileData) {
        throw new NotFoundError('Converted file not found');
      }

      const buffer = await fileData.arrayBuffer();
      const fileName = job.sourceFile 
        ? `${job.sourceFile.originalName.replace(/\.[^.]+$/, '')}_converted.docx`
        : 'converted.docx';

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', `attachment; filename="${fileName}"`)
        .send(Buffer.from(buffer));
    });
  });
}
