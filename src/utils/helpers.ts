import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { FastifyInstance } from 'fastify';
import { hash, compare } from 'bcryptjs';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const parts = hash.split('.');
    if (parts.length !== 2) {
      return false;
    }
    const [hashedPassword, salt] = parts;
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(Buffer.from(hashedPassword, 'hex'), buf);
  } catch {
    return false;
  }
}

export function generateTokens(userId: string, fastify: FastifyInstance) {
  const accessToken = fastify.jwt.sign({ sub: userId, type: 'access' });
  const refreshToken = randomBytes(64).toString('hex');
  
  return { accessToken, refreshToken };
}

export function verifyToken(token: string, fastify: FastifyInstance) {
  try {
    return fastify.jwt.verify(token);
  } catch {
    return null;
  }
}
