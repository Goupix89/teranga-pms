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
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth',
    });

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
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
    const { userService } = await import('../services/crud.service');
    const user = await userService.getById(req.user!.tenantId, req.user!.id);

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
