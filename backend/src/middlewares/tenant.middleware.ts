import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

// Simple in-memory cache for tenant slug → id resolution
const tenantCache = new Map<string, { id: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Reserved slugs that cannot be used as tenant identifiers
const RESERVED_SLUGS = new Set([
  'api', 'admin', 'www', 'mail', 'app', 'static', 'cdn',
  'auth', 'login', 'signup', 'register', 'dashboard',
  'support', 'help', 'docs', 'status', 'health',
]);

/**
 * Resolves tenant from subdomain.
 * Example: hotelA.platform.com → tenantId for "hotelA"
 */
export function extractTenantFromSubdomain(req: Request, _res: Response, next: NextFunction) {
  const host = req.hostname;
  const parts = host.split('.');

  // Need at least 3 parts: subdomain.platform.tld
  if (parts.length < 3) {
    return next();
  }

  const slug = parts[0].toLowerCase();

  // Validate slug format
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) {
    return next();
  }

  if (RESERVED_SLUGS.has(slug)) {
    return next();
  }

  resolveTenantBySlug(slug)
    .then((tenantId) => {
      if (tenantId) {
        req.tenantId = tenantId;
      }
      next();
    })
    .catch(next);
}

/**
 * Ensures tenantId is set on the request (from JWT or subdomain).
 * Must be placed AFTER auth middleware.
 */
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  // Prefer JWT-derived tenantId (most secure)
  if (req.user?.tenantId) {
    req.tenantId = req.user.tenantId;
    return next();
  }

  // Fallback to subdomain-derived tenantId
  if (req.tenantId) {
    return next();
  }

  return next(new UnauthorizedError('Tenant non identifié'));
}

/**
 * Verify that header X-Tenant-ID matches JWT tenantId.
 * Used by the mobile POS app for additional verification.
 */
export function verifyTenantHeader(req: Request, _res: Response, next: NextFunction) {
  const headerTenantId = req.headers['x-tenant-id'] as string;

  if (headerTenantId && req.user?.tenantId && headerTenantId !== req.user.tenantId) {
    logger.warn('Tenant mismatch: header vs JWT', {
      headerTenantId,
      jwtTenantId: req.user.tenantId,
      userId: req.user.id,
      ip: req.ip,
    });
    return next(new UnauthorizedError('Incohérence de tenant'));
  }

  next();
}

// Helper: resolve slug to tenant ID with caching
async function resolveTenantBySlug(slug: string): Promise<string | null> {
  const cached = tenantCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, isActive: true },
  });

  if (!tenant || !tenant.isActive) {
    return null;
  }

  tenantCache.set(slug, { id: tenant.id, expiresAt: Date.now() + CACHE_TTL_MS });
  return tenant.id;
}
