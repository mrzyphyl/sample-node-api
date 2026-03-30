import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword, generateTokens } from '../utils/helpers';
import { BadRequestError, UnauthorizedError } from '../errors/index';
import { withErrorHandling } from '../middleware/service-wrapper';

export const registerSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
};

export async function authRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; password: string; firstName?: string; lastName?: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { email, password, firstName, lastName } = request.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new BadRequestError('Email already registered');
      }

      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: 'USER',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      return reply.status(201).send({
        ...user,
        message: 'User registered successfully',
      });
    });
  });

  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }

      if (!user.isActive) {
        throw new UnauthorizedError('Account is deactivated');
      }

      const isValidPassword = await verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        throw new UnauthorizedError('Invalid email or password');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const { accessToken, refreshToken } = generateTokens(user.id, fastify);

      await prisma.session.create({
        data: {
          userId: user.id,
          token: accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          userAgent: request.headers['user-agent'],
          ipAddress: request.ip,
        },
      });

      return reply.send({
        accessToken,
        refreshToken,
        expiresIn: 900,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    });
  });

  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const { refreshToken } = request.body;

      const session = await prisma.session.findFirst({
        where: { refreshToken },
        include: { user: true },
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(session.userId, fastify);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      });
    });
  });

  fastify.post('/logout', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout user',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return withErrorHandling(async () => {
      const token = request.headers.authorization?.replace('Bearer ', '');

      if (token) {
        await prisma.session.deleteMany({ where: { token } });
      }

      return reply.send({ message: 'Logged out successfully' });
    });
  });

  await prisma.$disconnect();
}
