import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { notificationService } from '../services/notification.service';
import { firebaseService } from '../services/firebase.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

/**
 * GET /api/notifications — list notifications for current user
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const data = await notificationService.getForUser(req.user!.id, unreadOnly, limit);
  const unreadCount = await notificationService.getUnreadCount(req.user!.id);
  res.json({ success: true, data, unreadCount });
}));

/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user!.id);
  res.json({ success: true, data: { count } });
}));

/**
 * POST /api/notifications/:id/read — mark as read
 */
router.post('/:id/read', authenticate, asyncHandler(async (req, res) => {
  await notificationService.markAsRead(req.user!.id, req.params.id);
  res.json({ success: true });
}));

/**
 * POST /api/notifications/read-all — mark all as read
 */
router.post('/read-all', authenticate, asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user!.id);
  res.json({ success: true });
}));

/**
 * GET /api/notifications/vapid-public-key — return VAPID public key for Web Push
 */
router.get('/vapid-public-key', (req, res) => {
  const { config: cfg } = require('../config');
  res.json({ success: true, publicKey: cfg.vapid.publicKey });
});

/**
 * POST /api/notifications/device-token — register push token
 * For WEB: body = { platform: 'WEB', endpoint, auth, p256dh }
 * For mobile: body = { platform: 'ANDROID'|'IOS', token }
 */
router.post('/device-token', authenticate, asyncHandler(async (req, res) => {
  const { token, platform, endpoint, auth, p256dh } = req.body;

  if (!['WEB', 'ANDROID', 'IOS'].includes(platform)) {
    return res.status(400).json({ success: false, error: 'Platform invalide (WEB, ANDROID, IOS)' });
  }

  if (platform === 'WEB') {
    if (!endpoint || !auth || !p256dh) {
      return res.status(400).json({ success: false, error: 'endpoint, auth et p256dh requis pour WEB' });
    }
    await firebaseService.registerToken(req.user!.id, endpoint, 'WEB', { auth, p256dh });
  } else {
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token requis' });
    }
    await firebaseService.registerToken(req.user!.id, token, platform);
  }

  res.json({ success: true, message: 'Token enregistré' });
}));

/**
 * DELETE /api/notifications/device-token — remove FCM device token
 */
router.delete('/device-token', authenticate, asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Token requis' });
  }
  await firebaseService.removeToken(token);
  res.json({ success: true, message: 'Token supprimé' });
}));

/**
 * GET /api/notifications/stream — SSE stream
 */
router.get('/stream', authenticate, (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx/OLS buffering
  res.flushHeaders();

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n');

  // Register this client
  notificationService.addClient(req.user!.id, res);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

export default router;
