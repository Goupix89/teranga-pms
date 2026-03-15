import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Role-based access control middleware.
 * Restricts route access to users with specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      logger.warn('RBAC: access denied', {
        userId: req.user?.id,
        tenantId: req.user?.tenantId,
        userRole,
        requiredRoles: allowedRoles,
        method: req.method,
        path: req.path,
        ip: req.ip,
      });

      return next(new ForbiddenError('Vous n\'avez pas les droits nécessaires pour cette action'));
    }

    next();
  };
}

/**
 * Require Super Admin (platform-level) access.
 */
export const requireSuperAdmin = requireRole('SUPERADMIN');

/**
 * Require at least Admin level (establishment admin or above).
 */
export const requireAdmin = requireRole('SUPERADMIN', 'ADMIN');

/**
 * Require at least Manager level access.
 */
export const requireManager = requireRole('SUPERADMIN', 'ADMIN', 'MANAGER');

/**
 * Allow all authenticated users.
 */
export const requireAnyRole = requireRole('SUPERADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE');

/**
 * Middleware to ensure user can only access their own resources
 * (or has elevated role).
 */
export function requireSelfOrRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.params.id || req.params.userId;
    const isOwnResource = req.user?.id === userId;
    const hasRole = req.user?.role && allowedRoles.includes(req.user.role);

    if (!isOwnResource && !hasRole) {
      return next(new ForbiddenError('Accès limité à votre propre profil'));
    }

    next();
  };
}
