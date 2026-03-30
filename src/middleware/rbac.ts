import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../errors/index';
import { Permission, Role, rolePermissions } from '../enums/index';

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { id?: string; role?: Role } | undefined;

    if (!user || !user.role) {
      throw new ForbiddenError('User role not found');
    }

    const userPermissions = rolePermissions[user.role];

    if (!userPermissions) {
      throw new ForbiddenError('Invalid user role');
    }

    if (!userPermissions.includes(permission)) {
      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }
  };
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { id?: string; role?: Role } | undefined;

    if (!user || !user.role) {
      throw new ForbiddenError('User role not found');
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenError(`Required role: ${roles.join(' or ')}`);
    }
  };
}
