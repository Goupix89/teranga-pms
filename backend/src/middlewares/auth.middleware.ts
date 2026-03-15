import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { TokenPayload } from '../types';
import { UnauthorizedError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

/**
 * JWT Authentication Middleware
 * Extracts and verifies the Bearer token from Authorization header.
 * Loads establishment memberships for role-based access control.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token d\'authentification manquant'));
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };

    // Set tenantId on request for convenience
    req.tenantId = payload.tenantId;

    // SUPERADMIN has full access — no establishment filtering needed
    if (payload.role === 'SUPERADMIN') {
      return next();
    }

    // Load user's establishment memberships with roles
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        memberships: {
          where: { isActive: true },
          select: { establishmentId: true, role: true },
        },
      },
    });

    const memberships = user?.memberships || [];
    req.user.memberships = memberships;
    req.user.establishmentIds = memberships.map((m) => m.establishmentId);

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token expiré'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Token invalide'));
    }
    next(err);
  }
}

/**
 * API Key Authentication Middleware
 * For channel manager integrations (external bookings).
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return next(new UnauthorizedError('API Key manquante'));
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { tenant: true },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive || apiKeyRecord.expiresAt < new Date()) {
      return next(new UnauthorizedError('API Key invalide ou expirée'));
    }

    const allowedIps = apiKeyRecord.allowedIps as string[];
    if (allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      if (!allowedIps.includes(clientIp)) {
        logger.warn('API Key used from unauthorized IP', {
          tenantId: apiKeyRecord.tenantId,
          ip: clientIp,
          keyPrefix: apiKeyRecord.prefix,
        });
        return next(new UnauthorizedError('Accès refusé depuis cette adresse IP'));
      }
    }

    prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    req.tenantId = apiKeyRecord.tenantId;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication — doesn't fail if no token present.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };
    req.tenantId = payload.tenantId;
  } catch {
    // Silently ignore invalid tokens
  }

  next();
}
