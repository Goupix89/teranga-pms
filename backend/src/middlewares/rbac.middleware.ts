import { Request, Response, NextFunction } from 'express';
import { UserRole, EstablishmentRole } from '@prisma/client';
import { ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Tenant-level role check (SUPERADMIN only at this level).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      logger.warn('RBAC: tenant role denied', {
        userId: req.user?.id,
        userRole,
        requiredRoles: allowedRoles,
        method: req.method,
        path: req.path,
      });
      return next(new ForbiddenError('Vous n\'avez pas les droits nécessaires pour cette action'));
    }

    next();
  };
}

/**
 * Establishment-level role check.
 * SUPERADMIN bypasses all establishment role checks.
 *
 * Determines the target establishment from:
 * 1. req.params.establishmentId
 * 2. req.body.establishmentId
 * 3. req.query.establishmentId
 *
 * If no establishment specified, checks if user has the role in ANY of their establishments.
 */
export function requireEstablishmentRole(...allowedRoles: EstablishmentRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // SUPERADMIN bypasses
    if (req.user?.role === 'SUPERADMIN') {
      return next();
    }

    const memberships = req.user?.memberships || [];

    // Determine target establishment
    const establishmentId =
      req.params.establishmentId ||
      req.body?.establishmentId ||
      (req.query?.establishmentId as string);

    if (establishmentId) {
      // Check role in the specific establishment
      const membership = memberships.find(
        (m) => m.establishmentId === establishmentId
      );

      if (!membership || !allowedRoles.includes(membership.role)) {
        logger.warn('RBAC: establishment role denied', {
          userId: req.user?.id,
          establishmentId,
          userRole: membership?.role,
          requiredRoles: allowedRoles,
          method: req.method,
          path: req.path,
        });
        return next(new ForbiddenError('Vous n\'avez pas les droits nécessaires dans cet établissement'));
      }
    } else {
      // No specific establishment — check if user has the role in ANY establishment
      const hasRole = memberships.some((m) => allowedRoles.includes(m.role));
      if (!hasRole) {
        logger.warn('RBAC: no matching establishment role', {
          userId: req.user?.id,
          requiredRoles: allowedRoles,
          method: req.method,
          path: req.path,
        });
        return next(new ForbiddenError('Vous n\'avez pas les droits nécessaires pour cette action'));
      }
    }

    next();
  };
}

// ─── Tenant-level shortcuts ────────────────────────────────────────────────────

export const requireSuperAdmin = requireRole('SUPERADMIN');

/** All authenticated users (SUPERADMIN + any establishment member) */
export function requireAuthenticated(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ForbiddenError('Authentification requise'));
  }
  next();
}

// ─── Establishment-level shortcuts ─────────────────────────────────────────────

/** OWNER only (establishment proprietor) */
export const requireOwner = requireEstablishmentRole('OWNER');

/** OWNER or DAF (establishment admin) */
export const requireDAF = requireEstablishmentRole('OWNER', 'DAF');

/** OWNER, DAF or Manager */
export const requireDAFOrManager = requireEstablishmentRole('OWNER', 'DAF', 'MANAGER');

/** OWNER, DAF, Manager, or Server */
export const requireDAFOrManagerOrServer = requireEstablishmentRole('OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER');

/** OWNER, DAF, Manager, Server, POS (payment-related operations) */
export const requirePaymentRole = requireEstablishmentRole('OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS');

/** Cook + kitchen supervisors */
export const requireKitchenAccess = requireEstablishmentRole('OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'COOK');

/** Cleaning staff + supervisors */
export const requireCleaningAccess = requireEstablishmentRole('OWNER', 'DAF', 'MANAGER', 'CLEANER');

/** All establishment roles (any member) */
export const requireAnyEstablishmentRole = requireEstablishmentRole('OWNER', 'DAF', 'MANAGER', 'MAITRE_HOTEL', 'SERVER', 'POS', 'COOK', 'CLEANER');

/**
 * Helper: get user's role in a specific establishment.
 */
export function getEstablishmentRole(req: Request, establishmentId: string): EstablishmentRole | null {
  if (req.user?.role === 'SUPERADMIN') return 'OWNER'; // SUPERADMIN treated as OWNER everywhere
  return req.user?.memberships?.find((m) => m.establishmentId === establishmentId)?.role || null;
}

/**
 * Middleware to ensure user can only access their own resources
 * (or has DAF/SUPERADMIN role).
 */
export function requireSelfOrRole(...allowedEstRoles: EstablishmentRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.params.id || req.params.userId;
    const isOwnResource = req.user?.id === userId;

    if (isOwnResource) return next();

    // SUPERADMIN can access anything
    if (req.user?.role === 'SUPERADMIN') return next();

    // Check if user has an allowed establishment role
    const memberships = req.user?.memberships || [];
    const hasRole = memberships.some((m) => allowedEstRoles.includes(m.role));

    if (!hasRole) {
      return next(new ForbiddenError('Accès limité à votre propre profil'));
    }

    next();
  };
}
