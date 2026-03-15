import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { loginSchema, refreshSchema } from '../validators';

const router = Router();

/**
 * POST /api/auth/login
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token manquant' });
    }

    const result = await authService.refresh(refreshToken);

    res.json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout-all
 * Revoke all sessions for the current user.
 */
router.post('/logout-all', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logoutAll(req.user!.id);

    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.json({ success: true, message: 'Toutes les sessions ont été révoquées' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current user profile.
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../utils/prisma');
    const user = await prisma.user.findFirst({
      where: { id: req.user!.id, tenantId: req.user!.tenantId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true,
        tenantId: true,
        tenant: { select: { slug: true } },
        memberships: {
          where: { isActive: true },
          select: {
            establishmentId: true,
            role: true,
            establishment: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    }

    res.json({
      success: true,
      data: {
        ...user,
        tenantSlug: user.tenant.slug,
        memberships: user.memberships.map((m) => ({
          establishmentId: m.establishmentId,
          establishmentName: m.establishment.name,
          role: m.role,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
