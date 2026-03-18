import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { TokenPayload } from '../types';
import { UnauthorizedError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export class AuthService {
  /**
   * Authenticate user and return tokens.
   */
  async login(email: string, password: string, meta: { ip?: string; userAgent?: string } = {}) {
    // Find user — we search across all tenants by email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { tenant: { select: { id: true, isActive: true, slug: true } } },
    });

    // Constant-time comparison even if user doesn't exist (prevent timing attack)
    const dummyHash = '$2b$12$LJ3m4ys3Lz0MgRtTSqMhJeJY7N3vI8XjNmKqKxD01p1Fz2hRdKOy';
    const hash = user?.passwordHash ?? dummyHash;
    const validPassword = await bcrypt.compare(password, hash);

    // Generic error — don't reveal whether email exists
    if (!user || !validPassword) {
      // Increment failed attempts if user exists
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            ...(attempts >= MAX_FAILED_ATTEMPTS && { status: 'LOCKED' }),
          },
        });

        if (attempts >= MAX_FAILED_ATTEMPTS) {
          logger.warn('Account locked due to failed attempts', {
            userId: user.id,
            tenantId: user.tenantId,
            attempts,
          });
        }
      }

      throw new UnauthorizedError('Identifiants invalides');
    }

    // Check account status
    if (user.status === 'PENDING_APPROVAL') {
      throw new UnauthorizedError('Votre compte est en attente de validation par un administrateur.');
    }

    if (user.status === 'LOCKED') {
      throw new UnauthorizedError('Compte verrouillé. Contactez votre administrateur.');
    }

    if (user.status === 'ARCHIVED') {
      throw new UnauthorizedError('Ce compte a été archivé.');
    }

    // Check tenant is active
    if (!user.tenant.isActive) {
      throw new UnauthorizedError('Le compte de votre organisation est suspendu.');
    }

    // Generate access token
    const payload: TokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });

    // Generate refresh token (opaque, stored hashed in DB)
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        tenantId: user.tenantId,
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ip,
        expiresAt: new Date(Date.now() + config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000),
      },
    });

    // Reset failed login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    // Load active memberships
    const memberships = await prisma.establishmentMember.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        establishmentId: true,
        role: true,
        establishment: { select: { id: true, name: true } },
      },
    });

    logger.info('User logged in', {
      userId: user.id,
      tenantId: user.tenantId,
      ip: meta.ip,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
        memberships: memberships.map(m => ({
          establishmentId: m.establishmentId,
          establishmentName: m.establishment.name,
          role: m.role,
        })),
      },
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refresh(refreshToken: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: {
        user: {
          select: { id: true, tenantId: true, role: true, status: true },
        },
      },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Session expirée. Veuillez vous reconnecter.');
    }

    if (stored.user.status !== 'ACTIVE') {
      // Revoke the token
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revoked: true },
      });
      throw new UnauthorizedError('Compte inactif');
    }

    // Generate new access token
    const payload: TokenPayload = {
      sub: stored.user.id,
      tenantId: stored.user.tenantId,
      role: stored.user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiry,
    });

    // Update last active
    prisma.user.update({
      where: { id: stored.user.id },
      data: { lastActiveAt: new Date() },
    }).catch(() => {});

    return { accessToken };
  }

  /**
   * Revoke a refresh token (logout).
   */
  async logout(refreshToken: string) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.updateMany({
      where: { tokenHash: hash },
      data: { revoked: true },
    });
  }

  /**
   * Revoke all refresh tokens for a user (force logout everywhere).
   */
  async logoutAll(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Hash a password using bcrypt.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.bcrypt.saltRounds);
  }
}

export const authService = new AuthService();
