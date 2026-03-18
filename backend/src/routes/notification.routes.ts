import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { notificationService } from '../services/notification.service';

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
