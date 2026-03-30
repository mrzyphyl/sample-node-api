import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/index';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
