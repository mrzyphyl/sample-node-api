import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { requirePermission, requireRole } from '../middleware/rbac';
import { AppError, NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../errors/index';
import { withErrorHandling, Result } from '../middleware/service-wrapper';
import { fileService } from '../services/file.service';
import { Permission, Role } from '../enums/index';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/me', {
    preHandler: [requirePermission(Permission.USER_READ)],
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: (request.user as any).id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User');
      }

      return reply.send(user);
    });
  });

  fastify.put('/me', {
    preHandler: [requirePermission(Permission.USER_UPDATE)],
    schema: {
      tags: ['Users'],
      summary: 'Update current user profile',
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { firstName?: string; lastName?: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { firstName, lastName } = request.body;

      const user = await fastify.prisma.user.update({
        where: { id: (request.user as any).id },
        data: { firstName, lastName },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      return reply.send(user);
    });
  });

  fastify.put('/password', {
    preHandler: [requirePermission(Permission.USER_UPDATE)],
    schema: {
      tags: ['Users'],
      summary: 'Change password',
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', minLength: 6 },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { currentPassword: string; newPassword: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { currentPassword, newPassword } = request.body;
      const userId = (request.user as any).id;

      if (currentPassword === newPassword) {
        throw new BadRequestError('New password must be different from current password');
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundError('User');
      }

      const { verifyPassword } = await import('../utils/helpers');
      const isValid = await verifyPassword(currentPassword, user.passwordHash);

      if (!isValid) {
        throw new BadRequestError('Current password is incorrect');
      }

      const { hashPassword } = await import('../utils/helpers');
      const passwordHash = await hashPassword(newPassword);

      await fastify.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return reply.send({ message: 'Password updated successfully' });
    });
  });

  fastify.delete('/me', {
    preHandler: [requirePermission(Permission.USER_DELETE)],
    schema: {
      tags: ['Users'],
      summary: 'Delete current user account',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const userId = (request.user as any).id;

      await fastify.prisma.user.delete({
        where: { id: userId },
      });

      return reply.status(204).send();
    });
  });

  fastify.get('/roles', {
    preHandler: [requireRole(Role.ADMIN, Role.SUPER_ADMIN)],
    schema: {
      tags: ['Users'],
      summary: 'List all users (Admin only)',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          role: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number; role?: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { page = 1, limit = 20, role } = request.query;

      const where: any = {};
      if (role && Object.values(Role).includes(role as Role)) {
        where.role = role;
      }

      const [users, total] = await Promise.all([
        fastify.prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        fastify.prisma.user.count({ where }),
      ]);

      return reply.send({
        data: users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    });
  });

  fastify.get('/roles/:userId', {
    preHandler: [requireRole(Role.ADMIN, Role.SUPER_ADMIN)],
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID (Admin only)',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.params.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User');
      }

      return reply.send(user);
    });
  });

  fastify.put('/roles/:userId', {
    preHandler: [requireRole(Role.ADMIN, Role.SUPER_ADMIN)],
    schema: {
      tags: ['Users'],
      summary: 'Update user role (Admin only)',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['ADMIN', 'EDITOR', 'USER', 'GUEST'] },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { userId: string }; Body: { role: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { userId } = request.params;
      const { role } = request.body;

      const requestingUser = (request.user as any);

      if (userId === requestingUser.id) {
        throw new BadRequestError('Cannot change your own role');
      }

      const targetUser = await fastify.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!targetUser) {
        throw new NotFoundError('User');
      }

      if (targetUser.role === Role.SUPER_ADMIN) {
        throw new ForbiddenError('Cannot modify SUPER_ADMIN role');
      }

      if (requestingUser.role !== Role.SUPER_ADMIN && role === Role.ADMIN) {
        throw new ForbiddenError('Only SUPER_ADMIN can assign ADMIN role');
      }

      const updatedUser = await fastify.prisma.user.update({
        where: { id: userId },
        data: { role: role as Role },
        select: {
          id: true,
          email: true,
          role: true,
          updatedAt: true,
        },
      });

      return reply.send(updatedUser);
    });
  });
}
